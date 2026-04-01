/**
 * YAML parser for Anvil tool definitions.
 *
 * Parses .anvil.yaml files into validated AnvilServiceDefinition objects.
 * Provides rich error messages with source locations.
 */

import { parse as parseYaml, LineCounter, type Document } from 'yaml';
import { serviceDefinitionSchema } from './validation.js';
import { AnvilError, type AnvilDiagnostic } from './errors.js';
import type { AnvilServiceDefinition } from './types.js';

export interface ParseOptions {
  /** File path for error messages */
  filePath?: string;
  /** Whether to allow unknown keys (lenient mode) */
  lenient?: boolean;
}

export interface ParseResult {
  /** The parsed and validated service definition */
  service: AnvilServiceDefinition;
  /** Warnings generated during parsing */
  warnings: AnvilDiagnostic[];
}

/**
 * Parse a YAML string into a validated AnvilServiceDefinition.
 */
export function parseAnvilYaml(source: string, options: ParseOptions = {}): ParseResult {
  const { filePath } = options;
  const warnings: AnvilDiagnostic[] = [];
  const lineCounter = new LineCounter();

  // Step 1: Parse YAML
  let raw: unknown;
  try {
    raw = parseYaml(source, { lineCounter, prettyErrors: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AnvilError([{
      severity: 'error',
      code: 'YAML_PARSE_ERROR',
      message: `Failed to parse YAML: ${message}`,
      location: { file: filePath },
    }]);
  }

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new AnvilError([{
      severity: 'error',
      code: 'EMPTY_DOCUMENT',
      message: 'Anvil definition file is empty or not an object',
      location: { file: filePath },
    }]);
  }

  // Step 2: Validate against Zod schema
  const result = serviceDefinitionSchema.safeParse(raw);

  if (!result.success) {
    const diagnostics: AnvilDiagnostic[] = result.error.issues.map(issue => ({
      severity: 'error' as const,
      code: `VALIDATION_${issue.code.toUpperCase()}`,
      message: issue.message,
      location: {
        file: filePath,
        path: issue.path.join('.'),
      },
      hint: formatZodHint(issue),
    }));
    throw new AnvilError(diagnostics);
  }

  // Step 3: Semantic validation (things Zod can't catch)
  const service = result.data as unknown as AnvilServiceDefinition;
  semanticValidation(service, warnings, filePath);

  return { service, warnings };
}

/**
 * Parse multiple YAML files and merge them into a single service definition.
 */
export function mergeAnvilDefinitions(definitions: ParseResult[]): ParseResult {
  if (definitions.length === 0) {
    throw new AnvilError([{
      severity: 'error',
      code: 'NO_DEFINITIONS',
      message: 'No Anvil definitions provided',
    }]);
  }

  const base = definitions[0]!;
  const mergedTools = { ...base.service.tools };
  const allWarnings = [...base.warnings];

  for (let i = 1; i < definitions.length; i++) {
    const def = definitions[i]!;
    allWarnings.push(...def.warnings);

    for (const [name, tool] of Object.entries(def.service.tools)) {
      if (mergedTools[name]) {
        allWarnings.push({
          severity: 'warning',
          code: 'DUPLICATE_TOOL',
          message: `Tool "${name}" defined in multiple files — later definition wins`,
        });
      }
      mergedTools[name] = tool;
    }
  }

  return {
    service: { ...base.service, tools: mergedTools },
    warnings: allWarnings,
  };
}

// ---------------------------------------------------------------------------
// Semantic validation
// ---------------------------------------------------------------------------

function semanticValidation(
  service: AnvilServiceDefinition,
  warnings: AnvilDiagnostic[],
  filePath?: string,
): void {
  for (const [toolName, tool] of Object.entries(service.tools)) {
    // Warn if no agent description is provided
    if (!tool.agent?.description) {
      warnings.push({
        severity: 'info',
        code: 'MISSING_AGENT_DESC',
        message: `Tool "${toolName}" has no agent description — agents will use the human description`,
        location: { file: filePath, path: `tools.${toolName}.agent` },
        hint: 'Add an agent.description for better LLM tool selection',
      });
    }

    // Warn if no examples
    if (!tool.examples || tool.examples.length === 0) {
      warnings.push({
        severity: 'info',
        code: 'NO_EXAMPLES',
        message: `Tool "${toolName}" has no examples — eval harness will have no test cases`,
        location: { file: filePath, path: `tools.${toolName}.examples` },
        hint: 'Add examples for documentation and eval generation',
      });
    }

    // Validate example inputs match parameter schema
    if (tool.examples) {
      for (const example of tool.examples) {
        const paramNames = new Set(Object.keys(tool.parameters));
        for (const key of Object.keys(example.input)) {
          if (!paramNames.has(key)) {
            warnings.push({
              severity: 'warning',
              code: 'EXAMPLE_UNKNOWN_PARAM',
              message: `Example "${example.name}" for tool "${toolName}" references unknown parameter "${key}"`,
              location: { file: filePath, path: `tools.${toolName}.examples` },
            });
          }
        }

        // Check required params are present in example
        for (const [paramName, param] of Object.entries(tool.parameters)) {
          if (param.required && !(paramName in example.input)) {
            warnings.push({
              severity: 'warning',
              code: 'EXAMPLE_MISSING_REQUIRED',
              message: `Example "${example.name}" for tool "${toolName}" missing required parameter "${paramName}"`,
              location: { file: filePath, path: `tools.${toolName}.examples` },
            });
          }
        }
      }
    }

    // Warn about destructive tools without confirmation agent hints
    if (tool.side_effects === 'destructive' && !tool.agent?.tips?.some(t => /confirm/i.test(t))) {
      warnings.push({
        severity: 'warning',
        code: 'DESTRUCTIVE_NO_CONFIRM',
        message: `Tool "${toolName}" is destructive but has no confirmation tip for agents`,
        location: { file: filePath, path: `tools.${toolName}.agent.tips` },
        hint: 'Add a tip like "Always confirm with the user before executing"',
      });
    }

    // Validate cache config references valid parameters in vary_by
    if (tool.cache?.vary_by) {
      const paramNames = new Set(Object.keys(tool.parameters));
      for (const field of tool.cache.vary_by) {
        if (!paramNames.has(field)) {
          warnings.push({
            severity: 'warning',
            code: 'CACHE_UNKNOWN_PARAM',
            message: `Cache vary_by references unknown parameter "${field}" in tool "${toolName}"`,
            location: { file: filePath, path: `tools.${toolName}.cache.vary_by` },
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZodHint(issue: { code: string; message: string; path: (string | number)[] }): string | undefined {
  if (issue.code === 'invalid_type') return 'Check the type of this field';
  if (issue.code === 'unrecognized_keys') return 'Remove unknown fields or check for typos';
  if (issue.code === 'invalid_string') return 'Check the format/pattern of this string';
  return undefined;
}
