# Task 7: Rewrite CLI install command for new workflow

## What Was Implemented

Completely rewrote the CLI install command to implement the new index-based workflow with closure resolution, hash verification, and lock file generation.

### Subtasks Completed

#### 7.1: Implement three-step install process

- Implemented Step 1: Call `resolveClosureFromIndex` to get all nodes from `.spectrl/spectrl-index.json`
- Implemented Step 2: For each node, compute hash and materialize to registry
- Implemented Step 3: Write lock file with all entries to `.spectrl/lock.json`

#### 7.2: Implement hash computation and verification

- Read manifest and files from source location using `readSourceFiles` helper
- Compute hash using `computeHash` from `@spectrl/core`
- Check if spec exists in registry using `registry.exists()`
- If exists, verify hash matches (throw error with exit code 2 on mismatch)
- If not exists or matches, materialize using `registry.publish()`

#### 7.3: Implement lock file writing

- Create LockFile object with ISO-8601 timestamp using `new Date().toISOString()`
- Add LockEntry for each resolved node with computed hash
- Sort entries by `name@version` lexicographically for determinism
- Write to `.spectrl/lock.json` with pretty formatting (2-space indent + newline)

#### 7.4: Remove old install logic

- Removed `ref` parameter (no longer needed, reads all specs from index)
- Removed `index` option (always uses `.spectrl/spectrl-index.json`)
- Simplified signature to just `{ cwd, registry? }`
- Removed any add-to-deps logic

#### 7.5: Write unit tests for install

- Re-enabled test suite (removed `.skip`)
- Updated all tests to match new workflow (no ref parameter)
- Added test for hash verification with matching hash
- Added test for error on hash mismatch
- Added comprehensive lock file generation tests
- All 11 tests pass successfully

## Why These Decisions

### Index-Based Installation

The new workflow fundamentally changes how installation works:

- **Old approach**: Install a specific spec by reference (e.g., `spectrl install my-spec@1.0.0`)
- **New approach**: Install all specs listed in the project index (`.spectrl/spectrl-index.json`)

This shift aligns with the simplified architecture where the project index is the single source of truth for what specs a project depends on. The install command now simply materializes everything in the index to the local registry.

### Three-Step Process

The implementation follows a clear three-step process:

1. **Resolve**: Use the resolver to get the complete dependency closure from the index. This handles all the complexity of BFS traversal, cycle detection, and dependency validation.

2. **Materialize**: For each resolved spec, compute its hash and either skip it (if already installed with matching hash) or materialize it to the registry. This ensures integrity and avoids unnecessary work.

3. **Lock**: Write a lock file with all installed specs, their hashes, and dependencies. This provides a reproducible record of what was installed.

This separation of concerns makes the code easier to understand and test.

### Hash Verification

The hash verification logic implements the integrity check requirement:

- When a spec already exists in the registry, we verify its hash matches the computed hash
- If there's a mismatch, we throw an error with exit code 2 (IO_ERROR)
- This prevents silent corruption and ensures reproducibility

The decision to use IO_ERROR (exit code 2) for hash mismatches aligns with the requirement that this is a data integrity issue, not a validation or dependency problem.

### Lock File Format

The lock file implementation follows the schema requirements:

- ISO-8601 timestamp for `createdAt`
- Array of entries with name, version, hash, source, and deps
- Lexicographic sorting by `name@version` for determinism
- Pretty formatting with 2-space indent and trailing newline

The sorting ensures that the lock file is deterministic across runs, which is important for version control and reproducibility.

### Error Handling

The error handling maps resolver errors to appropriate CLI exit codes:

- ResolverError with exit code 3 → DEPENDENCY_ERROR (missing dependency)
- ResolverError with exit code 1 → VALIDATION_ERROR (invalid index, manifest mismatch)
- Other errors → IO_ERROR (file system issues)

This mapping ensures that the CLI provides meaningful exit codes that users can rely on for scripting and automation.

### Test Updates

The tests were updated to match the new workflow:

- Removed the `ref` parameter from all install calls
- Added `.spectrl/spectrl-index.json` setup in each test
- Added comprehensive lock file validation tests
- Added hash mismatch test to verify integrity checking
- Updated exit code expectations to match the new error handling

The tests now provide comprehensive coverage of the new workflow, including edge cases like hash mismatches and missing dependencies.

## Requirements Addressed

- **Requirement 4.1**: Read from project index ✓
- **Requirement 4.2**: Resolve complete dependency closure ✓
- **Requirement 4.3**: Use BFS traversal with lexicographic sorting ✓
- **Requirement 4.4**: Verify dependencies exist in index ✓
- **Requirement 4.7**: Materialize specs to registry ✓
- **Requirement 4.8**: Write lock file ✓
- **Requirement 4.9**: Skip already installed specs ✓
- **Requirement 4.10**: Exit with code 0 on success ✓
- **Requirement 4.11**: Verify hash matches for existing specs ✓
- **Requirement 4.12**: Exit with code 2 on hash mismatch ✓
- **Requirement 7.1-7.9**: Lock file format and structure ✓
- **Requirement 8.2-8.5**: Deterministic behavior ✓
- **Requirement 9.1-9.6**: Error handling with correct exit codes ✓

## Code Changes

### Modified Files

**`packages/cli/src/commands/install.ts`**

- Completely rewrote the install function
- Added `readSourceFiles` helper to read manifest and file contents
- Implemented three-step process: resolve, materialize, lock
- Added hash computation and verification
- Added lock file writing with proper formatting
- Removed old install logic (ref parameter, index option)

**`packages/cli/src/commands/install.test.ts`**

- Re-enabled test suite (removed `.skip`)
- Updated all tests to use new API (no ref parameter)
- Added `.spectrl/spectrl-index.json` setup in each test
- Added hash mismatch test
- Added comprehensive lock file generation tests
- Updated exit code expectations

### Test Results

All 11 tests in the install test suite pass:

- 2 single spec installation tests
- 2 recursive dependency installation tests
- 2 skip already installed tests (including hash mismatch)
- 1 missing dependency error test
- 2 lock file generation tests
- 2 exit code tests

## Challenges & Considerations

### Source Path Resolution

One challenge was handling different source URL formats (file://, file:, and relative paths). The `readSourceFiles` helper normalizes these to filesystem paths and resolves relative paths against the `.spectrl` directory.

This ensures that sources specified in the index can use any of these formats and still work correctly.

### Exit Code Mapping

The ResolverError uses numeric exit codes (1, 3) while the CLI uses the ExitCode enum. The error handling code maps these appropriately:

- Exit code 3 → DEPENDENCY_ERROR
- Exit code 1 → VALIDATION_ERROR

This mapping ensures that the CLI provides consistent exit codes across all operations.

### Lock File Determinism

The lock file must be deterministic to ensure reproducibility. This is achieved by:

- Sorting entries lexicographically by `name@version`
- Using ISO-8601 format for timestamps (which is deterministic for a given point in time)
- Pretty formatting with consistent indentation

The trailing newline is also important for git diffs and editor compatibility.

### Test Complexity

The tests required careful setup of the `.spectrl/spectrl-index.json` file in each test case. This was necessary because the new workflow always reads from this file rather than accepting an index path parameter.

The helper functions (`createIndex`, `createSourceSpec`) were updated to work with this new structure, making the tests more maintainable.
