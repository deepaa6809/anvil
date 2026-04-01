import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateSdkTs, type SdkTsOptions } from './generator.js';

export const sdkTypescript: AnvilTargetFactory<SdkTsOptions> = (options = {}) => ({
  name: 'sdk-ts',
  description: 'Generate a typed TypeScript client SDK',
  primaryExtension: '.ts',

  async generate(ir) {
    return generateSdkTs(ir, options);
  },
});

export type { SdkTsOptions };
