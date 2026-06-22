# Task 7: Implement CLI init Command

## What Was Implemented

Implemented the `spectrl init` command that initializes a new spec manifest in the current directory.

### Subtasks Completed

- 7.1: Implement init command in commands/init.ts
- 7.2: Write unit tests for init command

## Implementation Details

### Command Functionality

The init command creates a `spectrl.json` manifest file with sensible defaults:

- **Name**: Derived from the current directory's basename
- **Version**: Set to `0.1.0` (standard initial version)
- **Dependencies**: Empty object `{}`
- **Files**: Empty array `[]` (user will populate this later)

### Error Handling

The command validates that `spectrl.json` doesn't already exist before creating it. If the file exists, it throws a `CLIError` with exit code `VALIDATION_ERROR` (1), preventing accidental overwrites.

### Output Format

The manifest is written with:

- 2-space indentation for readability
- Trailing newline for POSIX compliance
- UTF-8 encoding

Success message uses colored output to highlight the spec name.

## Why These Decisions

### Directory Basename as Default Name

Using the directory basename as the default spec name provides a sensible starting point that users can modify if needed. This follows common conventions from package managers like npm (which uses the directory name in `npm init`).

### Empty Files Array

While the manifest schema requires at least one file for validation, the init command creates an empty array to allow users to start fresh. The validation will catch this when they attempt to publish, prompting them to add files. This is more user-friendly than forcing them to specify files during initialization.

### Exit Code 1 for Existing File

Using `VALIDATION_ERROR` (exit code 1) for the "file already exists" case aligns with the semantic meaning - the user's request to initialize is invalid because initialization has already occurred. This is consistent with how other CLI tools handle similar scenarios.

### Leveraging Existing Utilities

The implementation reuses existing utilities from `utils.ts`:

- `getManifestPath()` - Consistent path resolution
- `assertFileNotExists()` - Standardized existence checking with proper error handling
- `output.log()` - Consistent stdout/stderr usage

This maintains code consistency and reduces duplication.

## Requirements Addressed

- Requirement 1.1: System initialization with manifest creation
- Requirement 1.2: Manifest structure with name, version, deps, files
- Requirement 1.3: Default version assignment
- Requirement 1.4: Empty dependencies object initialization
- Requirement 1.5: Files array initialization
- Requirement 7.1: Validation that manifest doesn't already exist
- Requirement 7.2: Proper error handling with exit codes
- Requirement 7.6: Success message output

## Code Changes

### packages/cli/src/commands/init.ts

- Implemented full init command functionality
- Added imports for file operations and utilities
- Created default manifest structure
- Implemented file existence check
- Added formatted JSON writing with proper indentation
- Added success message output

### packages/cli/src/commands/init.test.ts (new file)

- Created comprehensive test suite with 7 test cases
- Tests for successful initialization scenarios
- Tests for error handling when file exists
- Tests for correct exit codes
- Tests for JSON formatting and structure
- Tests for directory basename usage

## Test Results

All tests pass successfully:

- ✓ 7 tests for init command
- ✓ All existing tests continue to pass (108 total tests)
- No diagnostics or linting issues

## Challenges & Considerations

### Linting Compliance

Initial implementation used string concatenation (`+`) for adding the trailing newline, which triggered a Biome linting error. Fixed by using template literals instead: `` `${JSON.stringify(manifest, null, 2)}\n` ``

### Test Isolation

Tests use unique temporary directories with timestamps and random strings to ensure complete isolation between test runs, preventing any cross-test contamination.

### Output During Tests

The success messages appear in test output (stdout), which is expected behavior. The tests verify functionality without mocking the output functions, ensuring we test the real behavior.
