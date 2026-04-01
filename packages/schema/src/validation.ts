/**
 * Zod schemas for validating Anvil tool definitions.
 *
 * These schemas serve double duty:
 * 1. Validate raw YAML/JSON input
 * 2. Provide type-safe runtime parsing with coercion
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const scalarType = z.enum(['string', 'number', 'integer', 'boolean']);
const fieldType = z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array', 'enum', 'union']);

// ---------------------------------------------------------------------------
// Field schemas (recursive)
// ---------------------------------------------------------------------------

const fieldBase = z.object({
  type: fieldType,
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  examples: z.array(z.unknown()).optional(),
  deprecated: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const stringValidation = z.object({
  min_length: z.number().int().nonnegative().optional(),
  max_length: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  format: z.string().optional(),
}).strict().optional();

const numberValidation = z.object({
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  exclusive_minimum: z.number().optional(),
  exclusive_maximum: z.number().optional(),
  multiple_of: z.number().positive().optional(),
}).strict().optional();

const arrayValidation = z.object({
  min_items: z.number().int().nonnegative().optional(),
  max_items: z.number().int().positive().optional(),
  unique_items: z.boolean().optional(),
}).strict().optional();

// Recursive field schema using z.lazy
export const anvilFieldSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.discriminatedUnion('type', [
    fieldBase.extend({
      type: z.literal('string'),
      validation: stringValidation,
    }),
    fieldBase.extend({
      type: z.literal('number'),
      validation: numberValidation,
    }),
    fieldBase.extend({
      type: z.literal('integer'),
      validation: numberValidation,
    }),
    fieldBase.extend({
      type: z.literal('boolean'),
    }),
    fieldBase.extend({
      type: z.literal('enum'),
      values: z.array(z.union([z.string(), z.number()])).min(1),
    }),
    fieldBase.extend({
      type: z.literal('object'),
      properties: z.record(anvilFieldSchema),
      additional_properties: z.boolean().optional(),
    }),
    fieldBase.extend({
      type: z.literal('array'),
      items: anvilFieldSchema,
      validation: arrayValidation,
    }),
    fieldBase.extend({
      type: z.literal('union'),
      variants: z.array(anvilFieldSchema).min(2),
      discriminator: z.string().optional(),
    }),
  ])
);

// ---------------------------------------------------------------------------
// Agent metadata
// ---------------------------------------------------------------------------

const agentMetaSchema = z.object({
  description: z.string().optional(),
  when_to_use: z.array(z.string()).optional(),
  when_not_to_use: z.array(z.string()).optional(),
  tips: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

const permissionTypeSchema = z.enum([
  'network', 'filesystem', 'environment', 'subprocess', 'database', 'secret', 'custom',
]);

const permissionSchema = z.object({
  type: permissionTypeSchema,
  target: z.string(),
  methods: z.array(z.string()).optional(),
  reason: z.string().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

const rateLimitSchema = z.object({
  requests: z.number().int().positive(),
  period: z.string().regex(/^\d+[smhd]$/, 'Period must be like "100r/1h" — number followed by s/m/h/d'),
}).strict();

// ---------------------------------------------------------------------------
// Error definition
// ---------------------------------------------------------------------------

const errorSchema = z.object({
  status: z.number().int().optional(),
  code: z.string().optional(),
  message: z.string(),
  agent_hint: z.string().optional(),
  retryable: z.boolean().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Cache hint
// ---------------------------------------------------------------------------

const cacheHintSchema = z.object({
  ttl: z.number().int().positive(),
  vary_by: z.array(z.string()).optional(),
}).strict();

// ---------------------------------------------------------------------------
// Example
// ---------------------------------------------------------------------------

const exampleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  prompt: z.string().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Side effects & cost
// ---------------------------------------------------------------------------

const sideEffectsSchema = z.enum(['none', 'read', 'write', 'destructive']);
const costSchema = z.enum(['free', 'low', 'medium', 'high', 'variable']);

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const toolDefinitionSchema = z.object({
  description: z.string().min(1, 'Tool must have a description'),
  agent: agentMetaSchema.optional(),
  parameters: z.record(anvilFieldSchema),
  returns: anvilFieldSchema.optional(),
  permissions: z.array(permissionSchema).optional(),
  rate_limit: rateLimitSchema.optional(),
  errors: z.record(errorSchema).optional(),
  side_effects: sideEffectsSchema.optional(),
  cost: costSchema.optional(),
  idempotent: z.boolean().optional(),
  cache: cacheHintSchema.optional(),
  examples: z.array(exampleSchema).optional(),
  tags: z.array(z.string()).optional(),
  deprecated: z.union([z.boolean(), z.string()]).optional(),
}).strict();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const authTypeSchema = z.enum(['api_key', 'bearer', 'basic', 'oauth2', 'custom']);

const oauth2Schema = z.object({
  authorization_url: z.string().url().optional(),
  token_url: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
}).strict();

const authSchema = z.object({
  type: authTypeSchema,
  header: z.string().optional(),
  env_var: z.string().optional(),
  oauth2: oauth2Schema.optional(),
}).strict();

// ---------------------------------------------------------------------------
// Service (top-level)
// ---------------------------------------------------------------------------

const serviceMetaSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_-]*$/, 'Service name must be lowercase kebab/snake'),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver (x.y.z)'),
  description: z.string().optional(),
  base_url: z.string().url().optional(),
  auth: authSchema.optional(),
  default_permissions: z.array(permissionSchema).optional(),
  default_rate_limit: rateLimitSchema.optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export const serviceDefinitionSchema = z.object({
  anvil: z.string().regex(/^\d+\.\d+$/, 'Anvil version must be like "1.0"'),
  service: serviceMetaSchema,
  tools: z.record(
    z.string().regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be lowercase snake_case'),
    toolDefinitionSchema,
  ).refine(obj => Object.keys(obj).length > 0, 'At least one tool must be defined'),
}).strict();

// ---------------------------------------------------------------------------
// Inferred types (use these when you want Zod-validated types)
// ---------------------------------------------------------------------------

export type ValidatedServiceDefinition = z.infer<typeof serviceDefinitionSchema>;
export type ValidatedToolDefinition = z.infer<typeof toolDefinitionSchema>;
