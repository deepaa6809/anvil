import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { evalTarget } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  greet:
    description: Greet someone
    parameters:
      name:
        type: string
        required: true
      shout:
        type: boolean
    returns:
      type: object
      properties:
        message:
          type: string
    side_effects: none
    examples:
      - name: basic
        input: { name: World }
        output: { message: "Hello, World!" }
        prompt: Say hello to the world
      - name: shout
        input: { name: Alice, shout: true }
        output: { message: "HELLO, ALICE!" }
`;

describe('eval target', () => {
  it('generates fixtures, schema tests, agent eval, config, and package.json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [evalTarget()] });
    const paths = r.targets[0]!.files.map(f => f.path);
    expect(paths).toContain('fixtures.json');
    expect(paths).toContain('schema.test.ts');
    expect(paths).toContain('agent-eval.test.ts');
    expect(paths).toContain('vitest.config.ts');
    expect(paths).toContain('package.json');
  });

  it('fixtures include tool schemas and examples', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [evalTarget()] });
    const fixtures = JSON.parse(r.targets[0]!.files.find(f => f.path === 'fixtures.json')!.content);
    expect(fixtures.tools).toHaveLength(1);
    expect(fixtures.tools[0].name).toBe('greet');
    expect(fixtures.tools[0].examples).toHaveLength(2);
    expect(fixtures.tools[0].requiredParams).toContain('name');
  });

  it('schema tests validate examples', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [evalTarget()] });
    const test = r.targets[0]!.files.find(f => f.path === 'schema.test.ts')!.content;
    expect(test).toContain('validates example: basic');
    expect(test).toContain('validates example: shout');
    expect(test).toContain('rejects missing required');
  });

  it('agent eval uses prompt field', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [evalTarget()] });
    const test = r.targets[0]!.files.find(f => f.path === 'agent-eval.test.ts')!.content;
    expect(test).toContain('Say hello to the world');
    expect(test).toContain('selects greet');
  });

  it('warns when tools have no examples', async () => {
    const r = await compile({
      sources: [{ content: `
anvil: "1.0"
service:
  name: t
  version: "1.0.0"
tools:
  empty:
    description: No examples
    parameters:
      x:
        type: string
    side_effects: none
` }],
      targets: [evalTarget()],
    });
    expect(r.diagnostics.some(d => d.message.includes('no examples'))).toBe(true);
  });
});
