# Design Document: Symlink Implementation

## Overview

This design document outlines the transition from file copying to symbolic linking for Spectrl's installation mechanism. The change eliminates file duplication between the global registry (`~/.spectrl/registry/`) and project-local spec directories (`.spectrl/specs/`), treating the project specs directory as a derived location similar to `node_modules/`.

The implementation modifies the `install` command to create symlinks instead of copying files, with platform-specific handling for Windows (junction points) and graceful fallback to file copying when symlinks are unavailable.

## Architecture

### Current Architecture (File Copying)

```
~/.spectrl/registry/my-spec/1.0.0/
├── spectrl.json
└── files/
    ├── README.md
    └── docs/
        └── api.md

.spectrl/specs/my-spec/1.0.0/     ← COPIED FILES (duplicate)
├── spectrl.json
├── README.md
└── docs/
    └── api.md
```

### New Architecture (Symlinks)

```
~/.spectrl/registry/my-spec/1.0.0/
├── spectrl.json
└── files/
    ├── README.md
    └── docs/
        └── api.md

.spectrl/specs/
└── my-spec@1.0.0/                ← SYMLINK (no duplication)
    → ~/.spectrl/registry/my-spec/1.0.0/files/
```

**Key Changes:**

- Project specs directory contains symlinks, not copied files
- Symlink naming includes version: `{name}@{version}`
- Registry remains the single source of truth
- Multiple versions can coexist as separate symlinks

## Components and Interfaces

### 1. Symlink Creation Module

**Location:** `packages/cli/src/commands/install.ts`

**New Functions:**

```typescript
/**
 * Creates a symlink from project specs directory to registry
 * Handles platform-specific symlink types (junction on Windows, dir on Unix)
 *
 * @param registryFilesPath - Absolute path to registry files directory
 * @param projectSymlinkPath - Path where symlink should be created
 * @returns 'symlink' if successful, 'copy' if fallback was used
 * @throws CLIError if operation fails
 */
async function createSymlinkOrFallback(
  registryFilesPath: string,
  projectSymlinkPath: string,
): Promise<'symlink' | 'copy'>;

/**
 * Checks if a path is a symlink and validates its target
 *
 * @param symlinkPath - Path to check
 * @param expectedTarget - Expected symlink target (absolute path)
 * @returns Object with isSymlink flag and isCorrect flag
 */
async function checkSymlinkStatus(
  symlinkPath: string,
  expectedTarget: string,
): Promise<{ exists: boolean; isSymlink: boolean; isCorrect: boolean }>;

/**
 * Removes existing directory or symlink before creating new symlink
 * Handles both regular directories (old copied files) and incorrect symlinks
 *
 * @param path - Path to remove
 */
async function removeExistingPath(path: string): Promise<void>;
```

### 2. Modified Install Functions

**Changes to `installSingleSpec()`:**

```typescript
// BEFORE: Copy files from registry to project
const projectSpecPath = join(cwd, '.spectrl', 'specs', name, version);
await fs.mkdir(projectSpecPath, { recursive: true });
await fs.copyFile(registryManifestPath, projectManifestPath);
for (const filePath of manifest.files) {
  await fs.copyFile(sourceFile, destFile);
}

// AFTER: Create symlink to registry
const projectSymlinkPath = join(cwd, '.spectrl', 'specs', `${name}@${version}`);
const registryFilesPath = registry.paths.files(name, version);

// Check if already correctly linked
const status = await checkSymlinkStatus(projectSymlinkPath, registryFilesPath);
if (status.exists && status.isSymlink && status.isCorrect) {
  // Skip - already correctly linked
  return;
}

// Remove existing path if present
if (status.exists) {
  await removeExistingPath(projectSymlinkPath);
}

// Create symlink (or fallback to copy)
const result = await createSymlinkOrFallback(registryFilesPath, projectSymlinkPath);
```

**Changes to `install()` (bulk install):**

Similar modifications to replace file copying loops with symlink creation. The function already iterates through resolved specs, so the same symlink logic applies to each spec.

### 3. Platform Detection

**Location:** `packages/cli/src/commands/install.ts`

```typescript
/**
 * Determines the appropriate symlink type for the current platform
 *
 * @returns 'junction' for Windows, 'dir' for Unix-like systems
 */
function getSymlinkType(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir';
}
```

**Rationale:**

- Windows junction points don't require administrator privileges
- Standard symlinks on Windows require Developer Mode or elevation
- Unix-like systems (macOS, Linux) use standard directory symlinks

### 4. Skip Logic Enhancement

**Current Logic:**

```typescript
// Check if already installed by comparing manifest hash
const alreadyInstalled = await isAlreadyInstalled(name, version, expectedHash, cwd);
```

**Enhanced Logic:**

```typescript
// Check if symlink exists and points to correct location
const status = await checkSymlinkStatus(projectSymlinkPath, registryFilesPath);

if (status.exists && status.isSymlink && status.isCorrect) {
  // Already correctly linked - skip
  spinner.succeed(`Skipped ${name}@${version} (already linked)`);
  return;
}

if (status.exists && !status.isSymlink) {
  // Old copied files - upgrade to symlink
  spinner.text = `Upgrading ${name}@${version} to symlink`;
  await removeExistingPath(projectSymlinkPath);
}
```

## Data Models

### Symlink Status

```typescript
interface SymlinkStatus {
  /** Whether the path exists (file, directory, or symlink) */
  exists: boolean;

  /** Whether the path is a symbolic link */
  isSymlink: boolean;

  /** Whether the symlink points to the expected target (only valid if isSymlink is true) */
  isCorrect: boolean;
}
```

### Install Result

```typescript
type InstallResult = 'symlink' | 'copy';
```

Indicates whether a spec was installed via symlink or fallback file copying.

## Error Handling

### 1. Registry Path Not Found

**Scenario:** Registry files directory doesn't exist when creating symlink

**Handling:**

```typescript
if (!(await fs.pathExists(registryFilesPath))) {
  throw new CLIError(
    `Registry path not found: ${registryFilesPath}\n` +
      `Has this spec been published? Run: spectrl publish`,
    ExitCode.DEPENDENCY_ERROR,
  );
}
```

### 2. Symlink Permission Denied (Windows)

**Scenario:** Windows user without Developer Mode or admin privileges

**Handling:**

```typescript
try {
  await fs.symlink(source, dest, getSymlinkType());
  return 'symlink';
} catch (error) {
  if (error.code === 'EPERM') {
    spinner.warn(
      'Permission denied creating symlink. ' +
        'Windows: Enable Developer Mode or run as Administrator. ' +
        'Falling back to file copy...',
    );
    await copyFiles(source, dest);
    return 'copy';
  }
  throw error;
}
```

### 3. Symlink Creation Failure (Other Errors)

**Scenario:** Unexpected errors during symlink creation

**Handling:**

```typescript
catch (error) {
  if (error.code !== 'EPERM') {
    throw new CLIError(
      `Failed to create symlink: ${error.message}`,
      ExitCode.IO_ERROR
    );
  }
}
```

### 4. Inconsistent State Prevention

**Scenario:** Partial failure during installation

**Handling:**

- Always remove existing paths before creating symlinks
- Use atomic operations where possible
- Ensure parent directories exist before symlink creation
- Don't update index/lock files until symlink is created

```typescript
// Ensure parent directory exists
await fs.mkdir(join(projectSymlinkPath, '..'), { recursive: true });

// Create symlink
await fs.symlink(registryFilesPath, projectSymlinkPath, getSymlinkType());

// Only update index after successful symlink creation
projectIndex[specKey] = { source: registrySpecPath, hash };
```

## Testing Strategy

### Unit Tests

**Location:** `packages/cli/src/commands/install.test.ts`

**Test Cases:**

1. **Symlink Creation**
   - Test symlink creation on Unix-like systems
   - Test junction point creation on Windows
   - Verify symlink points to correct target
   - Verify symlink naming includes version

2. **Symlink Status Checking**
   - Test detection of existing symlinks
   - Test detection of regular directories
   - Test validation of symlink targets
   - Test handling of non-existent paths

3. **Platform Detection**
   - Test `getSymlinkType()` returns 'junction' on Windows
   - Test `getSymlinkType()` returns 'dir' on Unix

4. **Upgrade Path**
   - Test removal of old copied files
   - Test creation of symlink after removal
   - Test logging of upgrade action

5. **Skip Logic**
   - Test skipping when symlink already correct
   - Test re-creation when symlink points to wrong target
   - Test upgrade when regular directory exists

6. **Error Handling**
   - Test error when registry path doesn't exist
   - Test fallback to copy on permission errors
   - Test error messages for various failure scenarios

### Integration Tests

**Location:** `tests/e2e/install.test.ts`

**Test Cases:**

1. **Fresh Install Creates Symlink**

   ```typescript
   test('install creates symlink to registry', async () => {
     // Publish spec to registry
     // Run install
     // Verify symlink exists at .spectrl/specs/{name}@{version}
     // Verify symlink points to registry files directory
     // Verify files are readable through symlink
   });
   ```

2. **Multiple Versions Coexist**

   ```typescript
   test('install creates separate symlinks for different versions', async () => {
     // Publish my-spec@1.0.0 and my-spec@2.0.0
     // Install both versions
     // Verify both symlinks exist
     // Verify each points to correct registry location
   });
   ```

3. **Upgrade from Copied Files**

   ```typescript
   test('install upgrades old copied files to symlinks', async () => {
     // Create old-style copied files in .spectrl/specs/
     // Run install
     // Verify copied files are removed
     // Verify symlink is created
     // Verify upgrade message is logged
   });
   ```

4. **Skip Already Linked**

   ```typescript
   test('install skips when symlink already correct', async () => {
     // Create correct symlink
     // Run install
     // Verify symlink unchanged
     // Verify skip message is logged
   });
   ```

5. **AI Agent Compatibility**

   ```typescript
   test('files are readable through symlinks', async () => {
     // Install spec via symlink
     // Read files through symlink path
     // Verify content matches registry files
   });
   ```

6. **Cross-Platform Behavior**
   ```typescript
   test('install uses junction points on Windows', async () => {
     // Skip if not Windows
     // Run install
     // Verify junction point is created (not standard symlink)
   });
   ```

### Manual Testing Checklist

- [ ] Fresh install on macOS creates symlink
- [ ] Fresh install on Linux creates symlink
- [ ] Fresh install on Windows creates junction point
- [ ] Installing same spec twice skips correctly
- [ ] Installing different versions creates separate symlinks
- [ ] Upgrading from old copied files works
- [ ] AI agents can read files through symlinks
- [ ] Bulk install creates symlinks for all specs
- [ ] Single spec install creates symlink and updates index
- [ ] Symlinks appear in `.gitignore` correctly
- [ ] Windows without Developer Mode falls back to copy
- [ ] Error messages are clear and actionable

## Implementation Notes

### Path Resolution

All symlink targets use absolute paths resolved from the registry root:

```typescript
const registryFilesPath = path.resolve(registry.paths.files(name, version));
```

This ensures symlinks work regardless of where they're accessed from.

### Symlink Naming Convention

Project symlinks include the version in the directory name:

```
.spectrl/specs/
├── my-spec@1.0.0/    → ~/.spectrl/registry/my-spec/1.0.0/files/
├── my-spec@2.0.0/    → ~/.spectrl/registry/my-spec/2.0.0/files/
└── other-spec@1.5.0/ → ~/.spectrl/registry/other-spec/1.5.0/files/
```

This allows multiple versions to coexist and makes the version immediately visible.

### Manifest Handling

The manifest file (`spectrl.json`) is NOT symlinked separately. It remains in the registry at:

```
~/.spectrl/registry/{name}/{version}/spectrl.json
```

The symlink points to the `files/` directory only, which contains the tracked content files. This maintains the registry structure and avoids confusion about manifest location.

**Why not symlink the manifest?**

- AI agents only read tracked files (the actual documentation content)
- The manifest is CLI metadata (name, version, dependencies, hash)
- Keeping it in registry only maintains clear separation of concerns
- Reduces complexity and potential confusion about manifest location

### Index and Lock File Updates

The project index (`.spectrl/spectrl-index.json`) and lock file (`.spectrl/lock.json`) continue to reference the registry as the source:

```json
{
  "my-spec@1.0.0": {
    "source": "~/.spectrl/registry/my-spec/1.0.0",
    "hash": "abc123..."
  }
}
```

The symlink is purely a convenience for accessing files; the index remains the authoritative record of what's installed.

### Backward Compatibility

The implementation maintains backward compatibility:

1. **Old copied files are automatically upgraded** to symlinks on next install
2. **Fallback to copying** ensures functionality on systems without symlink support
3. **Index format unchanged** - no breaking changes to project metadata

### Performance Considerations

Symlinks provide several performance benefits:

1. **Instant installation** - no file copying required
2. **Reduced disk I/O** - single source of truth in registry
3. **Faster updates** - changing registry immediately reflects in projects
4. **Space efficiency** - no duplication of potentially large spec files

## Documentation Updates

### README.md Changes

**Section: How It Works**

Update the installation description:

```markdown
### Installation

When you run `spectrl install my-spec@1.0.0`:

1. Reads the manifest from `~/.spectrl/registry/my-spec/1.0.0/spectrl.json`
2. Verifies the content hash matches
3. Creates a symlink from `.spectrl/specs/my-spec@1.0.0/` to the registry files
4. Updates `.spectrl/spectrl-index.json` and `.spectrl/lock.json`

The symlink approach eliminates file duplication - specs exist only in the registry,
and projects access them through symlinks (similar to how `node_modules/` works).
```

**New Section: Troubleshooting**

````markdown
### Symlinks on Windows

Spectrl uses symlinks (junction points on Windows) to avoid duplicating files.
If you encounter permission errors on Windows:

1. **Windows 10/11:** Enable Developer Mode in Settings → Privacy & Security → For developers
2. **Older Windows:** Run terminal as Administrator
3. **Fallback:** Spectrl will automatically copy files if symlinks fail

To verify symlinks are working:

```bash
# On Unix/Mac:
ls -la .spectrl/specs/

# On Windows:
dir .spectrl\specs\
# Look for <SYMLINKD> or <JUNCTION> indicators
```
````

```

### CLI Help Text

Update `spectrl install --help` output to mention symlink behavior:

```

Creates symlinks from .spectrl/specs/{name}@{version}/ to the registry.
On Windows, uses junction points which don't require administrator privileges.
Falls back to file copying if symlinks are unavailable.

````

## Rollback Strategy

If critical issues arise with symlinks in production, an environment variable provides an immediate escape hatch:

```bash
export SPECTRL_USE_COPY=1
spectrl install
````

**Implementation:**

```typescript
/**
 * Checks if file copying should be used instead of symlinks
 * Controlled by SPECTRL_USE_COPY environment variable
 */
function shouldUseCopy(): boolean {
  return process.env.SPECTRL_USE_COPY === '1';
}

// In createSymlinkOrFallback():
if (shouldUseCopy()) {
  spinner.info('Using file copy mode (SPECTRL_USE_COPY=1)');
  await copyFiles(registryFilesPath, projectSymlinkPath);
  return 'copy';
}
```

**Benefits:**

- Provides immediate rollback without code changes
- Allows debugging symlink issues without blocking users
- Can be set per-project or globally
- Minimal implementation cost with significant safety value

**Use Cases:**

- Emergency rollback if symlinks cause production issues
- Debugging symlink-specific problems
- Environments with strict symlink policies
- Temporary workaround while investigating issues

## Migration Path

### For Existing Users

1. **No action required** - next `spectrl install` automatically upgrades
2. **Old copied files are removed** and replaced with symlinks
3. **Fallback ensures compatibility** on systems without symlink support
4. **Rollback available** via `SPECTRL_USE_COPY=1` if issues arise

### For CI/CD Environments

1. **No changes needed** - symlinks work in CI environments
2. **Docker containers** support symlinks by default
3. **Windows CI** may need Developer Mode enabled or will use fallback
4. **Emergency rollback** available via environment variable

### For Development

1. **Test on all platforms** before release
2. **Document Windows requirements** clearly
3. **Provide troubleshooting guide** for permission issues
4. **Test rollback mechanism** to ensure it works correctly
