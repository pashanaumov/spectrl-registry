# Task 2: Add explicit initialization check to `spectrl install` commands

## What Was Implemented

Added explicit initialization checks to both `install()` and `installSingleSpec()` functions in `packages/cli/src/commands/install.ts`. These checks ensure that the project is initialized before attempting to install specs, and provide clear, contextual error messages that explain why initialization is needed and mention that authoring commands work without it.

### Changes Made

1. **Updated imports**:
   - Added `getProjectIndexPath` and `fileExists` to the imports from `../utils.js`

2. **Added initialization check to `installSingleSpec()`**:
   - Added check at the beginning of the function (after extracting `cwd` from options)
   - Checks if `.spectrl/spectrl-index.json` exists
   - Throws descriptive error if not initialized

3. **Added initialization check to `install()`**:
   - Added check at the beginning of the function (after extracting `cwd` from options)
   - Checks if `.spectrl/spectrl-index.json` exists
   - Throws descriptive error if not initialized
   - Reused the `projectIndexPath` variable later in the function to avoid redeclaration

### Code Flow After Changes

Both install functions now follow this flow:

1. Start spinner
2. Extract options (cwd, registry path)
3. **Check if project is initialized** (NEW)
4. Continue with existing logic (parse spec ref, resolve dependencies, etc.)

## Why These Decisions

The initialization checks were added to make the requirement explicit and provide better user experience through clear error messaging. Previously, the install commands would fail with cryptic errors when trying to read non-existent files. Now they fail fast with a helpful message that:

1. Explains what's wrong ("Project not initialized")
2. Tells the user how to fix it ("Run 'spectrl init'")
3. Explains why it's needed ("to set up dependency management")
4. Provides context about the workflow ("spectrl new" and "spectrl publish" work without initialization)

This aligns with the design principle that consumption workflows (install) require project context, while authoring workflows (new, publish) do not.

The check is placed early in both functions to fail fast before any expensive operations like network requests or file I/O.

## Requirements Addressed

- **Requirement 3.1**: Install commands now display an error when not initialized
- **Requirement 3.2**: Install commands require `.spectrl` directory to exist
- **Requirement 3.3**: Error message directs users to run `spectrl init`
- **Requirement 4.1**: Error message explains why initialization is needed for install
- **Requirement 4.3**: Error message provides actionable guidance (run `spectrl init`)
- **Requirement 4.4**: Error distinguishes between initialization errors and other validation errors

## Code Changes

**File**: `packages/cli/src/commands/install.ts`

**Added imports**:

```typescript
import { getRegistryPath, getProjectIndexPath, fileExists } from '../utils.js';
```

**Added to `installSingleSpec()` (after line 408)**:

```typescript
// Check if project is initialized
const projectIndexPath = getProjectIndexPath(cwd);
if (!(await fileExists(projectIndexPath))) {
  throw new CLIError(
    'Project not initialized. Run "spectrl init" to set up dependency management.\n' +
      'Note: "spectrl new" and "spectrl publish" work without initialization.',
    ExitCode.VALIDATION_ERROR,
  );
}
```

**Added to `install()` (after line 622)**:

```typescript
// Check if project is initialized
const projectIndexPath = getProjectIndexPath(cwd);
if (!(await fileExists(projectIndexPath))) {
  throw new CLIError(
    'Project not initialized. Run "spectrl init" to set up dependency management.\n' +
      'Note: "spectrl new" and "spectrl publish" work without initialization.',
    ExitCode.VALIDATION_ERROR,
  );
}
```

**Removed duplicate declaration** (line 662):

```typescript
// Before:
const projectIndexPath = join(basePath, 'spectrl-index.json');

// After: (removed, reusing projectIndexPath from initialization check)
```

## Validation

- TypeScript compilation passes with no diagnostics
- Initialization checks are placed early in both functions for fail-fast behavior
- Error messages are consistent between both functions
- Reused `projectIndexPath` variable to avoid redeclaration
- Exit code is `VALIDATION_ERROR` which is appropriate for missing prerequisites
