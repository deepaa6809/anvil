/**
 * Anvil Hub — Production tool registry server
 *
 * Architecture:
 *   server.ts     → boot + routing (this file)
 *   handlers.ts   → endpoint logic
 *   auth.ts       → token auth + scoping
 *   middleware.ts  → rate limit, CORS, logging, body parsing
 *   validation.ts → Zod schemas for API inputs
 *   db.ts         → SQLite schema + metadata extraction
 *
 * ENV:
 *   PORT         (default: 4400)
 *   DATA_DIR     (default: ./data)
 *   ADMIN_TOKEN  (default: anvil-admin-dev)
 *   SEED         (set "true" to seed example packages)
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createDB, hashToken, extractMetadata } from './db.js';
import { createAuth } from './auth.js';
import { createHandlers } from './handlers.js';
import { setCORS, rateLimit, getIP, logRequest, json } from './middleware.js';

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '4400', 10);
const DATA_DIR = process.env['DATA_DIR'] ?? './data';
const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] ?? 'anvil-admin-dev';
const SEED = process.env['SEED'] === 'true';

// ─── Boot ───────────────────────────────────────────────────────────────────

const db = createDB(DATA_DIR);
db.prepare('INSERT OR IGNORE INTO tokens (token_hash, owner, scopes, created_at) VALUES (?, ?, ?, ?)')
  .run(hashToken(ADMIN_TOKEN), 'admin', 'admin', new Date().toISOString());

const auth = createAuth(db, ADMIN_TOKEN);
const h = createHandlers(db, auth);

// ─── Routes ─────────────────────────────────────────────────────────────────

type Fn = (req: any, res: any, url: URL, m: RegExpMatchArray) => void | Promise<void>;
const R: Array<{ m: string; re: RegExp; fn: Fn; w?: boolean }> = [
  { m: 'GET',    re: /^\/health$/,                                                   fn: h.health },
  { m: 'GET',    re: /^\/api\/v1\/stats$/,                                           fn: h.stats },
  { m: 'GET',    re: /^\/api\/v1\/featured$/,                                        fn: h.featured },
  { m: 'GET',    re: /^\/api\/v1\/search$/,                                          fn: h.search },
  { m: 'POST',   re: /^\/api\/v1\/packages$/,                                        fn: h.publish, w: true },
  { m: 'GET',    re: /^\/api\/v1\/packages\/([^/]+)$/,                                fn: h.getPkg },
  { m: 'DELETE', re: /^\/api\/v1\/packages\/([^/]+)$/,                                fn: h.deletePkg, w: true },
  { m: 'GET',    re: /^\/api\/v1\/packages\/([^/]+)\/versions$/,                      fn: h.listVersions },
  { m: 'GET',    re: /^\/api\/v1\/packages\/([^/]+)\/definition$/,                    fn: h.getDefinition },
  { m: 'GET',    re: /^\/api\/v1\/packages\/([^/]+)\/versions\/([^/]+)\/definition$/, fn: h.getVersionDefinition },
  { m: 'POST',   re: /^\/api\/v1\/tokens$/,                                          fn: h.createToken, w: true },
];

// ─── Server ─────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const ip = getIP(req);
  const url = new URL(req.url ?? '/', 'http://localhost');

  for (const r of R) {
    if (req.method !== r.m) continue;
    const match = url.pathname.match(r.re);
    if (!match) continue;
    if (!rateLimit(ip, r.w ? 20 : 120)) {
      res.setHeader('Retry-After', '60');
      json(res, { error: 'Rate limit exceeded' }, 429);
      logRequest(req.method, url.pathname, 429, Date.now() - start);
      return;
    }
    try { await r.fn(req, res, url, match); }
    catch (e) { console.error(e); json(res, { error: 'Internal server error' }, 500); }
    logRequest(req.method, url.pathname, res.statusCode, Date.now() - start);
    return;
  }
  json(res, { error: 'Not found' }, 404);
  logRequest(req.method ?? '?', url.pathname, 404, Date.now() - start);
});

const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Seed ───────────────────────────────────────────────────────────────────

if (SEED) {
  const exDir = join(process.cwd(), '..', '..', 'examples');
  for (const name of ['weather', 'github', 'postgres', 'linear', 'browser', 'filesystem']) {
    const file = join(exDir, name, 'tools.anvil.yaml');
    if (!existsSync(file)) continue;
    const yaml = readFileSync(file, 'utf-8');
    const meta = extractMetadata(yaml);
    const pkgName = meta.name || `${name}-tools`;
    if (db.prepare('SELECT 1 FROM packages WHERE name = ?').get(pkgName)) continue;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO packages (name, version, description, author_name, tags, tool_count, tool_names, agent_descriptions, when_to_use, downloads_weekly, downloads_total, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,0,0,?,?,?)`)
      .run(pkgName, meta.version || '1.0.0', meta.description, 'anvil-team', JSON.stringify(meta.tags), meta.toolCount, JSON.stringify(meta.toolNames), JSON.stringify(meta.agentDescriptions), JSON.stringify(meta.whenToUse), ['weather','github','postgres'].includes(name)?1:0, now, now);
    db.prepare('INSERT INTO versions (package_name, version, definition, integrity, published_at) VALUES (?,?,?,?,?)')
      .run(pkgName, meta.version||'1.0.0', yaml, createHash('sha256').update(yaml).digest('hex'), now);
    console.log(`  Seeded: ${pkgName} (${meta.toolCount} tools)`);
  }
}

// ─── Start ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const c = (db.prepare('SELECT COUNT(*) as c FROM packages').get() as { c: number }).c;
  console.log(`\n  Anvil Hub · http://localhost:${PORT} · ${c} packages`);
  if (ADMIN_TOKEN === 'anvil-admin-dev') {
    console.log(`\n  WARNING: Using default ADMIN_TOKEN.`);
    console.log(`  Set ADMIN_TOKEN env var before deploying to production.\n`);
  } else {
    console.log();
  }
});
