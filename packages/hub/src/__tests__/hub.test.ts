import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDB, hashToken, extractMetadata, compareSemver, type PackageRow } from '../db.js';
import { validateDefinition, publishSchema, createTokenSchema, searchSchema } from '../validation.js';
import { createAuth } from '../auth.js';
import { createHandlers, fmtPkg } from '../handlers.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const VALID_YAML = `
anvil: "1.0"

service:
  name: test-tools
  version: "2.1.0"
  description: A test service
  tags: [test, demo]

tools:
  get_data:
    description: Get data
    agent:
      description: |
        Use this to retrieve data records.
        Best for lookups.
      when_to_use:
        - User asks for data
        - Agent needs records
      tips:
        - Use specific IDs
    parameters:
      id:
        type: string
        required: true
    side_effects: read
    tags: [lookup]

  set_data:
    description: Set data
    agent:
      description: Use this to update data records.
      when_to_use:
        - User wants to modify data
    parameters:
      id:
        type: string
        required: true
      value:
        type: string
        required: true
    side_effects: write
`;

const YAML_V2 = VALID_YAML.replace('version: "2.1.0"', 'version: "2.2.0"');

// ─── extractMetadata ────────────────────────────────────────────────────────

describe('extractMetadata', () => {
  it('extracts service name and version', () => {
    const m = extractMetadata(VALID_YAML);
    expect(m.name).toBe('test-tools');
    expect(m.version).toBe('2.1.0');
  });

  it('extracts description', () => {
    expect(extractMetadata(VALID_YAML).description).toBe('A test service');
  });

  it('extracts tool names and count', () => {
    const m = extractMetadata(VALID_YAML);
    expect(m.toolNames).toEqual(['get_data', 'set_data']);
    expect(m.toolCount).toBe(2);
  });

  it('extracts multi-line and single-line agent descriptions', () => {
    const m = extractMetadata(VALID_YAML);
    expect(m.agentDescriptions['get_data']).toContain('retrieve data records');
    expect(m.agentDescriptions['set_data']).toContain('update data records');
  });

  it('extracts when_to_use from all tools', () => {
    const m = extractMetadata(VALID_YAML);
    expect(m.whenToUse).toContain('User asks for data');
    expect(m.whenToUse).toContain('User wants to modify data');
  });

  it('deduplicates when_to_use entries', () => {
    const yaml = VALID_YAML.replace('User wants to modify data', 'User asks for data');
    const m = extractMetadata(yaml);
    expect(m.whenToUse.filter(w => w === 'User asks for data')).toHaveLength(1);
  });

  it('extracts and deduplicates tags from service and tools', () => {
    const m = extractMetadata(VALID_YAML);
    expect(m.tags).toContain('test');
    expect(m.tags).toContain('demo');
    expect(m.tags).toContain('lookup');
    expect(new Set(m.tags).size).toBe(m.tags.length);
  });

  it('handles YAML with no tools section', () => {
    const m = extractMetadata('anvil: "1.0"\nservice:\n  name: x\n  version: "1.0.0"');
    expect(m.toolCount).toBe(0);
    expect(m.toolNames).toEqual([]);
  });

  it('handles YAML with no agent descriptions', () => {
    const m = extractMetadata('anvil: "1.0"\nservice:\n  name: x\n  version: "1.0.0"\ntools:\n  simple:\n    description: No agent block');
    expect(m.toolNames).toEqual(['simple']);
    expect(Object.keys(m.agentDescriptions)).toHaveLength(0);
  });
});

// ─── validateDefinition ─────────────────────────────────────────────────────

describe('validateDefinition', () => {
  it('accepts valid YAML', () => {
    expect(validateDefinition(VALID_YAML)).toEqual([]);
  });

  it('rejects missing anvil version', () => {
    expect(validateDefinition('service:\n  name: x\n  version: "1.0.0"\ntools:\n  a:\n    d: x').some(e => e.includes('anvil'))).toBe(true);
  });

  it('rejects missing service name', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  version: "1.0.0"\ntools:\n  a:\n    d: x').some(e => e.includes('name'))).toBe(true);
  });

  it('rejects invalid service name (uppercase)', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  name: INVALID\n  version: "1.0.0"\ntools:\n  a:\n    d: x').some(e => e.includes('lowercase'))).toBe(true);
  });

  it('rejects missing version', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  name: x\ntools:\n  a:\n    d: x').some(e => e.includes('version'))).toBe(true);
  });

  it('rejects invalid version (not semver)', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  name: x\n  version: "abc"\ntools:\n  a:\n    d: x').some(e => e.includes('semver'))).toBe(true);
  });

  it('rejects empty tools section', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  name: x\n  version: "1.0.0"\ntools:\n  # nothing').some(e => e.includes('No tools'))).toBe(true);
  });

  it('rejects missing tools section entirely', () => {
    expect(validateDefinition('anvil: "1.0"\nservice:\n  name: x\n  version: "1.0.0"').some(e => e.includes('tools'))).toBe(true);
  });
});

// ─── Zod schemas ────────────────────────────────────────────────────────────

describe('publishSchema', () => {
  it('accepts valid publish body', () => {
    const r = publishSchema.safeParse({ definition: VALID_YAML });
    expect(r.success).toBe(true);
  });

  it('rejects missing definition', () => {
    expect(publishSchema.safeParse({}).success).toBe(false);
  });

  it('rejects definition that is too short', () => {
    expect(publishSchema.safeParse({ definition: 'hi' }).success).toBe(false);
  });

  it('accepts optional fields', () => {
    const r = publishSchema.safeParse({
      definition: VALID_YAML,
      readme: '# Hello',
      tags: ['api', 'test'],
      license: 'MIT',
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid repository URL', () => {
    expect(publishSchema.safeParse({ definition: VALID_YAML, repository: 'not-a-url' }).success).toBe(false);
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    expect(publishSchema.safeParse({ definition: VALID_YAML, tags }).success).toBe(false);
  });
});

describe('searchSchema', () => {
  it('accepts empty params', () => {
    expect(searchSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and per_page', () => {
    const r = searchSchema.parse({ page: '3', per_page: '50' });
    expect(r.page).toBe(3);
    expect(r.per_page).toBe(50);
  });

  it('rejects invalid sort', () => {
    expect(searchSchema.safeParse({ sort: 'invalid' }).success).toBe(false);
  });
});

describe('createTokenSchema', () => {
  it('has defaults', () => {
    const r = createTokenSchema.parse({});
    expect(r.owner).toBe('user');
    expect(r.scopes).toBe('publish');
  });

  it('accepts admin scope', () => {
    expect(createTokenSchema.parse({ scopes: 'admin' }).scopes).toBe('admin');
  });
});

// ─── compareSemver ──────────────────────────────────────────────────────────

describe('compareSemver', () => {
  it('major', () => { expect(compareSemver('2.0.0', '1.0.0')).toBe(1); expect(compareSemver('1.0.0', '2.0.0')).toBe(-1); });
  it('minor', () => { expect(compareSemver('1.2.0', '1.1.0')).toBe(1); });
  it('patch', () => { expect(compareSemver('1.0.2', '1.0.1')).toBe(1); });
  it('equal', () => { expect(compareSemver('1.2.3', '1.2.3')).toBe(0); });
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe('auth', () => {
  let db: Database.Database;
  let auth: ReturnType<typeof createAuth>;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'anvil-auth-test-'));
    db = createDB(tmpDir);
    auth = createAuth(db, 'test-admin-token');
  });

  afterAll(() => { db.close(); rmSync(tmpDir, { recursive: true, force: true }); });

  it('authenticates admin token', () => {
    const req = { headers: { authorization: 'Bearer test-admin-token' } } as any;
    const id = auth.authenticate(req);
    expect(id).not.toBeNull();
    expect(id!.owner).toBe('admin');
    expect(id!.scopes).toBe('admin');
  });

  it('rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer wrong' } } as any;
    expect(auth.authenticate(req)).toBeNull();
  });

  it('rejects missing header', () => {
    const req = { headers: {} } as any;
    expect(auth.authenticate(req)).toBeNull();
  });

  it('creates and authenticates user token', () => {
    const token = auth.createToken('alice', 'publish');
    expect(token).toMatch(/^avt_/);

    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const id = auth.authenticate(req);
    expect(id).not.toBeNull();
    expect(id!.owner).toBe('alice');
    expect(id!.scopes).toBe('publish');
  });

  it('revokes token', () => {
    const token = auth.createToken('bob', 'publish');
    auth.revokeToken(hashToken(token));

    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    expect(auth.authenticate(req)).toBeNull();
  });
});

// ─── Database layer ─────────────────────────────────────────────────────────

describe('createDB', () => {
  let tmpDir: string;

  beforeAll(() => { tmpDir = mkdtempSync(join(tmpdir(), 'anvil-db-test-')); });
  afterAll(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates database with all tables', () => {
    const db = createDB(tmpDir);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toContain('packages');
    expect(tables).toContain('versions');
    expect(tables).toContain('tokens');
    db.close();
  });

  it('inserts and retrieves a package', () => {
    const db = createDB(tmpDir);
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO packages (name, version, description, author_name, tags, tool_count, tool_names, agent_descriptions, when_to_use, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('test-pkg', '1.0.0', 'Test', 'user', '["t"]', 1, '["a"]', '{}', '[]', 0, now, now);
    const row = db.prepare('SELECT * FROM packages WHERE name = ?').get('test-pkg') as any;
    expect(row.name).toBe('test-pkg');
    expect(row.version).toBe('1.0.0');
    db.close();
  });

  it('enforces unique package names', () => {
    const db = createDB(tmpDir);
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO packages (name, version, description, author_name, tags, tool_count, tool_names, agent_descriptions, when_to_use, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('unique-test', '1.0.0', 'First', 'a', '[]', 0, '[]', '{}', '[]', 0, now, now);
    db.prepare('INSERT OR REPLACE INTO packages (name, version, description, author_name, tags, tool_count, tool_names, agent_descriptions, when_to_use, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('unique-test', '2.0.0', 'Second', 'b', '[]', 0, '[]', '{}', '[]', 0, now, now);
    const row = db.prepare('SELECT version FROM packages WHERE name = ?').get('unique-test') as any;
    expect(row.version).toBe('2.0.0');
    db.close();
  });

  it('cascade deletes versions when package deleted', () => {
    const db = createDB(tmpDir);
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO packages (name, version, description, author_name, tags, tool_count, tool_names, agent_descriptions, when_to_use, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('del-test', '1.0.0', 'X', 'a', '[]', 0, '[]', '{}', '[]', 0, now, now);
    db.prepare('INSERT INTO versions (package_name, version, definition, integrity, published_at) VALUES (?,?,?,?,?)')
      .run('del-test', '1.0.0', 'yaml', 'hash', now);
    db.prepare('DELETE FROM packages WHERE name = ?').run('del-test');
    const ver = db.prepare('SELECT * FROM versions WHERE package_name = ?').get('del-test');
    expect(ver).toBeUndefined();
    db.close();
  });
});

// ─── hashToken ──────────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('produces consistent SHA-256', () => {
    expect(hashToken('x')).toBe(hashToken('x'));
    expect(hashToken('x')).toHaveLength(64);
  });
  it('different inputs → different hashes', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

// ─── fmtPkg ─────────────────────────────────────────────────────────────────

describe('fmtPkg', () => {
  it('formats a package row correctly', () => {
    const row: PackageRow = {
      name: 'test', version: '1.0.0', description: 'desc',
      author_name: 'alice', author_email: 'a@b.com',
      repository: 'https://gh.com/x', license: 'MIT',
      tags: '["a","b"]', tool_count: 2, tool_names: '["x","y"]',
      agent_descriptions: '{"x":"desc"}', when_to_use: '["scenario"]',
      downloads_weekly: 5, downloads_total: 100, featured: 1,
      created_at: '2025-01-01', updated_at: '2025-01-02',
    };
    const f = fmtPkg(row);
    expect(f.name).toBe('test');
    expect(f.tags).toEqual(['a', 'b']);
    expect(f.tool_names).toEqual(['x', 'y']);
    expect(f.agent_descriptions).toEqual({ x: 'desc' });
    expect(f.featured).toBe(true);
    expect(f.downloads.total).toBe(100);
    expect(f.author.email).toBe('a@b.com');
  });

  it('handles malformed JSON gracefully', () => {
    const row: PackageRow = {
      name: 'x', version: '1.0.0', description: '',
      author_name: '', author_email: null,
      repository: null, license: null,
      tags: 'INVALID', tool_count: 0, tool_names: 'INVALID',
      agent_descriptions: 'INVALID', when_to_use: 'INVALID',
      downloads_weekly: 0, downloads_total: 0, featured: 0,
      created_at: '', updated_at: '',
    };
    const f = fmtPkg(row);
    expect(f.tags).toEqual([]);
    expect(f.tool_names).toEqual([]);
    expect(f.agent_descriptions).toEqual({});
    expect(f.when_to_use).toEqual([]);
  });
});
