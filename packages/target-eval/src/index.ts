import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateEval, type EvalOptions } from './generator.js';

export const evalTarget: AnvilTargetFactory<EvalOptions> = (options = {}) => ({
  name: 'eval',
  description: 'Generate eval/test harness from tool examples',
  primaryExtension: '.test.ts',

  async generate(ir) {
    return generateEval(ir, options);
  },

  async validate(ir) {
    const warnings: string[] = [];
    for (const tool of ir.tools) {
      if (tool.examples.length === 0) {
        warnings.push(`Tool "${tool.name}" has no examples — no test cases will be generated`);
      }
    }
    return warnings;
  },
});

export type { EvalOptions };
