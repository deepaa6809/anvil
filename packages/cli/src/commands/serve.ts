/**
 * `anvil serve` — start a local MCP server for testing.
 *
 * Reads tool definitions, compiles to MCP format, and serves over stdio or HTTP.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { glob } from 'glob';
import chalk from 'chalk';
import { parseAnvilYaml, mergeAnvilDefinitions, lowerToIR, type AnvilIR } from '@anvil-tools/schema';
import type { Command } from 'commander';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start a local MCP server for testing tool definitions')
    .argument('[patterns...]', 'Glob patterns for .anvil.yaml files', ['**/*.anvil.yaml'])
    .option('-p, --port <port>', 'HTTP port (uses stdio by default)')
    .option('--stub', 'Return example data instead of errors for unimplemented tools')
    .action(async (patterns: string[], opts: { port?: string; stub?: boolean }) => {
      const files = (await Promise.all(
        patterns.map(p => glob(p, { ignore: 'node_modules/**' })),
      )).flat();

      if (files.length === 0) {
        console.error(chalk.yellow('No .anvil.yaml files found.'));
        process.exit(1);
      }

      // Parse all files
      const parseResults = await Promise.all(
        files.map(async file => {
          const filePath = resolve(file);
          const content = await readFile(filePath, 'utf-8');
          return parseAnvilYaml(content, { filePath });
        }),
      );

      const merged = mergeAnvilDefinitions(parseResults);
      const ir = lowerToIR(merged.service, files);

      if (opts.port) {
        await startHttpServer(ir, parseInt(opts.port, 10), !!opts.stub);
      } else {
        await startStdioServer(ir, !!opts.stub);
      }
    });
}

async function startStdioServer(ir: AnvilIR, stub: boolean): Promise<void> {
  // Minimal JSON-RPC over stdio implementation
  // In production, this would use @modelcontextprotocol/sdk
  const { createInterface } = await import('node:readline');

  const rl = createInterface({ input: process.stdin });
  const toolList = ir.tools.map(t => ({
    name: t.name,
    description: t.agent_description,
    inputSchema: buildInputSchema(t),
  }));

  console.error(chalk.cyan(`Anvil MCP server (stdio) — serving ${ir.tools.length} tools`));

  rl.on('line', (line) => {
    try {
      const req = JSON.parse(line);
      let response: unknown;

      if (req.method === 'initialize') {
        response = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: ir.service.name, version: ir.service.version },
          },
        };
      } else if (req.method === 'tools/list') {
        response = {
          jsonrpc: '2.0',
          id: req.id,
          result: { tools: toolList },
        };
      } else if (req.method === 'tools/call') {
        const toolName = req.params?.name;
        const tool = ir.tools.find(t => t.name === toolName);
        if (!tool) {
          response = {
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32602, message: `Unknown tool: ${toolName}` },
          };
        } else if (stub && tool.examples.length > 0) {
          response = {
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(tool.examples[0]!.output ?? { stub: true }),
              }],
            },
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({ error: 'Not implemented — use --stub for example data' }),
              }],
              isError: true,
            },
          };
        }
      } else if (req.method === 'notifications/initialized') {
        return; // No response needed for notifications
      } else {
        response = {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
      }

      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch {
      // Ignore malformed input
    }
  });
}

async function startHttpServer(ir: AnvilIR, port: number, stub: boolean): Promise<void> {
  const { createServer } = await import('node:http');

  const toolMap = new Map(ir.tools.map(t => [t.name, t]));

  const server = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tools: ir.tools.map(t => ({
          name: t.name,
          description: t.agent_description,
          inputSchema: buildInputSchema(t),
        })),
      }));
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/tools/')) {
      const toolName = req.url.slice('/tools/'.length);
      const tool = toolMap.get(toolName);

      if (!tool) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Unknown tool: ${toolName}` }));
        return;
      }

      if (stub && tool.examples.length > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tool.examples[0]!.output ?? { stub: true }));
      } else {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not implemented' }));
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(chalk.cyan(`\nAnvil MCP server (HTTP) — serving ${ir.tools.length} tools`));
    console.log(chalk.dim(`  http://localhost:${port}/tools`));
    console.log(chalk.dim(`  POST http://localhost:${port}/tools/<name>\n`));
  });
}

function buildInputSchema(tool: { parameters: Array<{ name: string; field: { description?: string }; required: boolean }> }): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of tool.parameters) {
    properties[p.name] = { type: 'string', description: p.field.description ?? '' };
    if (p.required) required.push(p.name);
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
