---
title: Getting Started
description: Install Anvil and create your first tool definition in under 2 minutes.
date: "2025-03-31"
---

## Installation

```bash
npm install -g @anvil-tools/cli
```

Or with pnpm:

```bash
pnpm add -g @anvil-tools/cli
```

## Create a Project

```bash
anvil init my-tools
cd my-tools
```

This creates two files:

- `tools.anvil.yaml` — your tool definitions
- `anvil.config.ts` — compiler configuration

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

## Validate

```bash
anvil validate
```

You'll see:

```
  OK  tools.anvil.yaml (1 tool)

Validated 1 file, 1 tool.
```

## Compile

```bash
anvil compile
```

This generates all configured targets into the `out/` directory.

## What's Next

- [Schema Reference](/docs/schema/) — learn all available fields
- [Targets](/docs/targets/) — see all compilation targets
- [MCP Integration](/docs/mcp-integration/) — connect to Claude Desktop or Cursor
- [CLI Reference](/docs/cli-reference/) — all available commands
