# Task 4: Update installSingleSpec() to use symlinks

## What Was Implemented

Updated both `installSingleSpec()` and `install()` functions to use the new symlink-based installation approach with the `{name}@{version}` naming pattern.

### Changes Made

1. **Updated installSingleSpec() function**:
   - Changed project path from `.spectrl/specs/{name}/{version}` to `.spectrl/specs/{name}@{version}`
   - Replaced file copying logic with `checkSymlinkStatus()` call
   - Added skip logic when symlink already exists and points to correct target
   - Added upgrade logic to detect and remove old copied files before creating symlinks
   - Replaced file copying loop with `createSymlinkOrFallback()` call
   - Updated success messages to indicate symlink creation, upgrade, or copy fallback

2. **Updated install() bulk function**:
   - Applied same symlink logic as `installSingleSpec()`
   - Changed project path to use `{name}@{version}` pattern
   - Added symlink status checking before installation
   - Implemented skip logic for correct existing symlinks
   - Added upgrade path for old directory structures

3. **Updated isAlreadyInstalled() helper**:
   - Changed path construction to use `{name}@{version}` format
   - Maintains hash checking through symlink

4. **Updated test suite**:
   - Fixed all test paths to use new `{name}@{version}` naming pattern
   - Updated hash mismatch test to only run in copy mode (SPECTRL_USE_COPY=1)
   - All 180 tests now passing

## Why These Decisions

### Symlink Naming Pattern

The `{name}@{version}` pattern was chosen to match the spec reference format used throughout the codebase. This provides consistency and makes it easier to identify specs at a glance. The flat structure (no nested directories) simplifies path handling and reduces complexity.

### Skip Logic Implementation

The skip logic checks three conditions:

1. Path exists
2. Path is a symlink
3. Symlink points to correct target

This ensures we don't unnecessarily recreate symlinks that are already correct, improving performance and avoiding potential race conditions.

### Upgrade Path

The upgrade logic detects old directory structures (copied files) and removes them before creating symlinks. This allows seamless migration from the old file-copying approach to the new symlink approach without requiring manual cleanup.

### Test Adaptations

The hash mismatch test was updated to only run in copy mode because:

- With symlinks, the manifest lives in the registry, not the project directory
- You cannot corrupt a symlinked manifest without corrupting the registry
- The test scenario (corrupted project files) doesn't apply to symlinks
- In copy mode, the test still validates the hash mismatch detection works correctly

## Requirements Addressed

- **Requirement 1.1**: System uses symlinks by default for spec installation
- **Requirement 1.2**: System creates symlinks with `{name}@{version}` naming pattern
- **Requirement 1.3**: System skips installation when correct symlink exists
- **Requirement 3.1**: System detects existing symlinks before installation
- **Requirement 3.2**: System validates symlink targets match expected registry paths
- **Requirement 3.3**: System skips symlink creation when correct symlink exists
- **Requirement 3.4**: System removes incorrect symlinks before creating new ones
- **Requirement 3.5**: System upgrades old copied files to symlinks

## Code Changes

### packages/cli/src/commands/install.ts

**installSingleSpec() function** (lines ~360-520):

- Changed `projectSpecPath` to use `join(cwd, '.spectrl', 'specs', resolvedSpecRef)`
- Added `checkSymlinkStatus()` call to verify existing symlinks
- Implemented skip logic for correct symlinks
- Added upgrade detection for old directory structures
- Replaced file copying with `createSymlinkOrFallback()`
- Updated success messages with install method and upgrade status

**install() bulk function** (lines ~650-690):

- Changed `projectSymlinkPath` to use `join(cwd, '.spectrl', 'specs', specKey)`
- Added symlink status checking
- Implemented skip logic that increments `stats.skipped` counter
- Added upgrade path for old directories
- Replaced file copying loop with `createSymlinkOrFallback()`

**isAlreadyInstalled() helper** (lines ~335-355):

- Updated to use `specKey = ${name}@${version}` format
- Changed path construction to match new naming pattern

### packages/cli/src/commands/install.test.ts

Updated all test paths from `.spectrl/specs/{name}/{version}` to `.spectrl/specs/{name}@{version}`:

- Line 323: skip-test path
- Line 353: mismatch-spec path
- Line 612: test-spec path
- Line 697: multi-file-spec path
- Line 845: test-spec path
- Line 886-887: spec-a and spec-b paths
- Line 1160: my-spec path
- Line 1210: versioned-spec path
- Line 1264: single-version path
- Line 1299: sort-test path

Updated hash mismatch test (lines ~335-375):

- Added `SPECTRL_USE_COPY=1` environment variable
- Wrapped test in try/finally to clean up environment variable
- Added comment explaining why test only applies to copy mode

## Challenges & Considerations

### Symlink vs Copy Mode Testing

The main challenge was adapting tests that assumed file copying behavior. The hash mismatch test specifically tested a scenario that doesn't apply to symlinks. The solution was to make the test run only in copy mode, ensuring both code paths are tested appropriately.

### Path Migration

Changing from nested paths (`{name}/{version}`) to flat paths (`{name}@{version}`) required careful updates across both implementation and tests. The flat structure is simpler and more consistent with how specs are referenced elsewhere in the codebase.

### Backward Compatibility

The upgrade logic ensures that projects with old directory structures can seamlessly migrate to symlinks without manual intervention. When an old directory is detected, it's removed and replaced with a symlink, maintaining all functionality while improving performance.

## Test Results

All 180 tests passing:

- 53 install command tests
- 19 publish command tests
- 28 new command tests
- 15 error handling tests
- 49 utility tests
- 7 init command tests
- 9 CLI tests

The implementation successfully handles:

- Fresh installations with symlinks
- Skipping existing correct symlinks
- Upgrading from old copied files
- Fallback to copy mode when symlinks fail
- All edge cases and error conditions

## Post-Implementation Optimization

### Directory Creation Optimization

Applied code review suggestion to optimize the `copyFilesFromRegistry()` function:

**Before**: Created parent directory for each file individually during the copy loop

```typescript
for (const filePath of manifest.files) {
  const destFile = join(projectPath, filePath);
  await fse.ensureDir(join(destFile, '..')); // Called for every file
  await fse.copy(sourceFile, destFile);
}
```

**After**: Collect all unique parent directories and create them in a single pass before copying

```typescript
// Ensure all unique parent directories exist before copying files
const parentDirs = new Set<string>();
for (const filePath of manifest.files) {
  const destFile = join(projectPath, filePath);
  parentDirs.add(join(destFile, '..'));
}
for (const dir of parentDirs) {
  await fse.ensureDir(dir);
}

// Copy each tracked file from registry to project
for (const filePath of manifest.files) {
  const sourceFile = join(registryFilesPath, filePath);
  const destFile = join(projectPath, filePath);
  await fse.copy(sourceFile, destFile);
}
```

**Benefits**:

- Reduces filesystem operations by eliminating duplicate directory creation calls
- Improves performance for specs with multiple files in the same directory
- Cleaner separation of concerns (directory setup vs file copying)

### Test Update

Updated CLI help text test to match the new install command description that explains symlink behavior.

All 181 tests passing after optimization.

### Path Navigation Improvement

Applied code review suggestion to use `dirname()` instead of string literal `'..'` for parent directory resolution:

**Changes made**:

1. Added `dirname` to imports from `node:path`
2. Updated `copyFilesFromRegistry()`: `join(registryFilesPath, '..', 'spectrl.json')` → `join(dirname(registryFilesPath), 'spectrl.json')`
3. Updated `checkSymlinkStatus()`: `resolve(join(linkPath, '..'), actualTarget)` → `resolve(dirname(linkPath), actualTarget)`
4. Updated parent directory collection: `join(destFile, '..')` → `dirname(destFile)`
5. Updated `createSymlinkOrFallback()`: `join(projectSymlinkPath, '..')` → `dirname(projectSymlinkPath)`

**Benefits**:

- More explicit and readable code
- Less fragile than string literal path navigation
- Follows Node.js path module best practices
- Consistent with standard path manipulation patterns

All 181 tests passing after improvements.
