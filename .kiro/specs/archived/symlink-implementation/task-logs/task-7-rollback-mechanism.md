# Task 7: Implement Rollback Mechanism

## What Was Implemented

The rollback mechanism allows users to force file copying instead of symlinks by setting the `SPECTRL_USE_COPY=1` environment variable. This provides an emergency escape hatch if symlinks cause issues in production or specific environments.

### Implementation Details

1. **`shouldUseCopy()` function** (lines 95-100 in install.ts)
   - Checks if `process.env.SPECTRL_USE_COPY === '1'`
   - Returns boolean indicating whether to use copy mode
   - Simple, focused function with single responsibility

2. **Early check in `createSymlinkOrFallback()`** (lines 143-148)
   - Checks `shouldUseCopy()` at the very start of the function
   - If true, immediately calls `copyFilesFromRegistry()` and returns 'copy'
   - Skips all symlink creation logic when in copy mode

3. **Informational logging** (line 144)
   - Logs "Using file copy mode (SPECTRL_USE_COPY=1)" via spinner.info()
   - Makes it clear to users that copy mode is active
   - Helps with debugging and understanding behavior

4. **Correct parameter passing** (line 145)
   - Calls `copyFilesFromRegistry(registryFilesPath, projectSymlinkPath, manifest)`
   - All three required parameters are passed correctly
   - Reuses existing fallback function that was already implemented for permission errors

## Why These Decisions

The implementation follows the design document's rollback strategy exactly. The environment variable approach was chosen because:

1. **No code changes required** - Users can enable/disable without modifying code
2. **Per-project or global** - Can be set in shell, CI/CD, or project-specific configs
3. **Immediate rollback** - Provides instant escape hatch for production issues
4. **Minimal implementation** - Reuses existing `copyFilesFromRegistry()` function
5. **Clear semantics** - `SPECTRL_USE_COPY=1` is explicit and self-documenting

The check is placed at the very start of `createSymlinkOrFallback()` to ensure:

- No symlink operations are attempted when in copy mode
- Early return pattern keeps code simple and readable
- Logging happens before any file operations
- Consistent behavior across all installation paths (single spec and bulk install)

## Requirements Addressed

- **Rollback Strategy (design document)**: Complete implementation of environment variable-based rollback
- All subtasks from task 7:
  - ✅ Add `shouldUseCopy()` check at start of `createSymlinkOrFallback()`
  - ✅ Skip symlink creation when SPECTRL_USE_COPY=1
  - ✅ Log informational message when copy mode is active
  - ✅ Ensure fallback function called with correct parameters

## Code Changes

**File: `packages/cli/src/commands/install.ts`**

The implementation was already complete in the codebase:

```typescript
// Function to check environment variable (lines 95-100)
export function shouldUseCopy(): boolean {
  return process.env.SPECTRL_USE_COPY === '1';
}

// Early check in createSymlinkOrFallback (lines 143-148)
export async function createSymlinkOrFallback(
  registryFilesPath: string,
  projectSymlinkPath: string,
  manifest: Manifest,
  spinner: ReturnType<typeof ora>,
): Promise<'symlink' | 'copy'> {
  // Check if copy mode is enabled via environment variable
  if (shouldUseCopy()) {
    spinner.info('Using file copy mode (SPECTRL_USE_COPY=1)');
    await copyFilesFromRegistry(registryFilesPath, projectSymlinkPath, manifest);
    return 'copy';
  }
  // ... rest of symlink creation logic
}
```

## Integration Points

The rollback mechanism integrates seamlessly with:

1. **Single spec installation** (`installSingleSpec()`)
   - Calls `createSymlinkOrFallback()` which respects the environment variable
   - Statistics tracking correctly counts copies vs symlinks

2. **Bulk installation** (`install()`)
   - Same `createSymlinkOrFallback()` function used for all specs
   - Consistent behavior across all installation paths

3. **Permission error fallback**
   - Uses the same `copyFilesFromRegistry()` function
   - Ensures consistent file copying behavior

4. **Statistics tracking**
   - Return value ('symlink' or 'copy') allows proper counting
   - Users see accurate summary of installation methods used

## Testing Considerations

The implementation should be tested with:

1. **Environment variable set**: Verify copy mode is used
2. **Environment variable unset**: Verify symlinks are created
3. **Mixed scenarios**: Some specs with copy mode, others without
4. **Statistics tracking**: Verify counts are accurate in copy mode
5. **Logging**: Verify informational message appears

However, per the task instructions, tests are marked as optional (task 10) and should not be implemented as part of this task.

## Verification

The implementation can be verified manually:

```bash
# Test with copy mode enabled
export SPECTRL_USE_COPY=1
spectrl install my-spec@1.0.0
# Should see: "Using file copy mode (SPECTRL_USE_COPY=1)"
# Should create copied files, not symlinks

# Test with copy mode disabled
unset SPECTRL_USE_COPY
spectrl install my-spec@1.0.0
# Should create symlinks (or fallback to copy on permission errors)
```

## Challenges & Considerations

No challenges encountered - the implementation was already complete and follows the design document exactly. The code is:

- **Simple**: Single boolean check with early return
- **Clear**: Obvious what happens when environment variable is set
- **Maintainable**: Reuses existing fallback function
- **Testable**: Easy to test by setting environment variable
- **Documented**: Clear log message explains behavior

The implementation provides exactly what was requested: an emergency rollback mechanism that requires no code changes and can be enabled instantly if symlinks cause issues.
