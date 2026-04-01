/**
 * Anvil Target Plugin Interface
 *
 * Every compilation target (MCP, OpenAPI, docs, etc.) implements this interface.
 * The compiler calls generate() with the fully resolved IR and collects output files.
 */

import type { AnvilIR } from '@anvil-tools/schema';

// ---------------------------------------------------------------------------
// Core plugin types
// ---------------------------------------------------------------------------

export interface GeneratedFile {
  /** Relative path for the output file */
  path: string;
  /** File content */
  content: string;
  /** File category */
  type: 'source' | 'config' | 'docs' | 'test' | 'schema';
}

export interface TargetResult {
  /** Target name */
  target: string;
  /** Generated files */
  files: GeneratedFile[];
  /** Warnings from generation */
  warnings?: string[];
}

export interface AnvilTarget {
  /** Unique target identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** File extension for the primary output */
  primaryExtension?: string;

  /**
   * Generate output files from the IR.
   *
   * Targets receive the fully resolved IR and produce an array of files.
   * Each file has a relative path (the compiler resolves the absolute output directory).
   */
  generate(ir: AnvilIR, options?: Record<string, unknown>): Promise<TargetResult>;

  /**
   * Optional: validate target-specific requirements before generation.
   * Return diagnostics for issues the target can detect early.
   */
  validate?(ir: AnvilIR): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Target factory type (for configuration)
// ---------------------------------------------------------------------------

/**
 * A target factory creates a configured target instance.
 * Used in anvil.config.ts:
 *
 * ```typescript
 * import { mcp } from '@anvil-tools/target-mcp';
 * export default { targets: [mcp({ transport: 'stdio' })] };
 * ```
 */
export type AnvilTargetFactory<TOptions = Record<string, unknown>> =
  (options?: TOptions) => AnvilTarget;
