import { describe, it, expect } from 'vitest';
import { compile } from '@anvil-tools/compiler';
import { cliTarget } from '../index.js';

const YAML = `
anvil: "1.0"
service:
  name: my-tools
  version: "1.0.0"
tools:
  run_task:
    description: Run a scheduled task
    parameters:
      task_name:
        type: string
        required: true
        description: Name of the task
      dry_run:
        type: boolean
        description: Simulate without executing
      workers:
        type: integer
        default: 4
    side_effects: write
`;

describe('CLI-gen target', () => {
  it('generates cli.ts and package.json', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [cliTarget()] });
    const paths = r.targets[0]!.files.map(f => f.path);
    expect(paths).toContain('cli.ts');
    expect(paths).toContain('package.json');
  });

  it('converts snake_case tool name to kebab-case command', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [cliTarget()] });
    const cli = r.targets[0]!.files.find(f => f.path === 'cli.ts')!.content;
    expect(cli).toContain("'run-task'");
  });

  it('generates required and optional flags', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [cliTarget()] });
    const cli = r.targets[0]!.files.find(f => f.path === 'cli.ts')!.content;
    expect(cli).toContain('.requiredOption');
    expect(cli).toContain('--task-name');
    expect(cli).toContain('--dry-run');
    expect(cli).toContain('--workers');
  });

  it('includes --json output flag', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [cliTarget()] });
    const cli = r.targets[0]!.files.find(f => f.path === 'cli.ts')!.content;
    expect(cli).toContain("'--json'");
  });

  it('includes shebang and commander import', async () => {
    const r = await compile({ sources: [{ content: YAML }], targets: [cliTarget()] });
    const cli = r.targets[0]!.files.find(f => f.path === 'cli.ts')!.content;
    expect(cli).toContain('#!/usr/bin/env node');
    expect(cli).toContain("from 'commander'");
  });
});
