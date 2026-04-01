/**
 * Anvil Compilation Pipeline
 *
 * Orchestrates the full flow: parse → validate → lower to IR → generate targets.
 * Supports both YAML input and programmatic TypeScript definitions.
 */

import {
  parseAnvilYaml,
  mergeAnvilDefinitions,
  lowerToIR,
  AnvilError,
  type AnvilServiceDefinition,
  type AnvilIR,
  type AnvilDiagnostic,
  type ParseResult,
} from '@anvil-tools/schema';
import type { AnvilTarget, TargetResult, GeneratedFile } from './plugin.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CompileInput {
  /** YAML source strings (with optional file paths) */
  sources?: Array<{ content: string; filePath?: string }>;
  /** Pre-parsed service definition (from TypeScript builder) */
  definition?: AnvilServiceDefinition;
  /** Target plugins to generate */
  targets: AnvilTarget[];
  /** Output directory (if writing to disk) */
  outDir?: string;
}

export interface CompileResult {
  /** The IR that was generated */
  ir: AnvilIR;
  /** Results from each target */
  targets: TargetResult[];
  /** All diagnostics (errors + warnings) */
  diagnostics: AnvilDiagnostic[];
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function compile(input: CompileInput): Promise<CompileResult> {
  const diagnostics: AnvilDiagnostic[] = [];
  let service: AnvilServiceDefinition;

  // Step 1: Parse or use provided definition
  if (input.definition) {
    service = input.definition;
  } else if (input.sources && input.sources.length > 0) {
    const parseResults: ParseResult[] = [];

    for (const source of input.sources) {
      const result = parseAnvilYaml(source.content, {
        filePath: source.filePath,
      });
      diagnostics.push(...result.warnings);
      parseResults.push(result);
    }

    const merged = mergeAnvilDefinitions(parseResults);
    diagnostics.push(...merged.warnings);
    service = merged.service;
  } else {
    throw new AnvilError([{
      severity: 'error',
      code: 'NO_INPUT',
      message: 'Either sources or definition must be provided',
    }]);
  }

  // Step 2: Lower to IR
  const sourceFiles = input.sources?.map(s => s.filePath).filter(Boolean) as string[] | undefined;
  const ir = lowerToIR(service, sourceFiles);

  // Step 3: Validate targets (pre-flight checks)
  for (const target of input.targets) {
    if (target.validate) {
      const targetWarnings = await target.validate(ir);
      for (const w of targetWarnings) {
        diagnostics.push({
          severity: 'warning',
          code: `TARGET_${target.name.toUpperCase()}`,
          message: w,
        });
      }
    }
  }

  // Step 4: Generate all targets (in parallel)
  const targetResults = await Promise.all(
    input.targets.map(target => target.generate(ir)),
  );

  // Collect target warnings into diagnostics
  for (const result of targetResults) {
    if (result.warnings) {
      for (const w of result.warnings) {
        diagnostics.push({
          severity: 'warning',
          code: `TARGET_${result.target.toUpperCase()}`,
          message: w,
        });
      }
    }
  }

  return { ir, targets: targetResults, diagnostics };
}

// ---------------------------------------------------------------------------
// File writing utility
// ---------------------------------------------------------------------------

/**
 * Write generated files to the filesystem.
 * Used by the CLI — the compiler itself is pure/side-effect-free.
 */
export async function writeOutput(
  results: TargetResult[],
  outDir: string,
): Promise<string[]> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  const writtenPaths: string[] = [];

  for (const result of results) {
    for (const file of result.files) {
      const fullPath = join(outDir, result.target, file.path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content, 'utf-8');
      writtenPaths.push(fullPath);
    }
  }

  return writtenPaths;
}

// ---------------------------------------------------------------------------
// Single-target convenience
// ---------------------------------------------------------------------------

/**
 * Compile a single YAML source to a single target.
 * Convenience wrapper for simple use cases.
 */
export async function compileOne(
  yamlSource: string,
  target: AnvilTarget,
  filePath?: string,
): Promise<{ files: GeneratedFile[]; ir: AnvilIR }> {
  const result = await compile({
    sources: [{ content: yamlSource, filePath }],
    targets: [target],
  });

  return {
    files: result.targets[0]?.files ?? [],
    ir: result.ir,
  };
}
