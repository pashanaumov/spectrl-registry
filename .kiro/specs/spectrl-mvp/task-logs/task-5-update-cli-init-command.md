# Task 5: Update CLI init Command

## What Was Implemented

Updated the `spectrl init` command to initialize a project-level index instead of creating individual spec manifests. The command now creates a `.spectrl/` directory with an empty `spectrl-index.json` file.

### Subtasks Completed

- 5.1: Changed init to create project index
- 5.2: Updated unit tests for init

## Why These Decisions

The shift from creating `spectrl.json` (spec manifest) to creating `.spectrl/spectrl-index.json` (project index) reflects the architectural change in Spectrl's design. The init command now initializes a project-level registry rather than individual specs, which aligns with the local-first registry approach where projects maintain their own index of installed specs.

This separation makes the distinction clear:

- `spectrl init` - Initialize a project with a local registry (done once per project)
- Individual spec manifests (`spectrl.json`) - Created manually or through other commands for each spec

The implementation follows the existing patterns in the codebase:

- Added helper functions `getProjectIndexPath()` and `getProjectDir()` to `utils.ts` for consistency with other path helpers
- Used the `Index` type from `@spectrl/schema` to ensure type safety
- Maintained the same JSON formatting (2-space indentation, trailing newline) as the previous implementation
- Kept the same error handling approach with `assertFileNotExists` for consistency

## Requirements Addressed

- Requirement 1.1: System initialization with project directory
- Requirement 1.2: Create project index file
- Requirement 1.3: Validate index doesn't already exist
- Requirement 1.4: Proper directory structure creation
- Requirement 1.5: User feedback on successful initialization

## Code Changes

### packages/cli/src/utils.ts

- Added `getProjectIndexPath()` function to get path to `.spectrl/spectrl-index.json`
- Added `getProjectDir()` function to get path to `.spectrl/` directory

### packages/cli/src/commands/init.ts

- Changed from creating `spectrl.json` to creating `.spectrl/spectrl-index.json`
- Added directory creation with `mkdir()` for `.spectrl/` directory
- Updated imports to use `Index` type from `@spectrl/schema` instead of `Manifest`
- Updated success message to reflect new behavior
- Removed manifest-related logic (name from directory basename, version, deps, files)

### packages/cli/src/commands/init.test.ts

- Updated all tests to check for `.spectrl/spectrl-index.json` instead of `spectrl.json`
- Added test for `.spectrl/` directory creation
- Updated test to verify empty object `{}` is created in index file
- Updated error handling tests to check for correct file path in error messages
- Removed tests related to manifest fields (name, version, deps, files)

## Challenges & Considerations

The implementation was straightforward since it followed existing patterns. The main consideration was ensuring backward compatibility wasn't needed - this is a breaking change from the previous init behavior, but that's intentional as part of the architectural refactor.

All 7 unit tests pass, and the full CLI test suite (68 tests) passes without any regressions.
