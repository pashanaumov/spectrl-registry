# Examples Package Documentation Guide

This document provides an overview of all documentation in the examples package.

## Documentation Hierarchy

```
packages/examples/
├── README.md                           # Main package overview
├── DOCUMENTATION.md                    # This file - documentation guide
└── fixtures/
    ├── README.md                       # Detailed fixture documentation
    ├── specs/
    │   └── README.md                   # Spec fixtures explained
    ├── indexes/
    │   └── README.md                   # Index file fixtures explained
    └── golden/
        └── README.md                   # Golden file fixtures explained
```

## Quick Navigation

### Start Here

- **[Main README](README.md)** - Package overview, key concepts, usage examples

### Understanding Concepts

- **[What is an Index File?](README.md#what-is-an-index-file)** - Project-level dependency declaration
- **[What is a Golden File?](README.md#what-is-a-golden-file)** - Expected outputs for regression testing

### Fixture Details

- **[Fixtures Overview](fixtures/README.md)** - Complete fixture catalog
- **[Spec Fixtures](fixtures/specs/README.md)** - Sample specs with manifests and files
- **[Index Fixtures](fixtures/indexes/README.md)** - Project index files for different scenarios
- **[Golden Fixtures](fixtures/golden/README.md)** - Expected lock file outputs

### Practical Guides

- **[Using Fixtures in Tests](README.md#usage-in-tests)** - Code examples for unit, integration, and e2e tests
- **[Maintaining Fixtures](README.md#maintaining-fixtures)** - How to update and regenerate fixtures
- **[Regenerating Hashes](fixtures/golden/README.md#regenerating-golden-files)** - When and how to update hashes

## Key Concepts Summary

### Index Files (Input)

Project-level configuration that explicitly lists all specs your project depends on:

```json
{
  "app-spec@1.0.0": { "source": "file:./specs/app-spec" },
  "base-spec@1.0.0": { "source": "file:./specs/base-spec" }
}
```

- Located at `.spectrl/spectrl-index.json`
- Checked into version control
- All transitives must be explicit

### Lock Files (Output)

Generated file capturing resolved dependencies with integrity hashes:

```json
{
  "createdAt": "2025-11-07T00:00:00.000Z",
  "entries": [
    {
      "name": "base-spec",
      "version": "1.0.0",
      "hash": "sha256:284fea...",
      "source": "file:../../specs/base-spec",
      "deps": []
    }
  ]
}
```

- Located at `.spectrl/lock.json`
- Machine-generated, deterministic
- Ensures reproducible installations

### Golden Files (Test Reference)

Snapshots of expected lock file outputs for regression testing:

- Validate deterministic behavior
- Detect unintended changes
- Document correct output format

## Available Test Scenarios

| Scenario            | Index File               | Expected Outcome                | Golden File                 |
| ------------------- | ------------------------ | ------------------------------- | --------------------------- |
| Single spec         | `valid-single.json`      | 1 entry (base-spec)             | `single-spec.lock.json`     |
| Transitive deps     | `valid-transitive.json`  | 2 entries (app-spec, base-spec) | `transitive-deps.lock.json` |
| Missing dependency  | `error-missing-dep.json` | Error: Missing dependency       | N/A (error case)            |
| Circular dependency | `error-cycle.json`       | Error: Cycle detected           | N/A (error case)            |

## Common Tasks

### Running Tests with Fixtures

```typescript
import { join } from 'node:path';

const fixturesDir = join(__dirname, '../fixtures');
const indexPath = join(fixturesDir, 'indexes/valid-single.json');
const goldenPath = join(fixturesDir, 'golden/single-spec.lock.json');
```

### Updating Fixtures

1. Modify spec files in `fixtures/specs/`
2. Run `bun run packages/examples/scripts/compute-hashes.ts`
3. Update hashes in golden files
4. Run tests to verify

### Adding New Scenarios

1. Create new spec in `fixtures/specs/`
2. Create new index in `fixtures/indexes/`
3. Generate expected lock file in `fixtures/golden/`
4. Document in relevant README

## Documentation Standards

Each README follows this structure:

1. **What it is** - Concept explanation
2. **Why it exists** - Purpose and use cases
3. **Available items** - Catalog of fixtures/files
4. **Usage examples** - Code snippets
5. **Design decisions** - Rationale for choices

## See Also

- **[Spectrl Design Doc](../../.kiro/specs/spectrl-mvp/design.md)** - Overall system design
- **[Requirements](../../.kiro/specs/spectrl-mvp/requirements.md)** - Detailed requirements
- **[Task Log](../../.kiro/specs/spectrl-mvp/task-logs/task-9-example-fixtures.md)** - Implementation notes
