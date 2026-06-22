# Implementation Plan: Implicit Initialization During Install

## Overview

Extract core initialization logic into a shared `ensureInitialized` function, then replace the "not initialized" error in install commands with a call to this function. The `init` command retains its explicit behavior.

## Tasks

- [x] 1. Create `ensureInitialized` shared function in init module
  - [x] 1.1 Add `ensureInitialized` function to `packages/cli/src/commands/init/index.ts`
    - Accept `cwd` and options `{ skipAgents?: boolean; spinner?: Ora }`
    - Check if `.spectrl/spectrl-index.json` exists; if yes, return `{ wasInitialized: false }`
    - If not, create `.spectrl` directory, empty index, configure `.gitignore`, handle AGENTS.md
    - Display initialization message via spinner before creating project context
    - Display confirmation message after initialization completes
    - For non-interactive terminals (`!process.stdin.isTTY`), skip AGENTS.md prompts (use `skipAgents: true`)
    - Clean up `.spectrl` directory on failure or user cancellation
    - Export the function for use by install
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 3.1, 3.2, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Write unit tests for `ensureInitialized`
    - Test: creates `.spectrl` directory and index when not present, returns `wasInitialized: true`
    - Test: returns `wasInitialized: false` when already initialized, does not modify existing index
    - Test: skips AGENTS.md prompts in non-interactive mode
    - Test: handles AGENTS.md with existing marker (no modification)
    - _Requirements: 1.1, 1.2, 1.3, 5.3, 5.4_

  - [x] 1.3 Write property tests for `ensureInitialized`
    - **Property 1: Auto-initialization creates valid project context**
    - **Validates: Requirements 1.1, 1.3, 2.1**
    - **Property 2: Auto-initialization is idempotent for existing projects**
    - **Validates: Requirements 1.2, 2.2**
    - **Property 3: AGENTS.md with existing marker is preserved during auto-init**
    - **Validates: Requirements 5.3**

- [x] 2. Replace initialization error in install commands with auto-init
  - [x] 2.1 Update `installSingleSpec` in `packages/cli/src/commands/install/index.ts`
    - Replace the `CLIError` throw for missing project index with a call to `ensureInitialized`
    - Pass the existing spinner to `ensureInitialized`
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Update `install` (no-args) in `packages/cli/src/commands/install/index.ts`
    - Replace the `CLIError` throw for missing project index with a call to `ensureInitialized`
    - Pass the existing spinner to `ensureInitialized`
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Update `installFromPublic` in `packages/cli/src/commands/install/index.ts`
    - Replace the `CLIError` throw for missing project index with a call to `ensureInitialized`
    - Pass the existing spinner to `ensureInitialized`
    - _Requirements: 1.1, 1.2_

  - [x] 2.4 Update install unit tests
    - Remove or update tests that expect "not initialized" errors from install
    - Add test: install auto-initializes when `.spectrl` doesn't exist
    - Add test: install proceeds directly when `.spectrl` exists
    - Verify both `install()` and `installSingleSpec()` paths
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Verify `init` command retains explicit behavior
  - [x] 4.1 Confirm `init` command still errors when already initialized
    - Verify `assertFileNotExists` check is still in place in `init` function
    - No code changes expected; this is a verification step
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Update init tests if needed
    - Ensure existing init tests still pass
    - Add regression test if `init` on already-initialized project still errors
    - _Requirements: 4.1, 4.2_

- [x] 5. Update E2E tests for new install behavior
  - [x] 5.1 Update E2E tests to cover auto-initialization during install
    - Add test: `spectrl install <spec>` without prior init succeeds and creates `.spectrl`
    - Add test: `spectrl install` (no args) without prior init initializes then reports empty index
    - Update any existing tests that assume install requires prior init
    - _Requirements: 1.1, 2.1, 3.1, 3.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
