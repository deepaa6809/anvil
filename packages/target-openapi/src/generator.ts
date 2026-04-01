/**
 * OpenAPI 3.1 Spec Generator
 *
 * Generates a complete OpenAPI specification from Anvil IR.
 * Each tool maps to a POST /tools/{tool_name} endpoint.
 */

import type { AnvilIR, AnvilIRTool } from '@anvil-tools/schema';
import { toolParametersToJsonSchema, fieldToJsonSchema } from '@anvil-tools/schema';
import type { TargetResult, GeneratedFile } from '@anvil-tools/compiler';

export interface OpenApiOptions {
  version?: '3.0' | '3.1';
  format?: 'yaml' | 'json';
}

export function generateOpenApi(ir: AnvilIR, options: OpenApiOptions = {}): TargetResult {
  const format = options.format ?? 'yaml';
  const files: GeneratedFile[] = [];
  const spec = buildSpec(ir);

  if (format === 'json') {
    files.push({
      path: 'openapi.json',
      content: JSON.stringify(spec, null, 2),
      type: 'schema',
    });
  } else {
    files.push({
      path: 'openapi.yaml',
      content: toYaml(spec),
      type: 'schema',
    });
  }

  return { target: 'openapi', files };
}

function buildSpec(ir: AnvilIR): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {};

  for (const tool of ir.tools) {
    const inputSchema = toolParametersToJsonSchema(tool);
    const inputSchemaName = pascalCase(tool.name) + 'Request';
    const outputSchemaName = pascalCase(tool.name) + 'Response';

    schemas[inputSchemaName] = inputSchema;

    const responses: Record<string, unknown> = {};

    if (tool.returns) {
      const outputSchema = fieldToJsonSchema(tool.returns);
      schemas[outputSchemaName] = outputSchema;
      responses['200'] = {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { '$ref': `#/components/schemas/${outputSchemaName}` },
            ...(tool.examples.length > 0 && tool.examples[0]!.output
              ? { example: tool.examples[0]!.output }
              : {}),
          },
        },
      };
    } else {
      responses['200'] = { description: 'Successful response' };
    }

    // Add error responses
    for (const err of tool.errors) {
      const status = String(err.status ?? 400);
      responses[status] = {
        description: err.message,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                code: { type: 'string', enum: [err.code ?? err.key] },
                message: { type: 'string' },
              },
            },
          },
        },
      };
    }

    const operation: Record<string, unknown> = {
      operationId: tool.name,
      summary: tool.description,
      description: tool.agent_description !== tool.description ? tool.agent_description : undefined,
      tags: tool.tags.length > 0 ? tool.tags : undefined,
      deprecated: tool.deprecated || undefined,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { '$ref': `#/components/schemas/${inputSchemaName}` },
            ...(tool.examples.length > 0
              ? { example: tool.examples[0]!.input }
              : {}),
          },
        },
      },
      responses,
    };

    // Clean undefined values
    for (const [k, v] of Object.entries(operation)) {
      if (v === undefined) delete operation[k];
    }

    paths[`/tools/${tool.name}`] = { post: operation };
  }

  // Build security schemes from auth
  const securitySchemes: Record<string, unknown> = {};
  if (ir.service.auth) {
    switch (ir.service.auth.type) {
      case 'api_key':
        securitySchemes['apiKey'] = {
          type: 'apiKey',
          in: 'header',
          name: ir.service.auth.header ?? 'X-API-Key',
        };
        break;
      case 'bearer':
        securitySchemes['bearer'] = {
          type: 'http',
          scheme: 'bearer',
        };
        break;
      case 'oauth2':
        securitySchemes['oauth2'] = {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: ir.service.auth.oauth2?.authorization_url ?? '',
              tokenUrl: ir.service.auth.oauth2?.token_url ?? '',
              scopes: Object.fromEntries(
                (ir.service.auth.oauth2?.scopes ?? []).map(s => [s, s]),
              ),
            },
          },
        };
        break;
    }
  }

  const spec: Record<string, unknown> = {
    openapi: '3.1.0',
    info: {
      title: ir.service.name,
      version: ir.service.version,
      description: ir.service.description || undefined,
    },
    ...(ir.service.base_url ? { servers: [{ url: ir.service.base_url }] } : {}),
    paths,
    components: {
      schemas,
      ...(Object.keys(securitySchemes).length > 0 ? { securitySchemes } : {}),
    },
    ...(Object.keys(securitySchemes).length > 0
      ? { security: [Object.fromEntries(Object.keys(securitySchemes).map(k => [k, []]))] }
      : {}),
  };

  return spec;
}

// Minimal YAML serializer (no dependency needed for clean output)
function toYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      const lines = obj.split('\n');
      return '|\n' + lines.map(l => pad + '  ' + l).join('\n');
    }
    if (/[:{}\[\],&*?|>!%@`#'"]/.test(obj) || obj === '' || obj === 'true' || obj === 'false' || obj === 'null' || /^\d/.test(obj)) {
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const simple = obj.every(v => typeof v === 'string' || typeof v === 'number');
    if (simple && obj.length <= 5) {
      return '[' + obj.map(v => typeof v === 'string' ? JSON.stringify(v) : String(v)).join(', ') + ']';
    }
    return '\n' + obj.map(item => {
      const val = toYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const lines = val.trimStart().split('\n');
        return pad + '- ' + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
      }
      return pad + '- ' + val.trimStart();
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return '\n' + entries.map(([key, val]) => {
      const yamlVal = toYaml(val, indent + 1);
      if (yamlVal.startsWith('\n')) {
        return pad + key + ':' + yamlVal;
      }
      return pad + key + ': ' + yamlVal;
    }).join('\n');
  }

  return String(obj);
}

function pascalCase(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
