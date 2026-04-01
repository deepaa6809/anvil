import type { AnvilTarget, AnvilTargetFactory } from '@anvil-tools/compiler';
import { generateOpenApi, type OpenApiOptions } from './generator.js';

export const openapi: AnvilTargetFactory<OpenApiOptions> = (options = {}) => ({
  name: 'openapi',
  description: 'Generate an OpenAPI 3.1 specification',
  primaryExtension: options.format === 'json' ? '.json' : '.yaml',

  async generate(ir) {
    return generateOpenApi(ir, options);
  },
});

export type { OpenApiOptions };
