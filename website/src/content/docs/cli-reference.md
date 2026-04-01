---
title: CLI Reference
description: Complete reference for all Anvil CLI commands.
date: "2025-04-01"
---

## anvil init

Scaffold a new Anvil tool project.

```bash
anvil init [directory] [--name <name>]
```

Creates `tools.anvil.yaml` and `anvil.config.ts` in the target directory.

## anvil validate

Validate tool definition files.

```bash
anvil validate [patterns...] [--strict]
```

- Default pattern: `**/*.anvil.yaml`
- `--strict` treats warnings as errors

## anvil compile

Compile tool definitions to target outputs. No config file required.

```bash
# Zero-config (recommended):
anvil compile --target mcp                    # just MCP server
anvil compile --target mcp,docs,anthropic     # multiple targets
anvil compile --all                           # all 10 targets

# With config:
anvil compile -c anvil.config.ts

# Options:
anvil compile --target mcp -o ./dist          # custom output dir
anvil compile --target mcp --dry-run          # preview without writing
```

Available targets: `mcp`, `openapi`, `docs`, `agent-schema`, `eval`, `sdk-ts`, `cli-gen`, `anthropic`, `openai`, `vercel-ai`

## anvil serve

Start a production MCP server directly from .anvil.yaml files. Uses `@modelcontextprotocol/sdk` — works with Claude Desktop, Cursor, Claude Code, and any MCP client.

```bash
anvil serve [patterns...] [options]

Options:
  --stub              Return example data for all tools
  --handler <file>    Load custom handler implementations
```

### Use with Claude Desktop

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["@anvil-tools/cli", "serve", "--stub", "tools.anvil.yaml"]
    }
  }
}
```

### Custom handlers

```bash
anvil serve tools.anvil.yaml --handler ./my-handlers.js
```

Where `my-handlers.js` exports functions named after your tools:

```javascript
export async function get_weather({ location }) {
  const res = await fetch(`https://api.weather.com?q=${location}`);
  return res.json();
}
```

## anvil dev

Watch mode — recompile on file changes.

```bash
anvil dev [-c config] [-o out-dir]
```

## anvil publish

Publish tool definitions to the registry.

```bash
anvil publish [file] [options]

Options:
  --registry <url>   Registry URL (default: localhost:4400)
  --token <token>    Auth token
  --tag <tags...>    Tags for discovery
  --dry-run          Validate without publishing
  --local            Publish to local registry
```

## anvil search

Search the registry for tool definitions.

```bash
anvil search <query> [--tag <tags...>] [--local]
```

## anvil install

Download tool definitions from the registry.

```bash
anvil install <package>            # latest version
anvil install <package>@1.0.0     # specific version
anvil install <package> --compile  # validate after download
```

## anvil login

Save registry auth token.

```bash
anvil login --token <token> --registry <url>
```

## anvil doctor

Check your project for issues and get recommendations.

```bash
anvil doctor
```

Checks: Node.js version, config file, tool definitions, agent descriptions, examples, permissions.
