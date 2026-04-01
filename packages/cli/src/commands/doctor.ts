/**
 * `anvil doctor` — check project health and give recommendations.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'glob';
import chalk from 'chalk';
import { parseAnvilYaml, AnvilError } from '@anvil-tools/schema';
import type { Command } from 'commander';

interface Check {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  hint?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check your Anvil project for issues and get recommendations')
    .action(async () => {
      console.log(chalk.bold('\n  Anvil Doctor\n'));
      const checks: Check[] = [];

      // 1. Node version
      const [major] = process.versions.node.split('.').map(Number);
      checks.push(major! >= 20
        ? { name: 'Node.js version', status: 'pass', message: `v${process.versions.node}` }
        : { name: 'Node.js version', status: 'fail', message: `v${process.versions.node} — Node 20+ required`, hint: 'Upgrade Node.js to v20 or later' },
      );

      // 2. Config file
      const configPath = resolve('anvil.config.ts');
      try {
        await stat(configPath);
        checks.push({ name: 'Config file', status: 'pass', message: 'anvil.config.ts found' });
      } catch {
        const jsPath = resolve('anvil.config.js');
        try {
          await stat(jsPath);
          checks.push({ name: 'Config file', status: 'pass', message: 'anvil.config.js found' });
        } catch {
          checks.push({ name: 'Config file', status: 'warn', message: 'No anvil.config.ts found', hint: 'Run `anvil init` to create one, or compile with explicit targets' });
        }
      }

      // 3. Tool definitions
      const files = await glob('**/*.anvil.yaml', { ignore: 'node_modules/**' });
      if (files.length === 0) {
        checks.push({ name: 'Tool definitions', status: 'fail', message: 'No .anvil.yaml files found', hint: 'Run `anvil init` to create a starter definition' });
      } else {
        checks.push({ name: 'Tool definitions', status: 'pass', message: `${files.length} file${files.length !== 1 ? 's' : ''} found` });

        let totalTools = 0;
        let missingAgentDesc = 0;
        let missingExamples = 0;
        let missingPermissions = 0;
        let hasErrors = false;

        for (const file of files) {
          try {
            const content = await readFile(resolve(file), 'utf-8');
            const { service, warnings } = parseAnvilYaml(content, { filePath: file });

            for (const [, tool] of Object.entries(service.tools)) {
              totalTools++;
              if (!tool.agent?.description) missingAgentDesc++;
              if (!tool.examples || tool.examples.length === 0) missingExamples++;
              if (!tool.permissions || tool.permissions.length === 0) missingPermissions++;
            }
          } catch (err) {
            if (err instanceof AnvilError) {
              hasErrors = true;
              checks.push({ name: `Parse: ${file}`, status: 'fail', message: err.message, hint: 'Run `anvil validate` for details' });
            }
          }
        }

        checks.push({ name: 'Total tools', status: 'pass', message: `${totalTools} tool${totalTools !== 1 ? 's' : ''} defined` });

        if (hasErrors) {
          checks.push({ name: 'Validation', status: 'fail', message: 'Some files have errors', hint: 'Run `anvil validate --strict`' });
        } else {
          checks.push({ name: 'Validation', status: 'pass', message: 'All files valid' });
        }

        if (missingAgentDesc > 0) {
          checks.push({
            name: 'Agent descriptions',
            status: 'warn',
            message: `${missingAgentDesc} tool${missingAgentDesc !== 1 ? 's' : ''} missing agent.description`,
            hint: 'Add agent.description for better LLM tool selection',
          });
        } else if (totalTools > 0) {
          checks.push({ name: 'Agent descriptions', status: 'pass', message: 'All tools have agent descriptions' });
        }

        if (missingExamples > 0) {
          checks.push({
            name: 'Examples',
            status: 'warn',
            message: `${missingExamples} tool${missingExamples !== 1 ? 's' : ''} missing examples`,
            hint: 'Add examples for eval harness and documentation',
          });
        } else if (totalTools > 0) {
          checks.push({ name: 'Examples', status: 'pass', message: 'All tools have examples' });
        }

        if (missingPermissions > 0) {
          checks.push({
            name: 'Permissions',
            status: 'warn',
            message: `${missingPermissions} tool${missingPermissions !== 1 ? 's' : ''} without permission declarations`,
            hint: 'Declare permissions for runtime enforcement',
          });
        }
      }

      // Print results
      for (const check of checks) {
        const icon = check.status === 'pass' ? chalk.green('  PASS')
          : check.status === 'warn' ? chalk.yellow('  WARN')
          : chalk.red('  FAIL');
        console.log(`${icon}  ${chalk.dim(check.name + ':')} ${check.message}`);
        if (check.hint) {
          console.log(chalk.dim(`        → ${check.hint}`));
        }
      }

      const fails = checks.filter(c => c.status === 'fail').length;
      const warns = checks.filter(c => c.status === 'warn').length;
      console.log();
      if (fails > 0) {
        console.log(chalk.red(`  ${fails} issue${fails !== 1 ? 's' : ''} found.`));
      } else if (warns > 0) {
        console.log(chalk.yellow(`  ${warns} recommendation${warns !== 1 ? 's' : ''}.`));
      } else {
        console.log(chalk.green('  All checks passed.'));
      }
      console.log();
    });
}
