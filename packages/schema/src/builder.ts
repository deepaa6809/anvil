/**
 * TypeScript builder API for Anvil tool definitions.
 *
 * Provides a fluent, type-safe way to define tools programmatically:
 *
 * ```typescript
 * import { defineService, field } from '@anvil-tools/schema';
 *
 * export default defineService({
 *   name: 'weather-tools',
 *   version: '1.0.0',
 *   tools: {
 *     get_weather: {
 *       description: 'Get current weather',
 *       parameters: {
 *         location: field.string({ required: true }),
 *       },
 *       returns: field.object({
 *         temperature: field.number(),
 *       }),
 *     },
 *   },
 * });
 * ```
 */

import type {
  AnvilServiceDefinition,
  AnvilToolDefinition,
  AnvilField,
  AnvilStringField,
  AnvilNumberField,
  AnvilBooleanField,
  AnvilEnumField,
  AnvilObjectField,
  AnvilArrayField,
  AnvilUnionField,
  AnvilAgentMeta,
  AnvilPermission,
  AnvilRateLimit,
  AnvilError as AnvilErrorDef,
  AnvilExample,
  AnvilSideEffects,
  AnvilCost,
  AnvilCacheHint,
  AnvilAuth,
} from './types.js';

// ---------------------------------------------------------------------------
// Field builders — concise factory functions
// ---------------------------------------------------------------------------

type FieldOpts<T extends AnvilField> = Omit<T, 'type'>;

export const field = {
  string(opts: Omit<FieldOpts<AnvilStringField>, 'type'> = {}): AnvilStringField {
    return { type: 'string' as const, ...opts };
  },

  number(opts: Omit<FieldOpts<AnvilNumberField>, 'type'> = {}): AnvilNumberField {
    return { type: 'number' as const, ...opts };
  },

  integer(opts: Omit<FieldOpts<AnvilNumberField>, 'type'> = {}): AnvilNumberField {
    return { type: 'integer' as const, ...opts };
  },

  boolean(opts: Omit<FieldOpts<AnvilBooleanField>, 'type'> = {}): AnvilBooleanField {
    return { type: 'boolean' as const, ...opts };
  },

  enum(values: (string | number)[], opts: Omit<FieldOpts<AnvilEnumField>, 'type' | 'values'> = {}): AnvilEnumField {
    return { type: 'enum' as const, values, ...opts };
  },

  object(
    properties: Record<string, AnvilField>,
    opts: Omit<FieldOpts<AnvilObjectField>, 'type' | 'properties'> = {},
  ): AnvilObjectField {
    return { type: 'object' as const, properties, ...opts };
  },

  array(items: AnvilField, opts: Omit<FieldOpts<AnvilArrayField>, 'type' | 'items'> = {}): AnvilArrayField {
    return { type: 'array' as const, items, ...opts };
  },

  union(variants: AnvilField[], opts: Omit<FieldOpts<AnvilUnionField>, 'type' | 'variants'> = {}): AnvilUnionField {
    return { type: 'union' as const, variants, ...opts };
  },
};

// ---------------------------------------------------------------------------
// Service definition builder
// ---------------------------------------------------------------------------

export interface DefineServiceInput {
  name: string;
  version: string;
  description?: string;
  base_url?: string;
  auth?: AnvilAuth;
  default_permissions?: AnvilPermission[];
  default_rate_limit?: AnvilRateLimit;
  tags?: string[];
  tools: Record<string, DefineToolInput>;
}

export interface DefineToolInput {
  description: string;
  agent?: AnvilAgentMeta;
  parameters: Record<string, AnvilField>;
  returns?: AnvilField;
  permissions?: AnvilPermission[];
  rate_limit?: AnvilRateLimit;
  errors?: Record<string, AnvilErrorDef>;
  side_effects?: AnvilSideEffects;
  cost?: AnvilCost;
  idempotent?: boolean;
  cache?: AnvilCacheHint;
  examples?: AnvilExample[];
  tags?: string[];
  deprecated?: boolean | string;
}

/**
 * Define an Anvil service from TypeScript.
 * This is the main entry point for programmatic tool definitions.
 */
export function defineService(input: DefineServiceInput): AnvilServiceDefinition {
  const tools: Record<string, AnvilToolDefinition> = {};

  for (const [name, toolInput] of Object.entries(input.tools)) {
    tools[name] = buildTool(toolInput);
  }

  return {
    anvil: '1.0',
    service: {
      name: input.name,
      version: input.version,
      description: input.description,
      base_url: input.base_url,
      auth: input.auth,
      default_permissions: input.default_permissions,
      default_rate_limit: input.default_rate_limit,
      tags: input.tags,
    },
    tools,
  };
}

function buildTool(input: DefineToolInput): AnvilToolDefinition {
  return {
    description: input.description,
    agent: input.agent,
    parameters: input.parameters,
    returns: input.returns,
    permissions: input.permissions,
    rate_limit: input.rate_limit,
    errors: input.errors,
    side_effects: input.side_effects,
    cost: input.cost,
    idempotent: input.idempotent,
    cache: input.cache,
    examples: input.examples,
    tags: input.tags,
    deprecated: input.deprecated,
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers for permissions
// ---------------------------------------------------------------------------

export const permission = {
  network(target: string, methods?: string[], reason?: string): AnvilPermission {
    return { type: 'network', target, methods, reason };
  },
  filesystem(target: string, methods?: string[], reason?: string): AnvilPermission {
    return { type: 'filesystem', target, methods, reason };
  },
  environment(target: string, reason?: string): AnvilPermission {
    return { type: 'environment', target, reason };
  },
  subprocess(target: string, reason?: string): AnvilPermission {
    return { type: 'subprocess', target, reason };
  },
  database(target: string, methods?: string[], reason?: string): AnvilPermission {
    return { type: 'database', target, methods, reason };
  },
  secret(target: string, reason?: string): AnvilPermission {
    return { type: 'secret', target, reason };
  },
};
