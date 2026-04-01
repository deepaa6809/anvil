import { describe, it, expect } from 'vitest';
import { compile, compileOne } from '../index.js';
import type { AnvilTarget } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test-tools
  version: "1.0.0"
tools:
  greet:
    description: Greet a user
    agent:
      description: Use to greet people
      when_to_use:
        - User asks for a greeting
    parameters:
      name:
        type: string
        required: true
        description: Name to greet
    returns:
      type: object
      properties:
        message:
          type: string
    side_effects: none
    cost: free
    examples:
      - name: basic
        input: { name: World }
        output: { message: "Hello, World!" }
        prompt: "Say hello"
`;

const echoTarget: AnvilTarget = {
  name: 'echo',
  description: 'Echo IR as JSON',
  async generate(ir) {
    return {
      target: 'echo',
      files: [{
        path: 'ir.json',
        content: JSON.stringify({ tools: ir.tools.length, service: ir.service.name }),
        type: 'schema',
      }],
    };
  },
};

describe('compile', () => {
  it('compiles YAML to targets', async () => {
    const result = await compile({
      sources: [{ content: YAML }],
      targets: [echoTarget],
    });

    expect(result.ir.tools).toHaveLength(1);
    expect(result.ir.tools[0]!.name).toBe('greet');
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]!.files).toHaveLength(1);

    const output = JSON.parse(result.targets[0]!.files[0]!.content);
    expect(output.tools).toBe(1);
    expect(output.service).toBe('test-tools');
  });

  it('compiles to multiple targets in parallel', async () => {
    const result = await compile({
      sources: [{ content: YAML }],
      targets: [echoTarget, echoTarget],
    });
    expect(result.targets).toHaveLength(2);
  });

  it('throws on empty input', async () => {
    await expect(compile({ targets: [echoTarget] })).rejects.toThrow();
  });

  it('lowers IR correctly', async () => {
    const result = await compile({
      sources: [{ content: YAML }],
      targets: [echoTarget],
    });

    const tool = result.ir.tools[0]!;
    expect(tool.agent_description).toBe('Use to greet people');
    expect(tool.when_to_use).toEqual(['User asks for a greeting']);
    expect(tool.parameters).toHaveLength(1);
    expect(tool.parameters[0]!.required).toBe(true);
    expect(tool.side_effects).toBe('none');
    expect(tool.examples).toHaveLength(1);
    expect(tool.examples[0]!.prompt).toBe('Say hello');
  });
});

describe('compileOne', () => {
  it('compiles single source to single target', async () => {
    const result = await compileOne(YAML, echoTarget);
    expect(result.files).toHaveLength(1);
    expect(result.ir.tools).toHaveLength(1);
  });
});
