import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateAgentSchema, type AgentSchemaOptions } from './generator.js';

export const agentSchema: AnvilTargetFactory<AgentSchemaOptions> = (options = {}) => ({
  name: 'agent-schema',
  description: 'Generate LLM-optimized agent-facing tool schema',
  primaryExtension: options.format === 'yaml' ? '.yaml' : '.json',

  async generate(ir) {
    return generateAgentSchema(ir, options);
  },
});

export type { AgentSchemaOptions };
