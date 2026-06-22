# Task 7: Write Unit Tests for Manager Module

## What Was Implemented

Created comprehensive unit tests for the `packages/cli/src/agents/manager.ts` module, covering all three exported functions: `checkAgentsStatus()`, `createAgentsFile()`, and `appendToAgentsFile()`. The test suite includes 20 test cases organized into logical groups with proper setup/teardown using temporary directories.

## Test Coverage

### checkAgentsStatus() - 5 tests

- Non-existent file returns `{ exists: false }`
- File containing marker returns `{ exists: true, hasMarker: true }`
- File without marker returns `{ exists: true, hasMarker: false }`
- Unreadable file (simulated with chmod) is treated as non-existent
- Marker detection works regardless of position in file

### createAgentsFile() - 4 tests

- Creates file with correct content (marker + template)
- Marker is placed as the first line
- Throws `CLIError` with `ExitCode.IO_ERROR` on write failure
- Error message includes helpful details

### appendToAgentsFile() - 7 tests

- Preserves existing content and appends correctly
- Both existing and new content are present after append
- Trailing whitespace is trimmed before appending
- No extra whitespace between trimmed content and separator
- Throws `CLIError` with `ExitCode.IO_ERROR` on read failure
- Throws `CLIError` with `ExitCode.IO_ERROR` on write failure
- Error messages include helpful details

### Integration Scenarios - 4 tests

- Handles empty existing file correctly
- Handles file with only whitespace
- Create then detect marker workflow
- Append then detect marker workflow

## Why These Decisions

### Test Organization

Followed the established pattern from `template.test.ts` and `init.test.ts` by using nested `describe` blocks to organize tests by function. This makes the test output readable and helps locate specific test failures quickly.

### Temporary Directory Usage

Used `tmpdir()` with unique directory names (timestamp + random string) for complete test isolation. This prevents test interference and allows parallel test execution. The pattern matches exactly what's used in `init.test.ts`, ensuring consistency across the codebase.

### Error Testing Strategy

For write failures, used non-existent parent directories to force errors rather than trying to manipulate permissions in complex ways. This approach is more reliable across different operating systems and file systems.

For read failures with `appendToAgentsFile()`, simply tested with a non-existent file since the function needs to read before appending.

For the unreadable file test in `checkAgentsStatus()`, used `chmod` to remove read permissions. This tests the error handling path where the file exists but can't be read, which should be treated as non-existent per the requirements.

### Content Verification

Used `getNewFileContent()` and `getAppendContent()` from the template module to verify correct content rather than hardcoding expected strings. This ensures tests remain valid if the template content changes and follows the DRY principle.

### Integration Tests

Added integration scenario tests to verify the complete workflows work correctly:

- Create file → check status (should detect marker)
- Append to file → check status (should detect marker)
- Handle edge cases like empty files and whitespace-only files

These tests validate that the functions work together correctly, not just in isolation.

## Requirements Addressed

- **Requirement 1.1-1.9**: Tests verify AGENTS.md creation and prompting behavior
- **Requirement 2.1-2.8**: Tests verify detection of existing AGENTS.md and marker presence
- **Requirement 4.1-4.12**: Tests verify appending behavior, whitespace trimming, and separator placement

## Code Changes

- Created `packages/cli/src/agents/manager.test.ts` with 20 comprehensive test cases
- All tests follow established patterns from existing test files
- Tests use proper TypeScript types and imports
- Tests include proper cleanup with `beforeEach`/`afterEach` hooks

## Challenges & Considerations

### Cross-Platform File Permissions

The test for unreadable files uses `chmod` which may behave differently on Windows vs Unix systems. However, the test includes proper error handling and cleanup to ensure it doesn't break the test suite on any platform. The `try/finally` block ensures permissions are restored even if the test fails.

### Error Message Validation

Rather than checking for exact error message strings, tests verify that error messages contain key information (like "AGENTS.md") and have the correct exit codes. This makes tests more resilient to minor wording changes while still validating proper error handling.

### Test Isolation

Each test gets its own temporary directory with a unique name, preventing any possibility of test interference. The cleanup in `afterEach` uses `{ force: true }` to ensure directories are removed even if tests fail partway through.

### Whitespace Handling

The test for whitespace trimming was initially too specific (checking for exact marker placement). Fixed it to verify the complete expected content using `getAppendContent()`, which is more robust and matches the actual implementation behavior.

## Test Results

All 20 tests pass successfully:

- ✓ checkAgentsStatus (5 tests)
- ✓ createAgentsFile (4 tests)
- ✓ appendToAgentsFile (7 tests)
- ✓ Integration scenarios (4 tests)

Total execution time: ~12ms for test execution, ~157ms including setup and collection.
