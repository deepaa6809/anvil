---
title: Schema Reference
description: Complete reference for the Anvil .anvil.yaml schema format — every field, type, and option.
date: "2025-03-31"
---

## Overview

An Anvil file has three top-level sections:

```yaml
anvil: "1.0"          # Schema version
service: { ... }      # Service metadata
tools: { ... }        # Tool definitions
```

## Service

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Lowercase kebab-case service name |
| `version` | string | Yes | Semver version (x.y.z) |
| `description` | string | No | Human-readable description |
| `base_url` | string | No | Base URL for HTTP-based tools |
| `auth` | object | No | Authentication configuration |
| `default_permissions` | array | No | Permissions applied to all tools |
| `default_rate_limit` | object | No | Rate limit applied to all tools |
| `tags` | string[] | No | Tags for categorization |

### Auth Types

```yaml
auth:
  type: api_key | bearer | basic | oauth2 | custom
  header: X-API-Key        # for api_key/bearer
  env_var: MY_API_KEY       # environment variable name
```

## Tool Definition

Each tool under `tools:` supports these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Human-facing description |
| `agent` | object | No | Agent-specific metadata |
| `parameters` | object | Yes | Input parameters |
| `returns` | field | No | Return type schema |
| `permissions` | array | No | Required permissions |
| `rate_limit` | object | No | Rate limiting config |
| `errors` | object | No | Known error types |
| `side_effects` | enum | No | none / read / write / destructive |
| `cost` | enum | No | free / low / medium / high / variable |
| `idempotent` | boolean | No | Safe to retry? |
| `cache` | object | No | Cache configuration |
| `examples` | array | No | Test/documentation examples |
| `tags` | string[] | No | Tool-specific tags |
| `deprecated` | bool/string | No | Deprecation notice |

## Agent Metadata

The `agent` block provides LLM-optimized context:

```yaml
agent:
  description: |
    Rich description optimized for AI agent consumption.
    Can be multi-line and much more detailed than the human description.
  when_to_use:
    - User asks about X
    - Agent needs to do Y
  when_not_to_use:
    - For Z, use another_tool instead
  tips:
    - Prefer city names over coordinates
    - Default to metric units
  priority: 10  # Higher = prefer over similar tools
```

## Field Types

Parameters and return types use these types:

| Type | YAML | Description |
|------|------|-------------|
| `string` | `type: string` | Text value |
| `number` | `type: number` | Floating point |
| `integer` | `type: integer` | Whole number |
| `boolean` | `type: boolean` | true/false |
| `enum` | `type: enum` | Fixed set of values |
| `object` | `type: object` | Nested properties |
| `array` | `type: array` | List of items |
| `union` | `type: union` | One of several types |

### String Validation

```yaml
location:
  type: string
  validation:
    min_length: 1
    max_length: 200
    pattern: "^[A-Z]"
    format: email | uri | uuid | date | datetime | ip
```

### Number Validation

```yaml
count:
  type: integer
  validation:
    minimum: 0
    maximum: 100
    multiple_of: 5
```

### Array Validation

```yaml
tags:
  type: array
  items:
    type: string
  validation:
    min_items: 1
    max_items: 10
    unique_items: true
```

## Permissions

```yaml
permissions:
  - type: network
    target: api.example.com
    methods: [GET, POST]
    reason: API access
  - type: filesystem
    target: /tmp/**
    methods: [read, write]
  - type: environment
    target: API_KEY
  - type: database
    target: postgres
    methods: [SELECT]
  - type: subprocess
    target: ffmpeg
```

## Examples

Examples serve triple duty: documentation, eval test cases, and agent few-shot prompts.

```yaml
examples:
  - name: basic_query
    description: Simple weather lookup
    input:
      location: "San Francisco, CA"
      units: celsius
    output:
      temperature: 18
      conditions: "Partly cloudy"
    prompt: "What's the weather in SF?"
```

The `prompt` field is used by the eval harness to test agent tool selection accuracy.
