# Task 4: Rewrite Resolver for Closure Resolution from Index

## What Was Implemented

Completely rewrote the resolver module to support the new MVP architecture where all specs must be explicitly listed in the project index. The resolver now performs closure resolution from the index using a two-pass algorithm with proper cycle detection.

### Subtasks Completed

- **4.1**: Removed old resolver implementation
  - Removed `resolve(ref)` method that handled latest version lookup with semver
  - Removed `resolveDependencies(manifest)` method that took a manifest as input
  - Removed semver dependency (no longer needed for MVP)
  - Removed index caching logic

- **4.2**: Implemented `resolveClosureFromIndex` method
  - Loads and validates project index from `.spectrl/spectrl-index.json`
  - Extracts all keys as roots and sorts lexicographically
  - First pass: Collects all manifests and validates them
  - Second pass: Builds dependency graph and detects cycles using DFS
  - Returns sorted array of `ResolvedNode` objects

- **4.3**: Implemented comprehensive error handling
  - Created `ResolverError` class with `exitCode` property
  - Exit code 1: Invalid index key, missing source, manifest mismatch
  - Exit code 3: Missing dependency, cyclic dependency
  - All error messages include helpful context

- **4.4**: Updated `readManifestFromSource` helper
  - Supports `file://` URLs, `file:` URLs, and relative/absolute paths
  - Uses `path.resolve()` to handle relative paths correctly
  - Resolves paths relative to the index directory
  - Validates manifests using Zod schema

- **4.5**: Wrote comprehensive unit tests
  - 14 tests covering all functionality
  - Tests for single spec, dependencies, transitive deps, diamond pattern
  - Tests for lexicographic sorting of deps and results
  - Tests for all error cases with correct exit codes
  - All tests passing

## Why These Decisions

### Two-Pass Algorithm

The decision to use a two-pass algorithm (first collect manifests, then detect cycles) was driven by the need for clear separation of concerns and better error messages. The first pass validates that all specs in the index are valid and accessible, while the second pass focuses on dependency graph validation. This approach makes it easier to provide specific error messages about what went wrong.

### DFS for Cycle Detection

Cycle detection uses depth-first search (DFS) with a recursion stack rather than breadth-first search (BFS). This is because DFS naturally tracks the current path being explored, making it straightforward to detect back edges (cycles). The recursion stack (`recStack`) tracks nodes currently being processed in the current DFS path. If we encounter a node that's in the recursion stack, we've found a cycle.

### Relative Path Resolution

The resolver resolves relative paths from the index directory (`.spectrl/`) rather than the current working directory. This design choice ensures that the index file can use relative paths like `../specs/my-spec/1.0.0` that are relative to the index location, making the index portable within a project structure.

### Lexicographic Sorting

Dependencies are sorted lexicographically at multiple points:

1. Index keys are sorted before processing (ensures deterministic order)
2. Dependencies within each manifest are sorted (ensures deterministic output)
3. Final resolved nodes are sorted (ensures deterministic lock files)

This guarantees reproducible behavior across different systems and runs, which is critical for the MVP's determinism requirements.

### Error Exit Codes

The exit code scheme follows the requirements:

- Exit code 1: Validation errors (bad data, schema violations)
- Exit code 2: I/O errors (file not found, permission denied)
- Exit code 3: Dependency resolution errors (missing deps, cycles)

This allows the CLI to provide appropriate error handling and helps users understand the category of error they're dealing with.

### Removed Semver and Latest Version Resolution

The MVP explicitly does not support version ranges or "latest" version resolution. All dependencies must specify exact versions, and all transitive dependencies must be explicitly listed in the project index. This simplification makes the system more predictable and easier to reason about, at the cost of requiring users to manually manage their dependency closure.

## Requirements Addressed

- **Requirement 4.1**: Reads project index from `.spectrl/spectrl-index.json`
- **Requirement 4.2**: Resolves complete dependency closure
- **Requirement 4.3**: Uses breadth-first traversal (for collection) with lexicographic sorting
- **Requirement 4.4**: Verifies each dependency exists in the project index
- **Requirement 4.5**: Detects and reports missing transitive dependencies
- **Requirement 9.1**: Manifest mismatch error with exit code 1
- **Requirement 9.2**: Missing dependency error with exit code 3 and helpful message
- **Requirement 9.3**: Cyclic dependency detection with exit code 3
- **Requirement 9.4**: Invalid index key error with exit code 1
- **Requirement 9.5**: Cycle detection using visited set during traversal
- **Requirement 9.6**: Helpful error messages guiding users to fix configuration

## Code Changes

### Modified Files

- **`packages/core/src/resolver.ts`**
  - Removed old `resolve()` and `resolveDependencies()` methods
  - Added `ResolverError` class with exit codes
  - Added `ResolvedNode` interface
  - Implemented `resolveClosureFromIndex()` method
  - Updated `readManifestFromSource()` to handle relative paths
  - Removed semver dependency

- **`packages/core/src/resolver.test.ts`**
  - Completely rewrote tests for new API
  - Added tests for closure resolution
  - Added tests for error handling with exit codes
  - Added tests for cycle detection
  - All 14 tests passing

- **`packages/cli/src/commands/install.ts`**
  - Temporarily stubbed out to allow build to pass
  - Will be properly implemented in Task 7

## Challenges & Considerations

### Cycle Detection Complexity

The initial implementation attempted to detect cycles during BFS traversal, but this proved difficult because BFS doesn't naturally track the current path. The solution was to use a two-pass approach: first collect all manifests, then use DFS with a recursion stack to detect cycles. This is more straightforward and provides better error messages.

### Relative Path Resolution

Determining the correct base path for resolving relative sources required careful consideration. The decision to use the index directory (`.spectrl/`) as the base ensures that relative paths in the index are portable within the project structure. This means an index entry like `../specs/my-spec/1.0.0` will correctly resolve to `<project-root>/specs/my-spec/1.0.0`.

### Test Structure

The tests needed to create actual filesystem structures with manifests and spec directories. Using temporary directories with proper cleanup ensures tests are isolated and don't interfere with each other. The helper functions `createSpecDir()` and `createTestManifest()` make tests more readable and maintainable.

### Backward Compatibility

The old resolver API is completely removed, which means the CLI install command needs to be rewritten (Task 7). A temporary stub was added to allow the build to pass, but the install command will not work until Task 7 is completed.

## Next Steps

Task 7 will rewrite the CLI install command to use the new `resolveClosureFromIndex()` method. The install command will:

1. Call `resolveClosureFromIndex()` to get all nodes
2. For each node, compute hash and materialize to registry
3. Write lock file with all entries

This completes the new architecture where the project index is the source of truth for all dependencies.
