import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { agentSchema } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  search:
    description: Human search desc
    agent:
      description: Agent search desc with more context
      when_to_use: [user wants to find things]
      when_not_to_use: [user wants to create things]
      tips: [use specific keywords]
    parameters:
      query:
        type: string
        required: true
        description: Search query
        examples: ["hello world"]
      limit:
        type: integer
        default: 10
    errors:
      rate_limited:
        status: 429
        message: Too many requests
        agent_hint: Wait and retry
    side_effects: read
    cost: low
    idempotent: true
    examples:
      - name: basic
        input: { query: test }
        output: { results: [] }
        prompt: Search for test
`;

describe('agent-schema target', () => {
  it('generates agent-schema.json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    expect(r.targets[0]!.files[0]!.path).toBe('agent-schema.json');
  });

  it('uses agent description, NOT human description', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(schema.tools[0].description).toBe('Agent search desc with more context');
    expect(schema.tools[0].description).not.toBe('Human search desc');
  });

  it('includes when_to_use/when_not_to_use/tips', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(schema.tools[0].when_to_use).toEqual(['user wants to find things']);
    expect(schema.tools[0].when_not_to_use).toEqual(['user wants to create things']);
    expect(schema.tools[0].tips).toEqual(['use specific keywords']);
  });

  it('includes cost and side_effects', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(schema.tools[0].cost).toBe('low');
    expect(schema.tools[0].side_effects).toBe('read');
  });

  it('includes errors with agent_hint only', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(schema.tools[0].errors[0].hint).toBe('Wait and retry');
  });

  it('includes examples with prompts', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(schema.tools[0].examples[0].prompt).toBe('Search for test');
  });

  it('YAML format works', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema({ format: 'yaml' })] });
    expect(r.targets[0]!.files[0]!.path).toBe('agent-schema.yaml');
    expect(r.targets[0]!.files[0]!.content).toContain('service:');
  });

  it('excludes permissions/cache/rate_limit (runtime concerns)', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [agentSchema()] });
    const schema = JSON.parse(r.targets[0]!.files[0]!.content);
    const tool = schema.tools[0];
    expect(tool.permissions).toBeUndefined();
    expect(tool.cache).toBeUndefined();
    expect(tool.rate_limit).toBeUndefined();
  });
});
