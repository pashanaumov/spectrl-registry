# Task 1: Create Symlink Utility Functions

## What Was Implemented

Created four utility functions in `packages/cli/src/commands/install.ts` to support symlink operations:

1. **`getSymlinkType()`** - Platform detection for symlink type
2. **`checkSymlinkStatus()`** - Symlink validation and target verification
3. **`removeExistingPath()`** - Safe removal of directories and symlinks
4. **`shouldUseCopy()`** - Environment variable check for copy fallback

All functions are exported for testing and include comprehensive test coverage.

## Why These Decisions

### Using fs-extra

Chose `fs-extra` over Node.js built-in `fs` module because:

- Provides `remove()` method with recursive deletion support
- Maintains compatibility with existing `fs.promises` API
- Widely used and well-maintained library
- Simplifies error handling for common operations

### Platform Detection Approach

Used `process.platform === 'win32'` check for Windows detection because:

- Standard Node.js approach for platform detection
- Returns 'junction' for Windows (required for directory symlinks on Windows)
- Returns 'dir' for Unix-like systems (macOS, Linux, BSD)
- Simple and reliable without external dependencies

### Symlink Status Checking

Implemented three-state check (exists, isSymlink, isCorrect) because:

- Need to distinguish between non-existent paths, regular directories, and symlinks
- Must validate symlink target matches expected location
- Resolves both relative and absolute paths for accurate comparison
- Uses `lstat()` to check symlink itself without following it

### Safe Path Removal

Separated removal logic for symlinks vs directories because:

- Symlinks should be removed with `unlink()` to avoid affecting target
- Directories need recursive removal with `remove()`
- Gracefully handles ENOENT (path doesn't exist) without throwing
- Prevents accidental data loss by checking path type first

### Environment Variable Check

Used exact string match `=== '1'` for `SPECTRL_USE_COPY` because:

- Provides explicit opt-in behavior (not truthy values)
- Consistent with common Unix environment variable patterns
- Easy to document and understand
- Prevents accidental activation from other values

## Requirements Addressed

- **Requirement 1.1**: Platform-specific symlink type detection
- **Requirement 1.4**: Symlink validation and status checking
- **Requirement 2.5**: Safe removal of existing paths
- **Requirement 5.4**: Environment variable check for copy fallback

## Code Changes

### Modified Files

- `packages/cli/src/commands/install.ts`
  - Added fs-extra import
  - Added `resolve` to path imports
  - Implemented four exported utility functions
  - Added comprehensive JSDoc documentation

- `packages/cli/src/commands/install.test.ts`
  - Added new test suite "symlink utility functions"
  - Implemented 18 test cases covering all utility functions
  - Tests include platform mocking, symlink creation, and environment variable manipulation

- `packages/cli/package.json`
  - Added `fs-extra` dependency
  - Added `@types/fs-extra` dev dependency

## Test Coverage

Created comprehensive tests for all utility functions:

### getSymlinkType()

- Returns 'junction' for Windows (win32)
- Returns 'dir' for Unix-like platforms (darwin, linux, freebsd, openbsd)

### checkSymlinkStatus()

- Returns exists=false for non-existent paths
- Returns isSymlink=false for regular directories
- Returns isCorrect=true for symlinks with correct target
- Returns isCorrect=false for symlinks with wrong target
- Handles relative symlink paths correctly

### removeExistingPath()

- Removes symlinks without affecting target
- Removes regular directories recursively
- Handles non-existent paths gracefully
- Removes empty directories

### shouldUseCopy()

- Returns true when SPECTRL_USE_COPY=1
- Returns false when SPECTRL_USE_COPY is not set
- Returns false when SPECTRL_USE_COPY=0
- Returns false for other values (true, yes, on, 2, etc.)

All 175 tests pass, including the 18 new tests for symlink utilities.

## Challenges & Considerations

### Test Isolation

Challenge: Tests modify global state (process.platform, process.env)
Solution: Save original values and restore them in each test to prevent side effects

### Symlink Testing

Challenge: Creating actual symlinks in tests requires proper cleanup
Solution: Used existing test infrastructure with beforeEach/afterEach hooks for temp directory management

### Path Resolution

Challenge: Symlinks can use relative or absolute paths
Solution: Resolve both actual and expected paths to absolute before comparison using `resolve(join(linkPath, '..'), actualTarget)`

### Error Handling

Challenge: Different error codes for various failure scenarios
Solution: Check for ENOENT specifically and re-throw other errors to avoid masking real issues

## Next Steps

These utility functions are now ready to be used in Task 2 for implementing the actual symlink creation logic in the install command.
