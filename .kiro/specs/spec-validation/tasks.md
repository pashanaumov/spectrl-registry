# Implementation Plan: spec-validation

## Overview

Implement a shared validation module in `@spectrl/core`, a new `spectrl validate` CLI command, and integrate validation into the existing `spectrl publish` command. Tasks are ordered so that core logic is built and tested first, then CLI integration follows.

## Tasks

- [ ] 1. Create validation types and pure check functions in @spectrl/core
  - [ ] 1.1 Create `packages/core/src/validation.ts` with `ValidationIssue`, `ValidationResult`, `IssueSeverity` types and `hasErrors` helper
    - Export types and helper from `packages/core/src/index.ts`
    - _Requirements: 1.1, 1.4_

  - [ ] 1.2 Implement pure check functions: `checkNameConvention`, `checkSemverVersion`, `checkDescriptionPresence`, `checkDependencies`, `checkSelfDependency`, `checkAgentCompleteness`
    - All functions take only the data they need and return `ValidationIssue[]`
    - `checkNameConvention`: error if name doesn't match `/^[a-z0-9-]+$/`
    - `checkSemverVersion`: error if version doesn't match `/^\d+\.\d+\.\d+$/`
    - `checkDescriptionPresence`: warning if undefined or empty string
    - `checkDependencies`: error for each dep with invalid name or version
    - `checkSelfDependency`: error if spec name is a key in deps
    - `checkAgentCompleteness`: warning if agent present with empty purpose
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 7.3, 8.1, 8.2, 9.1, 9.2, 9.3_

  - [ ]\* 1.3 Write property tests for pure check functions
    - **Property 4: Name convention check accuracy**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 5: Semver version check accuracy**
    - **Validates: Requirements 5.1, 5.2**
    - **Property 6: Description warning accuracy**
    - **Validates: Requirements 6.1, 6.2**
    - **Property 7: Dependency validation accuracy**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - **Property 8: Self-dependency detection accuracy**
    - **Validates: Requirements 8.1, 8.2**
    - **Property 9: Agent completeness warning accuracy**
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [ ] 2. Implement filesystem check functions
  - [ ] 2.1 Implement `checkEmptyFiles` in `packages/core/src/validation.ts`
    - Stat each file, report error if size is 0
    - Catch I/O errors and report as error issues
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Implement `checkOrphanedFiles` in `packages/core/src/validation.ts`
    - Read top-level directory entries, exclude spectrl.json, dotfiles, node_modules, dist, .git
    - Report warning for each non-excluded file not in manifest files array
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]\* 2.3 Write property tests for filesystem check functions
    - **Property 2: Empty file detection accuracy**
    - **Validates: Requirements 2.1, 2.2**
    - **Property 3: Orphaned file detection accuracy**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - Use temp directories with generated file sets

- [ ] 3. Implement the validateSpec orchestrator
  - [ ] 3.1 Implement `validateSpec(cwd: string): Promise<ValidationResult>` in `packages/core/src/validation.ts`
    - Read spectrl.json with `readJsonFile`, catch errors as issues
    - Parse with `ManifestSchema.safeParse()`, convert Zod errors to issues
    - If manifest parsed: run `validateFilePaths` and `validateFilesExist` wrapped in try/catch
    - Run all new check functions, concatenate issues
    - Return combined ValidationResult
    - Export from `packages/core/src/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ]\* 3.2 Write property test for issue collection
    - **Property 1: All issues collected**
    - **Validates: Requirements 1.2, 1.3**
    - Create temp directories with multiple known problems, verify all are reported

- [ ] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create the spectrl validate CLI command
  - [ ] 5.1 Create `packages/cli/src/commands/validate/index.ts`
    - Import `validateSpec` and `hasErrors` from `@spectrl/core`
    - Display each issue with severity prefix using `formatError`/`formatWarning`
    - Print summary line with error/warning counts
    - Print success message if no issues
    - Exit with `ExitCode.VALIDATION_ERROR` if errors, `ExitCode.SUCCESS` otherwise
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 5.2 Register the validate command in `packages/cli/src/cli.ts`
    - Add `validateCmd` using `cmd-ts` command definition with no arguments
    - Add to the `cmds` object in the `subcommands` call
    - Export from `packages/cli/src/commands/index.ts`
    - _Requirements: 10.1_

  - [ ]\* 5.3 Write property tests for validate command behavior
    - **Property 10: Validate command exit code**
    - **Validates: Requirements 10.2, 10.3, 10.4**
    - **Property 11: Validate command displays all issues**
    - **Validates: Requirements 10.5**

- [ ] 6. Integrate validation into the publish command
  - [ ] 6.1 Refactor `packages/cli/src/commands/publish/index.ts`
    - Replace the three separate validation calls with `validateSpec(cwd)`
    - If `hasErrors(result)`: display all issues and throw `CLIError` with `ExitCode.VALIDATION_ERROR`
    - If only warnings: display warnings and continue
    - Call `readAndValidateManifest(cwd)` after validation passes to get typed Manifest for publish flow
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]\* 6.2 Write property test for publish abort behavior
    - **Property 12: Publish aborts on validation errors**
    - **Validates: Requirements 11.2, 11.3**

- [ ] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
