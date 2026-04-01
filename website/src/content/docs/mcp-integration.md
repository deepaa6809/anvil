---
title: MCP Integration Guide
description: Connect Anvil tools to Claude Desktop, Cursor, VS Code, and any MCP client.
date: "2025-04-01"
---

## Two Ways to Run MCP

### Option 1: `anvil serve` (Recommended)

Run an MCP server directly from your YAML — no compile step, no codegen:

```bash
anvil serve --stub tools.anvil.yaml
```

This starts a production MCP server using `@modelcontextprotocol/sdk` over stdio. The `--stub` flag returns example data from your definitions.

### Option 2: Compile and Run

Generate a standalone MCP server project:

```bash
anvil compile --target mcp
cd out/mcp
npm install
npm run dev
```

The generated server includes typed handlers you can implement with your actual logic.

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["@anvil-tools/cli", "serve", "--stub", "/absolute/path/to/tools.anvil.yaml"]
    }
  }
}
```

Restart Claude Desktop. Your tools appear in the tool picker.

## Connect to Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["@anvil-tools/cli", "serve", "--stub", "./tools.anvil.yaml"]
    }
  }
}
```

## Connect to Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["@anvil-tools/cli", "serve", "--stub", "./tools.anvil.yaml"]
    }
  }
}
```

## Custom Handlers

For real implementations (not stubs), create a handler file:

```javascript
// handlers.js
export async function get_current_weather({ location, units }) {
  const res = await fetch(
    `https://api.weather.com/v1/current?q=${location}&units=${units ?? 'celsius'}`
  );
  const data = await res.json();
  return data;
}

export async function get_forecast({ location, days }) {
  const res = await fetch(
    `https://api.weather.com/v1/forecast?q=${location}&days=${days ?? 3}`
  );
  return res.json();
}
```

Then run:

```bash
anvil serve tools.anvil.yaml --handler ./handlers.js
```

The handler functions receive typed arguments matching your YAML parameters. Return any value — it gets serialized as JSON in the MCP response.

## Generated MCP Server

If you need a standalone server (for deployment, Docker, etc.):

```bash
anvil compile --target mcp -o ./my-mcp-server
cd my-mcp-server/mcp
npm install && npm run build
```

The generated project includes:

| File | Purpose |
|------|---------|
| `server.ts` | MCP server with tool registration |
| `handlers.ts` | Handler stubs (edit these) |
| `types.ts` | TypeScript interfaces for tool inputs |
| `env.ts` | Environment variable helpers |
| `GUIDE.md` | Implementation guide with Claude Desktop config |
| `package.json` | Dependencies and scripts |

## Annotations

Anvil automatically sets MCP tool annotations based on your YAML:

| YAML field | MCP annotation |
|-----------|---------------|
| `side_effects: none` | `readOnlyHint: true` |
| `side_effects: destructive` | `destructiveHint: true` |
| `idempotent: true` | `idempotentHint: true` |
