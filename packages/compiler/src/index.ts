// Pipeline
export {
  compile,
  compileOne,
  writeOutput,
  type CompileInput,
  type CompileResult,
} from './pipeline.js';

// Plugin interface
export type {
  AnvilTarget,
  AnvilTargetFactory,
  GeneratedFile,
  TargetResult,
} from './plugin.js';

// Config
export {
  defineConfig,
  loadConfig,
  type AnvilConfig,
} from './config.js';
