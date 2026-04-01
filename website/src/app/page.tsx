import Link from 'next/link';
import { Playground } from '@/components/Playground';

const TARGETS = [
  { icon: '⚡', name: 'MCP Server', desc: 'Fully typed Model Context Protocol server with tool handlers and annotations.', pkg: '@anvil-tools/target-mcp' },
  { icon: '📐', name: 'OpenAPI 3.1', desc: 'Complete spec with schemas, security, examples, and error responses.', pkg: '@anvil-tools/target-openapi' },
  { icon: '📘', name: 'Documentation', desc: 'Markdown docs with parameter tables, examples, and agent guidance.', pkg: '@anvil-tools/target-docs' },
  { icon: '🧠', name: 'Agent Schema', desc: 'LLM-optimized tool schema with agent descriptions and few-shot examples.', pkg: '@anvil-tools/target-agent-schema' },
  { icon: '🧪', name: 'Eval Harness', desc: 'Test suite with schema validation, contract testing, and agent eval.', pkg: '@anvil-tools/target-eval' },
  { icon: '📦', name: 'TypeScript SDK', desc: 'Typed client class with Zod runtime validation.', pkg: '@anvil-tools/target-sdk-ts' },
  { icon: '⌨️', name: 'CLI Application', desc: 'Commander-based CLI with subcommands and JSON output.', pkg: '@anvil-tools/target-cli-gen' },
  { icon: '🔌', name: 'Claude · GPT · Vercel AI', desc: 'Native tool formats for Anthropic, OpenAI, and Vercel AI SDK.', pkg: 'target-anthropic / target-openai / target-vercel-ai' },
];

const SCHEMA_FIELDS = [
  { name: 'agent.description', desc: 'Rich context for LLM tool selection — separate from human docs' },
  { name: 'when_to_use', desc: 'Explicit scenarios where this tool is the right choice' },
  { name: 'when_not_to_use', desc: 'Anti-patterns — redirect agents to better alternatives' },
  { name: 'permissions', desc: 'Declared per-tool, enforced at runtime. Network, filesystem, env, db' },
  { name: 'side_effects', desc: 'none / read / write / destructive — agents know the blast radius' },
  { name: 'cost', desc: 'free / low / medium / high / variable — agents can budget' },
  { name: 'examples', desc: 'Input/output pairs that become eval test cases automatically' },
  { name: 'errors + agent_hint', desc: 'Known failure modes with recovery instructions for agents' },
];

const FRAGMENTS = ['MCP schema', 'OpenAPI spec', 'TypeScript types', 'Agent descriptions', 'Permission declarations', 'Test suites', 'Human docs'];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <header className="hero">
        <div className="container">
          <p className="hero-badge">Open Source Tool Compiler</p>
          <h1>Forge once.<br />Run everywhere.</h1>
          <p className="hero-sub">
            Define your tools once. Compile to MCP&nbsp;servers, TypeScript&nbsp;SDKs,
            OpenAPI&nbsp;specs, docs, eval&nbsp;harnesses, and agent&#8209;optimized&nbsp;schemas.
          </p>
          <div className="hero-actions">
            <Link href="/docs/" className="btn btn-primary">Get Started</Link>
            <Link href="/docs/schema/" className="btn btn-secondary">See the Schema</Link>
          </div>
          <div className="code-block" style={{maxWidth:520,margin:'0 auto',textAlign:'left'}}>
            <div className="code-header">
              <span className="code-dot" /><span className="code-dot" /><span className="code-dot" />
              <span className="code-title">tools.anvil.yaml → 10 targets</span>
            </div>
            <pre><code>{`anvil: "1.0"
service:
  name: weather-tools
  version: "1.0.0"

tools:
  get_current_weather:
    description: Get current weather for a location
    agent:
      when_to_use:
        - User asks about current weather
      tips:
        - Prefer city names over coordinates
    parameters:
      location:
        type: string
        required: true
      units:
        type: enum
        values: [celsius, fahrenheit]
    permissions:
      - type: network
        target: api.weather.com
    side_effects: none
    cost: low`}</code></pre>
          </div>
        </div>
      </header>

      {/* Problem */}
      <section className="section" id="problem">
        <div className="container">
          <h2>The tool layer is fragmented.</h2>
          <p className="section-sub">
            Every agent runtime has its own schema format. Every integration needs its own docs,
            permissions, and tests. You maintain seven versions of the same definition that drift apart.
          </p>
          <div className="fragment-grid">
            {FRAGMENTS.map(f => {
              const [a, b] = f.split(' ');
              return <div key={f} className="fragment"><span>{a}</span> {b}</div>;
            })}
          </div>
          <p className="section-note">Anvil replaces all of them with a single source of truth.</p>
        </div>
      </section>

      {/* Schema */}
      <section className="section section-alt" id="schema">
        <div className="container">
          <h2>One schema. Full semantics.</h2>
          <p className="section-sub">
            Anvil captures everything agents need — not just types. Descriptions optimized for LLMs,
            cost indicators, side effects, permissions, and examples that become test cases.
          </p>
          <div className="schema-grid">
            {SCHEMA_FIELDS.map(f => (
              <div key={f.name} className="schema-card">
                <h3>{f.name}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Targets */}
      <section className="section" id="targets">
        <div className="container">
          <h2>Ten targets. Zero config.</h2>
          <p className="section-sub">
            <code>anvil compile --target mcp</code> — no config file needed.
            All targets are built into the CLI. Or use <code>--all</code> for everything.
          </p>
          <div className="grid-2">
            {TARGETS.map((t, i) => (
              <div key={t.name} className={`card ${i === TARGETS.length - 1 ? 'card-full' : ''}`}>
                <div className="card-icon">{t.icon}</div>
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
                <code className="card-pkg">{t.pkg}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Playground */}
      <section className="section section-alt" id="playground">
        <div className="container" style={{maxWidth:'var(--max-w-wide)'}}>
          <h2>Try it live.</h2>
          <p className="section-sub">
            Edit the YAML on the left. See generated outputs update instantly on the right.
          </p>
        </div>
        <Playground />
      </section>

      {/* Pipeline */}
      <section className="section" id="pipeline">
        <div className="container">
          <h2>Compiler architecture.</h2>
          <p className="section-sub">
            Like protobuf compiles <code>.proto</code> to language-specific code,
            Anvil compiles <code>.anvil.yaml</code> through an IR. Adding a target is one interface.
          </p>
          <div className="pipeline">
            <div className="pipe-stage"><div className="pipe-label">Source</div><div className="pipe-box">.anvil.yaml<br /><small>or TypeScript</small></div></div>
            <div className="pipe-arrow" />
            <div className="pipe-stage"><div className="pipe-label">Parse + Validate</div><div className="pipe-box pipe-box-accent">IR</div></div>
            <div className="pipe-arrow" />
            <div className="pipe-stage"><div className="pipe-label">Generate</div><div className="pipe-box">Target Plugins</div></div>
            <div className="pipe-arrow" />
            <div className="pipe-stage"><div className="pipe-label">Output</div><div className="pipe-box">MCP · API · SDK<br />Docs · Eval · CLI</div></div>
          </div>
        </div>
      </section>

      {/* Featured Tools */}
      <section className="section section-alt" id="featured">
        <div className="container">
          <h2>Featured tools.</h2>
          <p className="section-sub">
            Real-world tool definitions ready to compile. Install with <code>anvil install &lt;name&gt;</code> or <Link href="/explore/" style={{color:'var(--accent)',textDecoration:'underline',textUnderlineOffset:2}}>browse all tools</Link>.
          </p>
          <div className="grid-2">
            {[
              { name: 'github-tools', desc: 'Issues, PRs, search, comments, and repo browsing', tools: 5, tags: ['github', 'devtools'] },
              { name: 'postgres-tools', desc: 'Read-only queries, table schemas, and guarded mutations', tools: 3, tags: ['database', 'sql'] },
              { name: 'weather-tools', desc: 'Current conditions and multi-day forecasts', tools: 2, tags: ['weather', 'api'] },
              { name: 'browser-tools', desc: 'Navigate, screenshot, and extract links from any URL', tools: 3, tags: ['browser', 'automation'] },
            ].map(t => (
              <div key={t.name} className="card">
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
                <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginTop:'0.5rem'}}>
                  <span style={{fontFamily:'var(--font-m)',fontSize:'0.72rem',color:'var(--text-3)'}}>{t.tools} tools</span>
                  <span style={{color:'var(--border-l)'}}>·</span>
                  {t.tags.map(tag => (
                    <span key={tag} style={{fontFamily:'var(--font-m)',fontSize:'0.65rem',color:'var(--text-3)',border:'1px solid var(--border)',padding:'0.1rem 0.4rem',borderRadius:4}}>{tag}</span>
                  ))}
                </div>
                <div style={{marginTop:'0.65rem',fontFamily:'var(--font-m)',fontSize:'0.72rem',color:'var(--accent)'}}>
                  anvil install {t.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get Started */}
      <section className="section" id="start">
        <div className="container">
          <h2>Get started in 30 seconds.</h2>
          <div className="start-steps">
            {[
              { cmd: 'npm install -g @anvil-tools/cli' },
              { cmd: 'anvil init my-tools && cd my-tools' },
              { cmd: 'anvil compile --target mcp', note: 'Zero config — MCP server generated' },
              { cmd: 'anvil serve --stub', note: 'Live MCP server for Claude Desktop / Cursor' },
            ].map((s, i) => (
              <div key={i} className="start-step">
                <div className="step-num">{i + 1}</div>
                <div>
                  <code className="step-cmd">{s.cmd}</code>
                  {s.note && <span className="step-note">{s.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
