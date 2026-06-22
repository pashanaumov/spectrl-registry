# @spectrl/core

Core business logic for Spectrl registry operations.

## Purpose

This package contains all the deterministic logic for:

- Content hashing (SHA-256)
- Registry file I/O
- Dependency resolution
- Manifest validation

The CLI is a thin wrapper around these functions. All testable logic lives here.

## Why This Exists

Separating core logic from the CLI provides:

1. **Testability**: Pure functions are easier to test than CLI commands
2. **Reusability**: Other tools can import core without CLI overhead
3. **Determinism**: All state changes go through well-defined APIs
4. **Future extensibility**: MCP server, web UI, etc. can use the same core

## Modules

### Hasher

Computes deterministic SHA-256 content hashes.

```typescript
import { Hasher } from '@spectrl/core';

const hash = Hasher.computeHash({
  manifest: { name: 'test', version: '1.0.0', deps: {}, files: ['README.md'] },
  fileContents: new Map([['README.md', '# Test']]),
});

// Returns: "sha256:a3f5b8c9..." (sha256: prefix + 64-char hex string)
```

**Algorithm:**

1. Sort file paths lexicographically
2. Normalize line endings to `\n`
3. Hash each file's path + content
4. Canonicalize manifest (sorted keys, no whitespace)
5. Combine into single SHA-256 digest

### Registry

Handles file I/O for `.spectrl/registry/`.

```typescript
import { Registry } from '@spectrl/core';

const registry = new Registry('.spectrl/registry');

// Publish a spec
await registry.publish(manifest, '/path/to/source');

// Check if spec exists
const exists = await registry.exists('example-spec', '1.0.0');

// Get manifest
const manifest = await registry.getManifest('example-spec', '1.0.0');
```

**Registry Layout:**

```
~/.spectrl/registry/
└── {name}/
    └── {version}/
        ├── spectrl.json       # manifest with hash
        └── files/
            └── {original/path/structure}
```

### Resolver

Resolves complete dependency closure from project index.

```typescript
import { Resolver } from '@spectrl/core';

const resolver = new Resolver();

// Resolve complete closure from index
const nodes = await resolver.resolveClosureFromIndex('./.spectrl/spectrl-index.json');

// Returns array of resolved nodes with name, version, source, deps
```

**Resolution:**

- Reads `.spectrl/spectrl-index.json`
- Extracts all keys as roots
- Performs breadth-first traversal with lexicographic sorting
- Validates manifest identity matches index key
- Ensures all transitive dependencies exist in index
- Returns flat list in dependency order
- Fails fast on missing dependencies or cycles

### Validator

Validates manifests and file paths.

```typescript
import { Validator } from '@spectrl/core';

// Validate manifest
const manifest = Validator.validateManifest(userInput);

// Validate file paths
Validator.validateFilePaths(['docs/spec.md', 'README.md']);

// Check files exist
await Validator.validateFilesExist(['README.md'], '/base/path');
```

**Path Safety:**

- Rejects `..` (path traversal)
- Rejects absolute paths
- Normalizes to forward slashes
- Detects duplicates

## Design Principles

### Determinism

Same inputs always produce same outputs:

- File operations are sorted lexicographically
- Line endings normalized to `\n`
- JSON canonicalized (sorted keys, no whitespace)
- No timestamps or system-specific metadata

### Offline-First

All operations work without network access:

- Registry is local filesystem
- Index is a local JSON file
- No external API calls

### Error Handling

Clear error codes and messages:

- Exit code 1: Validation error
- Exit code 2: I/O error
- Exit code 3: Dependency resolution error

### Atomicity

Operations are all-or-nothing:

- `publish` creates complete directory structure or fails
- `install` installs all dependencies or none

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Test
pnpm test
```

## Dependencies

- `@spectrl/schema`: Zod schemas and types
- Node.js built-ins: `crypto`, `fs/promises`, `path`

## No External Runtime Dependencies

This package only depends on `@spectrl/schema` and Node.js standard library. No third-party runtime dependencies.
