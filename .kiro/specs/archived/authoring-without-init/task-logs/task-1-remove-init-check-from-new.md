# Task 1: Remove initialization check from `spectrl new` command

## What Was Implemented

Removed the unnecessary initialization check from the `spectrl new` command in `packages/cli/src/commands/new.ts`. The command now works without requiring a `.spectrl` directory to exist, allowing spec authors to create new specs anywhere without running `spectrl init` first.

### Changes Made

1. **Removed initialization check block** (lines 33-39):
   - Removed the `getProjectIndexPath(cwd)` call
   - Removed the `fileExists()` check for project index
   - Removed the error throw that blocked spec creation

2. **Cleaned up imports**:
   - Removed unused `getProjectIndexPath` import from `../utils.js`
   - Kept `fileExists` import as it's still used for directory conflict checking

### Code Flow After Changes

The `newSpec()` function now follows this simplified flow:

1. Validate spec name format (lowercase alphanumeric with hyphens)
2. Check if directory already exists (prevent conflicts)
3. Create directory
4. Generate and write manifest template
5. Display success message

## Why These Decisions

The initialization check was removed because it served no purpose in the authoring workflow. The `spectrl new` command only needs to:

- Validate the spec name
- Create a directory
- Write a manifest file

None of these operations require project context (`.spectrl` directory, lock files, or dependency resolution). The initialization requirement was cargo-culted from consumption workflows where it's actually needed.

By removing this check, we enable a more natural authoring workflow where users can create specs anywhere without setup overhead. This aligns with the design principle that authoring and consumption are fundamentally different workflows with different requirements.

## Requirements Addressed

- **Requirement 1.1**: `spectrl new [name]` now creates specs without requiring prior initialization
- **Requirement 1.2**: The CLI no longer checks for `.spectrl` directory existence during `spectrl new`
- **Requirement 1.3**: The CLI does not create `.spectrl` directory as a side effect of `spectrl new`
- **Requirement 1.4**: The CLI still creates a valid `spectrl.json` manifest file

## Code Changes

**File**: `packages/cli/src/commands/new.ts`

**Removed**:

```typescript
import { getProjectIndexPath, fileExists } from '../utils.js';

// Check if project is initialized (user must run init first)
const projectIndexPath = getProjectIndexPath(cwd);
if (!(await fileExists(projectIndexPath))) {
  throw new CLIError(
    'Project not initialized. Run "spectrl init" first.',
    ExitCode.VALIDATION_ERROR,
  );
}
```

**Updated import**:

```typescript
import { fileExists } from '../utils.js';
```

## Validation

- TypeScript compilation passes with no diagnostics
- Import cleanup successful (removed unused `getProjectIndexPath`)
- Function logic remains intact for name validation and directory conflict checking
- No breaking changes to function signature or behavior (except removing the unwanted check)
