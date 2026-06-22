# Tech Stack & Build System

## Core Technologies

- **Language**: TypeScript with ES2022 target
- **Runtime**: Node.js 20+ or Bun for CLI execution
- **Package Manager**: pnpm with workspaces
- **Schema Validation**: Zod for runtime type checking
- **Testing**: Vitest for unit and integration tests
- **Linting**: Biome for code quality (formatter disabled, using Prettier)
- **Formatting**: Prettier with specific style rules

## Build System

- **CLI Bundler**: esbuild (bundles CLI into a single `dist/cli.js` file)
- **Compiler**: TypeScript compiler (tsc) for library packages
- **Module System**: ESNext with bundler resolution
- **Monorepo**: pnpm workspaces with workspace protocol dependencies
- **Incremental Builds**: TypeScript composite projects with build info

## Web App

- **Framework**: Next.js (App Router) with React
- **Styling**: Tailwind CSS
- **Location**: `apps/spectrl-web/`

## API (Lambda Functions)

- **Runtime**: Node.js on AWS Lambda
- **Location**: `api/` directory, one folder per Lambda function
- **Validation**: Zod schemas for all request/response shapes

## Local Infrastructure Development

- **LocalStack**: Emulates AWS services (Lambda, DynamoDB, S3, etc.) locally
- **tflocal**: Terraform wrapper that redirects AWS provider calls to LocalStack
- Use `tflocal` instead of `terraform` when applying infra changes locally
- See `infra/dev/` for local development infrastructure configuration

## Manifest Format

Specs and powers use `spectrl.jsonc` — JSONC format (JSON with inline comments). The CLI reads these with a JSONC parser that strips comments before JSON parsing.

## Code Style

- **Prettier Config**:
  - Single quotes, semicolons, 2-space tabs
  - 100 character line width, trailing commas
  - Arrow function parentheses always required
- **TypeScript**: Strict mode enabled with full type checking
- **Imports**: JSON module resolution enabled

## Common Commands

```bash
# Development
pnpm install          # Install all dependencies
pnpm build           # Build all packages
pnpm dev             # Start CLI in watch mode
pnpm test            # Run all tests
pnpm test:e2e        # Run end-to-end tests
pnpm lint            # Check code quality with Biome
pnpm format          # Format code with Prettier

# Package-specific (from package directory)
pnpm build           # Compile TypeScript
pnpm dev             # Watch mode compilation
pnpm test            # Run package tests
pnpm test:watch      # Run tests in watch mode

# Release
pnpm release         # Version, build, and publish with changesets
```

## Package Structure

All packages use consistent structure:

- `src/` - TypeScript source files
- `dist/` - Compiled JavaScript output
- `package.json` - ESM type with proper exports
- `tsconfig.json` - Extends base config
