# Project Structure & Organization

## Monorepo Layout

```
spectrl/
├── packages/           # Core library packages
│   ├── schema/        # Zod schemas + TypeScript types
│   ├── core/          # Registry I/O + resolution logic
│   └── cli/           # spectrl binary executable
├── apps/              # Applications and services
│   └── spectrl-web/   # Next.js frontend (browse public registry)
├── api/               # AWS Lambda functions (public registry backend)
│   ├── auth-device-init/
│   ├── auth-device-poll/
│   ├── auth-exchange/
│   ├── get-spec/
│   ├── publish-spec/
│   ├── search-specs/
│   └── unpublish-spec/
├── tests/             # Test suites
│   └── e2e/          # Black-box end-to-end tests
├── infra/             # Infrastructure configuration
│   ├── dev/          # Development environment setup
│   └── prod/         # Production configuration
├── docs/              # Documentation source files
└── .kiro/            # Kiro IDE configuration
```

## Package Dependencies

- **@spectrl/schema**: Foundation package with Zod schemas and types
- **@spectrl/core**: Depends on schema, provides registry and resolution logic
- **spectrl** (CLI): Depends on both core and schema, provides CLI interface

## Architectural Patterns

- **Schema-first**: All data structures defined in schema package using Zod
- **Workspace protocol**: Internal dependencies use `workspace:*` for local linking
- **ESM modules**: All packages use ES modules with proper exports
- **Incremental compilation**: TypeScript composite projects for fast rebuilds

## File Naming Conventions

- **Source files**: `.ts` extension in `src/` directories
- **Test files**: `.test.ts` suffix, co-located with source
- **Manifest files**: `spectrl.jsonc` (JSONC format with comments)
- **Config files**: Root-level configuration (tsconfig, package.json, etc.)
- **Build output**: `dist/` directories with `.js` and `.d.ts` files

## Key Directories

- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript output (gitignored)
- `node_modules/` - Package dependencies (gitignored)
- `.changeset/` - Changeset configuration for releases
- `.github/` - GitHub workflows and templates
- `~/.spectrl/registry/` - Machine-wide local registry (outside repo)

## Development Workflow

1. Make changes in `packages/` source files
2. Run `pnpm build` to compile TypeScript
3. Run `pnpm test` to validate changes
4. Use `pnpm dev` for watch mode during development
5. Format with `pnpm format` before committing

## Running the CLI Locally

The CLI is built but not globally installed during development. Run it with:

```bash
# From repo root
node packages/cli/dist/cli.js <command>

# From a subdirectory
node ../packages/cli/dist/cli.js <command>
```
