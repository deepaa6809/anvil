/**
 * `anvil compile` — compile tool definitions to one or more targets.
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
import { AnvilError } from '@anvil-tools/schema';
import type { Command } from 'commander';

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile Anvil tool definitions to target outputs')
    .option('-c, --config <path>', 'Path to anvil.config.ts', 'anvil.config.ts')
    .option('-o, --out-dir <dir>', 'Output directory (overrides config)')
    .option('--dry-run', 'Show what would be generated without writing files')
    .option('--target <name>', 'Only compile a specific target')
    .action(async (opts: {
      config: string;
      outDir?: string;
      dryRun?: boolean;
      target?: string;
    }) => {
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

      // Resolve tool files
      const patterns = Array.isArray(config.tools) ? config.tools : [config.tools];
      const configDir = dirname(configPath);
      const files = (await Promise.all(
        patterns.map(p => glob(p, { cwd: configDir, ignore: 'node_modules/**' })),
      )).flat().map(f => resolve(configDir, f));

      if (files.length === 0) {
        console.log(chalk.yellow('No tool definition files found.'));
        process.exit(1);
      }

      // Read all sources
      const sources = await Promise.all(
        files.map(async filePath => ({
          content: await readFile(filePath, 'utf-8'),
          filePath,
        })),
      );

      // Filter targets if --target specified
      let targets = config.targets;
      if (opts.target) {
        targets = targets.filter(t => t.name === opts.target);
        if (targets.length === 0) {
          console.log(chalk.red(`Target "${opts.target}" not found in config.`));
          console.log(chalk.dim(`Available: ${config.targets.map(t => t.name).join(', ')}`));
          process.exit(1);
        }
      }

      console.log(chalk.bold(`Compiling ${files.length} file${files.length !== 1 ? 's' : ''} → ${targets.length} target${targets.length !== 1 ? 's' : ''}`));
      console.log();

      try {
        const result = await runCompile({ sources, targets });

        // Print diagnostics
        for (const d of result.diagnostics) {
          if (d.severity === 'error') {
            console.log(chalk.red(`  ERROR  ${d.message}`));
          } else if (d.severity === 'warning') {
            console.log(chalk.yellow(`  WARN   ${d.message}`));
          }
        }

        if (result.diagnostics.some(d => d.severity === 'error')) {
          process.exit(1);
        }

        // Write or display
        if (opts.dryRun) {
          for (const targetResult of result.targets) {
            console.log(chalk.cyan(`  ${targetResult.target}/`));
            for (const file of targetResult.files) {
              console.log(chalk.dim(`    ${file.path} (${file.content.length} bytes)`));
            }
          }
          console.log();
          console.log(chalk.dim('Dry run — no files written.'));
        } else {
          const written = await writeOutput(result.targets, outDir);
          console.log();
          for (const p of written) {
            console.log(chalk.green('  +') + ' ' + chalk.dim(relative(process.cwd(), p)));
          }
          console.log();
          console.log(chalk.green(`Generated ${written.length} file${written.length !== 1 ? 's' : ''} in ${relative(process.cwd(), outDir)}/`));
        }
      } catch (err) {
        if (err instanceof AnvilError) {
          console.log(chalk.red('\nCompilation failed:\n'));
          console.log(err.format());
          process.exit(1);
        }
        throw err;
      }
    });
}
