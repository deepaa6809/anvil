import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { anthropic } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  search:
    description: Search for items
    agent:
      description: Use for searching with rich context
    parameters:
      query:
        type: string
        required: true
      limit:
        type: integer
        default: 10
    side_effects: read
`;

describe('Anthropic target', () => {
  it('generates tools.json and tools.ts', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [anthropic()] });
    const files = r.targets[0]!.files.map(f => f.path);
    expect(files).toContain('tools.json');
    expect(files).toContain('tools.ts');
  });

  it('uses agent description (not human description)', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [anthropic()] });
    const tools = JSON.parse(r.targets[0]!.files.find(f => f.path === 'tools.json')!.content);
    expect(tools[0].description).toBe('Use for searching with rich context');
  });

  it('generates valid Anthropic tool format', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [anthropic()] });
    const tools = JSON.parse(r.targets[0]!.files.find(f => f.path === 'tools.json')!.content);
    expect(tools[0].name).toBe('search');
    expect(tools[0].input_schema).toBeDefined();
    expect(tools[0].input_schema.type).toBe('object');
    expect(tools[0].input_schema.properties.query).toBeDefined();
    expect(tools[0].input_schema.required).toContain('query');
  });

  it('TypeScript file has correct import types', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [anthropic()] });
    const ts = r.targets[0]!.files.find(f => f.path === 'tools.ts')!.content;
    expect(ts).toContain("Anthropic.Tool[]");
    expect(ts).toContain("toolNames");
  });
});
