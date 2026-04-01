/**
 * `anvil validate` — validate tool definition files.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'glob';
import chalk from 'chalk';
import { parseAnvilYaml, AnvilError } from '@anvil-tools/schema';
import type { Command } from 'commander';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate Anvil tool definition files')
    .argument('[patterns...]', 'Glob patterns for .anvil.yaml files', ['**/*.anvil.yaml'])
    .option('--strict', 'Treat warnings as errors')
    .action(async (patterns: string[], opts: { strict?: boolean }) => {
      const files = (await Promise.all(
        patterns.map(p => glob(p, { ignore: 'node_modules/**' })),
      )).flat();

      if (files.length === 0) {
        console.log(chalk.yellow('No .anvil.yaml files found.'));
        console.log(chalk.dim('  Run `anvil init` to create a new project.'));
        process.exit(1);
      }

      let hasErrors = false;
      let totalTools = 0;
      let totalWarnings = 0;

      for (const file of files) {
        const filePath = resolve(file);
        const content = await readFile(filePath, 'utf-8');

        try {
          const result = parseAnvilYaml(content, { filePath });
          const toolCount = Object.keys(result.service.tools).length;
          totalTools += toolCount;

          if (result.warnings.length > 0) {
            totalWarnings += result.warnings.length;
            for (const w of result.warnings) {
              const icon = w.severity === 'warning' ? chalk.yellow('WARN') : chalk.blue('INFO');
              console.log(`  ${icon}  ${w.message}`);
              if (w.hint) {
                console.log(chalk.dim(`        hint: ${w.hint}`));
              }
            }

            if (opts.strict && result.warnings.some(w => w.severity === 'warning')) {
              hasErrors = true;
            }
          }

          console.log(chalk.green(`  OK`) + chalk.dim(`  ${file} (${toolCount} tool${toolCount !== 1 ? 's' : ''})`));
        } catch (err) {
          hasErrors = true;
          if (err instanceof AnvilError) {
            console.log(chalk.red(`  FAIL`) + chalk.dim(`  ${file}`));
            console.log();
            console.log(err.format());
            console.log();
          } else {
            throw err;
          }
        }
      }

      console.log();
      if (hasErrors) {
        console.log(chalk.red(`Validation failed.`));
        process.exit(1);
      } else {
        console.log(
          chalk.green(`Validated ${files.length} file${files.length !== 1 ? 's' : ''}, ${totalTools} tool${totalTools !== 1 ? 's' : ''}.`) +
          (totalWarnings > 0 ? chalk.yellow(` (${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''})`) : ''),
        );
      }
    });
}
