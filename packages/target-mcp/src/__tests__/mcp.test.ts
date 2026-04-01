import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { mcp } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test-tools
  version: "1.0.0"
tools:
  get_data:
    description: Get some data
    agent:
      description: Use to get data
      when_to_use: [needs data]
    parameters:
      id:
        type: string
        required: true
      format:
        type: enum
        values: [json, csv]
        default: json
    returns:
      type: object
      properties:
        data:
          type: string
    side_effects: read
    cost: low
    idempotent: true
    examples:
      - name: basic
        input: { id: "123" }
        output: { data: "hello" }
`;

describe('MCP target', () => {
  it('generates server.ts, handlers.ts, types.ts, package.json, tsconfig.json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const files = r.targets[0]!.files.map(f => f.path);
    expect(files).toContain('server.ts');
    expect(files).toContain('handlers.ts');
    expect(files).toContain('types.ts');
    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
  });

  it('server.ts imports @modelcontextprotocol/sdk', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const server = r.targets[0]!.files.find(f => f.path === 'server.ts')!.content;
    expect(server).toContain("from '@modelcontextprotocol/sdk/server/index.js'");
    expect(server).toContain('CallToolRequestSchema');
    expect(server).toContain('ListToolsRequestSchema');
  });

  it('registers tools with correct names and schemas', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const server = r.targets[0]!.files.find(f => f.path === 'server.ts')!.content;
    expect(server).toContain('"get_data"');
    expect(server).toContain('"id"');
    expect(server).toContain('"format"');
  });

  it('generates typed interfaces in types.ts', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const types = r.targets[0]!.files.find(f => f.path === 'types.ts')!.content;
    expect(types).toContain('export interface GetDataInput');
    expect(types).toContain('id: string');
  });

  it('handlers import types correctly', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const handlers = r.targets[0]!.files.find(f => f.path === 'handlers.ts')!.content;
    expect(handlers).toContain("from './types.js'");
    expect(handlers).toContain('GetDataInput');
  });

  it('generates MCP annotations', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const server = r.targets[0]!.files.find(f => f.path === 'server.ts')!.content;
    expect(server).toContain('readOnlyHint');
    expect(server).toContain('idempotentHint');
  });

  it('handlers return example data as stubs', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const handlers = r.targets[0]!.files.find(f => f.path === 'handlers.ts')!.content;
    expect(handlers).toContain('"hello"');
  });

  it('package.json includes @modelcontextprotocol/sdk dependency', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [mcp()] });
    const pkg = JSON.parse(r.targets[0]!.files.find(f => f.path === 'package.json')!.content);
    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(pkg.name).toBe('test-tools-mcp');
  });
});
