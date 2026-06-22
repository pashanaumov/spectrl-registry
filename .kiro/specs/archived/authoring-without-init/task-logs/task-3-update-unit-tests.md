# Task 3: Update unit tests for modified commands

## What Was Implemented

Updated unit tests across three test files to reflect the new behavior where `spectrl new` works without initialization and `spectrl install` requires initialization. All tests now pass with the updated command behavior.

### Subtasks Completed

#### 3.1 Update `new.test.ts` to remove initialization requirement tests

**Changes Made:**

1. **Removed unused imports**: Removed `writeFile` and `getProjectIndexPath` imports that were only used for initialization setup
2. **Simplified `beforeEach` setup**: Removed the code that created `.spectrl` directory and `spectrl-index.json` file
3. **Replaced initialization check tests**: Removed the entire "project initialization check" describe block (3 tests) that verified the command failed without initialization
4. **Added new tests**: Created "works without initialization" describe block with 2 new tests:
   - "should create spec without requiring project initialization" - Verifies specs can be created in uninitialized directories
   - "should not create .spectrl directory as side effect" - Verifies no project infrastructure is created

**Test Results:** All 27 tests pass (8 successful spec creation, 4 custom version/description, 10 name validation, 3 directory exists error, 2 works without initialization)

#### 3.2 Update `install.test.ts` to verify initialization requirement

**Changes Made:**

1. **Added new test section**: Created "initialization requirement" describe block with 6 comprehensive tests:
   - "should throw CLIError when project is not initialized" - Tests `install()` fails without init
   - "should throw CLIError with VALIDATION_ERROR for uninitialized project" - Verifies correct exit code
   - "should include helpful message about running init" - Checks error message mentions `spectrl init`
   - "should mention authoring commands work without initialization" - Verifies contextual help about `new`/`publish`
   - "should throw CLIError for installSingleSpec when not initialized" - Tests `installSingleSpec()` fails without init
   - "should throw CLIError with VALIDATION_ERROR for installSingleSpec" - Verifies correct exit code for single spec install

2. **Fixed existing tests**: Updated 11 existing tests that use `installSingleSpec()` to create the required project index file:
   - "should skip spec in installSingleSpec when already installed with matching hash"
   - "should install a specific spec from registry"
   - "should throw error for invalid spec reference format"
   - "should throw error when spec not found in registry"
   - "should install spec with multiple files"
   - "should create project index if it does not exist"
   - "should install latest version when version not specified"
   - "should install specific version when version is specified"
   - "should throw error when spec name not found in registry"
   - "should handle single version correctly"
   - "should correctly sort versions with different major/minor/patch"
   - "should reject invalid spec reference formats"

**Test Results:** All 60 tests pass (including 6 new initialization requirement tests)

#### 3.3 Verify `publish.test.ts` has no initialization checks

**Changes Made:**

- No changes needed - verified that existing tests don't require or check for initialization
- Confirmed tests only reference `.spectrl` for registry path, not for project initialization
- One test explicitly verifies that publish does NOT create a project index file

**Test Results:** All 19 tests pass

## Why These Decisions

The test updates align with the new command behavior where authoring (new, publish) and consumption (install) workflows have different initialization requirements.

For `new.test.ts`, we removed tests that verified the old behavior (requiring initialization) and added tests that verify the new behavior (working without initialization). This ensures the tests accurately reflect the intended functionality.

For `install.test.ts`, we added comprehensive tests to verify that install commands properly enforce the initialization requirement with clear, helpful error messages. We also fixed existing tests that were inadvertently relying on the lack of initialization checks - these tests now properly set up the project context they need.

For `publish.test.ts`, no changes were needed because the publish command never required initialization, so the existing tests already verified the correct behavior.

## Requirements Addressed

- **Requirement 1.1**: Tests verify `spectrl new` creates specs without requiring initialization
- **Requirement 1.4**: Tests verify valid `spectrl.json` manifest is created
- **Requirement 2.1**: Tests verify `spectrl publish` works without initialization
- **Requirement 2.2**: Tests verify publish doesn't check for `.spectrl` directory
- **Requirement 3.1**: Tests verify install displays error when not initialized
- **Requirement 3.3**: Tests verify error message directs users to run `spectrl init`
- **Requirement 4.1**: Tests verify error message explains why initialization is needed
- **Requirement 4.3**: Tests verify error message provides actionable guidance

## Code Changes

### File: `packages/cli/src/commands/new.test.ts`

**Removed imports:**

```typescript
import { writeFile } from 'node:fs/promises';
import { getProjectIndexPath } from '../utils.js';
```

**Simplified beforeEach:**

```typescript
// Before:
beforeEach(async () => {
  testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });

  // Initialize project (new command requires project to be initialized)
  const projectDir = join(testDir, '.spectrl');
  await mkdir(projectDir, { recursive: true });
  const indexPath = getProjectIndexPath(testDir);
  await writeFile(indexPath, '{}\n', 'utf-8');
});

// After:
beforeEach(async () => {
  testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});
```

**Replaced test section:**

```typescript
// Removed: "project initialization check" (3 tests)
// Added: "works without initialization" (2 tests)
describe('works without initialization', () => {
  it('should create spec without requiring project initialization', async () => { ... });
  it('should not create .spectrl directory as side effect', async () => { ... });
});
```

### File: `packages/cli/src/commands/install.test.ts`

**Added new test section:**

```typescript
describe('initialization requirement', () => {
  it('should throw CLIError when project is not initialized', async () => { ... });
  it('should throw CLIError with VALIDATION_ERROR for uninitialized project', async () => { ... });
  it('should include helpful message about running init', async () => { ... });
  it('should mention authoring commands work without initialization', async () => { ... });
  it('should throw CLIError for installSingleSpec when not initialized', async () => { ... });
  it('should throw CLIError with VALIDATION_ERROR for installSingleSpec', async () => { ... });
});
```

**Fixed existing tests** (pattern applied to 11 tests):

```typescript
// Added to each test that uses installSingleSpec:
const spectrlDir = join(testDir, '.spectrl');
await mkdir(spectrlDir, { recursive: true });
const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
await writeFile(projectIndexPath, '{}\n', 'utf-8');
```

### File: `packages/cli/src/commands/publish.test.ts`

No changes - tests already verify correct behavior (no initialization required).

## Validation

- All 27 tests in `new.test.ts` pass
- All 60 tests in `install.test.ts` pass (including 6 new initialization tests)
- All 19 tests in `publish.test.ts` pass
- Total: 106 unit tests passing
- Tests verify both positive cases (commands work as expected) and negative cases (proper error handling)
- Error messages are validated for content and exit codes
