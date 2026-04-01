/**
 * Telemetry & Observability
 *
 * OpenTelemetry-compatible instrumentation, cost tracking,
 * circuit breaker, and structured logging for Anvil tool execution.
 */

import type { AnvilIR, AnvilIRTool } from '@anvil-tools/schema';
import type { Middleware, ToolHandler } from './middleware.js';

// ---------------------------------------------------------------------------
// Structured Logging
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tool: string;
  event: string;
  duration_ms?: number;
  cost?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

const jsonSink: LogSink = (entry) => {
  process.stderr.write(JSON.stringify(entry) + '\n');
};

/**
 * Structured logging middleware — emits JSON log entries for every tool call.
 */
export function structuredLoggingMiddleware(
  sink: LogSink = jsonSink,
  level: LogLevel = 'info',
): Middleware {
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const minLevel = levels[level];

  return async (toolName, input, next) => {
    const start = performance.now();

    const emit = (l: LogLevel, event: string, extra?: Partial<LogEntry>) => {
      if (levels[l] >= minLevel) {
        sink({
          timestamp: new Date().toISOString(),
          level: l,
          tool: toolName,
          event,
          ...extra,
        });
      }
    };

    emit('info', 'tool.call.start', { metadata: { input_keys: Object.keys(input as object) } });

    try {
      const result = await next(toolName, input);
      const duration_ms = Math.round(performance.now() - start);
      emit('info', 'tool.call.success', { duration_ms });
      return result;
    } catch (error) {
      const duration_ms = Math.round(performance.now() - start);
      emit('error', 'tool.call.error', {
        duration_ms,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Cost Tracking
// ---------------------------------------------------------------------------

export interface CostRecord {
  tool: string;
  cost_level: string;
  timestamp: string;
  duration_ms: number;
}

export interface CostTracker {
  records: CostRecord[];
  total_calls: number;
  by_cost: Record<string, number>;
  getSummary(): CostSummary;
}

export interface CostSummary {
  total_calls: number;
  by_tool: Record<string, { calls: number; avg_duration_ms: number }>;
  by_cost_level: Record<string, number>;
}

export function createCostTracker(): CostTracker {
  const records: CostRecord[] = [];
  const by_cost: Record<string, number> = {};

  return {
    records,
    total_calls: 0,
    by_cost,
    getSummary() {
      const byTool: Record<string, { calls: number; total_duration: number }> = {};

      for (const r of records) {
        const entry = byTool[r.tool] ?? (byTool[r.tool] = { calls: 0, total_duration: 0 });
        entry.calls++;
        entry.total_duration += r.duration_ms;
      }

      return {
        total_calls: records.length,
        by_tool: Object.fromEntries(
          Object.entries(byTool).map(([k, v]) => [k, {
            calls: v.calls,
            avg_duration_ms: Math.round(v.total_duration / v.calls),
          }]),
        ),
        by_cost_level: { ...by_cost },
      };
    },
  };
}

/**
 * Cost tracking middleware — tracks cost levels and durations.
 */
export function costTrackingMiddleware(ir: AnvilIR, tracker?: CostTracker): Middleware {
  const t = tracker ?? createCostTracker();
  const toolMap = new Map(ir.tools.map(tool => [tool.name, tool]));

  return async (toolName, input, next) => {
    const tool = toolMap.get(toolName);
    const costLevel = tool?.cost ?? 'unknown';
    const start = performance.now();

    try {
      const result = await next(toolName, input);
      const duration_ms = Math.round(performance.now() - start);

      t.records.push({ tool: toolName, cost_level: costLevel, timestamp: new Date().toISOString(), duration_ms });
      t.total_calls++;
      t.by_cost[costLevel] = (t.by_cost[costLevel] ?? 0) + 1;

      return result;
    } catch (error) {
      const duration_ms = Math.round(performance.now() - start);
      t.records.push({ tool: toolName, cost_level: costLevel, timestamp: new Date().toISOString(), duration_ms });
      t.total_calls++;
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  last_failure: number;
  successes_in_half_open: number;
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failure_threshold?: number;
  /** Time in ms before attempting to close the circuit */
  recovery_timeout?: number;
  /** Number of successes in half-open needed to close */
  success_threshold?: number;
}

/**
 * Circuit breaker middleware — prevents cascading failures.
 * Opens the circuit after N consecutive failures, waits, then tries again.
 */
export function circuitBreakerMiddleware(options: CircuitBreakerOptions = {}): Middleware {
  const failureThreshold = options.failure_threshold ?? 5;
  const recoveryTimeout = options.recovery_timeout ?? 30_000;
  const successThreshold = options.success_threshold ?? 2;

  const circuits = new Map<string, CircuitBreakerState>();

  function getCircuit(name: string): CircuitBreakerState {
    if (!circuits.has(name)) {
      circuits.set(name, { state: 'closed', failures: 0, last_failure: 0, successes_in_half_open: 0 });
    }
    return circuits.get(name)!;
  }

  return async (toolName, input, next) => {
    const circuit = getCircuit(toolName);
    const now = Date.now();

    // Check circuit state
    if (circuit.state === 'open') {
      if (now - circuit.last_failure > recoveryTimeout) {
        circuit.state = 'half-open';
        circuit.successes_in_half_open = 0;
      } else {
        throw new Error(
          `Circuit breaker open for tool "${toolName}": ${circuit.failures} consecutive failures. ` +
          `Retry after ${Math.ceil((circuit.last_failure + recoveryTimeout - now) / 1000)}s.`,
        );
      }
    }

    try {
      const result = await next(toolName, input);

      if (circuit.state === 'half-open') {
        circuit.successes_in_half_open++;
        if (circuit.successes_in_half_open >= successThreshold) {
          circuit.state = 'closed';
          circuit.failures = 0;
        }
      } else {
        circuit.failures = 0;
      }

      return result;
    } catch (error) {
      circuit.failures++;
      circuit.last_failure = now;

      if (circuit.failures >= failureThreshold) {
        circuit.state = 'open';
      }

      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// OpenTelemetry Span Middleware (optional — uses OTel API if available)
// ---------------------------------------------------------------------------

/**
 * OpenTelemetry instrumentation middleware.
 * Creates spans for each tool call with attributes for tool name, cost, side effects.
 * Requires @opentelemetry/api as a peer dependency.
 */
export function otelMiddleware(ir: AnvilIR): Middleware {
  const toolMap = new Map(ir.tools.map(tool => [tool.name, tool]));

  return async (toolName, input, next) => {
    // Dynamic import — only loads if @opentelemetry/api is installed
    let otel: { trace: { getTracer(name: string): { startActiveSpan<T>(name: string, fn: (span: { setAttribute(k: string, v: string | boolean | number): void; end(): void }) => T): T } } } | undefined;
    try {
      const moduleName = '@opentelemetry' + '/api';
      otel = await (Function('m', 'return import(m)')(moduleName)) as any;
    } catch {
      return next(toolName, input);
    }

    const tracer = otel!.trace.getTracer('anvil-tools');
    const tool = toolMap.get(toolName);

    return tracer.startActiveSpan(`tool.${toolName}`, (span: any) => {
      span.setAttribute('anvil.tool.name', toolName);
      if (tool) {
        span.setAttribute('anvil.tool.cost', tool.cost);
        span.setAttribute('anvil.tool.side_effects', tool.side_effects);
        span.setAttribute('anvil.tool.idempotent', tool.idempotent);
      }

      return next(toolName, input)
        .then((result: unknown) => {
          span.setAttribute('anvil.tool.status', 'success');
          span.end();
          return result;
        })
        .catch((error: unknown) => {
          span.setAttribute('anvil.tool.status', 'error');
          span.setAttribute('anvil.tool.error', error instanceof Error ? error.message : String(error));
          span.end();
          throw error;
        });
    });
  };
}
