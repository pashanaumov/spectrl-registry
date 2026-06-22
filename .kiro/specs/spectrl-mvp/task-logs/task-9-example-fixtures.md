# Task 9: Create Example Fixtures for Testing

## What Was Implemented

Created a comprehensive set of test fixtures to support unit, integration, and e2e testing of the Spectrl MVP. The fixtures include sample specs with various dependency configurations, project index files for different scenarios, and golden lock files with computed hashes.

### Subtasks Completed

#### 9.1: Create sample specs with dependencies

Created five sample specs in `packages/examples/fixtures/specs/`:

1. **base-spec@1.0.0** - Foundation spec with no dependencies
   - Files: `README.md`
   - Hash: `sha256:284fea7b6adadc89c52007a39d42a7876f88c6feb2bf0f24a89c7a623fdb6b4f`

2. **app-spec@1.0.0** - Application spec depending on base-spec
   - Files: `docs/architecture.md`, `docs/api.md`
   - Dependencies: `base-spec@1.0.0`
   - Hash: `sha256:1e66a38fbf1c22c5e6645cf8756bd32faf0835ab6420810576c66d4d132fafb8`

3. **lib-spec@1.0.0** - Library spec depending on base-spec
   - Files: `src/types.md`, `src/utils.md`
   - Dependencies: `base-spec@1.0.0`
   - Hash: `sha256:02e79ccc09b0048ac830204cd89ed3e45bae07f68cd9ddb291928ec176b9979b`

4. **cycle-a@1.0.0** - Spec with circular dependency to cycle-b
   - Files: `README.md`
   - Dependencies: `cycle-b@1.0.0`

5. **cycle-b@1.0.0** - Spec with circular dependency to cycle-a
   - Files: `README.md`
   - Dependencies: `cycle-a@1.0.0`

#### 9.2: Create sample project index files

Created four project index files in `packages/examples/fixtures/indexes/`:

1. **valid-single.json** - Single spec without dependencies
   - Contains: `base-spec@1.0.0`
   - Purpose: Test basic installation

2. **valid-transitive.json** - Spec with transitive dependencies
   - Contains: `app-spec@1.0.0`, `base-spec@1.0.0`
   - Purpose: Test transitive dependency resolution

3. **error-missing-dep.json** - Missing dependency scenario
   - Contains: `app-spec@1.0.0` (but not its dependency `base-spec@1.0.0`)
   - Purpose: Test error handling for missing dependencies

4. **error-cycle.json** - Circular dependency scenario
   - Contains: `cycle-a@1.0.0`, `cycle-b@1.0.0`
   - Purpose: Test cycle detection

#### 9.3: Create golden lock files

Created two golden lock files in `packages/examples/fixtures/golden/`:

1. **single-spec.lock.json** - Expected output for valid-single.json
   - Contains one entry: `base-spec@1.0.0`
   - Includes computed SHA-256 hash

2. **transitive-deps.lock.json** - Expected output for valid-transitive.json
   - Contains two entries in lexicographic order
   - Includes computed SHA-256 hashes for both specs
   - Demonstrates proper dependency ordering

## Why These Decisions

### Fixture Organization

The fixtures are organized into three directories (`specs/`, `indexes/`, `golden/`) to clearly separate concerns and make it easy to locate specific test resources. This structure mirrors the actual Spectrl workflow: specs are published, indexes reference them, and lock files are generated.

### Realistic Content

Each spec contains realistic documentation files rather than empty or minimal content. This ensures that hash computation tests work with real-world data and that file path handling (including subdirectories like `docs/` and `src/`) is properly tested.

### Comprehensive Error Scenarios

The error fixtures (`error-missing-dep.json`, `error-cycle.json`) cover the two main failure modes in dependency resolution: missing dependencies and circular dependencies. These are critical for testing error handling and ensuring helpful error messages are displayed to users.

### Computed Hashes

Rather than using placeholder hashes, I created a script (`compute-hashes.ts`) to compute actual SHA-256 hashes using the production hasher module. This ensures that golden lock files contain valid hashes that match what the system will actually produce, making tests more reliable and catching any hash computation bugs.

### Deterministic Timestamps

The golden lock files use a fixed timestamp (`2025-11-07T00:00:00.000Z`) rather than dynamic timestamps. This allows for exact comparison in tests without needing to strip or ignore the timestamp field.

### Documentation

A comprehensive README was added to the fixtures directory to document the structure, purpose of each fixture, and how to use them in tests. This makes it easy for developers to understand what fixtures are available and how to regenerate hashes if needed.

## Requirements Addressed

This task supports testing for all requirements:

- **Requirement 1.1-1.5**: Project initialization (tested with indexes)
- **Requirement 2.1-2.8**: Manifest validation (tested with various manifest formats)
- **Requirement 3.1-3.12**: Spec publishing (tested with sample specs)
- **Requirement 4.1-4.12**: Installation with transitive dependencies (tested with valid-transitive)
- **Requirement 5.1-5.7**: Project index format (tested with all index files)
- **Requirement 6.1-6.7**: Registry structure (tested through installation)
- **Requirement 7.1-7.9**: Lock file format (validated with golden files)
- **Requirement 8.1-8.9**: Deterministic behavior (validated with computed hashes)
- **Requirement 9.1-9.6**: Dependency resolution errors (tested with error fixtures)
- **Requirement 10.1-10.5**: Offline operation (all fixtures use file:// URLs)
- **Requirement 11.1-11.5**: Path safety (tested with subdirectory structures)

## Code Changes

### New Files Created

**Spec Fixtures:**

- `packages/examples/fixtures/specs/base-spec/spectrl.json`
- `packages/examples/fixtures/specs/base-spec/README.md`
- `packages/examples/fixtures/specs/app-spec/spectrl.json`
- `packages/examples/fixtures/specs/app-spec/docs/architecture.md`
- `packages/examples/fixtures/specs/app-spec/docs/api.md`
- `packages/examples/fixtures/specs/lib-spec/spectrl.json`
- `packages/examples/fixtures/specs/lib-spec/src/types.md`
- `packages/examples/fixtures/specs/lib-spec/src/utils.md`
- `packages/examples/fixtures/specs/cycle-a/spectrl.json`
- `packages/examples/fixtures/specs/cycle-a/README.md`
- `packages/examples/fixtures/specs/cycle-b/spectrl.json`
- `packages/examples/fixtures/specs/cycle-b/README.md`

**Index Fixtures:**

- `packages/examples/fixtures/indexes/valid-single.json`
- `packages/examples/fixtures/indexes/valid-transitive.json`
- `packages/examples/fixtures/indexes/error-missing-dep.json`
- `packages/examples/fixtures/indexes/error-cycle.json`

**Golden Files:**

- `packages/examples/fixtures/golden/single-spec.lock.json`
- `packages/examples/fixtures/golden/transitive-deps.lock.json`

**Utilities:**

- `packages/examples/scripts/compute-hashes.ts` - Script to regenerate hashes
- `packages/examples/fixtures/README.md` - Documentation

## Challenges & Considerations

### Hash Computation

Initially attempted to use Bun to run the hash computation script, but encountered module resolution issues with workspace dependencies. Switched to using Node.js with explicit relative imports to the compiled core package, which worked reliably.

### Fixture Paths

The index files use relative paths (`file:../../specs/base-spec`) to reference specs. This allows the fixtures to be self-contained and work regardless of where the repository is cloned. Tests will need to resolve these paths relative to the fixtures directory.

### Lexicographic Ordering

The golden lock files demonstrate proper lexicographic ordering of entries. In `transitive-deps.lock.json`, `app-spec` comes before `base-spec` alphabetically, even though `base-spec` is a dependency of `app-spec`. This validates that the resolver correctly sorts the final output.

### Future Extensibility

The fixture structure is designed to be easily extended. New specs can be added to the `specs/` directory, new scenarios can be created in `indexes/`, and corresponding golden files can be generated. The compute-hashes script can be updated to handle new specs as needed.

## Testing Impact

These fixtures enable comprehensive testing across all layers:

1. **Unit Tests**: Can test individual components (hasher, resolver, validator) with known inputs
2. **Integration Tests**: Can test core package workflows with realistic data
3. **E2E Tests**: Can test full CLI workflows with complete scenarios

The golden lock files provide a reference for deterministic behavior, ensuring that the system produces consistent output across different environments and runs.
