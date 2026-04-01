import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateMcp, type McpOptions } from './generator.js';

export const mcp: AnvilTargetFactory<McpOptions> = (options = {}) => ({
  name: 'mcp',
  description: 'Generate a Model Context Protocol (MCP) server',
  primaryExtension: '.ts',

  async generate(ir) {
    return generateMcp(ir, options);
  },

  async validate(ir) {
    const warnings: string[] = [];
    if (ir.tools.length === 0) {
      warnings.push('No tools defined — MCP server will have no capabilities');
    }
    for (const tool of ir.tools) {
      if (tool.agent_description.length > 1024) {
        warnings.push(`Tool "${tool.name}" has a very long agent description (${tool.agent_description.length} chars) — some MCP clients may truncate it`);
      }
    }
    return warnings;
  },
});

export type { McpOptions };
