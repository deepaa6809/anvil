import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { docs } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test-tools
  version: "1.0.0"
  description: Test service
tools:
  action_a:
    description: Does action A
    agent:
      description: Agent desc for A
      when_to_use: [scenario X]
      when_not_to_use: [scenario Y]
      tips: [tip 1]
    parameters:
      input:
        type: string
        required: true
        description: The input
      verbose:
        type: boolean
        default: false
    returns:
      type: object
      properties:
        output:
          type: string
    permissions:
      - type: network
        target: api.test.com
    errors:
      bad_input:
        status: 400
        message: Invalid input
    side_effects: write
    cost: medium
    idempotent: false
    examples:
      - name: ex1
        input: { input: hello }
        output: { output: world }
        prompt: Do action A
  action_b:
    description: Does action B
    parameters:
      id:
        type: integer
        required: true
    side_effects: none
    deprecated: Use action_a instead
`;

describe('docs target', () => {
  it('generates single README for <= 5 tools', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    expect(r.targets[0]!.files).toHaveLength(1);
    expect(r.targets[0]!.files[0]!.path).toBe('README.md');
  });

  it('includes tool names', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('action_a');
    expect(md).toContain('action_b');
  });

  it('renders parameter table', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('| Name | Type | Required |');
    expect(md).toContain('`input`');
    expect(md).toContain('`verbose`');
  });

  it('includes agent guidance section', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('When to use');
    expect(md).toContain('scenario X');
    expect(md).toContain('When NOT to use');
    expect(md).toContain('tip 1');
  });

  it('includes examples with code blocks', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('```json');
    expect(md).toContain('"hello"');
  });

  it('shows deprecation notice', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('Deprecated');
    expect(md).toContain('Use action_a instead');
  });

  it('shows permissions', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('network');
    expect(md).toContain('api.test.com');
  });

  it('shows error table', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [docs()] });
    const md = r.targets[0]!.files[0]!.content;
    expect(md).toContain('bad_input');
    expect(md).toContain('400');
  });
});
