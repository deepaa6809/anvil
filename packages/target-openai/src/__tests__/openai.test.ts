import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { openai } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  fetch_data:
    description: Fetch data by ID
    agent:
      description: Use to retrieve data records
    parameters:
      id:
        type: string
        required: true
      format:
        type: enum
        values: [json, csv]
    side_effects: read
`;

describe('OpenAI target', () => {
  it('generates tools.json and tools.ts', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openai()] });
    expect(r.targets[0]!.files.map(f => f.path)).toContain('tools.json');
    expect(r.targets[0]!.files.map(f => f.path)).toContain('tools.ts');
  });

  it('produces OpenAI function calling format', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openai()] });
    const tools = JSON.parse(r.targets[0]!.files.find(f => f.path === 'tools.json')!.content);
    expect(tools[0].type).toBe('function');
    expect(tools[0].function.name).toBe('fetch_data');
    expect(tools[0].function.parameters.type).toBe('object');
    expect(tools[0].function.parameters.required).toContain('id');
  });

  it('uses agent description', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openai()] });
    const tools = JSON.parse(r.targets[0]!.files.find(f => f.path === 'tools.json')!.content);
    expect(tools[0].function.description).toBe('Use to retrieve data records');
  });

  it('strict mode adds additionalProperties: false', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openai({ strict: true })] });
    const tools = JSON.parse(r.targets[0]!.files.find(f => f.path === 'tools.json')!.content);
    expect(tools[0].function.strict).toBe(true);
    expect(tools[0].function.parameters.additionalProperties).toBe(false);
  });

  it('TypeScript file has correct types', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openai()] });
    const ts = r.targets[0]!.files.find(f => f.path === 'tools.ts')!.content;
    expect(ts).toContain('OpenAI.Chat.Completions.ChatCompletionTool[]');
  });
});
