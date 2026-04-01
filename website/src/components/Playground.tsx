'use client';

import { useState } from 'react';

const DEFAULT_YAML = `anvil: "1.0"
service:
  name: weather-tools
  version: "1.0.0"

tools:
  get_weather:
    description: Get current weather
    agent:
      description: |
        Use this tool for real-time weather data.
        Best for current conditions.
      when_to_use:
        - User asks about current weather
      tips:
        - Prefer city names over coordinates
    parameters:
      location:
        type: string
        required: true
        description: City name
      units:
        type: enum
        values: [celsius, fahrenheit]
        default: celsius
    returns:
      type: object
      properties:
        temperature:
          type: number
        conditions:
          type: string
    permissions:
      - type: network
        target: api.weather.com
    side_effects: none
    cost: low
    idempotent: true
    examples:
      - name: basic
        input:
          location: San Francisco
          units: celsius
        output:
          temperature: 18
          conditions: Partly cloudy
        prompt: "What's the weather in SF?"`;

type Tab = 'mcp' | 'openapi' | 'anthropic' | 'agent' | 'docs';

const TAB_LABELS: Record<Tab, string> = {
  mcp: 'MCP Server',
  openapi: 'OpenAPI',
  anthropic: 'Claude API',
  agent: 'Agent Schema',
  docs: 'Documentation',
};

function parseLightweight(yaml: string): { name: string; tools: any[] } | null {
  try {
    const nameMatch = yaml.match(/^\s+name:\s+(.+)$/m);
    const name = nameMatch?.[1]?.trim() ?? 'my-tools';

    const tools: any[] = [];
    const toolBlockRegex = /^  (\w+):\s*$/gm;
    const toolsStart = yaml.indexOf('\ntools:');
    if (toolsStart === -1) return null;
    const toolSection = yaml.slice(toolsStart);

    let match;
    const re = /^  ([a-z_]\w*):\s*$/gm;
    while ((match = re.exec(toolSection)) !== null) {
      const toolName = match[1];
      const descMatch = toolSection.slice(match.index).match(/description:\s*(.+)/);
      const desc = descMatch?.[1]?.trim() ?? '';
      const agentDescMatch = toolSection.slice(match.index).match(/agent:\s*\n\s+description:\s*\|?\s*\n((?:\s{8,}.+\n?)*)/);
      const agentDesc = agentDescMatch?.[1]?.trim() ?? desc;

      const params: any[] = [];
      const paramSection = toolSection.slice(match.index).match(/parameters:\s*\n((?:\s{6,}.+\n?)*)/);
      if (paramSection) {
        const pRe = /^\s{6}(\w+):\s*$/gm;
        let pm;
        while ((pm = pRe.exec(paramSection[0])) !== null) {
          const pName = pm[1];
          const pBlock = paramSection[0].slice(pm.index, pm.index + 200);
          const pType = pBlock.match(/type:\s+(\w+)/)?.[1] ?? 'string';
          const pReq = pBlock.includes('required: true');
          const pDesc = pBlock.match(/description:\s+(.+)/)?.[1]?.trim() ?? '';
          params.push({ name: pName, type: pType, required: pReq, description: pDesc });
        }
      }

      tools.push({ name: toolName, description: desc, agentDescription: agentDesc, params });
    }

    return { name, tools };
  } catch {
    return null;
  }
}

function generateMcpPreview(parsed: { name: string; tools: any[] }): string {
  const toolDefs = parsed.tools.map(t => {
    const props = t.params.map((p: any) => `          "${p.name}": { "type": "${p.type}"${p.description ? `, "description": "${p.description}"` : ''} }`).join(',\n');
    const req = t.params.filter((p: any) => p.required).map((p: any) => `"${p.name}"`).join(', ');
    return `    {
      name: '${t.name}',
      description: ${JSON.stringify(t.agentDescription)},
      inputSchema: {
        type: 'object',
        properties: {
${props}
        },${req ? `\n        required: [${req}],` : ''}
      },
    }`;
  }).join(',\n');

  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: '${parsed.name}', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
${toolDefs}
  ],
}));

const transport = new StdioServerTransport();
await server.connect(transport);`;
}

function generateOpenApiPreview(parsed: { name: string; tools: any[] }): string {
  const paths = parsed.tools.map(t => {
    const props = t.params.map((p: any) => `          ${p.name}:\n            type: ${p.type}${p.description ? `\n            description: ${p.description}` : ''}`).join('\n');
    const req = t.params.filter((p: any) => p.required).map((p: any) => `          - ${p.name}`).join('\n');
    return `  /tools/${t.name}:
    post:
      operationId: ${t.name}
      summary: ${t.description}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
${props}${req ? `\n              required:\n${req}` : ''}`;
  }).join('\n');

  return `openapi: "3.1.0"
info:
  title: ${parsed.name}
  version: "1.0.0"
paths:
${paths}`;
}

function generateAnthropicPreview(parsed: { name: string; tools: any[] }): string {
  const tools = parsed.tools.map(t => ({
    name: t.name,
    description: t.agentDescription,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(t.params.map((p: any) => [p.name, { type: p.type, description: p.description }])),
      required: t.params.filter((p: any) => p.required).map((p: any) => p.name),
    },
  }));
  return JSON.stringify(tools, null, 2);
}

function generateAgentPreview(parsed: { name: string; tools: any[] }): string {
  const schema = {
    service: parsed.name,
    tools: parsed.tools.map(t => ({
      name: t.name,
      description: t.agentDescription,
      parameters: Object.fromEntries(t.params.map((p: any) => [p.name, { type: p.type, required: p.required }])),
    })),
  };
  return JSON.stringify(schema, null, 2);
}

function generateDocsPreview(parsed: { name: string; tools: any[] }): string {
  const docs = parsed.tools.map(t => {
    const paramTable = t.params.length > 0
      ? `| Name | Type | Required | Description |\n|------|------|----------|-------------|\n` +
        t.params.map((p: any) => `| \`${p.name}\` | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.description} |`).join('\n')
      : 'No parameters.';
    return `## \`${t.name}\`\n\n${t.description}\n\n### Parameters\n\n${paramTable}`;
  }).join('\n\n---\n\n');

  return `# ${parsed.name}\n\n${docs}`;
}

export function Playground() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [activeTab, setActiveTab] = useState<Tab>('mcp');

  const parsed = parseLightweight(yaml);
  const error = !parsed && yaml.trim().length > 0;

  const outputs: Record<Tab, string> = {
    mcp: parsed ? generateMcpPreview(parsed) : '',
    openapi: parsed ? generateOpenApiPreview(parsed) : '',
    anthropic: parsed ? generateAnthropicPreview(parsed) : '',
    agent: parsed ? generateAgentPreview(parsed) : '',
    docs: parsed ? generateDocsPreview(parsed) : '',
  };

  return (
    <div style={{ maxWidth: 'var(--max-w-wide)', margin: '0 auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minHeight: 420 }}>
        {/* Input */}
        <div className="code-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="code-header">
            <span className="code-dot" /><span className="code-dot" /><span className="code-dot" />
            <span className="code-title">tools.anvil.yaml</span>
            {error && <span style={{ marginLeft: 'auto', color: '#f87171', fontSize: '0.72rem', fontFamily: 'var(--font-m)' }}>Parse error</span>}
            {parsed && <span style={{ marginLeft: 'auto', color: '#9ECE6A', fontSize: '0.72rem', fontFamily: 'var(--font-m)' }}>{parsed.tools.length} tool{parsed.tools.length !== 1 ? 's' : ''} detected</span>}
          </div>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1, width: '100%', resize: 'none', border: 'none', outline: 'none',
              background: 'var(--bg-code)', color: 'var(--text)',
              fontFamily: 'var(--font-m)', fontSize: '0.78rem', lineHeight: 1.7,
              padding: '1rem 1.25rem', tabSize: 2,
            }}
          />
        </div>

        {/* Output */}
        <div className="code-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="code-header" style={{ gap: 0, overflow: 'auto' }}>
            {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-m)', fontSize: '0.7rem',
                  padding: '0.25rem 0.6rem', borderRadius: 4,
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-3)',
                  backgroundColor: activeTab === tab ? 'var(--accent-dim)' : 'transparent',
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <pre style={{
            flex: 1, overflow: 'auto', padding: '1rem 1.25rem',
            fontFamily: 'var(--font-m)', fontSize: '0.78rem', lineHeight: 1.7,
            color: 'var(--text-2)', margin: 0,
          }}>
            <code>{outputs[activeTab] || '// Edit the YAML to see output'}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
