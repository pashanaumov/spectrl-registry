# Task 6: Add Registry Path Validation

## What Was Implemented

Task 6 was already fully implemented in the codebase. The registry path validation logic exists in the `createSymlinkOrFallback()` function in `packages/cli/src/commands/install.ts` (lines 155-162).

### Implementation Details

The validation check occurs before attempting to create a symlink:

```typescript
// Validate registry path exists
const registryExists = await fse.pathExists(registryFilesPath);
if (!registryExists) {
  throw new CLIError(
    `Registry path not found: ${registryFilesPath}\nHas this spec been published? Run: spectrl publish`,
    ExitCode.DEPENDENCY_ERROR,
  );
}
```

This implementation satisfies all task requirements:

- ✅ Checks if registry files path exists before creating symlink
- ✅ Throws CLIError with helpful message if registry path not found
- ✅ Suggests running `spectrl publish` in error message
- ✅ Uses ExitCode.DEPENDENCY_ERROR for missing registry paths

## Why This Implementation

The validation is placed at the optimal location in the code flow:

1. **After environment variable check**: The validation occurs after checking `SPECTRL_USE_COPY`, ensuring it applies to both symlink and copy modes
2. **Before filesystem operations**: The check happens before any symlink or directory creation attempts, preventing partial state
3. **Early failure**: By validating early, we provide immediate feedback to users without attempting operations that will fail
4. **Centralized location**: The validation is in `createSymlinkOrFallback()`, which is called by both `installSingleSpec()` and `install()`, ensuring consistent behavior

The error message is user-friendly and actionable:

- Shows the exact path that's missing
- Asks a clarifying question ("Has this spec been published?")
- Provides the specific command to fix the issue (`spectrl publish`)

Using `ExitCode.DEPENDENCY_ERROR` is appropriate because:

- The missing registry path represents a dependency issue (the spec hasn't been published)
- It's consistent with other dependency-related errors in the codebase
- It allows CLI consumers to distinguish this error type from validation or I/O errors

## Requirements Addressed

- **Requirement 1.4**: "THE Spectrl SHALL verify that the Registry path exists before attempting to create a symlink"
- **Requirement 5.1**: "IF the Registry path does not exist during installation, THEN THE Spectrl SHALL throw an error message indicating the missing path and suggesting to run `spectrl publish`"

## Code Location

- **File**: `packages/cli/src/commands/install.ts`
- **Function**: `createSymlinkOrFallback()`
- **Lines**: 155-162

## Testing Status

The validation logic is covered by existing error handling tests in the install command test suite. The error is thrown before any symlink operations occur, making it straightforward to test by attempting to install a spec that hasn't been published to the registry.

## Challenges & Considerations

No implementation was needed as the feature was already complete. The validation logic was implemented as part of earlier tasks (likely task 2 or 3) when the `createSymlinkOrFallback()` function was created.

The implementation follows best practices:

- Uses `fse.pathExists()` for reliable cross-platform path checking
- Provides clear, actionable error messages
- Uses appropriate exit codes for error categorization
- Validates before attempting operations to prevent partial state
