import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { openapi } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: api-tools
  version: "2.0.0"
  base_url: https://api.example.com
  auth:
    type: bearer
tools:
  create_item:
    description: Create a new item
    parameters:
      name:
        type: string
        required: true
      tags:
        type: array
        items:
          type: string
    returns:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
    side_effects: write
    errors:
      conflict:
        status: 409
        message: Item already exists
    examples:
      - name: basic
        input: { name: test }
        output: { id: "1", name: test }
`;

describe('OpenAPI target', () => {
  it('generates openapi.yaml by default', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi()] });
    expect(r.targets[0]!.files[0]!.path).toBe('openapi.yaml');
  });

  it('generates openapi.json when format=json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const file = r.targets[0]!.files[0]!;
    expect(file.path).toBe('openapi.json');
    const spec = JSON.parse(file.content);
    expect(spec.openapi).toBe('3.1.0');
  });

  it('includes service info', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const spec = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(spec.info.title).toBe('api-tools');
    expect(spec.info.version).toBe('2.0.0');
    expect(spec.servers[0].url).toBe('https://api.example.com');
  });

  it('maps tools to POST /tools/{name}', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const spec = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(spec.paths['/tools/create_item']).toBeDefined();
    expect(spec.paths['/tools/create_item'].post).toBeDefined();
  });

  it('includes request/response schemas', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const spec = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(spec.components.schemas.CreateItemRequest).toBeDefined();
    expect(spec.components.schemas.CreateItemResponse).toBeDefined();
  });

  it('includes error responses', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const spec = JSON.parse(r.targets[0]!.files[0]!.content);
    const op = spec.paths['/tools/create_item'].post;
    expect(op.responses['409']).toBeDefined();
  });

  it('includes security scheme for bearer auth', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [openapi({ format: 'json' })] });
    const spec = JSON.parse(r.targets[0]!.files[0]!.content);
    expect(spec.components.securitySchemes.bearer).toBeDefined();
    expect(spec.components.securitySchemes.bearer.type).toBe('http');
  });
});
