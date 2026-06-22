# Task 9: Implement CLI Install Command

## What Was Implemented

Implemented the `spectrl install` command that allows users to install specs from an index into their local registry, including automatic resolution and installation of all transitive dependencies.

### Subtasks Completed

#### 9.1: Implement install command in commands/install.ts

Created the complete install command implementation with the following functionality:

- **Parameter handling**: Accepts spec reference (name or name@version) and optional index path
- **Index path resolution**: Uses provided index path or defaults to `spectrl-index.json` in cwd
- **Registry and Resolver setup**: Creates instances with appropriate configurations
- **Spec resolution**: Resolves the target spec from the index using `Resolver.resolve()`
- **Dependency resolution**: Recursively resolves all transitive dependencies using `Resolver.resolveDependencies()`
- **Installation loop**: Iterates through target spec and all dependencies:
  - Checks if each spec is already installed using `Registry.exists()`
  - Skips already installed specs with informative stdout message
  - Parses `file://` URLs to local paths using `fileURLToPath()`
  - Copies specs from source to registry using `Registry.publish()`
  - Outputs success messages for newly installed specs
- **Error handling**:
  - Missing specs or dependencies → `CLIError` with exit code 3 (DEPENDENCY_ERROR)
  - I/O errors (file operations, invalid URLs) → `CLIError` with exit code 2 (IO_ERROR)
  - Follows established error handling patterns from publish command

#### 9.2: Write unit tests for install command

Created comprehensive unit tests covering all required scenarios:

- **Single spec installation**: Tests installing specs without dependencies, both with explicit version and resolving to latest
- **Recursive dependency installation**: Tests single-level and multi-level transitive dependencies
- **Skip already installed**: Tests that already installed specs are skipped gracefully, including shared dependencies
- **Missing dependency errors**: Tests proper error handling for missing specs and dependencies with correct exit codes
- **Exit codes**: Validates DEPENDENCY_ERROR (3) and IO_ERROR (2) exit codes for different failure scenarios

All 10 tests pass successfully.

## Why These Decisions

**User-level registry location**: The registry is located at `~/.spectrl/registry` (user's home directory) rather than in each project directory. This follows the npm model where the global cache is separate from project dependencies. Each project has an index (like package.json) that declares which specs it uses, but the actual spec packages are stored in a shared user-level registry. This design:

- Avoids duplication when multiple projects use the same specs
- Separates concerns: projects declare dependencies, the registry stores them
- Enables offline installation if specs are already in the registry
- Matches user expectations from other package managers

**Reusing Registry.publish() for installation**: Instead of implementing custom file copying logic, the install command leverages the existing `Registry.publish()` method. This ensures consistency in how specs are stored in the registry, maintains the same locking behavior for atomicity, and reduces code duplication. The publish method already handles directory creation, file copying with path preservation, and manifest writing.

**Error handling strategy**: The implementation distinguishes between dependency-related errors (spec not found, missing dependencies) and I/O errors (file operations, invalid URLs). This follows the requirements and provides clear feedback to users about what went wrong. Dependency errors use exit code 3, while I/O errors use exit code 2, matching the established CLI error code conventions.

**Skip already installed specs**: Rather than failing or re-installing, the command checks if each spec version already exists in the registry and skips it with an informative message. This makes the command idempotent and allows users to safely re-run installations without side effects. It also optimizes performance when installing specs with shared dependencies.

**Breadth-first dependency resolution**: The `Resolver.resolveDependencies()` method returns dependencies in breadth-first order, which the install command processes sequentially. This ensures that direct dependencies are installed before transitive ones, providing a logical installation order that's easier to understand in the output.

**Using fileURLToPath for source parsing**: The index stores source locations as `file://` URLs for consistency and to support potential future URL schemes. The `fileURLToPath()` utility from Node.js properly converts these URLs to local filesystem paths, handling platform-specific path formats and URL encoding.

## Requirements Addressed

- **Requirement 4.1**: Install command accepts spec reference and resolves from index
- **Requirement 4.2**: Supports both name and name@version formats
- **Requirement 4.3**: Copies specs from source to registry
- **Requirement 4.4**: Handles missing dependencies with appropriate errors
- **Requirement 4.7**: Recursive dependency resolution
- **Requirement 4.8**: Skips already installed specs
- **Requirement 4.9**: Proper exit codes for different error types
- **Requirement 4.10**: Clear stdout/stderr output
- **Requirement 5.1**: Registry integration for checking existing specs
- **Requirement 5.2**: Registry integration for publishing specs
- **Requirement 5.3**: Atomic operations via Registry locking
- **Requirement 7.1**: Index-based resolution
- **Requirement 7.3**: Version resolution (exact and latest)
- **Requirement 7.4**: Dependency graph traversal
- **Requirement 7.6**: Source location handling
- **Requirement 9.3**: CLI error handling with exit codes

## Code Changes

### New Files

- `packages/cli/src/commands/install.ts` - Complete install command implementation
- `packages/cli/src/commands/install.test.ts` - Comprehensive unit tests (10 tests)

### Implementation Details

The install command follows this flow:

1. Determine index path (parameter or default)
2. Create Registry and Resolver instances
3. Resolve target spec from index
4. Resolve all transitive dependencies
5. Build installation list (target + dependencies)
6. For each spec:
   - Check if already installed
   - Skip if exists, otherwise install
   - Parse file:// URL to local path
   - Copy to registry using Registry.publish()
   - Output success message
7. Handle errors with appropriate exit codes

## Challenges & Considerations

**Test design for I/O errors**: Initially attempted to test invalid URL handling, but discovered that the Resolver's index validation happens before URL parsing. Adjusted the test to use a valid URL pointing to a non-existent directory, which properly triggers the I/O error path during Registry.publish().

**Type inference with async error handling**: TypeScript couldn't infer types for variables assigned in try-catch blocks. Resolved by using `.catch()` method chaining instead of try-catch, which allows TypeScript to properly infer the return type.

**Idempotent installation**: The decision to skip already installed specs rather than fail or overwrite ensures the command can be safely re-run. This is particularly important for dependency installation where multiple specs might depend on the same package.

**Output formatting**: Used the existing color formatting utilities (`formatSuccess`, `formatHighlight`, `formatInfo`) to provide clear, visually distinct output for different installation states (newly installed vs. already installed).
