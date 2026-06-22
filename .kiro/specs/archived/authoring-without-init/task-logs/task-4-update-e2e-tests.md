# Task 4: Update end-to-end tests for workflow changes

## What Was Implemented

Updated end-to-end tests to verify the new workflow where authoring commands (new, publish) work without initialization while consumption commands (install) require it. Added 3 new comprehensive e2e tests and verified existing tests still pass.

### Subtasks Completed

#### 4.1 Update `natural-workflow.test.ts` to test authoring without init

**Changes Made:**

Added 3 new end-to-end tests to verify the complete workflow changes:

1. **"should support authoring workflow without initialization"** - Tests the complete authoring workflow:
   - Creates a spec directory without running `spectrl init`
   - Runs `spectrl new` to create a spec
   - Verifies spec is created successfully
   - Verifies `.spectrl` directory is NOT created as a side effect
   - Adds spec files and updates manifest
   - Runs `spectrl publish` without initialization
   - Verifies spec is published to the registry successfully

2. **"should require initialization for install commands"** - Tests that install properly enforces initialization:
   - Creates a project directory without initialization
   - Attempts to run `spectrl install`
   - Verifies command fails with exit code 1 (VALIDATION_ERROR)
   - Verifies error message contains:
     - "not initialized"
     - "spectrl init"
     - "spectrl new"
     - "spectrl publish"
     - "work without initialization"

3. **"should support mixed workflow: author without init, consume with init"** - Tests the realistic workflow:
   - **Author workspace**: Creates and publishes spec WITHOUT initialization
     - Creates spec with `spectrl new` (no init)
     - Adds spec files
     - Publishes with `spectrl publish` (no init)
     - Verifies no `.spectrl` directory in author workspace
   - **Consumer workspace**: Installs spec WITH initialization
     - Runs `spectrl init` to set up project
     - Verifies `.spectrl` directory is created
     - Adds spec to index
     - Runs `spectrl install` successfully
     - Verifies lock file is created
     - Verifies spec is accessible in registry

**Test Results:** All 7 tests in `natural-workflow.test.ts` pass (4 existing + 3 new)

#### 4.2 Update other e2e tests if they assume initialization

**Review Conducted:**

Reviewed all other e2e test files to identify any incorrect assumptions about initialization requirements:

1. **`init.test.ts`** - No changes needed
   - Only tests the `init` command itself
   - Doesn't test `new` or `publish` commands

2. **`install.test.ts`** - No changes needed
   - Already uses `init` before running `install` commands
   - Tests already follow the correct pattern (init required for install)

3. **`publish.test.ts`** - No changes needed
   - Already publishes specs without calling `init`
   - Tests already verify the correct behavior (publish works without init)

4. **Other test files** (`determinism.test.ts`, `errors.test.ts`, `symlink.test.ts`) - No changes needed
   - These tests use appropriate initialization patterns
   - No incorrect assumptions found

**Test Results:** All 40 e2e tests pass across all 7 test files

## Why These Decisions

The new e2e tests provide comprehensive coverage of the workflow changes at the integration level. They verify not just that individual commands work, but that the complete user workflows function correctly.

The "authoring workflow without initialization" test verifies the happy path for spec authors who just want to create and share specs without project overhead.

The "require initialization for install" test verifies that the error handling is correct and provides helpful guidance to users who try to install without initializing.

The "mixed workflow" test is particularly important because it represents the realistic scenario where one person authors specs and another person consumes them in a project. This test verifies that the two workflows can coexist and work together seamlessly.

No changes were needed to other e2e tests because they already followed correct patterns - this indicates that the existing test suite was well-designed and the changes are backward compatible.

## Requirements Addressed

- **Requirement 1.1**: E2e tests verify `spectrl new` creates specs without requiring initialization
- **Requirement 2.1**: E2e tests verify `spectrl publish` works without initialization
- **Requirement 3.1**: E2e tests verify install displays error when not initialized
- **Requirement 4.1**: E2e tests verify error message explains why initialization is needed
- **Requirement 4.2**: E2e tests verify no initialization errors for new/publish
- **Requirement 4.3**: E2e tests verify error message provides actionable guidance

## Code Changes

### File: `tests/e2e/natural-workflow.test.ts`

**Added 3 new tests:**

```typescript
it('should support authoring workflow without initialization', async () => {
  // Creates spec directory without init
  // Runs spectrl new (succeeds)
  // Verifies no .spectrl directory created
  // Adds files and publishes (succeeds)
  // Verifies spec in registry
});

it('should require initialization for install commands', async () => {
  // Creates project without init
  // Attempts spectrl install (fails)
  // Verifies error message content
});

it('should support mixed workflow: author without init, consume with init', async () => {
  // Author: creates and publishes without init
  // Consumer: initializes and installs with init
  // Verifies both workflows work correctly
});
```

### Files: Other e2e test files

No changes - existing tests already follow correct patterns.

## Validation

- All 7 tests in `natural-workflow.test.ts` pass
- All 40 e2e tests pass across all 7 test files
- Tests verify both positive cases (commands work) and negative cases (proper errors)
- Tests verify complete user workflows, not just individual commands
- Tests verify error messages contain helpful guidance
- No regressions in existing tests
