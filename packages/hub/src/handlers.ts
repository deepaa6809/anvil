/**
 * Route handlers — each handles one API endpoint.
 * Pure functions that receive typed dependencies, not globals.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { PackageRow } from './db.js';
import { extractMetadata, compareSemver } from './db.js';
import { publishSchema, createTokenSchema, searchSchema, validateDefinition } from './validation.js';
import { json, yaml as yamlRes, readBody } from './middleware.js';
import type { createAuth } from './auth.js';

type Auth = ReturnType<typeof createAuth>;

// ─── Package formatting ─────────────────────────────────────────────────────

function safeJSON(s: string, fallback: unknown) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export function fmtPkg(row: PackageRow) {
  return {
    name: row.name,
    version: row.version,
    description: row.description,
    author: { name: row.author_name, email: row.author_email },
    repository: row.repository,
    license: row.license,
    tags: safeJSON(row.tags, []),
    tool_count: row.tool_count,
    tool_names: safeJSON(row.tool_names, []),
    agent_descriptions: safeJSON(row.agent_descriptions, {}),
    when_to_use: safeJSON(row.when_to_use, []),
    downloads: { weekly: row.downloads_weekly, total: row.downloads_total },
    featured: row.featured > 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Handler Factory ────────────────────────────────────────────────────────

export function createHandlers(db: Database.Database, auth: Auth) {
  // Prepared statements — reused per request for performance
  const S = {
    getPkg: db.prepare('SELECT * FROM packages WHERE name = ?'),
    upsertPkg: db.prepare(`
      INSERT INTO packages (name, version, description, author_name, author_email, repository, license, tags, tool_count, tool_names, agent_descriptions, when_to_use, downloads_weekly, downloads_total, featured, created_at, updated_at)
      VALUES (@name, @version, @description, @author, @email, @repository, @license, @tags, @tool_count, @tool_names, @agent_descriptions, @when_to_use, 0, 0, 0, @now, @now)
      ON CONFLICT(name) DO UPDATE SET
        version=@version, description=@description, tags=@tags, tool_count=@tool_count,
        tool_names=@tool_names, agent_descriptions=@agent_descriptions, when_to_use=@when_to_use, updated_at=@now
        WHERE author_name=@author OR @is_admin=1`),
    insertVer: db.prepare('INSERT OR REPLACE INTO versions (package_name, version, definition, readme, integrity, published_at) VALUES (?, ?, ?, ?, ?, ?)'),
    getVer: db.prepare('SELECT definition FROM versions WHERE package_name = ? AND version = ?'),
    listVers: db.prepare('SELECT version, integrity, published_at FROM versions WHERE package_name = ? ORDER BY published_at DESC'),
    incDl: db.prepare('UPDATE packages SET downloads_total = downloads_total + 1, downloads_weekly = downloads_weekly + 1 WHERE name = ?'),
    deletePkg: db.prepare('DELETE FROM packages WHERE name = ?'),
    countPkgs: db.prepare('SELECT COUNT(*) as c FROM packages'),
    countVers: db.prepare('SELECT COUNT(*) as c FROM versions'),
    totalDl: db.prepare('SELECT COALESCE(SUM(downloads_total),0) as c FROM packages'),
    featured: db.prepare('SELECT * FROM packages ORDER BY featured DESC, downloads_total DESC LIMIT 12'),
  };

  return {
    health(_req: IncomingMessage, res: ServerResponse) {
      json(res, { status: 'ok', packages: (S.countPkgs.get() as { c: number }).c });
    },

    stats(_req: IncomingMessage, res: ServerResponse) {
      json(res, {
        packages: (S.countPkgs.get() as { c: number }).c,
        versions: (S.countVers.get() as { c: number }).c,
        downloads: (S.totalDl.get() as { c: number }).c,
      });
    },

    featured(_req: IncomingMessage, res: ServerResponse) {
      json(res, { packages: (S.featured.all() as PackageRow[]).map(fmtPkg) });
    },

    async publish(req: IncomingMessage, res: ServerResponse) {
      const identity = auth.authenticate(req);
      if (!identity) return json(res, { error: 'Authentication required. Run: anvil login --token <token>' }, 401);

      const raw = await readBody(req);
      if (!raw) return json(res, { error: 'Invalid JSON or body too large (max 2MB)' }, 400);

      const parsed = publishSchema.safeParse(raw);
      if (!parsed.success) {
        return json(res, { error: `Validation: ${parsed.error.issues.map(i => i.message).join('; ')}` }, 400);
      }

      const { definition, readme, repository, license, tags } = parsed.data;
      const defErrors = validateDefinition(definition);
      if (defErrors.length > 0) {
        return json(res, { error: `Invalid YAML: ${defErrors.join('. ')}` }, 400);
      }

      const meta = extractMetadata(definition);

      // Ownership check: only the original publisher or admin can update
      const existing = S.getPkg.get(meta.name) as PackageRow | undefined;
      if (existing) {
        if (existing.author_name !== identity.owner && !identity.scopes.includes('admin')) {
          return json(res, { error: `Package "${meta.name}" is owned by "${existing.author_name}". Only the owner or an admin can publish updates.` }, 403);
        }
        if (compareSemver(meta.version, existing.version) <= 0) {
          return json(res, { error: `Version ${meta.version} must be newer than ${existing.version}.` }, 409);
        }
      }

      const now = new Date().toISOString();
      const integrity = createHash('sha256').update(definition).digest('hex');

      S.upsertPkg.run({
        name: meta.name, version: meta.version, description: meta.description,
        author: identity.owner, email: parsed.data.author_email ?? null,
        repository: repository ?? null, license: license ?? null,
        tags: JSON.stringify(tags ?? meta.tags),
        tool_count: meta.toolCount, tool_names: JSON.stringify(meta.toolNames),
        agent_descriptions: JSON.stringify(meta.agentDescriptions),
        when_to_use: JSON.stringify(meta.whenToUse),
        is_admin: identity.scopes.includes('admin') ? 1 : 0,
        now,
      });

      S.insertVer.run(meta.name, meta.version, definition, readme ?? null, integrity, now);

      const pkg = S.getPkg.get(meta.name) as PackageRow;
      json(res, fmtPkg(pkg), 201);
    },

    getPkg(_req: IncomingMessage, res: ServerResponse, _u: URL, m: RegExpMatchArray) {
      const name = decodeURIComponent(m[1]!);
      const pkg = S.getPkg.get(name) as PackageRow | undefined;
      if (!pkg) return json(res, { error: `Package "${name}" not found` }, 404);
      S.incDl.run(name);
      json(res, fmtPkg(pkg));
    },

    deletePkg(req: IncomingMessage, res: ServerResponse, _u: URL, m: RegExpMatchArray) {
      const identity = auth.authenticate(req);
      if (!identity?.scopes.includes('admin')) return json(res, { error: 'Admin required' }, 403);
      S.deletePkg.run(decodeURIComponent(m[1]!));
      json(res, { deleted: decodeURIComponent(m[1]!) });
    },

    listVersions(_req: IncomingMessage, res: ServerResponse, _u: URL, m: RegExpMatchArray) {
      json(res, { versions: S.listVers.all(decodeURIComponent(m[1]!)) });
    },

    getDefinition(_req: IncomingMessage, res: ServerResponse, _u: URL, m: RegExpMatchArray) {
      const name = decodeURIComponent(m[1]!);
      const pkg = S.getPkg.get(name) as PackageRow | undefined;
      if (!pkg) return json(res, { error: 'Package not found' }, 404);
      const ver = S.getVer.get(name, pkg.version) as { definition: string } | undefined;
      if (!ver) return json(res, { error: 'Definition not found' }, 404);
      S.incDl.run(name);
      yamlRes(res, ver.definition);
    },

    getVersionDefinition(_req: IncomingMessage, res: ServerResponse, _u: URL, m: RegExpMatchArray) {
      const ver = S.getVer.get(decodeURIComponent(m[1]!), m[2]!) as { definition: string } | undefined;
      if (!ver) return json(res, { error: 'Version not found' }, 404);
      yamlRes(res, ver.definition);
    },

    search(_req: IncomingMessage, res: ServerResponse, url: URL) {
      const p = searchSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!p.success) return json(res, { error: 'Invalid search params' }, 400);
      const { q, tags: rawTags, sort, page, per_page: perPage } = p.data;
      const tagFilter = rawTags.split(',').filter(Boolean);
      const offset = (page - 1) * perPage;

      let where = '1=1';
      const params: unknown[] = [];
      if (q) {
        where += ' AND (name LIKE ? OR description LIKE ? OR tool_names LIKE ? OR agent_descriptions LIKE ? OR when_to_use LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }
      for (const tag of tagFilter) {
        where += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
      }

      const orderBy = sort === 'updated' ? 'updated_at DESC' : sort === 'created' ? 'created_at DESC' : sort === 'name' ? 'name ASC' : sort === 'featured' ? 'featured DESC, downloads_total DESC' : 'downloads_total DESC';

      const total = (db.prepare(`SELECT COUNT(*) as c FROM packages WHERE ${where}`).get(...params) as { c: number }).c;
      const rows = db.prepare(`SELECT * FROM packages WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, perPage, offset) as PackageRow[];
      json(res, { packages: rows.map(fmtPkg), total, page, per_page: perPage });
    },

    async createToken(req: IncomingMessage, res: ServerResponse) {
      const identity = auth.authenticate(req);
      if (!identity?.scopes.includes('admin')) return json(res, { error: 'Admin required' }, 403);
      const raw = await readBody(req);
      const p = createTokenSchema.safeParse(raw ?? {});
      if (!p.success) return json(res, { error: 'Invalid request' }, 400);
      const token = auth.createToken(p.data.owner, p.data.scopes);
      json(res, { token, owner: p.data.owner, scopes: p.data.scopes }, 201);
    },
  };
}
