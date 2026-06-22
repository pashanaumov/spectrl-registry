# Test Fixtures

This directory contains test fixtures for unit, integration, and e2e tests.

## Structure

```
fixtures/
├── specs/           # Sample spec directories
│   ├── base-spec/   # No dependencies
│   ├── app-spec/    # Depends on base-spec
│   ├── lib-spec/    # Depends on base-spec
│   ├── cycle-a/     # Circular dependency with cycle-b
│   └── cycle-b/     # Circular dependency with cycle-a
├── indexes/         # Sample project index files
│   ├── valid-single.json         # Single spec without dependencies
│   ├── valid-transitive.json     # Spec with transitive dependencies
│   ├── error-missing-dep.json    # Missing dependency (for error testing)
│   └── error-cycle.json          # Circular dependency (for error testing)
└── golden/          # Expected lock files
    ├── single-spec.lock.json     # Expected output for valid-single
    └── transitive-deps.lock.json # Expected output for valid-transitive
```

## Sample Specs

### base-spec@1.0.0

- **Dependencies**: None
- **Files**: `README.md`
- **Hash**: `sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f`
- **Purpose**: Foundation spec with no dependencies

### app-spec@1.0.0

- **Dependencies**: `base-spec@1.0.0`
- **Files**: `docs/architecture.md`, `docs/api.md`
- **Hash**: `sha256:1e66a38fbf1c22c5e6645cf8756bd32faf0835ab6420810576c66d4d132fafb8`
- **Purpose**: Application spec that depends on base-spec

### lib-spec@1.0.0

- **Dependencies**: `base-spec@1.0.0`
- **Files**: `src/types.md`, `src/utils.md`
- **Hash**: `sha256:02e79ccc09b0048ac830204cd89ed3e45bae07f68cd9ddb291928ec176b9979b`
- **Purpose**: Library spec that depends on base-spec

### cycle-a@1.0.0 & cycle-b@1.0.0

- **Dependencies**: Each depends on the other
- **Purpose**: Test circular dependency detection

## Project Index Files

### valid-single.json

Contains only `base-spec@1.0.0` with no dependencies.

### valid-transitive.json

Contains `app-spec@1.0.0` and its transitive dependency `base-spec@1.0.0`.

### error-missing-dep.json

Contains `app-spec@1.0.0` but missing its dependency `base-spec@1.0.0`.
Expected to fail with: "Missing dependency: base-spec@1.0.0. Add it to .spectrl/spectrl-index.json"

### error-cycle.json

Contains `cycle-a@1.0.0` and `cycle-b@1.0.0` which have circular dependencies.
Expected to fail with: "Cyclic dependency detected: ..."

## Golden Lock Files

### single-spec.lock.json

Expected lock file output when installing from `valid-single.json`.
Contains one entry for `base-spec@1.0.0`.

### transitive-deps.lock.json

Expected lock file output when installing from `valid-transitive.json`.
Contains two entries in lexicographic order:

1. `app-spec@1.0.0` (depends on base-spec)
2. `base-spec@1.0.0` (no dependencies)

## Usage in Tests

### Unit Tests

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const fixturesDir = join(__dirname, '../fixtures');
const indexPath = join(fixturesDir, 'indexes/valid-single.json');
const goldenPath = join(fixturesDir, 'golden/single-spec.lock.json');
```

### Integration Tests

```typescript
// Test resolver with fixture index
const resolver = new Resolver();
const nodes = await resolver.resolveClosureFromIndex(
  join(fixturesDir, 'indexes/valid-transitive.json'),
);
```

### E2E Tests

```typescript
// Copy fixture specs to temp directory
// Run spectrl install
// Compare output lock file to golden file
```

## Regenerating Hashes

If you modify the fixture specs, regenerate hashes with:

```bash
bun run packages/examples/scripts/compute-hashes.ts
```

Then update the golden lock files with the new hashes.
