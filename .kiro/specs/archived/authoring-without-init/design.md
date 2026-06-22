# Design Document

## Overview

This design removes the initialization requirement from `spectrl new` and `spectrl publish` commands, allowing spec authors to work without project infrastructure. The key insight is that authoring (creating and publishing specs) is fundamentally different from consumption (installing and using specs). Only consumption workflows require project context like the `.spectrl` directory, lock files, and dependency resolution.

## Architecture

### Command Classification

Commands are classified into two categories based on their need for project context:

**Authoring Commands** (no initialization required):

- `spectrl new [name]` - Creates a spec manifest
- `spectrl publish` - Publishes a spec to the registry

**Consumption Commands** (initialization required):

- `spectrl install [spec]` - Installs specs and resolves dependencies
- `spectrl init` - Initializes project context

### Initialization Check Strategy

The current implementation uses `getProjectIndexPath()` to check for `.spectrl/spectrl-index.json` existence. This check needs to be:

- **Removed** from `new.ts` and `publish.ts`
- **Retained** in `install.ts` with improved error messaging

## Components and Interfaces

### Modified Commands

#### `new.ts` Changes

Remove the initialization check that currently blocks spec creation:

```typescript
// REMOVE THIS BLOCK:
const projectIndexPath = getProjectIndexPath(cwd);
if (!(await fileExists(projectIndexPath))) {
  throw new CLIError(
    'Project not initialized. Run "spectrl init" first.',
    ExitCode.VALIDATION_ERROR,
  );
}
```

The command will:

1. Validate spec name format
2. Check if directory already exists
3. Create directory and manifest
4. No project context checks

#### `publish.ts` Changes

The `publish` command already doesn't check for initialization - it works directly with:

1. Reading manifest from current directory
2. Validating tracked files
3. Computing hash
4. Writing to registry (user-level by default: `~/.spectrl/registry`)

**No changes needed** - this command already works without initialization.

#### `install.ts` Changes

Add explicit initialization check at the beginning with clear error messaging:

```typescript
// Add at start of install() and installSingleSpec()
const projectIndexPath = getProjectIndexPath(cwd);
if (!(await fileExists(projectIndexPath))) {
  throw new CLIError(
    'Project not initialized. Run "spectrl init" to set up dependency management.\n' +
      'Note: "spectrl new" and "spectrl publish" work without initialization.',
    ExitCode.VALIDATION_ERROR,
  );
}
```

This makes the requirement explicit and provides context about which commands need initialization.

## Data Models

No changes to data models. The existing structures remain:

- **Manifest** (`spectrl.json`) - Spec metadata, works standalone
- **Index** (`.spectrl/spectrl-index.json`) - Project-level dependency tracking, only for consumption
- **LockFile** (`.spectrl/lock.json`) - Resolved dependency closure, only for consumption
- **Registry** (`~/.spectrl/registry/`) - User-level published specs, shared across projects

## Error Handling

### Error Messages

**Before (confusing):**

```
Project not initialized. Run "spectrl init" first.
```

(Shown for all commands, unclear why it's needed)

**After (contextual):**

For `spectrl install`:

```
Project not initialized. Run "spectrl init" to set up dependency management.
Note: "spectrl new" and "spectrl publish" work without initialization.
```

For `spectrl new` and `spectrl publish`:

- No initialization errors
- Only validation errors for actual problems (invalid name, missing files, etc.)

### Exit Codes

Maintain existing exit codes:

- `ExitCode.VALIDATION_ERROR` - For validation failures (invalid names, missing files)
- `ExitCode.IO_ERROR` - For file system errors
- `ExitCode.DEPENDENCY_ERROR` - For dependency resolution failures (install only)

## Testing Strategy

### Unit Tests

Update existing tests in:

1. **`new.test.ts`**
   - Remove tests that verify initialization check
   - Add test: "creates spec without initialization"
   - Keep tests for name validation, directory conflicts

2. **`publish.test.ts`**
   - Verify no initialization checks exist
   - Keep tests for manifest validation, file tracking, hash computation

3. **`install.test.ts`**
   - Add test: "fails with clear error when not initialized"
   - Verify error message includes context about authoring commands
   - Keep existing tests for dependency resolution

### Integration Tests (E2E)

Update `tests/e2e/natural-workflow.test.ts`:

1. **Authoring workflow** (no init):

   ```typescript
   // Should work without init
   await cli.new('my-spec', tempDir);
   await cli.publish(tempDir);
   ```

2. **Consumption workflow** (requires init):

   ```typescript
   // Should fail without init
   await expect(cli.install('my-spec', tempDir)).rejects.toThrow('not initialized');

   // Should work after init
   await cli.init(tempDir);
   await cli.install('my-spec', tempDir);
   ```

3. **Mixed workflow**:

   ```typescript
   // Author in one directory (no init)
   await cli.new('spec-a', authorDir);
   await cli.publish(authorDir);

   // Consume in another directory (with init)
   await cli.init(projectDir);
   await cli.install('spec-a', projectDir);
   ```

## Implementation Notes

### Backward Compatibility

This change is **backward compatible**:

- Existing projects with `.spectrl` directories continue to work
- `spectrl init` still creates the same structure
- `spectrl install` behavior unchanged
- Only difference: `new` and `publish` no longer require init

### Migration Path

No migration needed. Users can:

- Continue using `init` before authoring (works but unnecessary)
- Start using `new`/`publish` without `init` (new capability)
- Existing workflows remain valid

### Registry Location

The registry location remains unchanged:

- Default: `~/.spectrl/registry` (user-level, shared across projects)
- Override: `--registry` flag or environment variable
- No project-level registry concept

This design maintains the local-first, reproducible nature of Spectrl while removing unnecessary friction from the authoring workflow.
