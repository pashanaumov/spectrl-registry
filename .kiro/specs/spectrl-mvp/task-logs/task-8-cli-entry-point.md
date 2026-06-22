# Task 8: Update CLI Entry Point

## What Was Implemented

Updated the CLI entry point to use cmd-ts for command routing and implemented comprehensive tests for the CLI interface.

### Subtasks Completed

- 8.1: Simplify command routing
- 8.2: Update CLI tests

## Implementation Details

### 8.1 Command Routing

**Changes to `packages/cli/src/cli.ts`:**

- Replaced placeholder CLI with full cmd-ts implementation
- Created three command definitions using `command()`:
  - `initCmd` - Initialize project with local spec index
  - `publishCmd` - Publish spec to local registry
  - `installCmd` - Install all specs from project index
- Used `subcommands()` to group commands under the `spectrl` binary
- Implemented centralized error handling in `main()` function
- Proper exit code mapping from `CLIError` to process exit codes

**Command signatures:**

- `spectrl init` - No arguments, operates on current directory
- `spectrl publish` - No arguments, reads from current directory
- `spectrl install` - No arguments, reads from `.spectrl/spectrl-index.json`

**Error handling:**

- Catches `CLIError` and exits with its `exitCode` property
- Outputs formatted errors to stderr using `output.error()`
- Handles unknown errors gracefully with fallback exit code

### 8.2 CLI Tests

**Created `packages/cli/src/cli.test.ts`:**

- Implemented helper function `runCLI()` to spawn CLI process and capture output
- Tests for command routing:
  - Help output when no command provided
  - Help output with `--help` flag
  - Individual command help for init, publish, install
  - Unknown command handling
- Tests for error handling:
  - Validation error exit codes
  - IO error exit codes
- Tests for output formatting:
  - Errors output to stderr
  - Success messages output to stdout

**Deleted `packages/cli/src/index.test.ts`:**

- Removed placeholder test file
- Replaced with comprehensive CLI tests

## Why These Decisions

**cmd-ts for command routing:**
The cmd-ts library was already installed in the project and provides a type-safe, declarative way to define CLI commands. It handles argument parsing, help generation, and command routing automatically, which reduces boilerplate and ensures consistent behavior. The library's subcommands feature perfectly matches the MVP design where we have three distinct commands (init, publish, install).

**Centralized error handling:**
By catching errors in the main function and mapping CLIError exit codes to process exit codes, we ensure consistent error reporting across all commands. This approach keeps command implementations focused on business logic while the entry point handles cross-cutting concerns like error formatting and exit code management.

**No arguments for commands:**
The simplified command signatures align with the local-first philosophy where all operations work on the current directory. The install command no longer needs a spec reference because it resolves the complete closure from the project index. This makes the CLI more intuitive and reduces cognitive load for users.

**Integration tests for CLI:**
The tests spawn actual CLI processes rather than importing and calling functions directly. This approach tests the complete integration including argument parsing, command routing, and error handling. It ensures the CLI works as users will actually invoke it from the command line.

## Requirements Addressed

- Requirement 7.1: CLI provides init, publish, and install commands
- Requirement 7.2: Commands operate on current directory
- Requirement 7.3: Error messages output to stderr
- Requirement 7.4: Exit codes map to error types (0=success, 1=validation, 2=IO, 3=dependency)
- Requirement 7.5: Help text available for all commands
- Requirement 7.6: Unknown commands show help
- Requirement 7.7: Errors include descriptive messages

## Code Changes

**Modified files:**

- `packages/cli/src/cli.ts` - Complete rewrite with cmd-ts implementation

**Created files:**

- `packages/cli/src/cli.test.ts` - Comprehensive CLI tests

**Deleted files:**

- `packages/cli/src/index.test.ts` - Replaced with cli.test.ts

## Test Results

All 90 tests pass:

- 15 tests in errors.test.ts
- 7 tests in init.test.ts
- 35 tests in utils.test.ts
- 13 tests in publish.test.ts
- 11 tests in install.test.ts
- 9 tests in cli.test.ts (new)

## Challenges & Considerations

**cmd-ts help behavior:**
cmd-ts outputs help to stdout and exits with code 1 when no command is provided or when an unknown command is used. This is standard CLI behavior but required adjusting test expectations to check both stdout and stderr for error scenarios.

**Exit code mapping:**
The publish command returns exit code 2 (IO_ERROR) when spectrl.json doesn't exist, rather than 1 (VALIDATION_ERROR). This is correct behavior since the file not existing is an I/O issue, not a validation issue. Tests were updated to reflect this.

**Process spawning in tests:**
Using `spawn()` to test the CLI provides true integration testing but adds complexity. The helper function `runCLI()` encapsulates this complexity and makes tests readable while ensuring we test the actual user experience.
