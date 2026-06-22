# Task 6: Update CLI publish command

## What Was Implemented

Updated the CLI publish command to align with the simplified architecture requirements, focusing on hash format validation and registry structure verification through comprehensive tests.

### Subtasks Completed

#### 6.1: Update publish to use new hash format

- **Status**: Already correctly implemented
- Verified that `computeHash` function returns `sha256:<hex>` format
- Confirmed registry paths use `{name}/{version}/` structure
- Verified no index modification logic exists in publish command

#### 6.2: Update unit tests for publish

- Added test to verify hash format with `sha256:` prefix and 64 hex characters
- Added test to verify registry structure at `{name}/{version}/`
- Added test to verify no project index file is created/modified during publish
- All 13 tests pass successfully

## Why These Decisions

### No Code Changes Required for Subtask 6.1

The publish command implementation was already correct and aligned with requirements:

- The `computeHash` function in `@spectrl/core` already returns hashes in the `sha256:<hex>` format
- The `Registry` class already uses the simplified `{name}/{version}/` path structure
- The publish command has no logic to modify project index files

This demonstrates that the earlier implementation tasks (Tasks 2-5) were completed correctly and the architecture is consistent.

### Comprehensive Test Coverage

Added three new test cases to explicitly verify the requirements:

1. **Hash format test**: Validates that published manifests contain hashes matching the pattern `^sha256:[a-f0-9]{64}$`, ensuring compliance with Requirement 2.6 (hash field format).

2. **Registry structure test**: Verifies that specs are stored at the correct path structure (`{name}/{version}/`) and that the registry paths helper methods return expected values, ensuring compliance with Requirement 6.1 (registry storage location).

3. **No index modification test**: Confirms that the publish operation does not create or modify `.spectrl/spectrl-index.json`, ensuring compliance with Requirement 3.12 (publish shall not modify project index).

These tests provide explicit validation of the architecture requirements and prevent regression if future changes are made to the publish command.

## Requirements Addressed

- **Requirement 3.1**: Validate manifest before publishing ✓
- **Requirement 3.2**: Compute SHA-256 hash with proper format ✓
- **Requirement 3.9**: Reject paths with `..` ✓
- **Requirement 3.10**: Exit with code 2 for missing files ✓
- **Requirement 3.11**: Exit with code 0 on success ✓
- **Requirement 3.12**: Do not modify project index ✓

## Code Changes

### Modified Files

**`packages/cli/src/commands/publish.test.ts`**

- Added `should use sha256: prefix in hash format` test
- Added `should store spec in registry at {name}/{version}/ structure` test
- Added `should not create or modify project index during publish` test

### Test Results

All 13 tests in the publish test suite pass:

- 6 successful publish tests (including 3 new tests)
- 3 validation error tests
- 2 file not found error tests
- 2 exit code tests

## Challenges & Considerations

### Verification vs Implementation

This task highlighted an important aspect of the spec-driven workflow: sometimes verification is more important than implementation. The publish command was already correctly implemented, but lacked explicit tests for the new architecture requirements. Adding these tests provides:

1. **Documentation**: The tests serve as executable documentation of the architecture decisions
2. **Regression prevention**: Future changes will be caught if they break these requirements
3. **Confidence**: Explicit verification that the simplified architecture is working as designed

### Test Design Philosophy

The new tests follow the principle of testing behavior, not implementation:

- Hash format test validates the output format without caring how the hash is computed
- Registry structure test validates the path structure without caring about internal path construction
- Index modification test validates the absence of side effects without caring about the publish logic

This approach makes the tests resilient to refactoring while still catching breaking changes.
