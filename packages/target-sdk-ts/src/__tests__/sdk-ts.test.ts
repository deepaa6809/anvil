import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { sdkTypescript } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: api-tools
  version: "1.0.0"
tools:
  get_user:
    description: Get a user by ID
    parameters:
      user_id:
        type: string
        required: true
      include_email:
        type: boolean
        default: false
    returns:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
    side_effects: read
    deprecated: Use get_user_v2 instead
`;

describe('SDK TypeScript target', () => {
  it('generates types.ts, schemas.ts, client.ts, index.ts, package.json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [sdkTypescript()] });
    const paths = r.targets[0]!.files.map(f => f.path);
    expect(paths).toContain('types.ts');
    expect(paths).toContain('schemas.ts');
    expect(paths).toContain('client.ts');
    expect(paths).toContain('index.ts');
    expect(paths).toContain('package.json');
  });

  it('types.ts has input interface', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [sdkTypescript()] });
    const types = r.targets[0]!.files.find(f => f.path === 'types.ts')!.content;
    expect(types).toContain('export interface GetUserInput');
    expect(types).toContain('user_id: string');
    expect(types).toContain('include_email?: boolean');
  });

  it('schemas.ts has Zod schemas', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [sdkTypescript()] });
    const schemas = r.targets[0]!.files.find(f => f.path === 'schemas.ts')!.content;
    expect(schemas).toContain("import { z } from 'zod'");
    expect(schemas).toContain('getUserInputSchema');
    expect(schemas).toContain('z.string()');
    expect(schemas).toContain('z.boolean()');
  });

  it('client.ts has typed method', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [sdkTypescript()] });
    const client = r.targets[0]!.files.find(f => f.path === 'client.ts')!.content;
    expect(client).toContain('class ApiToolsClient');
    expect(client).toContain('async getUser(input: GetUserInput)');
    expect(client).toContain('@deprecated');
  });
});
