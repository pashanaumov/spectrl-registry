# @spectrl/examples

Test fixtures and example specs for Spectrl MVP testing.

## Purpose

This package contains comprehensive test fixtures for unit, integration, and end-to-end testing of Spectrl. All fixtures are designed to test the core MVP functionality: initialization, publishing, and installation with transitive dependency resolution.

## What's Inside

### 1. **Specs** (`fixtures/specs/`)

Sample spec directories with manifests and files that can be published to the registry. These represent real specs that users would create.

### 2. **Index Files** (`fixtures/indexes/`)

Project index files (`.spectrl/spectrl-index.json`) that map spec references to their source locations. These are what users create in their projects to declare dependencies.

### 3. **Golden Files** (`fixtures/golden/`)

Expected lock file outputs for specific scenarios. These are used for regression testing to ensure deterministic behavior.

### 4. **Scripts** (`scripts/`)

Utility scripts for maintaining fixtures, such as computing hashes when specs are modified.

## Why This Exists

Centralizing test fixtures provides:

1. **Reusability**: Same fixtures used across unit, integration, and e2e tests
2. **Consistency**: All tests work with known-good examples
3. **Documentation**: Examples show what valid specs look like
4. **Determinism**: Golden files ensure reproducible outputs
5. **Error Testing**: Invalid fixtures test error handling and messages

## Structure

```
examples/
├── fixtures/
│   ├── specs/               # Sample spec directories
│   │   ├── base-spec/       # No dependencies
│   │   ├── app-spec/        # Depends on base-spec
│   │   ├── lib-spec/        # Depends on base-spec
│   │   ├── cycle-a/         # Circular dependency with cycle-b
│   │   └── cycle-b/         # Circular dependency with cycle-a
│   ├── indexes/             # Project index files
│   │   ├── valid-single.json         # Single spec
│   │   ├── valid-transitive.json     # Spec with transitive deps
│   │   ├── error-missing-dep.json    # Missing dependency
│   │   └── error-cycle.json          # Circular dependency
│   └── golden/              # Expected lock files
│       ├── single-spec.lock.json     # Expected output for valid-single
│       └── transitive-deps.lock.json # Expected output for valid-transitive
├── scripts/
│   └── compute-hashes.ts    # Regenerate hashes for fixtures
└── README.md                # This file
```

See `fixtures/README.md` for detailed documentation of all fixtures.

## Key Concepts

### What is an Index File?

An **index file** (`.spectrl/spectrl-index.json`) is a project-level configuration that explicitly lists all specs your project depends on, including transitive dependencies. It maps spec references (`name@version`) to their source locations.

**Example:**

```json
{
  "app-spec@1.0.0": {
    "source": "file:./specs/app-spec"
  },
  "base-spec@1.0.0": {
    "source": "file:./specs/base-spec"
  }
}
```

In this example:

- Your project depends on `app-spec@1.0.0`
- `app-spec` depends on `base-spec@1.0.0`
- Both must be explicitly listed in the index (no implicit resolution)
- Sources use `file://` URLs in MVP (local filesystem paths)

The index is **checked into version control** and serves as the source of truth for what specs your project uses.

### What is a Golden File?

A **golden file** is a snapshot of expected output used for regression testing. It captures what the system _should_ produce for a given input, allowing tests to detect unintended changes.

**Example Golden Lock File:**

```json
{
  "createdAt": "2025-11-07T00:00:00.000Z",
  "entries": [
    {
      "name": "base-spec",
      "version": "1.0.0",
      "hash": "sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f",
      "source": "file:../../specs/base-spec",
      "deps": []
    }
  ]
}
```

Golden files ensure:

- **Determinism**: Same inputs always produce same outputs
- **Regression detection**: Changes to hash computation or resolution logic are caught
- **Documentation**: Show what correct output looks like

When you run `spectrl install` with `valid-single.json`, the output lock file should exactly match `single-spec.lock.json`.

## Usage in Tests

### Unit Tests (Testing Individual Components)

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeHash } from '@spectrl/core';

// Test hasher with fixture spec
const specDir = join(__dirname, '../fixtures/specs/base-spec');
const manifest = JSON.parse(await readFile(join(specDir, 'spectrl.json'), 'utf-8'));
const content = await readFile(join(specDir, 'README.md'), 'utf-8');

const hash = computeHash({
  manifest,
  fileContents: { 'README.md': content },
});

// Should match the known hash
expect(hash).toBe('sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f');
```

### Integration Tests (Testing Core Package)

```typescript
import { Resolver } from '@spectrl/core';

// Test resolver with fixture index
const resolver = new Resolver();
const nodes = await resolver.resolveClosureFromIndex(
  join(__dirname, '../fixtures/indexes/valid-transitive.json'),
);

// Should resolve both app-spec and base-spec
expect(nodes).toHaveLength(2);
expect(nodes[0].name).toBe('app-spec');
expect(nodes[1].name).toBe('base-spec');
```

### E2E Tests (Testing Full CLI Workflow)

```typescript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Copy fixtures to temp directory
// ... setup code ...

// Run install command
await execAsync('spectrl install', { cwd: tmpDir });

// Compare output to golden file
const lockFile = await readFile(join(tmpDir, '.spectrl/lock.json'), 'utf-8');
const golden = await readFile(join(__dirname, '../fixtures/golden/single-spec.lock.json'), 'utf-8');

// Ignore timestamp, compare structure
const lock = JSON.parse(lockFile);
const expected = JSON.parse(golden);
expect(lock.entries).toEqual(expected.entries);
```

### Testing Error Scenarios

```typescript
// Test missing dependency error
await expect(
  resolver.resolveClosureFromIndex(join(__dirname, '../fixtures/indexes/error-missing-dep.json')),
).rejects.toThrow('Missing dependency: base-spec@1.0.0');

// Test cycle detection
await expect(
  resolver.resolveClosureFromIndex(join(__dirname, '../fixtures/indexes/error-cycle.json')),
).rejects.toThrow('Cyclic dependency detected');
```

## Maintaining Fixtures

### Regenerating Hashes

If you modify any spec files in `fixtures/specs/`, you need to regenerate the hashes in the golden lock files:

```bash
# Compute new hashes
bun run packages/examples/scripts/compute-hashes.ts

# Update golden files with new hashes
# (manually copy the output hashes into the golden lock files)
```

### Adding New Fixtures

1. **Add a new spec**: Create a directory in `fixtures/specs/` with a `spectrl.json` and files
2. **Compute its hash**: Run the compute-hashes script
3. **Create index files**: Add entries to existing indexes or create new ones
4. **Create golden files**: If testing a new scenario, create the expected lock file output

### Fixture Design Principles

- **Realistic content**: Use actual documentation, not placeholder text
- **Minimal but complete**: Include enough to test features, not more
- **Clear naming**: Names should indicate purpose (e.g., `error-missing-dep.json`)
- **Self-contained**: Fixtures should work without external dependencies

## Development Notes

This is **not a published package**. It exists only for internal testing.

- No build step required (static files)
- No runtime dependencies
- Used by `@spectrl/core`, `@spectrl/cli`, and `tests/e2e`

## See Also

- `fixtures/README.md` - Detailed fixture documentation
- `fixtures/specs/README.md` - Spec fixture details
- `fixtures/indexes/README.md` - Index file details
- `fixtures/golden/README.md` - Golden file details
