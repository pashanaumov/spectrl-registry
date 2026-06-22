# Spec Fixtures

This directory contains sample spec directories that can be published to the Spectrl registry. Each spec has a `spectrl.json` manifest and one or more tracked files.

## What is a Spec?

A **spec** is a versioned collection of structured documents (PRDs, TDDs, ADRs, etc.) that can be published to the registry and installed by other projects. Each spec consists of:

1. **Manifest** (`spectrl.json`) - Metadata including name, version, dependencies, and tracked files
2. **Tracked files** - The actual documentation files included in the spec

## Available Specs

### base-spec@1.0.0

**Purpose**: Foundation spec with no dependencies

**Manifest**:

```json
{
  "name": "base-spec",
  "version": "1.0.0",
  "deps": {},
  "files": ["README.md"]
}
```

**Files**:

- `README.md` - Basic documentation about the spec

**Hash**: `sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f`

**Use Cases**:

- Testing basic publish workflow
- Testing single-spec installation
- Serving as a dependency for other specs

---

### app-spec@1.0.0

**Purpose**: Application spec that depends on base-spec

**Manifest**:

```json
{
  "name": "app-spec",
  "version": "1.0.0",
  "deps": {
    "base-spec": "1.0.0"
  },
  "files": ["docs/architecture.md", "docs/api.md"]
}
```

**Files**:

- `docs/architecture.md` - Architecture documentation
- `docs/api.md` - API documentation

**Hash**: `sha256:1e66a38fbf1c22c5e6645cf8756bd32faf0835ab6420810576c66d4d132fafb8`

**Use Cases**:

- Testing transitive dependency resolution
- Testing specs with subdirectories
- Testing specs with multiple files

---

### lib-spec@1.0.0

**Purpose**: Library spec that depends on base-spec

**Manifest**:

```json
{
  "name": "lib-spec",
  "version": "1.0.0",
  "deps": {
    "base-spec": "1.0.0"
  },
  "files": ["src/types.md", "src/utils.md"]
}
```

**Files**:

- `src/types.md` - Type definitions documentation
- `src/utils.md` - Utility functions documentation

**Hash**: `sha256:02e79ccc09b0048ac830204cd89ed3e45bae07f68cd9ddb291928ec176b9979b`

**Use Cases**:

- Testing multiple specs depending on the same base
- Testing different directory structures
- Testing diamond dependencies (if combined with app-spec)

---

### cycle-a@1.0.0 & cycle-b@1.0.0

**Purpose**: Specs with circular dependencies for error testing

**cycle-a manifest**:

```json
{
  "name": "cycle-a",
  "version": "1.0.0",
  "deps": {
    "cycle-b": "1.0.0"
  },
  "files": ["README.md"]
}
```

**cycle-b manifest**:

```json
{
  "name": "cycle-b",
  "version": "1.0.0",
  "deps": {
    "cycle-a": "1.0.0"
  },
  "files": ["README.md"]
}
```

**Use Cases**:

- Testing cycle detection in dependency resolution
- Testing error messages for circular dependencies
- Verifying resolver fails gracefully

## Dependency Graph

```
base-spec@1.0.0
    ↑
    ├── app-spec@1.0.0
    └── lib-spec@1.0.0

cycle-a@1.0.0 ⟷ cycle-b@1.0.0
```

## Usage in Tests

### Publishing a Spec

```typescript
import { Registry } from '@spectrl/core';
import { join } from 'node:path';

const registry = new Registry();
const specDir = join(__dirname, 'fixtures/specs/base-spec');

await registry.publish(manifest, specDir);
```

### Computing Hash

```typescript
import { computeHash } from '@spectrl/core';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(join(specDir, 'spectrl.json'), 'utf-8'));

const fileContents = {
  'README.md': await readFile(join(specDir, 'README.md'), 'utf-8'),
};

const hash = computeHash({ manifest, fileContents });
```

### Testing Validation

```typescript
// Valid spec
const validManifest = JSON.parse(await readFile('fixtures/specs/base-spec/spectrl.json', 'utf-8'));
expect(() => ManifestSchema.parse(validManifest)).not.toThrow();

// Invalid spec (missing required field)
const invalidManifest = { name: 'test', version: '1.0.0' }; // missing files
expect(() => ManifestSchema.parse(invalidManifest)).toThrow();
```

## Design Decisions

### Realistic Content

Each spec contains realistic documentation rather than placeholder text. This ensures:

- Hash computation works with real-world data
- File path handling is properly tested
- Content normalization (line endings) is validated

### Subdirectories

Specs like `app-spec` and `lib-spec` use subdirectories (`docs/`, `src/`) to test:

- Path preservation in registry
- Directory creation during publish
- Relative path handling

### Multiple Files

Specs with multiple files test:

- Lexicographic ordering during hash computation
- Batch file operations
- File list validation

### Minimal Dependencies

Most specs depend only on `base-spec` to keep the dependency graph simple and predictable. This makes it easy to reason about resolution order and test specific scenarios.

## Regenerating Hashes

If you modify any spec files, regenerate hashes:

```bash
bun run packages/examples/scripts/compute-hashes.ts
```

Then update the hashes in:

- This README
- Golden lock files in `fixtures/golden/`
- Any test assertions that check specific hash values
