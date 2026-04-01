---
title: "Introducing Anvil: The Universal Tool Compiler for AI Agents"
description: "Anvil is an open-source compiler that turns a single tool definition into MCP servers, TypeScript SDKs, OpenAPI specs, documentation, eval harnesses, and agent-optimized schemas."
date: "2025-03-31"
---

Today we're open-sourcing **Anvil** — a compiler for AI tool definitions.

The problem is simple: if you build tools for AI agents, you're maintaining the same definition in 7 different formats. An MCP schema here, an OpenAPI spec there, TypeScript types somewhere else, hand-written docs that drift out of sync, no eval coverage, no permission model.

Anvil fixes this. Write your tool definition once — in YAML or TypeScript — and compile it to any target.

## What Anvil Does

Define a tool with rich semantics:

```yaml
tools:
  get_weather:
    description: Get current weather
    agent:
      description: Use for real-time weather data.
      when_to_use: [User asks about current weather]
      when_not_to_use: [User asks about forecasts]
      tips: [Prefer city names over coordinates]
    parameters:
      location:
        type: string
        required: true
    permissions:
      - type: network
        target: api.weather.com
    side_effects: none
    cost: low
    examples:
      - name: basic
        input: { location: "SF" }
        output: { temperature: 18 }
        prompt: "What's the weather in SF?"
```

Then compile to **10 targets** with a single command:

- **MCP Server** — production-ready Model Context Protocol server
- **OpenAPI 3.1** — complete spec with schemas and examples
- **Documentation** — Markdown docs with parameter tables and agent guidance
- **Agent Schema** — LLM-optimized JSON for better tool selection
- **Eval Harness** — Vitest test suite for schema validation and agent eval
- **TypeScript SDK** — typed client with Zod runtime validation
- **CLI** — commander-based CLI from tool definitions
- **Anthropic/OpenAI/Vercel AI** — native tool formats for each platform

## Why Agent-First

Most tool schemas were designed for APIs. Anvil was designed for agents.

The difference: agents need `when_to_use`, `when_not_to_use`, `tips`, `cost`, and `side_effects` to make good decisions about which tool to call. They need `agent_description` that's richer than a human-facing summary. They need `errors` with `agent_hint` for recovery strategies.

These aren't afterthoughts in Anvil — they're first-class fields.

## What's Next

- **Registry** — `anvil publish` to share tools with the community
- **More examples** — popular integrations (GitHub, Linear, Postgres, browser automation)
- **LLM-as-judge eval** — test tool selection accuracy across models

Anvil is Apache 2.0 licensed. We believe the tool layer should be open.

[Get started in 30 seconds](/docs/getting-started/) or [read the schema reference](/docs/schema/).
