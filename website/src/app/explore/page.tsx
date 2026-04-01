'use client';

import { useState } from 'react';
import type { Metadata } from 'next';

// Seed data — in production these come from the hub API
const SEED_PACKAGES = [
  {
    name: 'weather-tools',
    version: '1.0.0',
    description: 'Weather data tools for AI agents — current conditions and forecasts',
    author: { name: 'anvil-examples' },
    tags: ['weather', 'api'],
    tool_count: 2,
    tool_names: ['get_current_weather', 'get_forecast'],
    downloads: { weekly: 0, total: 0 },
  },
  {
    name: 'github-tools',
    version: '1.0.0',
    description: 'GitHub API tools — issues, pull requests, and repositories',
    author: { name: 'anvil-examples' },
    tags: ['github', 'git', 'devtools'],
    tool_count: 3,
    tool_names: ['create_issue', 'search_issues', 'get_pull_request'],
    downloads: { weekly: 0, total: 0 },
  },
  {
    name: 'postgres-tools',
    version: '1.0.0',
    description: 'PostgreSQL database tools with safety controls and read-only queries',
    author: { name: 'anvil-examples' },
    tags: ['database', 'postgres', 'sql'],
    tool_count: 3,
    tool_names: ['query', 'list_tables', 'execute_mutation'],
    downloads: { weekly: 0, total: 0 },
  },
  {
    name: 'linear-tools',
    version: '1.0.0',
    description: 'Linear project management tools — create and search issues',
    author: { name: 'anvil-examples' },
    tags: ['linear', 'project-management'],
    tool_count: 2,
    tool_names: ['create_issue', 'search_issues'],
    downloads: { weekly: 0, total: 0 },
  },
  {
    name: 'browser-tools',
    version: '1.0.0',
    description: 'Browser automation — navigate, screenshot, and extract links',
    author: { name: 'anvil-examples' },
    tags: ['browser', 'web', 'automation'],
    tool_count: 3,
    tool_names: ['navigate', 'screenshot', 'extract_links'],
    downloads: { weekly: 0, total: 0 },
  },
  {
    name: 'filesystem-tools',
    version: '1.0.0',
    description: 'Filesystem operations with permission controls',
    author: { name: 'anvil-examples' },
    tags: ['filesystem', 'io'],
    tool_count: 3,
    tool_names: ['read_file', 'write_file', 'list_directory'],
    downloads: { weekly: 0, total: 0 },
  },
];

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = [...new Set(SEED_PACKAGES.flatMap(p => p.tags))].sort();

  const filtered = SEED_PACKAGES.filter(pkg => {
    if (search) {
      const q = search.toLowerCase();
      if (!pkg.name.includes(q) && !pkg.description.toLowerCase().includes(q) &&
          !pkg.tool_names.some(t => t.includes(q))) return false;
    }
    if (selectedTag && !pkg.tags.includes(selectedTag)) return false;
    return true;
  });

  return (
    <div className="prose" style={{ maxWidth: 'var(--max-w-wide)' }}>
      <h1>Explore Tools</h1>
      <p className="prose-meta">
        Browse published Anvil tool definitions. Install any package with <code>anvil install &lt;name&gt;</code>
      </p>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200,
            background: 'var(--bg-code)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '0.6rem 1rem', fontFamily: 'var(--font-b)', fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              background: !selectedTag ? 'var(--accent-dim)' : 'transparent',
              color: !selectedTag ? 'var(--accent)' : 'var(--text-3)',
              border: `1px solid ${!selectedTag ? 'rgba(217,119,6,0.3)' : 'var(--border)'}`,
              borderRadius: 6, padding: '0.35rem 0.7rem',
              fontFamily: 'var(--font-m)', fontSize: '0.72rem', cursor: 'pointer',
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              style={{
                background: selectedTag === tag ? 'var(--accent-dim)' : 'transparent',
                color: selectedTag === tag ? 'var(--accent)' : 'var(--text-3)',
                border: `1px solid ${selectedTag === tag ? 'rgba(217,119,6,0.3)' : 'var(--border)'}`,
                borderRadius: 6, padding: '0.35rem 0.7rem',
                fontFamily: 'var(--font-m)', fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
        {filtered.map(pkg => (
          <div key={pkg.name} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{pkg.name}</h3>
              <span style={{ fontFamily: 'var(--font-m)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                v{pkg.version}
              </span>
            </div>
            <p style={{ margin: '0 0 0.75rem', flex: 1 }}>{pkg.description}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {pkg.tool_names.map(t => (
                <code key={t} style={{
                  fontSize: '0.7rem', padding: '0.15rem 0.4rem',
                  background: 'var(--bg-code)', borderRadius: 4, border: '1px solid var(--border)',
                  color: 'var(--accent)',
                }}>
                  {t}
                </code>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {pkg.tags.map(t => (
                <span key={t} style={{
                  fontFamily: 'var(--font-m)', fontSize: '0.65rem',
                  color: 'var(--text-3)', padding: '0.1rem 0.4rem',
                  border: '1px solid var(--border)', borderRadius: 4,
                }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{
              marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)',
              fontFamily: 'var(--font-m)', fontSize: '0.72rem', color: 'var(--text-3)',
            }}>
              anvil install {pkg.name}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '3rem 0' }}>
          No packages match your search.
        </p>
      )}
    </div>
  );
}
