/**
 * Authentication and token management.
 *
 * Tokens are stored as SHA-256 hashes. The plaintext is never persisted.
 * Scopes: "admin" (full access), "publish" (publish only).
 * Each token tracks its last_used timestamp.
 */

import type { IncomingMessage } from 'node:http';
import type Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { hashToken } from './db.js';

export interface AuthIdentity {
  owner: string;
  scopes: string;
}

export function createAuth(db: Database.Database, adminToken: string) {
  const stmts = {
    get: db.prepare('SELECT owner, scopes FROM tokens WHERE token_hash = ?'),
    touch: db.prepare('UPDATE tokens SET last_used = ? WHERE token_hash = ?'),
    insert: db.prepare('INSERT INTO tokens (token_hash, owner, scopes, created_at) VALUES (?, ?, ?, ?)'),
    revoke: db.prepare('DELETE FROM tokens WHERE token_hash = ?'),
  };

  return {
    /** Extract and verify token from Authorization header. */
    authenticate(req: IncomingMessage): AuthIdentity | null {
      const header = req.headers.authorization;
      if (!header) return null;
      const token = header.startsWith('Bearer ') ? header.slice(7) : header;

      // Admin shortcut
      if (token === adminToken) return { owner: 'admin', scopes: 'admin' };

      const hash = hashToken(token);
      const row = stmts.get.get(hash) as AuthIdentity | undefined;
      if (row) stmts.touch.run(new Date().toISOString(), hash);
      return row ?? null;
    },

    /** Create a new scoped token. Returns the plaintext token (show once). */
    createToken(owner: string, scopes: string): string {
      const token = 'avt_' + randomBytes(24).toString('hex');
      stmts.insert.run(hashToken(token), owner, scopes, new Date().toISOString());
      return token;
    },

    /** Revoke a token by its hash. */
    revokeToken(hash: string): void {
      stmts.revoke.run(hash);
    },
  };
}
