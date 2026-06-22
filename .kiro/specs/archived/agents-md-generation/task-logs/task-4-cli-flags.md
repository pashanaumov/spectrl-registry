# Task 4: Add CLI Flags to Init Command

## What Was Implemented

Added two new CLI flags to the `spectrl init` command:

- `--skip-agents`: Skip AGENTS.md creation/update entirely
- `--force-agents`: Force overwrite AGENTS.md with fresh template

### Changes Made

1. **Updated `packages/cli/src/cli.ts`**:
   - Added `flag` to the imports from `cmd-ts`
   - Added `skipAgents` and `forceAgents` flags to the init command args
   - Updated the handler to pass these flags to the init function via an options object

2. **Updated `packages/cli/src/commands/init.ts`**:
   - Created `InitOptions` interface with optional `skipAgents` and `forceAgents` boolean properties
   - Modified the `init` function signature to accept an optional `options` parameter with default value `{}`

## Why These Decisions

The implementation follows the existing patterns in the codebase:

- Used `flag` from `cmd-ts` which is already used for other boolean flags in the project
- Followed the same pattern as other commands that accept options (like the `new` command with its version and description options)
- Made the options parameter optional with a default empty object to maintain backward compatibility
- Used descriptive flag names with kebab-case (`--skip-agents`, `--force-agents`) consistent with CLI conventions

The `InitOptions` interface was defined in the init command file rather than a separate types file because:

- It's only used by the init command
- It's a simple interface with just two optional boolean properties
- This follows the pattern of keeping related types close to their usage
- It matches the design document specification

## Requirements Addressed

- **Requirement 8.1**: THE CLI SHALL accept a `--force-agents` flag for `spectrl init`
- **Requirement 9.1**: THE CLI SHALL accept a `--skip-agents` flag for `spectrl init`

## Code Changes

### packages/cli/src/cli.ts

- Added `flag` to imports
- Added `skipAgents` and `forceAgents` flags to init command args
- Updated handler to pass flags to init function

### packages/cli/src/commands/init.ts

- Added `InitOptions` interface
- Updated `init` function signature to accept optional options parameter

## Tests Added

Added unit tests to `packages/cli/src/commands/init.test.ts` to verify the new options parameter:

- Test that empty options object is accepted
- Test that `skipAgents` option is accepted
- Test that `forceAgents` option is accepted
- Test that both options can be passed together

All tests pass successfully (11/11 tests passing).

## Verification

- TypeScript compilation successful with no diagnostics
- Build completed successfully
- All unit tests pass (11/11)
- No breaking changes to existing functionality (options parameter is optional with default value)

## Next Steps

The next task (Task 5) will integrate the AGENTS.md logic into the init command, using these flags to control the behavior. Task 9 will add comprehensive integration tests for the full AGENTS.md workflow including flag behavior.
