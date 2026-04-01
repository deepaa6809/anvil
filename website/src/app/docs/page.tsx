import type { Metadata } from 'next';
import Link from 'next/link';
import { getPosts } from '@/lib/content';

export const metadata: Metadata = { title: 'Documentation', description: 'Anvil documentation — schema reference, targets, CLI commands, and integration guides.' };

const SECTIONS = [
  { slug: 'getting-started', title: 'Getting Started', desc: 'Install Anvil and create your first tool definition' },
  { slug: 'schema', title: 'Schema Reference', desc: 'Complete reference for the .anvil.yaml schema format' },
  { slug: 'targets', title: 'Targets', desc: 'All compilation targets: MCP, OpenAPI, SDK, docs, eval, and more' },
  { slug: 'mcp-integration', title: 'MCP Integration', desc: 'Connect Anvil-generated MCP servers to Claude Desktop, Cursor, and VS Code' },
  { slug: 'cli-reference', title: 'CLI Reference', desc: 'All anvil commands: init, validate, compile, dev, serve, publish, doctor' },
  { slug: 'runtime', title: 'Runtime & Middleware', desc: 'Validation, permissions, rate limiting, caching, and telemetry' },
  { slug: 'hub', title: 'Hub Deployment', desc: 'Deploy your own Anvil tool registry — SQLite-backed, zero external services' },
];

export default function DocsIndex() {
  const docs = getPosts('docs');
  return (
    <div className="prose">
      <h1>Documentation</h1>
      <p className="prose-meta">Everything you need to build with Anvil.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'0.75rem'}}>
        {SECTIONS.map(s => (
          <Link key={s.slug} href={`/docs/${s.slug}/`} className="card" style={{textDecoration:'none'}}>
            <h3 style={{fontSize:'1rem',marginBottom:'0.3rem'}}>{s.title}</h3>
            <p style={{margin:0}}>{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
