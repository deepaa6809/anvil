---
title: Compilation Targets
description: All 10 Anvil compilation targets — MCP, OpenAPI, docs, agent schema, eval, SDK, CLI, Anthropic, OpenAI, Vercel AI.
date: "2025-03-31"
---

## Available Targets

| Target | Package | Output |
|--------|---------|--------|
| MCP Server | `@anvil-tools/target-mcp` | TypeScript MCP server |
| OpenAPI | `@anvil-tools/target-openapi` | OpenAPI 3.1 spec |
| Documentation | `@anvil-tools/target-docs` | Markdown docs |
| Agent Schema | `@anvil-tools/target-agent-schema` | LLM-optimized JSON |
| Eval Harness | `@anvil-tools/target-eval` | Vitest/Jest test suite |
| TypeScript SDK | `@anvil-tools/target-sdk-ts` | Typed client |
| CLI | `@anvil-tools/target-cli-gen` | Commander CLI |
| Anthropic | `@anvil-tools/target-anthropic` | Claude API tools |
| OpenAI | `@anvil-tools/target-openai` | GPT function calling |
| Vercel AI | `@anvil-tools/target-vercel-ai` | AI SDK tools |

## Configuration

Configure targets in `anvil.config.ts`:

```typescript
import { defineConfig } from '@anvil-tools/compiler';
import { mcp } from '@anvil-tools/target-mcp';
import { openapi } from '@anvil-tools/target-openapi';
import { docs } from '@anvil-tools/target-docs';
import { agentSchema } from '@anvil-tools/target-agent-schema';
import { evalTarget } from '@anvil-tools/target-eval';

export default defineConfig({
  tools: './**/*.anvil.yaml',
  targets: [
    mcp({ transport: 'stdio' }),
    openapi({ format: 'yaml' }),
    docs(),
    agentSchema(),
    evalTarget({ framework: 'vitest' }),
  ],
  outDir: './out',
});
```

## MCP Server Target

Generates a production-ready MCP server using `@modelcontextprotocol/sdk`.

```typescript
mcp({
  transport: 'stdio',  // 'stdio' | 'http'
  port: 3000,          // for HTTP transport
})
```

The generated server includes:
- Tool registration with full JSON Schema input validation
- MCP annotations (readOnlyHint, destructiveHint, idempotentHint)
- Handler stubs for implementation
- Package.json and tsconfig.json

## Writing Custom Targets

Implement the `AnvilTarget` interface:

```typescript
import type { AnvilTarget } from '@anvil-tools/compiler';
import type { AnvilIR } from '@anvil-tools/schema';

const myTarget: AnvilTarget = {
  name: 'my-target',
  description: 'My custom target',

  async generate(ir: AnvilIR) {
    return {
      target: 'my-target',
      files: [{
        path: 'output.json',
        content: JSON.stringify(ir, null, 2),
        type: 'schema',
      }],
    };
  },
};
```
