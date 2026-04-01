import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateCliGen, type CliGenOptions } from './generator.js';

export const cliTarget: AnvilTargetFactory<CliGenOptions> = (options = {}) => ({
  name: 'cli-gen',
  description: 'Generate a CLI application',
  primaryExtension: '.ts',

  async generate(ir) {
    return generateCliGen(ir, options);
  },
});

export type { CliGenOptions };
