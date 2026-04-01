/**
 * Anvil configuration file loader.
 *
 * Supports anvil.config.ts, anvil.config.js, and anvil.config.yaml.
 */

import type { AnvilTarget } from './plugin.js';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface AnvilConfig {
  /** Glob patterns for tool definition files */
  tools: string | string[];
  /** Target plugins to compile */
  targets: AnvilTarget[];
  /** Output directory */
  outDir?: string;
  /** Permission enforcement options */
  permissions?: {
    /** Whether to enforce permission declarations at runtime */
    enforce?: boolean;
    /** Whether to fail compilation if permissions are missing */
    require?: boolean;
  };
  /** Watch mode options */
  watch?: {
    /** Additional directories to watch */
    include?: string[];
    /** Directories to ignore */
    exclude?: string[];
  };
}

/**
 * Type-safe config helper for anvil.config.ts
 */
export function defineConfig(config: AnvilConfig): AnvilConfig {
  return config;
}

/**
 * Load config from a file path. Supports .ts and .js files.
 */
export async function loadConfig(configPath: string): Promise<AnvilConfig> {
  // Use dynamic import — works for both .ts (with tsx/tsup) and .js
  const mod = await import(configPath);
  const config = mod.default ?? mod;

  if (!config.tools) {
    throw new Error(`Invalid anvil config at ${configPath}: missing "tools" field`);
  }
  if (!config.targets || !Array.isArray(config.targets)) {
    throw new Error(`Invalid anvil config at ${configPath}: missing "targets" array`);
  }

  return config as AnvilConfig;
}
