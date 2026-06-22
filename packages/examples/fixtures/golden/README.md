# Golden Lock Files

This directory contains expected lock file outputs for specific installation scenarios. These are used for regression testing to ensure deterministic behavior.

## What is a Golden File?

A **golden file** (also called a "snapshot" or "expected output") is a reference file that captures what the system _should_ produce for a given input. Tests compare actual output against golden files to detect unintended changes.

### Why Golden Files?

1. **Regression Detection**: Catch unintended changes to output format or behavior
2. **Determinism Validation**: Ensure same inputs always produce same outputs
3. **Documentation**: Show what correct output looks like
4. **Confidence**: Know that changes are intentional, not accidental

### When to Update Golden Files

Update golden files when:

- You intentionally change output format
- You modify hash computation logic
- You update fixture specs (which changes their hashes)
- You add new fields to lock file schema

**Never** update golden files to make failing tests pass without understanding why they're failing!

## Lock File Format

A lock file (`.spectrl/lock.json`) captures the complete resolved dependency closure with integrity hashes:

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

### Fields

- **createdAt**: ISO-8601 timestamp (fixed in golden files for determinism)
- **entries**: Array of resolved specs, sorted lexicographically by `name@version`
- **name**: Spec name (lowercase alphanumeric with hyphens)
- **version**: Exact semver version (x.y.z)
- **hash**: SHA-256 content hash in format `sha256:<64 hex chars>`
- **source**: URL where spec was sourced from
- **deps**: Array of dependency references in format `name@version`

## Available Golden Files

### single-spec.lock.json

**Scenario**: Installing from `indexes/valid-single.json`

**Input Index**:

```json
{
  "base-spec@1.0.0": {
    "source": "file:../../specs/base-spec"
  }
}
```

**Expected Output**:

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

**What This Tests**:

- Single spec installation
- Hash computation for simple spec
- Lock file structure
- No dependencies case

---

### transitive-deps.lock.json

**Scenario**: Installing from `indexes/valid-transitive.json`

**Input Index**:

```json
{
  "app-spec@1.0.0": {
    "source": "file:../../specs/app-spec"
  },
  "base-spec@1.0.0": {
    "source": "file:../../specs/base-spec"
  }
}
```

**Expected Output**:

```json
{
  "createdAt": "2025-11-07T00:00:00.000Z",
  "entries": [
    {
      "name": "app-spec",
      "version": "1.0.0",
      "hash": "sha256:1e66a38fbf1c22c5e6645cf8756bd32faf0835ab6420810576c66d4d132fafb8",
      "source": "file:../../specs/app-spec",
      "deps": ["base-spec@1.0.0"]
    },
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

**What This Tests**:

- Transitive dependency resolution
- Multiple spec installation
- Dependency relationship capture
- Lexicographic ordering (app-spec before base-spec)
- Hash computation for specs with multiple files

**Important**: Note that entries are sorted alphabetically by `name@version`, not by dependency order. `app-spec` comes before `base-spec` even though it depends on it.

## Usage in Tests

### Exact Comparison (Unit/Integration Tests)

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Generate lock file
const lockFile = await generateLockFile(indexPath);

// Load golden file
const goldenPath = join(__dirname, 'fixtures/golden/single-spec.lock.json');
const golden = JSON.parse(await readFile(goldenPath, 'utf-8'));

// Compare (ignoring timestamp)
expect(lockFile.entries).toEqual(golden.entries);
```

### Structural Comparison (E2E Tests)

```typescript
// Run CLI command
await exec('spectrl install', { cwd: tmpDir });

// Read generated lock file
const lockPath = join(tmpDir, '.spectrl/lock.json');
const lock = JSON.parse(await readFile(lockPath, 'utf-8'));

// Load golden file
const golden = JSON.parse(await readFile('fixtures/golden/transitive-deps.lock.json', 'utf-8'));

// Compare structure (ignore timestamp)
expect(lock.entries).toHaveLength(golden.entries.length);
expect(lock.entries[0].name).toBe(golden.entries[0].name);
expect(lock.entries[0].hash).toBe(golden.entries[0].hash);
expect(lock.entries[0].deps).toEqual(golden.entries[0].deps);
```

### Hash Validation

```typescript
// Verify hashes match expected values
const baseSpecHash = 'sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f';

const entry = lock.entries.find((e) => e.name === 'base-spec');
expect(entry.hash).toBe(baseSpecHash);
```

## Design Decisions

### Fixed Timestamps

Golden files use a fixed timestamp (`2025-11-07T00:00:00.000Z`) rather than dynamic timestamps. This allows exact comparison without needing to strip or ignore the timestamp field.

In real usage, the timestamp would be the current time when `spectrl install` runs.

### Actual Hashes

Golden files contain real SHA-256 hashes computed from the fixture specs, not placeholder values. This ensures:

- Hash computation is tested end-to-end
- Changes to specs are detected
- Hash format is validated

### Lexicographic Ordering

Entries are sorted alphabetically by `name@version`, which is the deterministic ordering Spectrl uses. This is important for reproducibility across different environments.

### Complete Entries

Each entry includes all fields (name, version, hash, source, deps) even when some are empty (like `deps: []`). This validates the complete lock file schema.

## Regenerating Golden Files

If you modify fixture specs or change hash computation logic:

1. **Compute new hashes**:

   ```bash
   bun run packages/examples/scripts/compute-hashes.ts
   ```

2. **Update golden files**:
   - Copy new hashes into the golden lock files
   - Verify the structure is still correct
   - Ensure ordering is lexicographic

3. **Run tests**:

   ```bash
   pnpm test
   ```

4. **Verify changes**:
   - Review the diff carefully
   - Ensure changes are intentional
   - Update any test assertions that check specific hash values

## Determinism Guarantees

Golden files validate these determinism guarantees:

1. **Same inputs → same outputs**: Running install twice produces identical lock files
2. **Stable ordering**: Entries are always in lexicographic order
3. **Stable hashes**: Same spec content produces same hash
4. **Stable format**: JSON structure is consistent

These guarantees are critical for Spectrl's reproducibility goals.

## See Also

- `../indexes/README.md` - Input index files that produce these outputs
- `../specs/README.md` - Specs referenced in lock files
- Design doc: `.kiro/specs/spectrl-mvp/design.md` - Lock file format specification
- Requirements: `.kiro/specs/spectrl-mvp/requirements.md` - Requirement 7 (Lock File Format)
