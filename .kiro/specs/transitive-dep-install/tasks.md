# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Transitive Deps Not Installed
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: a manifest with `deps: { "shared-errors": "1.0.0" }` installed via `installFromPublic` or `installSingleSpec`
  - Write an integration test that installs a spec whose manifest declares `deps: { "shared-errors": "1.0.0" }` and asserts that `shared-errors@1.0.0` exists in `.spectrl/specs/`, `spectrl-index.json`, and `catalog.md`
  - Also test a two-level transitive chain: root → dep-A → dep-B; assert all three are installed
  - The test assertions match Property 1 from design: `allDepsInstalledInProject`, `allDepsInIndex`, `allDepsInCatalog`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "only root spec dir exists; dep dirs absent; index contains only root key")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - No-Dep Specs Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: installing a spec with `deps: {}` on unfixed code produces specific files, index entries, and catalog entries
  - Observe: re-installing an already-installed spec is a no-op on unfixed code
  - Write property-based tests (using `fast-check`) that generate random no-dep manifests and assert install output is identical before and after the fix
  - Also write unit tests: no-dep spec install produces same files/index/catalog; already-installed spec is still a no-op; malformed dep manifest causes `CLIError(VALIDATION_ERROR)`; missing dep causes `CLIError(DEPENDENCY_ERROR)`
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix transitive dependency installation
  - [x] 3.1 Add `installTransitiveDeps` BFS helper to CLI install command
    - Add new function `installTransitiveDeps(manifest, options)` in `packages/cli/src/commands/install/index.ts`
    - Implement BFS queue seeded from `manifest.deps` entries
    - Track visited set keyed by `name@version` to skip already-processed deps
    - Check if dep is already installed at correct version — skip if so (idempotency)
    - Check local registry first (`~/.spectrl/registry/{name}/{version}/`); fall back to public registry
    - Validate every fetched dep manifest with `ManifestSchema.safeParse()` before writing any files
    - Feed BFS queue from each installed dep's own `manifest.deps`
    - Throw `CLIError` with `ExitCode.DEPENDENCY_ERROR` if a dep cannot be found in either registry
    - _Bug_Condition: `isBugCondition(manifest)` where `Object.keys(manifest.deps).length > 0 AND NOT allDepsInstalledInProject(manifest.deps)`_
    - _Expected_Behavior: after install, every spec in the transitive `deps` graph is present in `.spectrl/specs/`, `spectrl-index.json`, and `catalog.md`_
    - _Preservation: specs with `deps: {}` must produce no extra work; already-installed deps must be skipped; Zod validation must run on every manifest_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4_

  - [x] 3.2 Wire `installTransitiveDeps` into `installFromPublic`
    - After the root spec is written and the index is updated in `installFromPublic`, call `installTransitiveDeps(manifest, { cwd })`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Wire `installTransitiveDeps` into `installSingleSpec`
    - After the root spec is symlinked and the index is updated in `installSingleSpec`, call `installTransitiveDeps(manifest, { cwd, registry })`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Add `deps` field to `SpecVersionSchema` in web app
    - In `apps/spectrl-web/src/lib/schemas.ts`, add `deps: z.record(z.string(), z.string()).optional()` to `SpecVersionSchema`
    - _Requirements: 3.1_

  - [x] 3.5 Render Dependencies section in `SpecDetail` component
    - In `apps/spectrl-web/src/components/specs/spec-detail.tsx`, add a "Dependencies" section below the install command block
    - Render only when `currentVersion.deps` is a non-empty object
    - Each dep name links to `/specs?q={encodeURIComponent(depName)}`; version shown as `@{depVersion}`
    - _Requirements: 2.1, 3.1_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Transitive Deps Not Installed
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the full transitive closure is installed
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - No-Dep Specs Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Write unit and component tests
  - [x] 4.1 Unit tests for `installTransitiveDeps`
    - Test single-level dep graph (one dep installed correctly)
    - Test two-level transitive chain (root → dep-A → dep-B; all three installed)
    - Test idempotency: already-installed dep is skipped without error
    - Test `CLIError(DEPENDENCY_ERROR)` thrown when dep not found in either registry
    - Test Zod validation runs on each dep manifest before writing files (malformed manifest → `CLIError(VALIDATION_ERROR)`)
    - _Requirements: 2.1, 2.2, 2.5, 3.3, 3.4_

  - [x] 4.2 Schema tests for `deps` field in `SpecVersionSchema`
    - Test `SpecVersionSchema` accepts a version object with `deps: { "foo": "1.0.0" }`
    - Test `SpecVersionSchema` accepts a version object without `deps` (field is optional)
    - Test `SpecVersionSchema` rejects a version object with `deps` containing non-string values
    - _Requirements: 3.1_

  - [x] 4.3 Component tests for Dependencies section in `SpecDetail`
    - Test: when `currentVersion.deps` is `{ "shared-errors": "1.0.0" }`, rendered output contains "Dependencies", "shared-errors", and "@1.0.0"
    - Test: when `currentVersion.deps` is `{}`, no "Dependencies" heading is rendered
    - Test: when `currentVersion.deps` is absent (`undefined`), no "Dependencies" heading is rendered
    - Test: each dep name links to `/specs?q={depName}` (search URL, not direct spec URL)
    - _Requirements: 2.1, 3.1_

- [x] 5. Add e2e test for transitive dependency installation
  - Add a new test case to `tests/e2e/install.test.ts` following the existing patterns in that file
  - Test: `spectrl install <name>` where the spec declares multiple deps — assert all transitive deps are symlinked in `.spectrl/specs/`, present in `spectrl-index.json`, and listed in `catalog.md`
  - Test: three-level transitive chain (root → mid → leaf) — assert all three are installed after a single `spectrl install root`
  - Test: spec with two direct deps each having their own dep (diamond pattern) — assert the shared dep is installed exactly once
  - Use `createSpec`, `publish`, `install`, `exists`, `readJSON`, `readText` helpers from `tests/e2e/utils/index.js` (same as existing tests)
  - Use `createTempDir` + `afterEach` cleanup pattern consistent with the rest of the file
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Run `pnpm test` across all packages and verify no failures
  - Run `pnpm test:e2e` to verify end-to-end install flow with transitive deps
  - Ensure all tests pass; ask the user if questions arise
