/**
 * Anvil Schema Types
 *
 * These types define the canonical representation of an Anvil tool definition.
 * Everything — YAML parser, TypeScript builder, and all targets — operates on these types.
 */

// ---------------------------------------------------------------------------
// Scalar & field types
// ---------------------------------------------------------------------------

export type AnvilScalarType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean';

export type AnvilFieldType =
  | AnvilScalarType
  | 'object'
  | 'array'
  | 'enum'
  | 'union';

// ---------------------------------------------------------------------------
// Field definitions (recursive — objects contain fields)
// ---------------------------------------------------------------------------

export interface AnvilFieldBase {
  type: AnvilFieldType;
  description?: string;
  required?: boolean;
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  /** Free-form metadata targets can use */
  metadata?: Record<string, unknown>;
}

export interface AnvilStringField extends AnvilFieldBase {
  type: 'string';
  validation?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    format?: 'email' | 'uri' | 'uuid' | 'date' | 'datetime' | 'ip' | string;
  };
}

export interface AnvilNumberField extends AnvilFieldBase {
  type: 'number' | 'integer';
  validation?: {
    minimum?: number;
    maximum?: number;
    exclusive_minimum?: number;
    exclusive_maximum?: number;
    multiple_of?: number;
  };
}

export interface AnvilBooleanField extends AnvilFieldBase {
  type: 'boolean';
}

export interface AnvilEnumField extends AnvilFieldBase {
  type: 'enum';
  values: (string | number)[];
}

export interface AnvilObjectField extends AnvilFieldBase {
  type: 'object';
  properties: Record<string, AnvilField>;
  additional_properties?: boolean;
}

export interface AnvilArrayField extends AnvilFieldBase {
  type: 'array';
  items: AnvilField;
  validation?: {
    min_items?: number;
    max_items?: number;
    unique_items?: boolean;
  };
}

export interface AnvilUnionField extends AnvilFieldBase {
  type: 'union';
  variants: AnvilField[];
  discriminator?: string;
}

export type AnvilField =
  | AnvilStringField
  | AnvilNumberField
  | AnvilBooleanField
  | AnvilEnumField
  | AnvilObjectField
  | AnvilArrayField
  | AnvilUnionField;

// ---------------------------------------------------------------------------
// Agent-facing metadata
// ---------------------------------------------------------------------------

export interface AnvilAgentMeta {
  /** Rich description optimized for LLM consumption */
  description?: string;
  /** Scenarios where the agent should use this tool */
  when_to_use?: string[];
  /** Scenarios where the agent should NOT use this tool */
  when_not_to_use?: string[];
  /** Tips for optimal usage */
  tips?: string[];
  /** Priority relative to similar tools: higher = prefer */
  priority?: number;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type AnvilPermissionType =
  | 'network'
  | 'filesystem'
  | 'environment'
  | 'subprocess'
  | 'database'
  | 'secret'
  | 'custom';

export interface AnvilPermission {
  type: AnvilPermissionType;
  /** Target resource (URL, path pattern, env var, etc.) */
  target: string;
  /** Allowed operations */
  methods?: string[];
  /** Human-readable reason this permission is needed */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export interface AnvilRateLimit {
  requests: number;
  period: string; // e.g. "1m", "1h", "1d"
}

// ---------------------------------------------------------------------------
// Error definitions
// ---------------------------------------------------------------------------

export interface AnvilError {
  status?: number;
  code?: string;
  message: string;
  /** Hint for agents on how to handle this error */
  agent_hint?: string;
  retryable?: boolean;
}

// ---------------------------------------------------------------------------
// Cache hints
// ---------------------------------------------------------------------------

export interface AnvilCacheHint {
  /** TTL in seconds */
  ttl: number;
  /** Cache key fields (parameter names to include in cache key) */
  vary_by?: string[];
}

// ---------------------------------------------------------------------------
// Examples (used for eval + docs)
// ---------------------------------------------------------------------------

export interface AnvilExample {
  name: string;
  description?: string;
  input: Record<string, unknown>;
  output?: unknown;
  /** For eval: natural language prompt that should trigger this tool */
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export type AnvilSideEffects = 'none' | 'read' | 'write' | 'destructive';
export type AnvilCost = 'free' | 'low' | 'medium' | 'high' | 'variable';

export interface AnvilToolDefinition {
  /** Human-facing description */
  description: string;
  /** Agent-facing metadata */
  agent?: AnvilAgentMeta;
  /** Input parameters */
  parameters: Record<string, AnvilField>;
  /** Return type (optional — some tools are fire-and-forget) */
  returns?: AnvilField;
  /** Required permissions */
  permissions?: AnvilPermission[];
  /** Rate limiting config */
  rate_limit?: AnvilRateLimit;
  /** Known error types */
  errors?: Record<string, AnvilError>;
  /** Side effect classification */
  side_effects?: AnvilSideEffects;
  /** Cost indicator for agent decision-making */
  cost?: AnvilCost;
  /** Whether the tool is idempotent (safe to retry) */
  idempotent?: boolean;
  /** Cache configuration */
  cache?: AnvilCacheHint;
  /** Example invocations */
  examples?: AnvilExample[];
  /** Tags for categorization */
  tags?: string[];
  /** Mark as deprecated */
  deprecated?: boolean | string;
}

// ---------------------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------------------

export type AnvilAuthType = 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'custom';

export interface AnvilAuth {
  type: AnvilAuthType;
  /** Header name (for api_key/bearer) */
  header?: string;
  /** Environment variable holding the credential */
  env_var?: string;
  /** OAuth2 configuration */
  oauth2?: {
    authorization_url?: string;
    token_url?: string;
    scopes?: string[];
  };
}

// ---------------------------------------------------------------------------
// Service (top-level definition)
// ---------------------------------------------------------------------------

export interface AnvilServiceDefinition {
  /** Schema version */
  anvil: string;
  /** Service metadata */
  service: {
    name: string;
    version: string;
    description?: string;
    base_url?: string;
    auth?: AnvilAuth;
    /** Default permissions applied to all tools */
    default_permissions?: AnvilPermission[];
    /** Default rate limit applied to all tools */
    default_rate_limit?: AnvilRateLimit;
    tags?: string[];
  };
  /** Tool definitions */
  tools: Record<string, AnvilToolDefinition>;
}
