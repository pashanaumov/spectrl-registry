# Index File Fixtures

This directory contains sample project index files (`.spectrl/spectrl-index.json`) for testing different installation scenarios.

## What is an Index File?

An **index file** is a project-level configuration that explicitly declares all specs your project depends on, including transitive dependencies. It's located at `.spectrl/spectrl-index.json` in your project root.

### Key Characteristics

1. **Explicit**: All dependencies, including transitives, must be listed
2. **Versioned**: Each entry specifies an exact version (no ranges in MVP)
3. **Sourced**: Each entry maps to a source location (file:// URLs in MVP)
4. **Checked in**: The index is committed to version control

### Format

```json
{
  "name@version": {
    "source": "file:./path/to/spec"
  }
}
```

The key format is `{name}@{version}` (e.g., `base-spec@1.0.0`), and the value contains a `source` field with a URL pointing to the spec location.

## Available Index Files

### valid-single.json

**Purpose**: Test installation of a single spec with no dependencies

**Content**:

```json
{
  "base-spec@1.0.0": {
    "source": "file:../../specs/base-spec"
  }
}
```

**Expected Behavior**:

- Resolves to 1 spec: `base-spec@1.0.0`
- Generates lock file with 1 entry
- Installs base-spec to registry

**Use Cases**:

- Basic installation workflow
- Single-spec scenarios
- Baseline for more complex tests

**Golden File**: `golden/single-spec.lock.json`

---

### valid-transitive.json

**Purpose**: Test installation with transitive dependencies

**Content**:

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

**Expected Behavior**:

- Resolves to 2 specs: `app-spec@1.0.0` and `base-spec@1.0.0`
- Generates lock file with 2 entries in lexicographic order
- Installs both specs to registry
- Correctly captures dependency relationship

**Use Cases**:

- Transitive dependency resolution
- Dependency ordering
- Multi-spec installation

**Golden File**: `golden/transitive-deps.lock.json`

---

### error-missing-dep.json

**Purpose**: Test error handling when a dependency is missing from the index

**Content**:

```json
{
  "app-spec@1.0.0": {
    "source": "file:../../specs/app-spec"
  }
}
```

**Expected Behavior**:

- Fails during resolution
- Exit code: 3 (dependency resolution error)
- Error message: `"Missing dependency: base-spec@1.0.0. Add it to .spectrl/spectrl-index.json"`

**Use Cases**:

- Testing error messages
- Validating dependency checking
- Ensuring helpful user guidance

**Why This Fails**:
`app-spec@1.0.0` declares `base-spec@1.0.0` as a dependency in its manifest, but `base-spec@1.0.0` is not listed in the index. Spectrl requires all transitive dependencies to be explicitly declared.

---

### error-cycle.json

**Purpose**: Test cycle detection in dependency resolution

**Content**:

```json
{
  "cycle-a@1.0.0": {
    "source": "file:../../specs/cycle-a"
  },
  "cycle-b@1.0.0": {
    "source": "file:../../specs/cycle-b"
  }
}
```

**Expected Behavior**:

- Fails during resolution
- Exit code: 3 (dependency resolution error)
- Error message: `"Cyclic dependency detected: cycle-a@1.0.0 → cycle-b@1.0.0 → cycle-a@1.0.0"`

**Use Cases**:

- Testing cycle detection algorithm
- Validating error messages for cycles
- Ensuring resolver doesn't infinite loop

**Why This Fails**:
`cycle-a` depends on `cycle-b`, and `cycle-b` depends on `cycle-a`, creating a circular dependency that cannot be resolved.

## Usage in Tests

### Testing Valid Resolution

```typescript
import { Resolver } from '@spectrl/core';
import { join } from 'node:path';

const resolver = new Resolver();
const indexPath = join(__dirname, 'fixtures/indexes/valid-transitive.json');

const nodes = await resolver.resolveClosureFromIndex(indexPath);

expect(nodes).toHaveLength(2);
expect(nodes[0].name).toBe('app-spec');
expect(nodes[1].name).toBe('base-spec');
expect(nodes[0].deps).toEqual(['base-spec@1.0.0']);
```

### Testing Error Scenarios

```typescript
// Missing dependency
await expect(
  resolver.resolveClosureFromIndex(join(__dirname, 'fixtures/indexes/error-missing-dep.json')),
).rejects.toThrow('Missing dependency: base-spec@1.0.0');

// Circular dependency
await expect(
  resolver.resolveClosureFromIndex(join(__dirname, 'fixtures/indexes/error-cycle.json')),
).rejects.toThrow('Cyclic dependency detected');
```

### E2E Testing

```typescript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Copy index to temp project
await copyFile('fixtures/indexes/valid-single.json', join(tmpDir, '.spectrl/spectrl-index.json'));

// Run install
await execAsync('spectrl install', { cwd: tmpDir });

// Verify lock file was created
const lockExists = await fileExists(join(tmpDir, '.spectrl/lock.json'));
expect(lockExists).toBe(true);
```

## Design Decisions

### Relative Paths

Index files use relative paths (`file:../../specs/base-spec`) to reference specs. This makes fixtures self-contained and portable. Tests need to resolve these paths relative to the fixtures directory.

### Explicit Transitives

Even though `app-spec` depends on `base-spec`, `valid-transitive.json` explicitly lists both. This reflects Spectrl's design principle: **no implicit resolution**. Users must declare all dependencies, including transitives.

### Error Scenarios

The error fixtures (`error-missing-dep.json`, `error-cycle.json`) are just as important as valid fixtures. They ensure:

- Error messages are helpful
- Exit codes are correct
- The system fails gracefully
- Users get actionable guidance

### Minimal Complexity

Each index tests one specific scenario. This makes it easy to:

- Understand what's being tested
- Debug failures
- Add new scenarios without affecting existing tests

## Index File Workflow

1. **User creates project**: `spectrl init` creates `.spectrl/spectrl-index.json`
2. **User adds specs**: Manually edit index to add spec references
3. **User installs**: `spectrl install` reads index, resolves closure, generates lock file
4. **Lock file created**: `.spectrl/lock.json` captures resolved dependencies with hashes

The index is the **input** (what user declares), and the lock file is the **output** (what system resolves).

## See Also

- `../specs/README.md` - Documentation of available specs
- `../golden/README.md` - Expected lock file outputs
- Design doc: `.kiro/specs/spectrl-mvp/design.md` - Index file format specification
