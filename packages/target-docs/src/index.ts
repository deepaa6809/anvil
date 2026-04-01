import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateDocs, type DocsOptions } from './generator.js';

export const docs: AnvilTargetFactory<DocsOptions> = (options = {}) => ({
  name: 'docs',
  description: 'Generate Markdown documentation',
  primaryExtension: '.md',

  async generate(ir) {
    return generateDocs(ir, options);
  },
});

export type { DocsOptions };
