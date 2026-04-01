/**
 * Local File-based Registry
 *
 * Stores packages in ~/.anvil/registry/ for offline development.
 * Implements the same Registry interface as the hosted client.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type {
  Registry,
  RegistryPackage,
  PublishRequest,
  SearchQuery,
  SearchResult,
  RegistryVersion,
} from './types.js';

export class LocalRegistry implements Registry {
  private root: string;

  constructor(root?: string) {
    this.root = root ?? join(homedir(), '.anvil', 'registry');
  }

  private pkgDir(name: string): string {
    return join(this.root, name.replace(/\//g, '__'));
  }

  private metaPath(name: string): string {
    return join(this.pkgDir(name), 'meta.json');
  }

  private defPath(name: string, version: string): string {
    return join(this.pkgDir(name), `${version}.anvil.yaml`);
  }

  async publish(req: PublishRequest): Promise<RegistryPackage> {
    const dir = this.pkgDir(req.name);
    await mkdir(dir, { recursive: true });

    const integrity = createHash('sha256').update(req.definition).digest('hex');
    const now = new Date().toISOString();

    let existing: RegistryPackage | null = null;
    try {
      existing = JSON.parse(await readFile(this.metaPath(req.name), 'utf-8'));
    } catch {
      // New package
    }

    const toolNames = extractToolNames(req.definition);
    const newVersion: RegistryVersion = {
      version: req.version,
      anvil_version: '1.0',
      tool_names: toolNames,
      published_at: now,
      integrity,
    };

    const pkg: RegistryPackage = {
      name: req.name,
      version: req.version,
      description: extractDescription(req.definition),
      versions: [...(existing?.versions ?? []), newVersion],
      author: { name: 'local' },
      tool_count: toolNames.length,
      targets: [],
      tags: req.tags ?? [],
      downloads: { weekly: 0, total: 0 },
      created_at: existing?.created_at ?? now,
      updated_at: now,
      repository: req.repository,
      license: req.license,
    };

    await writeFile(this.metaPath(req.name), JSON.stringify(pkg, null, 2));
    await writeFile(this.defPath(req.name, req.version), req.definition);

    if (req.readme) {
      await writeFile(join(dir, 'README.md'), req.readme);
    }

    return pkg;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const packages: RegistryPackage[] = [];

    try {
      const dirs = await readdir(this.root);
      for (const dir of dirs) {
        try {
          const meta = JSON.parse(
            await readFile(join(this.root, dir, 'meta.json'), 'utf-8'),
          ) as RegistryPackage;

          if (query.query) {
            const q = query.query.toLowerCase();
            const matches = meta.name.toLowerCase().includes(q)
              || meta.description.toLowerCase().includes(q)
              || meta.tags.some(t => t.toLowerCase().includes(q));
            if (!matches) continue;
          }

          if (query.tags && query.tags.length > 0) {
            if (!query.tags.some(t => meta.tags.includes(t))) continue;
          }

          packages.push(meta);
        } catch {
          continue;
        }
      }
    } catch {
      // Registry dir doesn't exist yet
    }

    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const start = (page - 1) * perPage;

    return {
      packages: packages.slice(start, start + perPage),
      total: packages.length,
      page,
      per_page: perPage,
    };
  }

  async get(name: string): Promise<RegistryPackage | null> {
    try {
      return JSON.parse(await readFile(this.metaPath(name), 'utf-8'));
    } catch {
      return null;
    }
  }

  async getDefinition(name: string, version?: string): Promise<string | null> {
    const pkg = await this.get(name);
    if (!pkg) return null;
    const v = version ?? pkg.version;
    try {
      return await readFile(this.defPath(name, v), 'utf-8');
    } catch {
      return null;
    }
  }

  async versions(name: string): Promise<RegistryVersion[]> {
    const pkg = await this.get(name);
    return pkg?.versions ?? [];
  }
}

function extractToolNames(yaml: string): string[] {
  const names: string[] = [];
  const toolsMatch = yaml.match(/^tools:\s*$/m);
  if (!toolsMatch) return names;
  const afterTools = yaml.slice(toolsMatch.index! + toolsMatch[0].length);
  const lines = afterTools.split('\n');
  for (const line of lines) {
    const match = line.match(/^  ([a-z][a-z0-9_]*):\s*$/);
    if (match?.[1]) names.push(match[1]);
    // Stop at next top-level key
    if (/^\S/.test(line) && line.trim().length > 0) break;
  }
  return names;
}

function extractDescription(yaml: string): string {
  const match = yaml.match(/description:\s*(.+)/);
  return match?.[1]?.trim() ?? '';
}
