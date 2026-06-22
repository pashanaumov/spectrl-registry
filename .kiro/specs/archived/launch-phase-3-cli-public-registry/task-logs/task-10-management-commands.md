# Task 10: Implement Management Commands

## What Was Implemented

Implemented two new management commands for the Spectrl CLI: `unpublish` and `update`. These commands allow users to manage their published specs on the public registry.

### Subtasks Completed

#### 10.1: Implement unpublish command

- Created `packages/cli/src/commands/unpublish.ts`
- Added `unpublishSpec` function to `packages/cli/src/utils/api-client.ts` with Zod validation
- Integrated with existing `TokenManager` for authentication
- Used `@inquirer/prompts` for confirmation dialog
- Registered command in CLI entry point (`packages/cli/src/cli.ts`)

#### 10.2: Implement update command

- Created `packages/cli/src/commands/update.ts`
- Installed dependencies: `semver`, `cli-table3`, `date-fns`
- Implemented version comparison using semver
- Added support for updating single spec or all specs with `--all` flag
- Integrated with existing `installFromPublic` function for actual updates
- Registered command in CLI entry point

#### 10.3: Write unit tests for management commands

- Created `packages/cli/src/commands/unpublish.test.ts` with 11 tests
- Created `packages/cli/src/commands/update.test.ts` with 11 tests
- Used MSW (Mock Service Worker) for HTTP mocking following project standards
- All tests passing (22/22)

## Why These Decisions

### API Client with Zod Validation

Following the project's api-validation.md steering rules, all API responses are validated with Zod schemas before use. This ensures:

- Security: Prevents malformed data from causing crashes
- Reliability: Catches API contract changes immediately
- Type Safety: Zod provides both runtime validation and compile-time types

The `UnpublishSpecResponseSchema` was added to validate the DELETE endpoint response.

### Confirmation Flow for Destructive Operations

The unpublish command requires explicit user confirmation because it's a destructive operation that permanently removes a spec version from the registry. This follows best practices for CLI tools (similar to `npm unpublish`, `git push --force`, etc.).

The confirmation uses `@inquirer/prompts` select with:

- Default to "No, cancel" for safety
- Clear warning message with highlighted spec reference
- Two distinct options with descriptions

### Version Comparison with Semver

The update command uses the `semver` library for version comparison because:

- Industry standard used by npm, yarn, and most package managers
- Handles semantic versioning correctly (1.0.1 > 1.0.0, 2.0.0 > 1.9.9)
- Provides reliable `gt()` (greater than) comparison

### Table Formatting with cli-table3

The update command displays available updates in a formatted table using `cli-table3` because:

- Modern, well-maintained library
- Provides clean, readable output
- Consistent with design document specifications
- Used by many popular CLI tools

### Reusing Existing Functions

The update command reuses `installFromPublic` from install.ts rather than duplicating logic. This:

- Maintains DRY principles
- Ensures consistent behavior between install and update
- Leverages existing collision detection and error handling
- Reduces maintenance burden

### Output Helpers

Used the existing `output` object from utils.ts for console output, which only provides `log` and `error` methods. For success and warning messages, used chalk directly:

- `chalk.green()` for success messages
- `chalk.yellow()` for warnings
- `chalk.dim()` for secondary information

This maintains consistency with the existing codebase patterns.

### MSW for HTTP Mocking

Following the api-validation.md steering rules, used MSW (Mock Service Worker) instead of overriding `global.fetch` because:

- Type-safe with full TypeScript support
- Intercepts at network level like real requests
- Clean, declarative API for defining mocks
- Industry standard used by major projects
- Easy to test different scenarios (success, errors, timeouts)

### Test Coverage

Tests cover:

- Input validation (invalid formats, missing version, local vs public specs)
- Authentication checks (not logged in, invalid token, permission denied)
- Confirmation flow (cancel, proceed)
- API errors (404, 500)
- Success cases
- Version comparison logic
- Multiple specs with updates
- Edge cases (no updates available, no public specs)

## Requirements Addressed

- **FR-5**: Management commands for unpublish and update
- **AC-5**: All acceptance criteria for management commands
  - Unpublish removes spec from public registry
  - Update checks for and installs spec updates
  - Output is formatted and readable
  - Proper error handling and user feedback

## Code Changes

### New Files

- `packages/cli/src/commands/unpublish.ts` - Unpublish command implementation
- `packages/cli/src/commands/update.ts` - Update command implementation
- `packages/cli/src/commands/unpublish.test.ts` - Unpublish tests (11 tests)
- `packages/cli/src/commands/update.test.ts` - Update tests (11 tests)

### Modified Files

- `packages/cli/src/utils/api-client.ts` - Added `unpublishSpec` function and `UnpublishSpecResponseSchema`
- `packages/cli/src/cli.ts` - Registered `unpublish` and `update` commands
- `packages/cli/package.json` - Added dependencies: semver, cli-table3, date-fns

## Challenges & Considerations

### Output Helper Methods

Initially used `output.warn()` and `output.success()` which don't exist in the utils.ts output object. Fixed by using chalk directly for colored output, maintaining consistency with existing patterns.

### Inquirer Prompts Mocking

Had to properly mock `@inquirer/prompts` in tests using vi.mock at the module level, then accessing the mocked function with `vi.mocked(select)` in each test. This ensures the mock is properly set up before the module is imported.

### Retry Logic Timeout

The unpublish test for 500 errors was timing out because the API client has retry logic that retries on 5xx errors. Fixed by increasing the test timeout to 10 seconds using Vitest 4 syntax: `it('test name', { timeout: 10000 }, async () => {})`.

### Dynamic Import for Install Function

The update command dynamically imports `installFromPublic` from install.ts to avoid circular dependencies and ensure the function is available when needed. This is a common pattern in Node.js/TypeScript for handling module dependencies.

## Testing Results

All tests passing:

- `unpublish.test.ts`: 11/11 tests passed
- `update.test.ts`: 11/11 tests passed
- Total: 22/22 tests passed

Build successful with no TypeScript errors or warnings.
