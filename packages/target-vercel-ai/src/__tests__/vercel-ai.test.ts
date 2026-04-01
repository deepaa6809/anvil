import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { vercelAI } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  create_item:
    description: Create an item
    agent:
      description: Use to create new items
    parameters:
      name:
        type: string
        required: true
      tags:
        type: array
        items:
          type: string
      priority:
        type: enum
        values: [low, medium, high]
        default: medium
    side_effects: write
`;

describe('Vercel AI target', () => {
  it('generates tools.ts', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [vercelAI()] });
    expect(r.targets[0]!.files).toHaveLength(1);
    expect(r.targets[0]!.files[0]!.path).toBe('tools.ts');
  });

  it('imports tool from ai and z from zod', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [vercelAI()] });
    const ts = r.targets[0]!.files[0]!.content;
    expect(ts).toContain("import { tool } from 'ai'");
    expect(ts).toContain("import { z } from 'zod'");
  });

  it('generates Zod schemas for parameters', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [vercelAI()] });
    const ts = r.targets[0]!.files[0]!.content;
    expect(ts).toContain('z.string()');
    expect(ts).toContain('z.array(');
    expect(ts).toContain("z.enum([");
  });

  it('uses camelCase for tool names', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [vercelAI()] });
    const ts = r.targets[0]!.files[0]!.content;
    expect(ts).toContain('createItem: tool(');
  });

  it('uses agent description', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [vercelAI()] });
    const ts = r.targets[0]!.files[0]!.content;
    expect(ts).toContain('Use to create new items');
  });
});
