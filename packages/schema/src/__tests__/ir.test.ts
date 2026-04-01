import { describe, it, expect } from 'vitest';
import { parseAnvilYaml, lowerToIR, fieldToJsonSchema, toolParametersToJsonSchema } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: test-svc
  version: "1.0.0"
  description: Test service
  default_permissions:
    - type: network
      target: "*.api.com"
  tags: [test]
tools:
  do_thing:
    description: Does a thing
    agent:
      description: Agent-specific description
      when_to_use: [condition A]
      when_not_to_use: [condition B]
      tips: [tip 1]
    parameters:
      name:
        type: string
        required: true
        description: The name
        validation:
          min_length: 1
          max_length: 50
      count:
        type: integer
        default: 5
        validation:
          minimum: 0
          maximum: 100
      tags:
        type: array
        items:
          type: string
      mode:
        type: enum
        values: [fast, slow]
        default: fast
    returns:
      type: object
      properties:
        result:
          type: string
        score:
          type: number
    permissions:
      - type: filesystem
        target: /tmp
        methods: [read]
    errors:
      not_found:
        status: 404
        message: Not found
        agent_hint: Try another name
        retryable: false
    side_effects: write
    cost: medium
    idempotent: false
    cache:
      ttl: 60
      vary_by: [name]
    tags: [tool-tag]
    examples:
      - name: ex1
        input: { name: hello, count: 3 }
        output: { result: ok, score: 0.9 }
        prompt: Do the thing
`;

describe('lowerToIR', () => {
  const { service } = parseAnvilYaml(YAML);
  const ir = lowerToIR(service);

  it('sets service metadata', () => {
    expect(ir.service.name).toBe('test-svc');
    expect(ir.service.version).toBe('1.0.0');
    expect(ir.service.description).toBe('Test service');
    expect(ir.service.tags).toEqual(['test']);
  });

  it('lowers tool with all fields', () => {
    expect(ir.tools).toHaveLength(1);
    const t = ir.tools[0]!;
    expect(t.name).toBe('do_thing');
    expect(t.description).toBe('Does a thing');
    expect(t.agent_description).toBe('Agent-specific description');
    expect(t.when_to_use).toEqual(['condition A']);
    expect(t.when_not_to_use).toEqual(['condition B']);
    expect(t.tips).toEqual(['tip 1']);
    expect(t.side_effects).toBe('write');
    expect(t.cost).toBe('medium');
    expect(t.idempotent).toBe(false);
  });

  it('merges service + tool permissions', () => {
    const t = ir.tools[0]!;
    expect(t.permissions).toHaveLength(2);
    expect(t.permissions[0]!.type).toBe('network');
    expect(t.permissions[1]!.type).toBe('filesystem');
  });

  it('merges tags', () => {
    expect(ir.tools[0]!.tags).toEqual(['test', 'tool-tag']);
  });

  it('flattens parameters correctly', () => {
    const params = ir.tools[0]!.parameters;
    expect(params).toHaveLength(4);
    expect(params[0]!.name).toBe('name');
    expect(params[0]!.required).toBe(true);
    expect(params[1]!.name).toBe('count');
    expect(params[1]!.default_value).toBe(5);
    expect(params[2]!.name).toBe('tags');
    expect(params[3]!.name).toBe('mode');
  });

  it('flattens errors', () => {
    const errs = ir.tools[0]!.errors;
    expect(errs).toHaveLength(1);
    expect(errs[0]!.key).toBe('not_found');
    expect(errs[0]!.agent_hint).toBe('Try another name');
    expect(errs[0]!.retryable).toBe(false);
  });

  it('resolves cache', () => {
    expect(ir.tools[0]!.cache).toEqual({ ttl: 60, vary_by: ['name'] });
  });

  it('includes examples with prompt', () => {
    const exs = ir.tools[0]!.examples;
    expect(exs).toHaveLength(1);
    expect(exs[0]!.prompt).toBe('Do the thing');
  });
});

describe('fieldToJsonSchema', () => {
  it('converts string with validation', () => {
    const s = fieldToJsonSchema({ type: 'string', validation: { min_length: 1, max_length: 50, pattern: '^[a-z]+$' } });
    expect(s.type).toBe('string');
    expect(s.minLength).toBe(1);
    expect(s.maxLength).toBe(50);
    expect(s.pattern).toBe('^[a-z]+$');
  });

  it('converts number with validation', () => {
    const s = fieldToJsonSchema({ type: 'number', validation: { minimum: 0, maximum: 100 } });
    expect(s.type).toBe('number');
    expect(s.minimum).toBe(0);
  });

  it('converts enum', () => {
    const s = fieldToJsonSchema({ type: 'enum', values: ['a', 'b'] });
    expect(s.enum).toEqual(['a', 'b']);
  });

  it('converts object recursively', () => {
    const s = fieldToJsonSchema({
      type: 'object',
      properties: { x: { type: 'string', required: true }, y: { type: 'number' } },
    });
    expect(s.type).toBe('object');
    expect((s.properties as any).x.type).toBe('string');
    expect(s.required).toEqual(['x']);
  });

  it('converts array', () => {
    const s = fieldToJsonSchema({ type: 'array', items: { type: 'string' }, validation: { min_items: 1 } });
    expect(s.type).toBe('array');
    expect(s.minItems).toBe(1);
  });
});

describe('toolParametersToJsonSchema', () => {
  const { service } = parseAnvilYaml(YAML);
  const ir = lowerToIR(service);

  it('produces valid JSON Schema object', () => {
    const schema = toolParametersToJsonSchema(ir.tools[0]!);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['name']);
    const props = schema.properties as Record<string, any>;
    expect(props.name.type).toBe('string');
    expect(props.count.type).toBe('integer');
    expect(props.tags.type).toBe('array');
    expect(props.mode.enum).toEqual(['fast', 'slow']);
  });
});
