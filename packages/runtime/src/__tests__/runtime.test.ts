import { describe, it, expect } from 'vitest';
import { parseAnvilYaml, lowerToIR, type AnvilIR } from '@anvil-tools/schema';
import {
  validateInput, validateOutput,
  compose, validationMiddleware, rateLimitMiddleware, cachingMiddleware,
  structuredLoggingMiddleware, costTrackingMiddleware, createCostTracker,
  circuitBreakerMiddleware,
  checkPermission,
  type LogEntry,
} from '../index.js';

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
      loud:
        type: boolean
    returns:
      type: object
      properties:
        message:
          type: string
          required: true
    permissions:
      - type: network
        target: api.example.com
        methods: [GET]
    rate_limit:
      requests: 3
      period: 1s
    side_effects: none
    cost: low
    cache:
      ttl: 5
      vary_by: [name]
    examples:
      - name: basic
        input: { name: World }
        output: { message: "Hello, World!" }
`;

function getIR(): AnvilIR {
  const { service } = parseAnvilYaml(YAML);
  return lowerToIR(service);
}

describe('validateInput', () => {
  const ir = getIR();
  const tool = ir.tools[0]!;

  it('accepts valid input', () => {
    const r = validateInput(tool, { name: 'Alice' });
    expect(r.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const r = validateInput(tool, { name: 'Alice', loud: true });
    expect(r.success).toBe(true);
  });

  it('rejects missing required field', () => {
    const r = validateInput(tool, {});
    expect(r.success).toBe(false);
    expect(r.errors).toBeDefined();
    expect(r.errors!.length).toBeGreaterThan(0);
  });

  it('rejects wrong type', () => {
    const r = validateInput(tool, { name: 123 });
    expect(r.success).toBe(false);
  });
});

describe('validateOutput', () => {
  const ir = getIR();
  const tool = ir.tools[0]!;

  it('accepts valid output', () => {
    const r = validateOutput(tool, { message: 'Hello' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid output', () => {
    const r = validateOutput(tool, { message: 42 });
    expect(r.success).toBe(false);
  });
});

describe('validationMiddleware', () => {
  const ir = getIR();

  it('passes valid input through', async () => {
    const mw = validationMiddleware(ir);
    const result = await mw('greet', { name: 'Bob' }, async () => ({ message: 'Hi Bob' }));
    expect(result).toEqual({ message: 'Hi Bob' });
  });

  it('throws on invalid input', async () => {
    const mw = validationMiddleware(ir);
    await expect(mw('greet', {}, async () => ({}))).rejects.toThrow('validation failed');
  });

  it('throws on unknown tool', async () => {
    const mw = validationMiddleware(ir);
    await expect(mw('unknown', {}, async () => ({}))).rejects.toThrow('Unknown tool');
  });
});

describe('compose', () => {
  it('chains middleware in order', async () => {
    const order: string[] = [];
    const mw1 = async (_n: string, _i: unknown, next: any) => { order.push('1-before'); const r = await next(_n, _i); order.push('1-after'); return r; };
    const mw2 = async (_n: string, _i: unknown, next: any) => { order.push('2-before'); const r = await next(_n, _i); order.push('2-after'); return r; };

    const handler = compose(mw1, mw2)(async () => { order.push('handler'); return 'ok'; });
    await handler('t', {});
    expect(order).toEqual(['1-before', '2-before', 'handler', '2-after', '1-after']);
  });
});

describe('rateLimitMiddleware', () => {
  const ir = getIR();

  it('allows requests within limit', async () => {
    const mw = rateLimitMiddleware(ir);
    const next = async () => 'ok';
    expect(await mw('greet', {}, next)).toBe('ok');
    expect(await mw('greet', {}, next)).toBe('ok');
    expect(await mw('greet', {}, next)).toBe('ok');
  });

  it('rejects requests exceeding limit', async () => {
    const mw = rateLimitMiddleware(ir);
    const next = async () => 'ok';
    await mw('greet', {}, next);
    await mw('greet', {}, next);
    await mw('greet', {}, next);
    await expect(mw('greet', {}, next)).rejects.toThrow('Rate limit exceeded');
  });
});

describe('cachingMiddleware', () => {
  const ir = getIR();

  it('caches results', async () => {
    const mw = cachingMiddleware(ir);
    let callCount = 0;
    const next = async () => { callCount++; return { data: 'fresh' }; };

    const r1 = await mw('greet', { name: 'Alice' }, next);
    const r2 = await mw('greet', { name: 'Alice' }, next);
    expect(r1).toEqual(r2);
    expect(callCount).toBe(1);
  });

  it('does not cache different inputs', async () => {
    const mw = cachingMiddleware(ir);
    let callCount = 0;
    const next = async () => { callCount++; return { data: callCount }; };

    await mw('greet', { name: 'Alice' }, next);
    await mw('greet', { name: 'Bob' }, next);
    expect(callCount).toBe(2);
  });
});

describe('structuredLoggingMiddleware', () => {
  it('logs tool calls', async () => {
    const logs: LogEntry[] = [];
    const mw = structuredLoggingMiddleware((e) => logs.push(e));
    await mw('greet', { name: 'X' }, async () => 'ok');
    expect(logs).toHaveLength(2);
    expect(logs[0]!.event).toBe('tool.call.start');
    expect(logs[1]!.event).toBe('tool.call.success');
    expect(logs[1]!.duration_ms).toBeDefined();
  });

  it('logs errors', async () => {
    const logs: LogEntry[] = [];
    const mw = structuredLoggingMiddleware((e) => logs.push(e));
    await expect(mw('greet', {}, async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(logs[1]!.event).toBe('tool.call.error');
    expect(logs[1]!.error).toBe('fail');
  });
});

describe('costTrackingMiddleware', () => {
  const ir = getIR();

  it('tracks costs', async () => {
    const tracker = createCostTracker();
    const mw = costTrackingMiddleware(ir, tracker);
    await mw('greet', {}, async () => 'ok');
    await mw('greet', {}, async () => 'ok');

    const summary = tracker.getSummary();
    expect(summary.total_calls).toBe(2);
    expect(summary.by_tool.greet!.calls).toBe(2);
    expect(summary.by_cost_level.low).toBe(2);
  });
});

describe('circuitBreakerMiddleware', () => {
  it('opens after threshold failures', async () => {
    const mw = circuitBreakerMiddleware({ failure_threshold: 2, recovery_timeout: 100 });
    const failing = async () => { throw new Error('fail'); };

    await expect(mw('greet', {}, failing)).rejects.toThrow('fail');
    await expect(mw('greet', {}, failing)).rejects.toThrow('fail');
    await expect(mw('greet', {}, async () => 'ok')).rejects.toThrow('Circuit breaker open');
  });
});

describe('checkPermission', () => {
  const ir = getIR();
  const tool = ir.tools[0]!;

  it('allows matching network request', () => {
    const r = checkPermission(tool, { network: { url: 'https://api.example.com/data', method: 'GET' } });
    expect(r.allowed).toBe(true);
  });

  it('denies non-matching network request', () => {
    const r = checkPermission(tool, { network: { url: 'https://evil.com', method: 'GET' } });
    expect(r.allowed).toBe(false);
    expect(r.violations).toHaveLength(1);
  });

  it('denies non-matching method', () => {
    const r = checkPermission(tool, { network: { url: 'https://api.example.com/data', method: 'DELETE' } });
    expect(r.allowed).toBe(false);
  });
});
