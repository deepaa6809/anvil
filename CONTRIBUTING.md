# Contributing to Anvil

Thank you for your interest in contributing to Anvil. This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/64envy64/anvil.git
cd anvil-tools

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test
```

## Project Structure

Anvil is a pnpm monorepo with packages in `packages/`:

- **`schema`** — Core types, YAML parser, Zod validation, IR
- **`compiler`** — Compilation pipeline and plugin interface
- **`cli`** — CLI commands (init, validate, compile, dev, serve, publish, doctor)
- **`runtime`** — Middleware for production deployments
- **`registry`** — Package registry client
- **`target-*`** — Compilation targets (one package per target)

## Making Changes

1. Create a branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure `pnpm run build` and `pnpm run test` pass
5. Submit a pull request

## Adding a New Target

1. Create `packages/target-your-name/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Implement the `AnvilTarget` interface from `@anvil-tools/compiler`
3. Export a factory function: `export const yourTarget: AnvilTargetFactory = (options) => ({ ... })`
4. Add tests
5. Update the README and docs

## Code Style

- TypeScript strict mode
- ESM modules
- No default exports (except for config files)
- Prefer explicit types over inference for public APIs
- Keep dependencies minimal — each target should only depend on `@anvil-tools/schema` and `@anvil-tools/compiler`

## Commit Messages

Use conventional commit format:

```
feat(target-mcp): add HTTP transport support
fix(schema): handle empty examples array
docs: update MCP integration guide
test(compiler): add multi-source merge test
```

## Reporting Issues

- Use GitHub Issues
- Include your Anvil version (`anvil --version`)
- Include the `.anvil.yaml` file (or a minimal reproduction)
- Include the full error output

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0.
