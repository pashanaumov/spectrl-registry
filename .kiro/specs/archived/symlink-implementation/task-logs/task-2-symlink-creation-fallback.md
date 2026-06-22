# Task 2: Implement Symlink Creation with Fallback

## What Was Implemented

Created two new functions in `packages/cli/src/commands/install.ts` to handle symlink creation with automatic fallback to file copying:

1. **`copyFilesFromRegistry()`** - Helper function to copy files when symlinks fail
2. **`createSymlinkOrFallback()`** - Main function that attempts symlink creation with comprehensive error handling

Both functions are exported for testing and include comprehensive test coverage with 5 new test cases.

## Why These Decisions

### Symlink Creation Strategy

Implemented a multi-layered approach with the following priority:

1. **Check environment variable first** - If `SPECTRL_USE_COPY=1`, skip directly to copying
2. **Validate registry path** - Ensure source exists before attempting symlink
3. **Create parent directories** - Use `fse.ensureDir()` to handle missing directories
4. **Attempt symlink** - Use platform-specific type from `getSymlinkType()`
5. **Catch EPERM specifically** - Handle Windows permission errors gracefully
6. **Fall back to copying** - Ensure functionality even without symlink support

This approach ensures maximum compatibility while preferring symlinks when available.

### Using fs-extra Methods

Chose specific fs-extra methods for their benefits:

- **`fse.pathExists()`** - Simpler than try-catch with fs.access()
- **`fse.ensureDir()`** - Creates parent directories recursively, idempotent
- **`fse.symlink()`** - Compatible with Node.js fs.symlink but with better error handling
- **`fse.copy()`** - Handles nested directories automatically, preserves structure

### Error Handling Approach

Implemented three-tier error handling:

1. **Registry validation** - Throw CLIError with helpful message before attempting symlink
2. **Permission errors (EPERM)** - Catch specifically, log warning, fall back to copying
3. **Other errors** - Re-throw with context as CLIError with IO_ERROR exit code

This provides clear feedback for each failure scenario while maintaining graceful degradation.

### Spinner Integration

Passed spinner as parameter to enable contextual logging:

- **Info message** - When SPECTRL_USE_COPY=1 is active
- **Warning message** - When permission denied, explaining Windows requirements
- **Success/failure** - Handled by caller based on return value

This keeps users informed about what's happening without cluttering the implementation.

### Return Value Design

Return `'symlink' | 'copy'` to indicate which method was used:

- Allows caller to track statistics (symlinks vs copies)
- Enables different success messages based on method
- Useful for debugging and testing
- Simple boolean-like but more descriptive

### File Copying Implementation

Implemented `copyFilesFromRegistry()` as a separate function:

- **Reusable** - Can be called from multiple places
- **Testable** - Can be tested independently
- **Clear responsibility** - Single purpose: copy files from registry
- **Manifest-driven** - Uses manifest.files list to know what to copy

The function iterates through manifest.files and copies each file, ensuring parent directories exist for nested structures.

## Requirements Addressed

- **Requirement 1.1**: Platform-specific symlink type detection (uses `getSymlinkType()`)
- **Requirement 1.5**: Logging for symlink success and fallback warnings
- **Requirement 2.1**: Attempts junction point creation on Windows
- **Requirement 2.2**: Logs warning message on permission errors
- **Requirement 2.3**: Falls back to file copying on permission errors
- **Requirement 2.4**: Logs message when falling back to copying
- **Requirement 5.1**: Validates registry path exists before symlink creation
- **Requirement 5.2**: Throws error with helpful message for missing registry path
- **Rollback Strategy**: Checks SPECTRL_USE_COPY environment variable

## Code Changes

### Modified Files

- `packages/cli/src/commands/install.ts`
  - Added `copyFilesFromRegistry()` helper function
  - Added `createSymlinkOrFallback()` main function
  - Both functions exported for testing
  - Comprehensive JSDoc documentation
  - Error handling for registry validation, permissions, and other failures

- `packages/cli/src/commands/install.test.ts`
  - Added 5 new test cases in `createSymlinkOrFallback` test suite
  - Tests cover: successful symlink creation, copy mode, missing registry, nested files, parent directory creation
  - All tests use real file system operations (no mocks) for integration-level confidence

## Test Coverage

Created 5 comprehensive tests for `createSymlinkOrFallback()`:

### 1. Successful Symlink Creation

- Creates target directory with test file
- Calls `createSymlinkOrFallback()`
- Verifies return value is 'symlink'
- Verifies symlink exists using `lstat().isSymbolicLink()`
- Verifies file is readable through symlink

### 2. Copy Mode with SPECTRL_USE_COPY=1

- Sets environment variable to '1'
- Creates target directory with test file
- Calls `createSymlinkOrFallback()`
- Verifies return value is 'copy'
- Verifies result is regular directory, not symlink
- Verifies file was copied correctly
- Restores environment variable

### 3. Error on Missing Registry Path

- Attempts to create symlink to non-existent path
- Verifies CLIError is thrown
- Verifies error message mentions registry path

### 4. Nested Directory Structure

- Creates target with nested files (README.md, docs/api.md, docs/guides/setup.md)
- Creates symlink
- Verifies all files are accessible through symlink
- Tests that directory structure is preserved

### 5. Parent Directory Creation

- Attempts to create symlink in deeply nested path that doesn't exist
- Verifies symlink is created successfully
- Verifies parent directories were created automatically
- Verifies symlink works correctly

All 180 tests pass (175 existing + 5 new).

## Challenges & Considerations

### Spinner Type Annotation

Challenge: TypeScript couldn't resolve `ora.Ora` type
Solution: Used `ReturnType<typeof ora>` to infer the correct type from the ora function

### Environment Variable Handling

Challenge: Tests modify global state (process.env)
Solution: Save original value, modify for test, restore in cleanup - same pattern as Task 1

### Registry Path Validation

Challenge: Need to validate path exists before attempting symlink
Solution: Use `fse.pathExists()` which is simpler and more reliable than try-catch with fs.access()

### Error Message Clarity

Challenge: Users need actionable guidance when registry path missing
Solution: Include both the missing path and suggestion to run `spectrl publish` in error message

### Fallback Copying Logic

Challenge: Need to replicate file copying behavior when symlinks fail
Solution: Created separate `copyFilesFromRegistry()` function that mirrors the existing file copying logic but uses fs-extra methods for better reliability

### Testing Real Symlinks

Challenge: Tests need to verify actual symlink behavior
Solution: Use real file system operations in tests (no mocks) to ensure symlinks work correctly on the test platform

## Implementation Details

### Function Signatures

```typescript
async function copyFilesFromRegistry(
  registryFilesPath: string,
  projectPath: string,
  manifest: Manifest,
): Promise<void>;

export async function createSymlinkOrFallback(
  registryFilesPath: string,
  projectSymlinkPath: string,
  manifest: Manifest,
  spinner: ReturnType<typeof ora>,
): Promise<'symlink' | 'copy'>;
```

### Error Codes Used

- **DEPENDENCY_ERROR** - When registry path doesn't exist (suggests running publish)
- **IO_ERROR** - When symlink creation fails for reasons other than permissions

### Logging Messages

- **Info**: "Using file copy mode (SPECTRL_USE_COPY=1)"
- **Warning**: "Permission denied creating symlink. Windows: Enable Developer Mode or run as Administrator. Falling back to file copy..."
- **Error**: "Registry path not found: {path}\nHas this spec been published? Run: spectrl publish"
- **Error**: "Failed to create symlink: {message}"

## Next Steps

These functions are now ready to be integrated into the actual install commands in Tasks 4 and 5:

- Task 4: Update `installSingleSpec()` to use symlinks
- Task 5: Update `install()` bulk function to use symlinks

The functions provide a clean interface that the install commands can use without worrying about platform differences or error handling details.
