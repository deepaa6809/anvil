---
title: Getting Started
description: Install Anvil and create your first tool definition in under 2 minutes.
date: "2025-04-01"
---

## Installation

```bash
npm install -g @anvil-tools/cli
```

Verify:

```bash
anvil --version  # 0.4.0
```

## Create a Project

```bash
anvil init my-tools
cd my-tools
```

This creates:

- `tools.anvil.yaml` — your tool definitions
- `anvil.config.ts` — optional compiler configuration

## Define a Tool

Edit `tools.anvil.yaml`:

```yaml
anvil: "1.0"

service:
  name: my-tools
  version: "1.0.0"

tools:
  greet:
    description: Greet someone by name
    agent:
      description: Use this tool to generate a personalized greeting.
      when_to_use:
        - User asks for a greeting
    parameters:
      name:
        type: string
        required: true
        description: The name to greet
    returns:
      type: object
      properties:
        message:
          type: string
          description: The greeting message
    side_effects: none
    cost: free
    examples:
      - name: basic
        input: { name: "World" }
        output: { message: "Hello, World!" }
        prompt: "Say hello to the world"
```

## Compile

No config file needed — targets are built into the CLI:

```bash
anvil compile --target mcp                # MCP server
anvil compile --target mcp,docs           # MCP + documentation
anvil compile --target anthropic          # Claude API format
anvil compile --all                       # all 10 targets
```

Output goes to `out/` by default.

## Run as MCP Server

Start an MCP server directly from your YAML — no compile step needed:

```bash
anvil serve --stub tools.anvil.yaml
```

This starts a production MCP server (using `@modelcontextprotocol/sdk`) that returns example data from your definitions. Works with any MCP client.

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Connect to Cursor

Add to `.cursor/mcp.json`:

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

## Validate and Check

```bash
anvil validate          # check for errors
anvil doctor            # project health check with recommendations
```

## What's Next

- [Schema Reference](/docs/schema/) — all available fields
- [Targets](/docs/targets/) — all 10 compilation targets
- [MCP Integration](/docs/mcp-integration/) — detailed Claude Desktop / Cursor setup
- [CLI Reference](/docs/cli-reference/) — all commands
