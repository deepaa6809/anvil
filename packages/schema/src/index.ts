// Core types
export type {
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
  AnvilFieldType,
  AnvilScalarType,
  AnvilAgentMeta,
  AnvilPermission,
  AnvilPermissionType,
  AnvilRateLimit,
  AnvilError as AnvilErrorDef,
  AnvilCacheHint,
  AnvilExample,
  AnvilSideEffects,
  AnvilCost,
  AnvilAuth,
  AnvilAuthType,
} from './types.js';

// Validation schemas
export {
  serviceDefinitionSchema,
  toolDefinitionSchema,
  anvilFieldSchema,
  type ValidatedServiceDefinition,
  type ValidatedToolDefinition,
} from './validation.js';

// Parser
export {
  parseAnvilYaml,
  mergeAnvilDefinitions,
  type ParseOptions,
  type ParseResult,
} from './parser.js';

// Builder API
export {
  defineService,
  field,
  permission,
  type DefineServiceInput,
  type DefineToolInput,
} from './builder.js';

// IR
export {
  lowerToIR,
  fieldToJsonSchema,
  toolParametersToJsonSchema,
  type AnvilIR,
  type AnvilIRService,
  type AnvilIRTool,
  type AnvilIRParameter,
  type AnvilIRError,
  type AnvilIRExample,
} from './ir.js';

// Errors
export {
  AnvilError,
  type AnvilDiagnostic,
  type AnvilSeverity,
  type AnvilSourceLocation,
} from './errors.js';
