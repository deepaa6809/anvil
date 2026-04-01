---
title: Runtime & Middleware
description: Composable middleware for production tool deployments — validation, permissions, rate limiting, caching, telemetry.
date: "2025-03-31"
---

## Overview

`@anvil-tools/runtime` provides composable middleware for production tool execution. All middleware is derived from your Anvil definitions — no separate configuration needed.

## Middleware Composition

```typescript
import { parseAnvilYaml, lowerToIR } from '@anvil-tools/schema';
import {
  compose,
  validationMiddleware,
  rateLimitMiddleware,
  cachingMiddleware,
  loggingMiddleware,
} from '@anvil-tools/runtime';

const { service } = parseAnvilYaml(yamlSource);
const ir = lowerToIR(service);

const handler = compose(
  loggingMiddleware(),
  validationMiddleware(ir),
  rateLimitMiddleware(ir),
  cachingMiddleware(ir),
)(async (toolName, input) => {
  // Your tool implementation
  return { result: 'ok' };
});
```

## Available Middleware

| Middleware | Purpose |
|-----------|---------|
| `validationMiddleware` | Validates input/output against tool schemas |
| `rateLimitMiddleware` | Enforces rate limits from tool definitions |
| `cachingMiddleware` | Caches results based on cache hints |
| `loggingMiddleware` | Basic logging |
| `structuredLoggingMiddleware` | JSON structured logging |
| `costTrackingMiddleware` | Tracks cost levels and durations |
| `circuitBreakerMiddleware` | Prevents cascading failures |
| `otelMiddleware` | OpenTelemetry instrumentation |

## Telemetry

### Structured Logging

```typescript
import { structuredLoggingMiddleware } from '@anvil-tools/runtime';

const mw = structuredLoggingMiddleware(
  (entry) => console.log(JSON.stringify(entry)),
  'info'
);
```

### Cost Tracking

```typescript
import { costTrackingMiddleware, createCostTracker } from '@anvil-tools/runtime';

const tracker = createCostTracker();
const mw = costTrackingMiddleware(ir, tracker);

// Later...
console.log(tracker.getSummary());
```

### Circuit Breaker

```typescript
import { circuitBreakerMiddleware } from '@anvil-tools/runtime';

const mw = circuitBreakerMiddleware({
  failure_threshold: 5,
  recovery_timeout: 30_000,
  success_threshold: 2,
});
```
