# Task 3: Implement File Copying Fallback Function

## What Was Implemented

Updated the `copyFilesFromRegistry()` function in `packages/cli/src/commands/install.ts` to include manifest file copying, completing the fallback mechanism for when symlinks cannot be created.

The function now:

1. Copies the manifest file from registry to project
2. Iterates through manifest.files and copies each tracked file
3. Preserves directory structure for nested files
4. Ensures parent directories exist for each copied file

## Why These Decisions

### Manifest Copying

Added manifest copying to maintain consistency with the existing install implementation:

- Current code copies manifest to `.spectrl/specs/{name}/{version}/spectrl.json`
- Even though design document suggests not copying manifest, existing behavior does
- Maintaining backward compatibility with current structure
- Allows project to have complete spec information locally

The manifest is copied from `registryFilesPath/../spectrl.json` (parent of files directory) to `projectPath/spectrl.json`.

### Implementation Approach

The function follows this sequence:

1. **Ensure project directory exists** - Use `fse.ensureDir()` for idempotent directory creation
2. **Copy manifest first** - Get manifest from parent directory of files directory
3. **Copy each tracked file** - Iterate through manifest.files array
4. **Create parent directories** - Ensure nested structure exists before copying files
5. **Copy with fs-extra** - Use `fse.copy()` which handles files and preserves permissions

This approach mirrors the existing file copying logic but uses fs-extra methods for better reliability.

### Error Handling

The function doesn't include explicit error handling because:

- Called from `createSymlinkOrFallback()` which has comprehensive error handling
- fs-extra methods throw descriptive errors that bubble up appropriately
- Caller wraps in try-catch and converts to CLIError with proper exit codes
- Keeps function focused on single responsibility: copying files

## Requirements Addressed

- **Requirement 2.3**: Falls back to file copying when symlinks fail
- **Requirement 2.4**: Copies files from registry to project directory
- **Task requirement**: Copy manifest file from registry to project ✅
- **Task requirement**: Iterate through manifest.files and copy each file ✅
- **Task requirement**: Preserve directory structure ✅
- **Task requirement**: Ensure parent directories exist ✅
- **Task requirement**: Reuse existing file copying logic ✅

## Code Changes

### Modified Files

- `packages/cli/src/commands/install.ts`
  - Updated `copyFilesFromRegistry()` to copy manifest file
  - Manifest copied from `registryFilesPath/../spectrl.json`
  - Maintains existing file copying logic for tracked files

- `packages/cli/src/commands/install.test.ts`
  - Updated 4 test cases to create manifest files
  - Tests now write `spectrl.json` to parent directory of registry files
  - Ensures tests match real registry structure

## Test Coverage

Updated existing tests to create manifest files:

### Tests Updated

1. **should create symlink successfully** - Added manifest file creation
2. **should use copy mode when SPECTRL_USE_COPY=1** - Added manifest file creation
3. **should copy files with nested directory structure** - Added manifest file creation
4. **should create parent directory if it does not exist** - Added manifest file creation

All tests now create the manifest at `targetDir/../spectrl.json` to match the registry structure where:

- `targetDir` = registry files directory (`~/.spectrl/registry/{name}/{version}/files/`)
- `targetDir/..` = registry spec directory (`~/.spectrl/registry/{name}/{version}/`)
- `targetDir/../spectrl.json` = manifest location

All 180 tests pass.

## Implementation Details

### Function Signature

```typescript
async function copyFilesFromRegistry(
  registryFilesPath: string,
  projectPath: string,
  manifest: Manifest,
): Promise<void>;
```

### Registry Structure

The function expects this registry structure:

```
~/.spectrl/registry/{name}/{version}/
├── spectrl.json          ← Manifest (copied from here)
└── files/                ← registryFilesPath points here
    ├── README.md
    └── docs/
        └── api.md
```

### Project Structure After Copying

```
.spectrl/specs/{name}@{version}/
├── spectrl.json          ← Manifest (copied to here)
├── README.md             ← Tracked files (copied to here)
└── docs/
    └── api.md
```

### Manifest Path Resolution

```typescript
// Manifest is in parent directory of files directory
const registryManifestPath = join(registryFilesPath, '..', 'spectrl.json');
const projectManifestPath = join(projectPath, 'spectrl.json');
await fse.copy(registryManifestPath, projectManifestPath);
```

## Challenges & Considerations

### Test Failures

Challenge: Initial tests failed because they didn't create manifest files
Solution: Updated all tests to create `spectrl.json` in parent directory of registry files

### Manifest Location

Challenge: Understanding where manifest should be copied from
Solution: Analyzed existing code and registry structure to determine manifest is in parent of files directory

### Backward Compatibility

Challenge: Design document says not to copy manifest, but existing code does
Solution: Maintained existing behavior for consistency and backward compatibility

### Directory Structure

Challenge: Ensuring nested directories work correctly
Solution: Use `fse.ensureDir()` before each file copy to create parent directories

## Next Steps

The file copying fallback is now complete and ready to be used by:

- Task 4: Update `installSingleSpec()` to use symlinks (will call `createSymlinkOrFallback()`)
- Task 5: Update `install()` bulk function to use symlinks (will call `createSymlinkOrFallback()`)

The fallback mechanism ensures that even if symlinks fail (Windows permissions, unsupported filesystems, etc.), users can still install specs by falling back to file copying.
