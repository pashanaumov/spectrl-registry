# @spectrl/schema

Zod schemas and TypeScript types for Spectrl manifests and index files.

## Purpose

This package is the single source of truth for all data structures in Spectrl. It provides:

- Runtime validation using Zod
- TypeScript type inference from schemas
- Consistent validation across CLI and core packages

## Why This Exists

By centralizing schemas in one package, we ensure:

1. **Consistency**: All packages validate data the same way
2. **Type safety**: TypeScript types are automatically derived from runtime schemas
3. **Single source of truth**: Schema changes propagate automatically
4. **Validation errors**: Zod provides detailed, actionable error messages

## Exports

### Manifest Schema

Defines the structure of `spectrl.json` files:

```typescript
import { ManifestSchema, type Manifest } from '@spectrl/schema';

const manifest: Manifest = {
  name: 'example-spec',
  version: '1.0.0',
  deps: { 'base-spec': '0.5.0' },
  files: ['docs/architecture.md'],
  hash: 'sha256:a3f5b8c9...', // optional, computed during publish
};

// Validate at runtime
ManifestSchema.parse(manifest);
```

### Project Index Schema

Defines the structure of `.spectrl/spectrl-index.json` that maps spec references to sources:

```typescript
import { ProjectIndexSchema, type ProjectIndex } from '@spectrl/schema';

const index: ProjectIndex = {
  'example-spec@1.0.0': {
    source: 'file:./specs/example-spec/1.0.0',
  },
  'base-spec@0.5.0': {
    source: 'file:./specs/base-spec/0.5.0',
  },
};

// Validate at runtime
ProjectIndexSchema.parse(index);
```

### Lock File Schema

Defines the structure of `.spectrl/lock.json` that captures resolved dependency closure:

```typescript
import { LockFileSchema, type LockFile, type LockEntry } from '@spectrl/schema';

const lockFile: LockFile = {
  createdAt: '2025-11-07T13:40:00Z',
  entries: [
    {
      name: 'base-spec',
      version: '0.5.0',
      hash: 'sha256:def456...',
      source: 'file:./specs/base-spec/0.5.0',
      deps: [],
    },
    {
      name: 'example-spec',
      version: '1.0.0',
      hash: 'sha256:abc123...',
      source: 'file:./specs/example-spec/1.0.0',
      deps: ['base-spec@0.5.0'],
    },
  ],
};

// Validate at runtime
LockFileSchema.parse(lockFile);
```

## Schema Rules

### Manifest

- `name`: Lowercase alphanumeric + hyphens only (no scopes in MVP)
- `version`: Exact semver format (e.g., `1.0.0`)
- `deps`: Object mapping spec names to exact versions
- `files`: Array of relative file paths (must not be empty)
- `hash`: Optional SHA-256 hash with `sha256:` prefix (computed during publish)

### Project Index Entry

- Key format: `{name}@{version}` (e.g., `example-spec@1.0.0`)
- `source`: URL string (file:// URLs in MVP)

### Lock Entry

- `name`: Spec name
- `version`: Exact semver version
- `hash`: SHA-256 hash with `sha256:` prefix
- `source`: URL where spec was resolved from
- `deps`: Array of dependency references in `{name}@{version}` format

## Usage in Other Packages

### In @spectrl/core

```typescript
import { ManifestSchema } from '@spectrl/schema';

// Validate user input
const manifest = ManifestSchema.parse(userInput);
```

### In @spectrl/cli

```typescript
import type { Manifest } from '@spectrl/schema';

// Use types for function signatures
function processManifest(manifest: Manifest): void {
  // TypeScript knows the shape of manifest
}
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev
```

## Dependencies

- `zod`: Runtime schema validation and type inference

## No External Runtime Dependencies

This package only depends on Zod. All validation logic is self-contained.
