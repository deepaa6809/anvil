/**
 * Intermediate Representation (IR) for the Anvil compiler.
 *
 * The IR is produced by the schema parser/builder and consumed by target generators.
 * It normalizes all tool definitions into a uniform, resolved structure that
 * targets can operate on without worrying about parsing or validation.
 *
 * Design: the IR is intentionally flat and denormalized — each tool carries
 * its full context (including inherited defaults) so targets never need to
 * "look up" to the service level.
 */

import type {
  AnvilServiceDefinition,
  AnvilToolDefinition,
  AnvilField,
  AnvilPermission,
  AnvilRateLimit,
  AnvilAuth,
} from './types.js';

// ---------------------------------------------------------------------------
// IR types
// ---------------------------------------------------------------------------

export interface AnvilIR {
  /** Anvil schema version */
  version: string;
  /** Service metadata */
  service: AnvilIRService;
  /** Fully resolved tool definitions */
  tools: AnvilIRTool[];
  /** Generation metadata */
  meta: {
    generated_at: string;
    source_files?: string[];
    anvil_version: string;
  };
}

export interface AnvilIRService {
  name: string;
  version: string;
  description: string;
  base_url?: string;
  auth?: AnvilAuth;
  tags: string[];
}

export interface AnvilIRTool {
  /** Unique tool name (snake_case) */
  name: string;
  /** Human-facing description */
  description: string;
  /** Agent-facing description (falls back to human description) */
  agent_description: string;
  /** When to use (for agents) */
  when_to_use: string[];
  /** When not to use (for agents) */
  when_not_to_use: string[];
  /** Usage tips (for agents) */
  tips: string[];
  /** Resolved parameters with defaults applied */
  parameters: AnvilIRParameter[];
  /** Return type (null if fire-and-forget) */
  returns: AnvilField | null;
  /** Merged permissions (tool + service defaults) */
  permissions: AnvilPermission[];
  /** Resolved rate limit */
  rate_limit: AnvilRateLimit | null;
  /** Error definitions */
  errors: AnvilIRError[];
  /** Side effects classification */
  side_effects: string;
  /** Cost indicator */
  cost: string;
  /** Idempotency flag */
  idempotent: boolean;
  /** Cache configuration */
  cache: { ttl: number; vary_by: string[] } | null;
  /** Examples for eval */
  examples: AnvilIRExample[];
  /** Tags (merged from tool + service) */
  tags: string[];
  /** Deprecation status */
  deprecated: boolean;
  /** Deprecation message (if string was provided) */
  deprecation_message?: string;
}

export interface AnvilIRParameter {
  name: string;
  field: AnvilField;
  required: boolean;
  default_value: unknown;
}

export interface AnvilIRError {
  key: string;
  status?: number;
  code?: string;
  message: string;
  agent_hint?: string;
  retryable: boolean;
}

export interface AnvilIRExample {
  name: string;
  description?: string;
  input: Record<string, unknown>;
  output?: unknown;
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Lower service definition to IR
// ---------------------------------------------------------------------------

const ANVIL_VERSION = '0.1.0';

export function lowerToIR(
  service: AnvilServiceDefinition,
  sourceFiles?: string[],
): AnvilIR {
  const tools = Object.entries(service.tools).map(([name, tool]) =>
    lowerTool(name, tool, service),
  );

  return {
    version: service.anvil,
    service: {
      name: service.service.name,
      version: service.service.version,
      description: service.service.description ?? '',
      base_url: service.service.base_url,
      auth: service.service.auth,
      tags: service.service.tags ?? [],
    },
    tools,
    meta: {
      generated_at: new Date().toISOString(),
      source_files: sourceFiles,
      anvil_version: ANVIL_VERSION,
    },
  };
}

function lowerTool(
  name: string,
  tool: AnvilToolDefinition,
  service: AnvilServiceDefinition,
): AnvilIRTool {
  // Merge permissions: tool-specific + service defaults
  const permissions = [
    ...(service.service.default_permissions ?? []),
    ...(tool.permissions ?? []),
  ];

  // Resolve rate limit: tool overrides service default
  const rate_limit = tool.rate_limit ?? service.service.default_rate_limit ?? null;

  // Flatten parameters
  const parameters: AnvilIRParameter[] = Object.entries(tool.parameters).map(
    ([paramName, paramField]) => ({
      name: paramName,
      field: paramField,
      required: paramField.required ?? false,
      default_value: paramField.default,
    }),
  );

  // Flatten errors
  const errors: AnvilIRError[] = Object.entries(tool.errors ?? {}).map(
    ([key, err]) => ({
      key,
      status: err.status,
      code: err.code,
      message: err.message,
      agent_hint: err.agent_hint,
      retryable: err.retryable ?? false,
    }),
  );

  // Resolve deprecation
  const deprecated = tool.deprecated !== undefined && tool.deprecated !== false;
  const deprecation_message = typeof tool.deprecated === 'string' ? tool.deprecated : undefined;

  // Merge tags
  const tags = [...(service.service.tags ?? []), ...(tool.tags ?? [])];

  return {
    name,
    description: tool.description,
    agent_description: tool.agent?.description ?? tool.description,
    when_to_use: tool.agent?.when_to_use ?? [],
    when_not_to_use: tool.agent?.when_not_to_use ?? [],
    tips: tool.agent?.tips ?? [],
    parameters,
    returns: tool.returns ?? null,
    permissions,
    rate_limit,
    errors,
    side_effects: tool.side_effects ?? 'none',
    cost: tool.cost ?? 'free',
    idempotent: tool.idempotent ?? false,
    cache: tool.cache ? { ttl: tool.cache.ttl, vary_by: tool.cache.vary_by ?? [] } : null,
    examples: (tool.examples ?? []).map(ex => ({
      name: ex.name,
      description: ex.description,
      input: ex.input,
      output: ex.output,
      prompt: ex.prompt,
    })),
    tags,
    deprecated,
    deprecation_message,
  };
}

// ---------------------------------------------------------------------------
// IR utilities
// ---------------------------------------------------------------------------

/** Convert an AnvilField to JSON Schema (used by multiple targets) */
export function fieldToJsonSchema(f: AnvilField): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (f.description) base['description'] = f.description;

  switch (f.type) {
    case 'string': {
      base['type'] = 'string';
      if (f.validation?.min_length !== undefined) base['minLength'] = f.validation.min_length;
      if (f.validation?.max_length !== undefined) base['maxLength'] = f.validation.max_length;
      if (f.validation?.pattern) base['pattern'] = f.validation.pattern;
      if (f.validation?.format) base['format'] = f.validation.format;
      if (f.examples) base['examples'] = f.examples;
      break;
    }
    case 'number':
    case 'integer': {
      base['type'] = f.type;
      if (f.validation?.minimum !== undefined) base['minimum'] = f.validation.minimum;
      if (f.validation?.maximum !== undefined) base['maximum'] = f.validation.maximum;
      if (f.validation?.exclusive_minimum !== undefined) base['exclusiveMinimum'] = f.validation.exclusive_minimum;
      if (f.validation?.exclusive_maximum !== undefined) base['exclusiveMaximum'] = f.validation.exclusive_maximum;
      if (f.validation?.multiple_of !== undefined) base['multipleOf'] = f.validation.multiple_of;
      break;
    }
    case 'boolean': {
      base['type'] = 'boolean';
      break;
    }
    case 'enum': {
      const allStrings = f.values.every(v => typeof v === 'string');
      const allNumbers = f.values.every(v => typeof v === 'number');
      if (allStrings) base['type'] = 'string';
      else if (allNumbers) base['type'] = 'number';
      base['enum'] = f.values;
      break;
    }
    case 'object': {
      base['type'] = 'object';
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, prop] of Object.entries(f.properties)) {
        properties[key] = fieldToJsonSchema(prop);
        if (prop.required) required.push(key);
      }
      base['properties'] = properties;
      if (required.length > 0) base['required'] = required;
      if (f.additional_properties !== undefined) base['additionalProperties'] = f.additional_properties;
      break;
    }
    case 'array': {
      base['type'] = 'array';
      base['items'] = fieldToJsonSchema(f.items);
      if (f.validation?.min_items !== undefined) base['minItems'] = f.validation.min_items;
      if (f.validation?.max_items !== undefined) base['maxItems'] = f.validation.max_items;
      if (f.validation?.unique_items) base['uniqueItems'] = true;
      break;
    }
    case 'union': {
      if (f.discriminator) {
        base['discriminator'] = { propertyName: f.discriminator };
      }
      base['oneOf'] = f.variants.map(v => fieldToJsonSchema(v));
      break;
    }
  }

  if (f.default !== undefined) base['default'] = f.default;

  return base;
}

/** Build a JSON Schema "object" for a tool's parameters */
export function toolParametersToJsonSchema(tool: AnvilIRTool): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    properties[param.name] = fieldToJsonSchema(param.field);
    if (param.required) required.push(param.name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
