/**
 * SQLite database layer for the Anvil Hub.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface PackageRow {
  name: string;
  version: string;
  description: string;
  author_name: string;
  author_email: string | null;
  repository: string | null;
  license: string | null;
  tags: string;
  tool_count: number;
  tool_names: string;
  agent_descriptions: string; // JSON: { tool_name: description }
  when_to_use: string;        // JSON: combined when_to_use from all tools
  downloads_weekly: number;
  downloads_total: number;
  featured: number;
  created_at: string;
  updated_at: string;
}

export function createDB(dataDir: string): Database.Database {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'hub.db'));

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      name TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      author_email TEXT,
      repository TEXT,
      license TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      tool_count INTEGER NOT NULL DEFAULT 0,
      tool_names TEXT NOT NULL DEFAULT '[]',
      agent_descriptions TEXT NOT NULL DEFAULT '{}',
      when_to_use TEXT NOT NULL DEFAULT '[]',
      downloads_weekly INTEGER NOT NULL DEFAULT 0,
      downloads_total INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      package_name TEXT NOT NULL,
      version TEXT NOT NULL,
      definition TEXT NOT NULL,
      readme TEXT,
      integrity TEXT NOT NULL,
      published_at TEXT NOT NULL,
      PRIMARY KEY (package_name, version),
      FOREIGN KEY (package_name) REFERENCES packages(name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT 'publish',
      created_at TEXT NOT NULL,
      last_used TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_packages_updated ON packages(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_packages_downloads ON packages(downloads_total DESC);
    CREATE INDEX IF NOT EXISTS idx_packages_featured ON packages(featured DESC, downloads_total DESC);
  `);

  return db;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Parse an Anvil YAML definition and extract structured metadata.
 * Lightweight parser — no external deps, works on the raw YAML text.
 */
export function extractMetadata(yaml: string): {
  name: string;
  version: string;
  description: string;
  toolNames: string[];
  agentDescriptions: Record<string, string>;
  whenToUse: string[];
  tags: string[];
  toolCount: number;
} {
  const get = (pattern: RegExp) => yaml.match(pattern)?.[1]?.trim() ?? '';

  const name = get(/^\s+name:\s+(.+)$/m);
  const version = get(/^\s+version:\s+"?([^"\s]+)"?$/m);
  const description = get(/^\s+description:\s+(.+)$/m);

  // Extract tool names from top-level `tools:` block
  const toolNames: string[] = [];
  const agentDescriptions: Record<string, string> = {};
  const whenToUse: string[] = [];
  const tags: string[] = [];

  // Service-level tags
  const serviceTagsMatch = yaml.match(/^\s+tags:\s*\[([^\]]*)\]/m);
  if (serviceTagsMatch?.[1]) {
    tags.push(...serviceTagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean));
  }

  // Parse tools section
  const toolsIdx = yaml.indexOf('\ntools:');
  if (toolsIdx !== -1) {
    const toolsSection = yaml.slice(toolsIdx);
    const toolRe = /^  ([a-z][a-z0-9_]*):\s*$/gm;
    let match;

    while ((match = toolRe.exec(toolsSection)) !== null) {
      const toolName = match[1]!;
      toolNames.push(toolName);

      // Find agent.description for this tool
      const toolStart = match.index;
      const nextToolMatch = toolsSection.slice(toolStart + match[0].length).match(/^  [a-z]/m);
      const toolBlock = nextToolMatch
        ? toolsSection.slice(toolStart, toolStart + match[0].length + nextToolMatch.index!)
        : toolsSection.slice(toolStart);

      // Agent description (may be multi-line with |)
      const agentDescMatch = toolBlock.match(/agent:\s*\n\s+description:\s*\|?\s*\n((?:\s{8,}.+\n?)*)/);
      if (agentDescMatch?.[1]) {
        agentDescriptions[toolName] = agentDescMatch[1].replace(/^\s{8,}/gm, '').trim();
      } else {
        const simpleAgentDesc = toolBlock.match(/agent:\s*\n\s+description:\s+(.+)/);
        if (simpleAgentDesc?.[1]) {
          agentDescriptions[toolName] = simpleAgentDesc[1].trim();
        }
      }

      // when_to_use entries
      const wtuMatch = toolBlock.match(/when_to_use:\s*\n((?:\s+-\s+.+\n?)*)/);
      if (wtuMatch?.[1]) {
        const entries = wtuMatch[1].match(/^\s+-\s+(.+)$/gm);
        if (entries) {
          whenToUse.push(...entries.map(e => e.replace(/^\s+-\s+/, '').replace(/['"]/g, '').trim()));
        }
      }

      // Tool-level tags
      const toolTagsMatch = toolBlock.match(/^\s{4}tags:\s*\[([^\]]*)\]/m);
      if (toolTagsMatch?.[1]) {
        tags.push(...toolTagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean));
      }
    }
  }

  return {
    name,
    version,
    description,
    toolNames,
    agentDescriptions,
    whenToUse: [...new Set(whenToUse)],
    tags: [...new Set(tags)],
    toolCount: toolNames.length,
  };
}

/**
 * Compare two semver strings. Returns -1, 0, or 1.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
