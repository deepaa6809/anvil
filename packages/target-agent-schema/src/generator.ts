/**
 * Agent Schema Generator
 *
 * Generates a compact, LLM-optimized schema for AI agents.
 * This is a KEY differentiator — the output is specifically designed
 * to maximize agent tool selection accuracy and correct usage.
 *
 * Includes: agent descriptions, when_to_use/when_not_to_use, tips,
 *           parameters, examples, cost/side_effects.
 * Excludes: permissions, cache config, rate limits (runtime concerns).
 */

import type { AnvilIR, AnvilIRTool, AnvilField } from '@anvil-tools/schema';
import type { TargetResult, GeneratedFile } from '@anvil-tools/compiler';

export interface AgentSchemaOptions {
  format?: 'json' | 'yaml';
  compact?: boolean;
}

export function generateAgentSchema(ir: AnvilIR, options: AgentSchemaOptions = {}): TargetResult {
  const format = options.format ?? 'json';
  const compact = options.compact ?? false;
  const files: GeneratedFile[] = [];

  const schema = buildAgentSchema(ir, compact);

  if (format === 'json') {
    files.push({
      path: 'agent-schema.json',
      content: JSON.stringify(schema, null, compact ? 0 : 2),
      type: 'schema',
    });
  } else {
    files.push({
      path: 'agent-schema.yaml',
      content: agentSchemaToYaml(schema),
      type: 'schema',
    });
  }

  return { target: 'agent-schema', files };
}

interface AgentToolSchema {
  name: string;
  description: string;
  when_to_use?: string[];
  when_not_to_use?: string[];
  tips?: string[];
  parameters: Record<string, AgentParamSchema>;
  returns?: Record<string, unknown>;
  cost: string;
  side_effects: string;
  idempotent: boolean;
  errors?: Array<{ code: string; hint: string }>;
  examples?: Array<{
    prompt?: string;
    input: Record<string, unknown>;
    output?: unknown;
  }>;
}

interface AgentParamSchema {
  type: string;
  description?: string;
  required: boolean;
  default?: unknown;
  enum?: (string | number)[];
  examples?: unknown[];
}

function buildAgentSchema(ir: AnvilIR, compact: boolean): {
  service: string;
  version: string;
  tools: AgentToolSchema[];
} {
  return {
    service: ir.service.name,
    version: ir.service.version,
    tools: ir.tools.map(t => buildToolSchema(t, compact)),
  };
}

function buildToolSchema(tool: AnvilIRTool, compact: boolean): AgentToolSchema {
  const schema: AgentToolSchema = {
    name: tool.name,
    description: tool.agent_description,
    cost: tool.cost,
    side_effects: tool.side_effects,
    idempotent: tool.idempotent,
    parameters: {},
  };

  // Only include non-empty arrays
  if (tool.when_to_use.length > 0) schema.when_to_use = tool.when_to_use;
  if (tool.when_not_to_use.length > 0) schema.when_not_to_use = tool.when_not_to_use;
  if (tool.tips.length > 0) schema.tips = tool.tips;

  // Parameters — flattened for agent readability
  for (const param of tool.parameters) {
    const p: AgentParamSchema = {
      type: flatFieldType(param.field),
      required: param.required,
    };
    if (param.field.description) p.description = param.field.description;
    if (param.default_value !== undefined) p.default = param.default_value;
    if (param.field.type === 'enum') p.enum = param.field.values;
    if (param.field.examples && param.field.examples.length > 0 && !compact) {
      p.examples = param.field.examples;
    }
    schema.parameters[param.name] = p;
  }

  // Returns — simplified
  if (tool.returns && !compact) {
    schema.returns = simplifiedReturn(tool.returns);
  }

  // Errors with agent hints only
  const hintedErrors = tool.errors.filter(e => e.agent_hint);
  if (hintedErrors.length > 0) {
    schema.errors = hintedErrors.map(e => ({
      code: e.code ?? e.key,
      hint: e.agent_hint!,
    }));
  }

  // Examples — include prompt + input for few-shot
  if (tool.examples.length > 0) {
    schema.examples = tool.examples.map(ex => {
      const entry: { prompt?: string; input: Record<string, unknown>; output?: unknown } = {
        input: ex.input,
      };
      if (ex.prompt) entry.prompt = ex.prompt;
      if (ex.output !== undefined && !compact) entry.output = ex.output;
      return entry;
    });
  }

  return schema;
}

function flatFieldType(f: AnvilField): string {
  switch (f.type) {
    case 'enum': return `enum(${f.values.join('|')})`;
    case 'array': return `array<${flatFieldType(f.items)}>`;
    case 'object': return 'object';
    case 'union': return f.variants.map(v => flatFieldType(v)).join(' | ');
    default: return f.type;
  }
}

function simplifiedReturn(f: AnvilField): Record<string, unknown> {
  if (f.type === 'object') {
    const props: Record<string, string> = {};
    for (const [key, prop] of Object.entries(f.properties)) {
      props[key] = `${flatFieldType(prop)}${prop.description ? ` — ${prop.description}` : ''}`;
    }
    return props;
  }
  return { type: flatFieldType(f), description: f.description ?? '' };
}

function agentSchemaToYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(': ') || obj.includes('#') || /^[{[]/.test(obj)) {
      return JSON.stringify(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '\n' + obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        const inner = agentSchemaToYaml(item, indent + 2).trimStart();
        const lines = inner.split('\n');
        return pad + '  - ' + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
      }
      return pad + '  - ' + agentSchemaToYaml(item, indent + 1);
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return '\n' + entries.map(([k, v]) => {
      const val = agentSchemaToYaml(v, indent + 1);
      return val.startsWith('\n') ? `${pad}  ${k}:${val}` : `${pad}  ${k}: ${val}`;
    }).join('\n');
  }
  return String(obj);
}
