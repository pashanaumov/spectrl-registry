# Implementation Plan: spectrl uninstall

## Overview

Implement the `spectrl uninstall` command by creating the core logic functions first, wiring them into a command handler, registering the CLI subcommand, and adding tests. Each task builds incrementally on the previous one.

## Tasks

- [ ] 1. Create uninstall module with core helper functions
  - [ ] 1.1 Create `packages/cli/src/commands/uninstall/index.ts` with `findMatchingKeys` and `findDependents` functions
    - `findMatchingKeys(index: Index, parsed: ParsedSpecRef): string[]` — returns all index keys matching the parsed spec ref (exact match with version, prefix match without version)
    - `findDependents(lockEntries: LockEntry[], keysToRemove: string[]): string[]` — returns keys of specs whose `deps` include any of the keys being removed
    - Export both functions for testing
    - _Requirements: 1.3, 5.1_

  - [ ]\* 1.2 Write property tests for `findMatchingKeys`
    - **Property 1: Version-less reference matches all versions**
    - **Validates: Requirements 1.3**

  - [ ]\* 1.3 Write property tests for `findDependents`
    - **Property 7: Dependents correctly identified**
    - **Validates: Requirements 5.1**

- [ ] 2. Implement the main `uninstall` function
  - [ ] 2.1 Implement the `uninstall(specRef: string, options: { cwd: string }): Promise<void>` function
    - Parse spec reference using `parseSpecRef`
    - Read and validate project index with `IndexSchema.safeParse`
    - Find matching keys using `findMatchingKeys`
    - Check for dependents using `findDependents` on lock file entries
    - Prompt for confirmation in interactive mode when dependents exist, warn in non-interactive mode
    - Remove matching entries from index and write updated index to disk
    - Remove spec directories/symlinks using `removeExistingPath`
    - Update lock file: remove matching entries, write back with `LockFileSchema` validation
    - Display success message with ora spinner
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [ ]\* 2.2 Write property tests for index removal
    - **Property 2: Removal removes key from index and result is valid**
    - **Property 3: Not-found spec produces error**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]\* 2.3 Write property tests for lock file update
    - **Property 6: Lock file entry removed, remaining entries preserved**
    - **Validates: Requirements 4.1, 4.3**

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Register CLI subcommand and integrate
  - [ ] 4.1 Register `uninstall` subcommand in `packages/cli/src/cli.ts`
    - Add import for `uninstall` from `./commands/uninstall/index.js`
    - Create `uninstallCmd` using `cmd-ts` `command()` with positional `specRef` argument
    - Add `uninstall: uninstallCmd` to the `cmds` object in `subcommands()`
    - Export `uninstall` from `packages/cli/src/commands/index.ts`
    - _Requirements: 7.1, 7.2_

  - [ ]\* 4.2 Write unit tests for the uninstall command
    - Test malformed spec reference error (Req 1.2)
    - Test uninitialized project error (Req 2.3)
    - Test spec not found error (Req 2.2)
    - Test successful removal of a single spec (Req 2.1, 3.1, 4.1, 6.1)
    - Test removal of all versions when no version specified (Req 1.3, 6.2)
    - Test idempotent cleanup when spec directory missing (Req 3.4)
    - Test skip lock file update when lock file missing (Req 4.2)
    - Test dependency warning and user cancellation (Req 5.2, 5.4)
    - _Requirements: 1.2, 2.2, 2.3, 3.4, 4.2, 5.2, 5.4, 6.3_

- [ ] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations
- The `removeExistingPath` function is already exported from the install module and handles both symlinks and directories
- All disk reads of index and lock files use Zod `safeParse` — no type casting
