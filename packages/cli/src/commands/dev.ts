/**
 * `anvil dev` — watch mode for development.
 *
 * Watches tool definition files and recompiles on change.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { glob } from 'glob';
import chalk from 'chalk';
import {
  compile as runCompile,
  writeOutput,
  loadConfig,
  type AnvilConfig,
} from '@anvil-tools/compiler';
import type { Command } from 'commander';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Watch tool definitions and recompile on change')
    .option('-c, --config <path>', 'Path to anvil.config.ts', 'anvil.config.ts')
    .option('-o, --out-dir <dir>', 'Output directory (overrides config)')
    .action(async (opts: { config: string; outDir?: string }) => {
      const configPath = resolve(opts.config);
      let config: AnvilConfig;

      try {
        config = await loadConfig(configPath);
      } catch (err) {
        console.log(chalk.red(`Failed to load config: ${configPath}`));
        console.log(chalk.dim(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      const outDir = opts.outDir ? resolve(opts.outDir) : resolve(config.outDir ?? 'out');
      const patterns = Array.isArray(config.tools) ? config.tools : [config.tools];
      const configDir = dirname(configPath);

      // Compile once
      await runOnce(patterns, configDir, config, outDir);

      // Watch for changes
      const { watch } = await import('chokidar');
      const watchPaths = patterns.map(p => resolve(configDir, p));

      console.log(chalk.cyan('\nWatching for changes...'));
      console.log(chalk.dim(`  Patterns: ${patterns.join(', ')}\n`));

      const watcher = watch(watchPaths, {
        ignoreInitial: true,
        ignored: ['**/node_modules/**'],
      });

      watcher.on('change', async (path) => {
        console.log(chalk.dim(`\n  Changed: ${relative(process.cwd(), path)}`));
        await runOnce(patterns, configDir, config, outDir);
      });

      watcher.on('add', async (path) => {
        console.log(chalk.dim(`\n  Added: ${relative(process.cwd(), path)}`));
        await runOnce(patterns, configDir, config, outDir);
      });
    });
}

async function runOnce(
  patterns: string[],
  configDir: string,
  config: AnvilConfig,
  outDir: string,
): Promise<void> {
  const files = (await Promise.all(
    patterns.map(p => glob(p, { cwd: configDir, ignore: 'node_modules/**' })),
  )).flat().map(f => resolve(configDir, f));

  if (files.length === 0) {
    console.log(chalk.yellow('  No files found.'));
    return;
  }

  const sources = await Promise.all(
    files.map(async filePath => ({
      content: await readFile(filePath, 'utf-8'),
      filePath,
    })),
  );

  try {
    const result = await runCompile({ sources, targets: config.targets });

    for (const d of result.diagnostics) {
      if (d.severity === 'error') {
        console.log(chalk.red(`  ERROR  ${d.message}`));
      } else if (d.severity === 'warning') {
        console.log(chalk.yellow(`  WARN   ${d.message}`));
      }
    }

    if (!result.diagnostics.some(d => d.severity === 'error')) {
      const written = await writeOutput(result.targets, outDir);
      console.log(chalk.green(`  Compiled → ${written.length} files in ${relative(process.cwd(), outDir)}/`));
    }
  } catch (err) {
    console.log(chalk.red(`  Compilation failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}
