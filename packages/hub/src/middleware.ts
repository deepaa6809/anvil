/**
 * HTTP middleware: rate limiting, CORS, logging, body parsing.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ─── Rate Limiter ───────────────────────────────────────────────────────────

const buckets = new Map<string, { count: number; reset: number }>();
const WINDOW = 60_000;

export function rateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) { buckets.set(ip, { count: 1, reset: now + WINDOW }); return true; }
  return ++b.count <= limit;
}

export function getIP(req: IncomingMessage): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.socket.remoteAddress ?? 'unknown';
}

// ─── CORS ───────────────────────────────────────────────────────────────────

export function setCORS(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Powered-By', 'anvil-hub');
}

// ─── Logging ────────────────────────────────────────────────────────────────

export function logRequest(method: string, path: string, status: number, ms: number): void {
  process.stdout.write(`${new Date().toISOString()} ${method} ${path} ${status} ${ms}ms\n`);
}

// ─── Body Parser ────────────────────────────────────────────────────────────

const MAX_BODY = 2 * 1024 * 1024; // 2MB

export function readBody(req: IncomingMessage, maxSize = MAX_BODY): Promise<unknown | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) { req.destroy(); resolve(null); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// ─── Response Helpers ───────────────────────────────────────────────────────

export function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function yaml(res: ServerResponse, content: string): void {
  res.writeHead(200, { 'Content-Type': 'text/yaml' });
  res.end(content);
}
