---
title: MCP Integration Guide
description: Connect Anvil-generated MCP servers to Claude Desktop, Cursor, VS Code, and other MCP clients.
date: "2025-03-31"
---

## Generate an MCP Server

```bash
anvil compile --target mcp
```

This generates a complete MCP server project in `out/mcp/`:

```
out/mcp/
  server.ts      # MCP server with tool registration
  handlers.ts    # Handler stubs to implement
  package.json   # Dependencies
  tsconfig.json  # TypeScript config
```

## Implement Handlers

Edit `handlers.ts` to add your tool logic:

```typescript
export async function getCurrentWeather(args: {
  location: string;
  units?: string;
}): Promise<ToolResult> {
  const response = await fetch(
    `https://api.weather.com/v1/current?q=${args.location}&units=${args.units ?? 'celsius'}`
  );
  const data = await response.json();
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}
```

## Build and Run

```bash
cd out/mcp
npm install
npm run build
npm start
```

## Connect to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["/path/to/out/mcp/dist/server.js"]
    }
  }
}
```

Restart Claude Desktop. Your tools will appear in the tool picker.

## Connect to Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["./out/mcp/dist/server.js"]
    }
  }
}
```

## Quick Testing with anvil serve

For rapid iteration without compiling:

```bash
anvil serve tools.anvil.yaml --stub
```

This starts an MCP server that returns example data from your definitions. Use `--port 3000` for HTTP transport.

## Using with Claude Code

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "anvil",
      "args": ["serve", "tools.anvil.yaml", "--stub"]
    }
  }
}
```
