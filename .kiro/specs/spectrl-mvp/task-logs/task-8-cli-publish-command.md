# Task 8: Implement CLI Publish Command

## What Was Implemented

Implemented the `spectrl publish` command that publishes a spec to the local registry with content-based hashing.

### Subtasks Completed

- 8.1: Implement publish command in commands/publish.ts
- 8.2: Write unit tests for publish command

## Implementation Details

### Command Implementation (publish.ts)

Created the publish command with the following flow:

1. **Load and validate manifest**: Uses `readAndValidateManifest()` utility to read spectrl.json from the current directory and validate it against the Zod schema
2. **Validate file paths**: Calls `validateFilePaths()` to check for security issues (path traversal, absolute paths)
3. **Validate files exist**: Uses `validateFilesExist()` to ensure all tracked files are present on disk
4. **Read file contents**: Loops through manifest.files array and reads each file into a Record<string, string> mapping file paths to contents
5. **Compute hash**: Calls `computeHash()` from @spectrl/core with the manifest and file contents to generate a deterministic SHA-256 hash
6. **Create manifest with hash**: Spreads the original manifest and adds the computed hash field
7. **Publish to registry**: Creates a Registry instance and calls publish() to atomically write the spec to .spectrl/registry
8. **Output success**: Uses formatSuccess and formatHighlight to display a colored success message with spec name, version, and hash (first 12 characters)

### Error Handling

The command properly handles different error types with appropriate exit codes:

- **Validation errors** (exit code 1): Invalid manifest structure, empty files array, path traversal attempts
- **I/O errors** (exit code 2): Missing spectrl.json, tracked files not found, registry write failures
- **CLIError re-throwing**: Preserves CLIError instances from utilities to maintain correct exit codes

### Test Coverage

Created comprehensive unit tests covering:

1. **Successful publish scenarios**:
   - Single file spec publication
   - Multiple file spec publication
   - Hash computation and storage verification

2. **Validation error scenarios**:
   - Invalid manifest (missing required fields)
   - Empty files array
   - Path traversal attempts (..)

3. **I/O error scenarios**:
   - Missing tracked files
   - Missing spectrl.json

4. **Exit code verification**:
   - VALIDATION_ERROR (1) for schema violations
   - IO_ERROR (2) for file system issues

## Why These Decisions

### Working Directory Pattern

The publish command accepts a `cwd` parameter (current working directory) rather than hardcoding paths. This design allows the command to be testable and flexible - it can operate on any directory, not just process.cwd(). This pattern is consistent with the init command and makes testing straightforward.

### Error Handling Strategy

The error handling uses a try-catch block that distinguishes between CLIError instances (which already have the correct exit code) and other errors. This prevents double-wrapping of errors while still ensuring all errors get appropriate exit codes. The catch block checks for validation-related error messages to classify unknown errors appropriately.

### Hash Display Format

The success message displays only the first 12 characters of the hash (similar to Git commit SHAs). This provides enough information for human verification while keeping the output concise and readable. The full hash is stored in the registry manifest for complete verification.

### Test Isolation with process.chdir()

The tests use `process.chdir()` to change to a temporary directory before each test. This approach was necessary because:

1. The Registry class uses relative paths and validates against absolute paths
2. The publish command creates a registry at the default location (.spectrl/registry)
3. Changing the working directory allows tests to use relative paths while maintaining isolation

Each test saves the original working directory, changes to a unique temp directory, runs the test, then restores the original directory. This ensures tests don't interfere with each other or the actual project directory.

## Requirements Addressed

- Requirement 3.1: Manifest validation before publishing
- Requirement 3.2: Content hash computation
- Requirement 3.9: Error handling with appropriate exit codes
- Requirement 7.1: CLI command implementation
- Requirement 7.2: Stdout/stderr output formatting
- Requirement 7.6: Exit code conventions
- Requirement 7.7: Error message formatting
- Requirement 9.2: Registry publication

## Code Changes

- `packages/cli/src/commands/publish.ts` - Main publish command implementation
- `packages/cli/src/commands/publish.test.ts` - Comprehensive unit tests
- `packages/cli/src/commands/index.ts` - Already exported publish (no changes needed)

## Challenges & Considerations

### Registry Path Validation Issue

During testing, I discovered that the Registry class's `normalizePath()` function rejects absolute paths, but when creating a Registry with an absolute path (common in tests), the constructed spec paths become absolute. The registry tests work around this by using relative paths and changing the working directory.

I followed the same pattern in the publish tests rather than modifying the registry implementation (which was a previous task). This maintains consistency with existing test patterns and avoids scope creep.

### Test Isolation

Ensuring proper test isolation required careful management of:

- Working directory changes (save/restore pattern)
- Unique temporary directories for each test
- Registry cleanup between tests
- Avoiding test interference through unique spec names

The solution uses `process.chdir()` to change to a temp directory before each test, allowing the Registry to use its default relative path while maintaining complete isolation.

## Next Steps

The publish command is now complete and ready to be wired into the CLI entry point (Task 10). The command can be imported from `@spectrl/cli/commands` and invoked with a directory path parameter.
