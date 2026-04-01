/**
 * `anvil init` — scaffold a new Anvil tool project.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';

const TEMPLATE_YAML = `anvil: "1.0"

service:
  name: my-tools
  version: "1.0.0"
  description: My tool service

tools:
  hello_world:
    description: A simple hello world tool
    agent:
      description: |
        Use this tool to greet a user by name.
        Returns a personalized greeting message.
      when_to_use:
        - User asks for a greeting
        - User says hello
    parameters:
      name:
        type: string
        required: true
        description: The name to greet
        examples:
          - "World"
          - "Alice"
    returns:
      type: object
      properties:
        message:
          type: string
          description: The greeting message
    side_effects: none
    cost: free
    idempotent: true
    examples:
      - name: basic_greeting
        input:
          name: "World"
        output:
          message: "Hello, World!"
        prompt: "Say hello to the world"
`;

const TEMPLATE_CONFIG = `// anvil.config.ts — configure compilation targets
// Install targets you need: npm install @anvil-tools/target-mcp @anvil-tools/target-docs
//
// import { defineConfig } from '@anvil-tools/compiler';
// import { mcp } from '@anvil-tools/target-mcp';
// import { docs } from '@anvil-tools/target-docs';
//
// export default defineConfig({
//   tools: './*.anvil.yaml',
//   targets: [mcp(), docs()],
//   outDir: './out',
// });

import { defineConfig } from '@anvil-tools/compiler';

export default defineConfig({
  tools: './*.anvil.yaml',
  targets: [],
  outDir: './out',
});
`;

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold a new Anvil tool project')
    .argument('[directory]', 'Target directory', '.')
    .option('--name <name>', 'Service name')
    .action(async (directory: string, opts: { name?: string }) => {
      const dir = join(process.cwd(), directory);
      await mkdir(dir, { recursive: true });

      const yamlContent = opts.name
        ? TEMPLATE_YAML.replace('my-tools', opts.name)
        : TEMPLATE_YAML;

      await writeFile(join(dir, 'tools.anvil.yaml'), yamlContent, 'utf-8');
      await writeFile(join(dir, 'anvil.config.ts'), TEMPLATE_CONFIG, 'utf-8');

      const name = opts.name ?? 'my-tools';
      console.log(`\n  Anvil project initialized in ${dir === process.cwd() ? '.' : directory}\n`);
      console.log(`  Created:`);
      console.log(`    tools.anvil.yaml   — tool definitions for "${name}"`);
      console.log(`    anvil.config.ts    — compiler configuration\n`);
      console.log(`  Next steps:`);
      console.log(`    1. Edit tools.anvil.yaml to define your tools`);
      console.log(`    2. Run: anvil validate`);
      console.log(`    3. Run: anvil compile\n`);
    });
}
