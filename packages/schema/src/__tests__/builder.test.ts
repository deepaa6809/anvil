import { describe, it, expect } from 'vitest';
import { defineService, field, permission } from '../index.js';

describe('defineService', () => {
  it('creates a valid service definition from TypeScript builder', () => {
    const svc = defineService({
      name: 'math-tools',
      version: '1.0.0',
      description: 'Math utilities',
      tools: {
        add: {
          description: 'Add two numbers',
          agent: { description: 'Use for addition', when_to_use: ['math'] },
          parameters: {
            a: field.number({ required: true, description: 'First number' }),
            b: field.number({ required: true, description: 'Second number' }),
          },
          returns: field.object({ result: field.number({ description: 'Sum' }) }),
          permissions: [permission.network('api.math.com', ['GET'])],
          side_effects: 'none',
          cost: 'free',
          examples: [{ name: 'basic', input: { a: 1, b: 2 }, output: { result: 3 } }],
        },
      },
    });

    expect(svc.anvil).toBe('1.0');
    expect(svc.service.name).toBe('math-tools');
    expect(Object.keys(svc.tools)).toEqual(['add']);
    expect(svc.tools['add']!.parameters.a.type).toBe('number');
    expect(svc.tools['add']!.returns?.type).toBe('object');
  });

  it('creates field types correctly', () => {
    expect(field.string().type).toBe('string');
    expect(field.integer().type).toBe('integer');
    expect(field.boolean().type).toBe('boolean');
    expect(field.enum(['a', 'b']).values).toEqual(['a', 'b']);
    expect(field.array(field.string()).type).toBe('array');
    expect(field.object({ x: field.number() }).type).toBe('object');
  });

  it('creates permissions correctly', () => {
    expect(permission.network('api.com', ['GET']).type).toBe('network');
    expect(permission.filesystem('/tmp').type).toBe('filesystem');
    expect(permission.environment('API_KEY').type).toBe('environment');
    expect(permission.database('pg', ['SELECT']).type).toBe('database');
  });
});
