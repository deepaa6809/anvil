/**
 * Runtime input/output validation for Anvil tools.
 *
 * Builds Zod schemas dynamically from AnvilField definitions and
 * validates tool inputs/outputs at runtime.
 */

import { z, type ZodType } from 'zod';
import type {
  AnvilField,
  AnvilIRTool,
  AnvilIR,
} from '@anvil-tools/schema';

// ---------------------------------------------------------------------------
// Field → Zod schema conversion
// ---------------------------------------------------------------------------

export function fieldToZod(field: AnvilField): ZodType {
  switch (field.type) {
    case 'string': {
      let schema = z.string();
      if (field.validation?.min_length !== undefined) schema = schema.min(field.validation.min_length);
      if (field.validation?.max_length !== undefined) schema = schema.max(field.validation.max_length);
      if (field.validation?.pattern) schema = schema.regex(new RegExp(field.validation.pattern));
      if (field.validation?.format === 'email') schema = schema.email();
      if (field.validation?.format === 'uri') schema = schema.url();
      if (field.validation?.format === 'uuid') schema = schema.uuid();
      return field.required ? schema : schema.optional();
    }
    case 'number': {
      let schema = z.number();
      if (field.validation?.minimum !== undefined) schema = schema.min(field.validation.minimum);
      if (field.validation?.maximum !== undefined) schema = schema.max(field.validation.maximum);
      if (field.validation?.exclusive_minimum !== undefined) schema = schema.gt(field.validation.exclusive_minimum);
      if (field.validation?.exclusive_maximum !== undefined) schema = schema.lt(field.validation.exclusive_maximum);
      if (field.validation?.multiple_of !== undefined) schema = schema.multipleOf(field.validation.multiple_of);
      return field.required ? schema : schema.optional();
    }
    case 'integer': {
      let schema = z.number().int();
      if (field.validation?.minimum !== undefined) schema = schema.min(field.validation.minimum);
      if (field.validation?.maximum !== undefined) schema = schema.max(field.validation.maximum);
      return field.required ? schema : schema.optional();
    }
    case 'boolean': {
      const schema = z.boolean();
      return field.required ? schema : schema.optional();
    }
    case 'enum': {
      const values = field.values.map(v => z.literal(v));
      // z.union requires at least 2 members
      const schema = values.length === 1
        ? values[0]!
        : z.union([values[0]!, values[1]!, ...values.slice(2)]);
      return field.required ? schema : schema.optional();
    }
    case 'object': {
      const shape: Record<string, ZodType> = {};
      for (const [key, prop] of Object.entries(field.properties)) {
        shape[key] = fieldToZod(prop);
      }
      let schema: ZodType = field.additional_properties
        ? z.object(shape).passthrough()
        : z.object(shape);
      return field.required ? schema : schema.optional();
    }
    case 'array': {
      let schema = z.array(fieldToZod(field.items));
      if (field.validation?.min_items !== undefined) schema = schema.min(field.validation.min_items);
      if (field.validation?.max_items !== undefined) schema = schema.max(field.validation.max_items);
      return field.required ? schema : schema.optional();
    }
    case 'union': {
      const variants = field.variants.map(v => fieldToZod(v));
      const schema = variants.length === 1
        ? variants[0]!
        : z.union([variants[0]!, variants[1]!, ...variants.slice(2)]);
      return field.required ? schema : schema.optional();
    }
  }
}

// ---------------------------------------------------------------------------
// Build schemas for a tool
// ---------------------------------------------------------------------------

export interface ToolSchemas {
  input: ZodType;
  output: ZodType | null;
}

export function buildToolSchemas(tool: AnvilIRTool): ToolSchemas {
  const shape: Record<string, ZodType> = {};
  for (const param of tool.parameters) {
    let schema = fieldToZod(param.field);
    if (param.default_value !== undefined) {
      schema = schema.default(param.default_value) as unknown as ZodType;
    }
    shape[param.name] = param.required ? schema : schema.optional();
  }

  const input = z.object(shape);
  const output = tool.returns ? fieldToZod(tool.returns) : null;

  return { input, output };
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: Array<{ path: string; message: string }>;
}

export function validateInput(tool: AnvilIRTool, input: unknown): ValidationResult {
  const schemas = buildToolSchemas(tool);
  const result = schemas.input.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export function validateOutput(tool: AnvilIRTool, output: unknown): ValidationResult {
  const schemas = buildToolSchemas(tool);

  if (!schemas.output) {
    return { success: true, data: output };
  }

  const result = schemas.output.safeParse(output);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// Build all schemas for an IR
// ---------------------------------------------------------------------------

export function buildAllSchemas(ir: AnvilIR): Map<string, ToolSchemas> {
  const schemas = new Map<string, ToolSchemas>();
  for (const tool of ir.tools) {
    schemas.set(tool.name, buildToolSchemas(tool));
  }
  return schemas;
}
