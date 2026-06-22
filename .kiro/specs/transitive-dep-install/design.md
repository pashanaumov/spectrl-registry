# Transitive Dep Install Bugfix Design

## Overview

`spectrl install` installs only the top-level spec and ignores any `deps` declared in its manifest.
This breaks the composability promise: transitive specs are never fetched, never written to
`.spectrl/specs/`, and never reflected in `.spectrl/catalog.md` or `spectrl-index.json`.

The fix adds a BFS walk over every installed manifest's `deps` field — regardless of whether the
manifest came from the local registry or the public registry — until the full transitive closure is
installed. A second, independent change adds a "Dependencies" section to the web UI spec detail
page so users can see what a spec depends on.

## Glossary

- **Bug_Condition (C)**: A spec manifest declares one or more entries in `deps` AND those deps are
  not installed after `spectrl install` completes.
- **Property (P)**: After `spectrl install`, every spec reachable via the transitive `deps` graph
  is present in `.spectrl/specs/`, `.spectrl/catalog.md`, and `spectrl-index.json`.
- **Preservation**: Specs with no `deps`, already-installed specs, and error-handling paths must
  behave exactly as before.
- **BFS queue**: The breadth-first search queue used during install to discover all deps to install.
- **installFromPublic**: The function in `packages/cli/src/commands/install/index.ts` that fetches
  a spec from the public registry and writes it to the project directory.
- **installSingleSpec / install**: The local-registry install paths in the same file.
- **SpecVersionSchema**: The Zod schema in `apps/spectrl-web/src/lib/schemas.ts` that validates
  a single version object returned by the `GET /specs/:username/:name` API.
- **SpecDetail**: The React component in
  `apps/spectrl-web/src/components/specs/spec-detail.tsx` that renders the spec detail page.

## Bug Details

### Fault Condition

The bug manifests in two places:

1. **`installFromPublic`**: After downloading and writing the root spec, the function returns
   without inspecting `manifest.deps`. Any deps declared there are silently ignored.
2. **`installSingleSpec` (local path)**: After installing the root spec via symlink, the function
   returns without inspecting `manifest.deps`.

The BFS walk that exists in `install` (the "install all from index" path) only processes specs
already listed in `spectrl-index.json`. It does not discover new deps from freshly-fetched
manifests and add them to the queue.

**Formal Specification:**

```
FUNCTION isBugCondition(manifest)
  INPUT: manifest of type Manifest
  OUTPUT: boolean

  RETURN Object.keys(manifest.deps).length > 0
         AND NOT allDepsInstalledInProject(manifest.deps)
END FUNCTION
```

### Examples

- Install `alice/api-contract@1.0.0` which declares `deps: { "shared-errors": "1.0.0" }`.
  Expected: both `alice/api-contract@1.0.0` and `shared-errors@1.0.0` appear in
  `.spectrl/specs/`. Actual: only `alice/api-contract@1.0.0` is installed.
- Install local `my-spec@1.0.0` which declares `deps: { "base-types": "2.0.0" }`.
  Expected: both specs are symlinked. Actual: only `my-spec@1.0.0` is symlinked.
- Install `alice/deep@1.0.0` → deps `bob/mid@1.0.0` → deps `shared@1.0.0`.
  Expected: all three installed. Actual: only `alice/deep@1.0.0` installed.
- Install a spec with `deps: {}`. Expected: no change in behavior (no extra work done).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Specs with no `deps` (empty object) must install exactly as before — no extra network calls,
  no extra file writes.
- Already-installed specs at the correct version must be skipped without error (idempotency).
- Zod validation of every manifest (root and transitive) must continue to run before any file
  is written (requirement 3.3).
- When a dep cannot be found in the local registry or public registry, a clear error message
  must be surfaced and the process must exit non-zero (requirement 3.4).
- Collision detection and interactive resolution for the root spec must remain unchanged.

**Scope:**
All inputs that do NOT involve a manifest with non-empty `deps` should be completely unaffected.
This includes:

- `spectrl publish` — no changes.
- `spectrl init` — no changes.
- `spectrl install` with a no-dep spec — identical behavior.
- The `install` (from-index) path — behavior preserved; BFS already exists there but must be
  extended to handle public-sourced manifests' deps.

## Hypothesized Root Cause

1. **`installFromPublic` has no dep-walking loop**: After writing the root spec's files and
   updating the index, the function returns. There is no code to read `manifest.deps` and
   enqueue further installs.

2. **`installSingleSpec` (local path) has no dep-walking loop**: Same issue — after the symlink
   is created and the index is updated, the function returns without inspecting `manifest.deps`.

3. **`install` (from-index) BFS does not feed from fetched manifests**: The resolver reads
   `spectrl-index.json` to build the initial set of nodes. Newly-discovered deps from a
   public-sourced manifest are not added to `spectrl-index.json` before the resolver runs,
   so they are never visited.

4. **No recursive resolution helper exists**: There is no shared utility that takes a manifest,
   reads its `deps`, and recursively installs each one. Both install paths would need to call
   such a helper.

## Correctness Properties

Property 1: Fault Condition - Full Transitive Closure Installed

_For any_ spec (local or public) whose manifest declares one or more `deps`, the fixed install
function SHALL recursively resolve and install every spec in the transitive closure of those deps
— whether each dep lives in the local registry or the public registry — writing each to
`.spectrl/specs/{key}/`, updating `.spectrl/spectrl-index.json`, and updating
`.spectrl/catalog.md`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - No-Dep Specs Unchanged

_For any_ spec whose manifest declares `deps: {}` (empty), the fixed install function SHALL
produce exactly the same observable result as the original function: the same files written,
the same index entries, the same catalog entries, and no additional network calls or file I/O.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 3: Fault Condition - BFS Continues Through Public-Sourced Manifests

_For any_ spec fetched from the public registry whose manifest declares `deps`, the BFS queue
SHALL be fed by that manifest's `deps` entries, and each dep SHALL be resolved and installed
(from local or public registry as appropriate) before the install command exits.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 4: Web UI - Dependencies Section Renders When Deps Present

_For any_ `SpecVersion` object where `deps` is a non-empty record, the `SpecDetail` component
SHALL render a "Dependencies" section listing each dep name and version as a link to
`/specs?q={depName}`.

**Validates: Requirements 3.1 (web schema), 3.3 (component render)**

Property 5: Web UI - Dependencies Section Absent When Deps Empty or Missing

_For any_ `SpecVersion` object where `deps` is absent or an empty record, the `SpecDetail`
component SHALL NOT render a "Dependencies" section.

**Validates: Requirements 3.1 (web schema edge case)**

## Fix Implementation

### Change 1 — CLI: Add recursive BFS dep-walker helper

**File**: `packages/cli/src/commands/install/index.ts`

**New helper**: `installTransitiveDeps(manifest, options)`

```
FUNCTION installTransitiveDeps(manifest, options)
  queue ← entries from manifest.deps  // [{name, version}, ...]
  visited ← Set()

  WHILE queue is not empty DO
    dep ← queue.dequeue()
    key ← dep.name + "@" + dep.version

    IF key IN visited THEN CONTINUE
    visited.add(key)

    IF dep already installed at correct version THEN
      CONTINUE  // idempotent skip
    END IF

    IF dep exists in local registry THEN
      install dep from local registry
      depManifest ← registry.getManifest(dep.name, dep.version)
    ELSE
      install dep from public registry (requires username lookup or index hint)
      depManifest ← downloaded manifest
    END IF

    // Feed BFS from this dep's manifest
    FOR each transitiveDep IN depManifest.deps DO
      queue.enqueue(transitiveDep)
    END FOR
  END WHILE
END FUNCTION
```

**Specific Changes**:

1. After the root spec is installed in `installFromPublic`, call
   `installTransitiveDeps(manifest, { cwd })`.
2. After the root spec is installed in `installSingleSpec` (local path), call
   `installTransitiveDeps(manifest, { cwd, registry })`.
3. The helper must validate every fetched dep manifest with `ManifestSchema.safeParse()` before
   writing any files (per api-validation.md rules).
4. The helper must skip deps already present at the correct version (idempotency).
5. The helper must surface a `CLIError` with `ExitCode.DEPENDENCY_ERROR` if a dep cannot be
   found in either registry.

### Change 2 — Web: Add `deps` field to `SpecVersionSchema`

**File**: `apps/spectrl-web/src/lib/schemas.ts`

Add to `SpecVersionSchema`:

```typescript
deps: z.record(z.string(), z.string()).optional(),
```

This makes `deps` an optional `Record<string, string>` (name → version map), matching the shape
of `Manifest.deps` from `@spectrl/schema`.

### Change 3 — Web: Backend API includes `deps` in version response

**File**: The `GET /specs/:username/:name` API handler (backend, outside this repo's `apps/`
directory but referenced by the web client).

The version object returned by the API must include `deps` when present in the stored manifest.
No client-side change is needed beyond the schema update in Change 2 — the Zod schema will
accept the field once added.

### Change 4 — Web: `SpecDetail` renders Dependencies section

**File**: `apps/spectrl-web/src/components/specs/spec-detail.tsx`

Add a "Dependencies" section below the install command block, rendered only when
`currentVersion.deps` is a non-empty object:

```tsx
{
  currentVersion.deps && Object.keys(currentVersion.deps).length > 0 && (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">Dependencies</h2>
      <ul className="flex flex-col gap-1">
        {Object.entries(currentVersion.deps).map(([depName, depVersion]) => (
          <li key={depName} className="font-mono text-sm text-muted-foreground">
            <Link href={`/specs?q=${encodeURIComponent(depName)}`}>{depName}</Link>
            <span className="ml-1 text-xs">@{depVersion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Note: deps in the manifest are bare names (no username), so the link targets a search query
rather than a direct spec URL.

## Testing Strategy

### Validation Approach

Two-phase approach: first surface counterexamples on unfixed code, then verify the fix and
preservation.

### Exploratory Fault Condition Checking

**Goal**: Demonstrate the bug on unfixed code before implementing the fix.

**Test Plan**: Write integration tests that install a spec whose manifest declares `deps`, then
assert that the dep directories and index entries exist. Run on unfixed code to observe failures.

**Test Cases**:

1. **Public spec with one dep**: Install a public spec with `deps: { "shared-errors": "1.0.0" }`.
   Assert `shared-errors@1.0.0` exists in `.spectrl/specs/` and `spectrl-index.json`.
   (will fail on unfixed code)
2. **Local spec with one dep**: Install a local spec with `deps: { "base-types": "2.0.0" }`.
   Assert `base-types@2.0.0` is symlinked and in the index. (will fail on unfixed code)
3. **Two-level transitive chain**: Install root → dep-A → dep-B. Assert all three are installed.
   (will fail on unfixed code)
4. **Public spec whose dep is also public**: Install a public spec whose dep is another public
   spec. Assert both are installed. (will fail on unfixed code)

**Expected Counterexamples**:

- Only the root spec directory exists; dep directories are absent.
- `spectrl-index.json` contains only the root spec key.
- `catalog.md` lists only the root spec.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function installs
the full transitive closure.

**Pseudocode:**

```
FOR ALL manifest WHERE isBugCondition(manifest) DO
  result := install_fixed(manifest)
  ASSERT allDepsInstalledInProject(manifest.deps, result.projectDir)
  ASSERT allDepsInIndex(manifest.deps, result.index)
  ASSERT allDepsInCatalog(manifest.deps, result.catalog)
END FOR
```

### Preservation Checking

**Goal**: Verify that specs with no deps behave identically before and after the fix.

**Pseudocode:**

```
FOR ALL manifest WHERE NOT isBugCondition(manifest) DO
  ASSERT install_original(manifest) = install_fixed(manifest)
END FOR
```

**Testing Approach**: Property-based testing with `fast-check` is recommended for preservation
checking because it generates many random no-dep manifests and verifies the install output is
identical.

**Test Cases**:

1. **No-dep spec install**: Verify a spec with `deps: {}` produces the same files, index, and
   catalog as before the fix.
2. **Already-installed spec**: Verify re-installing an already-installed spec is still a no-op.
3. **Manifest validation still runs**: Verify that a malformed dep manifest causes a
   `CLIError` with `ExitCode.VALIDATION_ERROR`, not a crash.
4. **Missing dep surfaces error**: Verify that a dep not found in either registry causes a
   `CLIError` with `ExitCode.DEPENDENCY_ERROR`.

### Web UI Test Cases

**Schema tests** (`apps/spectrl-web/src/lib/schemas.test.ts`):

1. `SpecVersionSchema` accepts a version object with `deps: { "foo": "1.0.0" }`.
2. `SpecVersionSchema` accepts a version object without `deps` (field is optional).
3. `SpecVersionSchema` rejects a version object with `deps` containing non-string values.

**Component tests** (`apps/spectrl-web/src/components/specs/spec-detail.test.tsx`):

1. When `currentVersion.deps` is `{ "shared-errors": "1.0.0" }`, the rendered output contains
   "Dependencies", "shared-errors", and "@1.0.0".
2. When `currentVersion.deps` is `{}`, no "Dependencies" heading is rendered.
3. When `currentVersion.deps` is absent (`undefined`), no "Dependencies" heading is rendered.
4. Each dep name links to `/specs?q={depName}` (search URL, not direct spec URL).

### Unit Tests

- Test `installTransitiveDeps` with a single-level dep graph (one dep).
- Test `installTransitiveDeps` with a two-level transitive chain.
- Test `installTransitiveDeps` skips already-installed deps (idempotency).
- Test `installTransitiveDeps` throws `CLIError(DEPENDENCY_ERROR)` for missing deps.
- Test `installTransitiveDeps` validates each dep manifest with Zod before writing files.

### Property-Based Tests

- Generate random dep graphs (using `fast-check`) and verify that after install, every node in
  the graph is present in the project directory and index.
- Generate random no-dep manifests and verify install output is identical to the original
  (preservation property).
- Generate random `SpecVersion` objects with and without `deps` and verify `SpecVersionSchema`
  accepts/rejects correctly.

### Integration Tests

- Full flow: `spectrl install alice/api-contract@1.0.0` where `api-contract` depends on
  `shared-errors@1.0.0`. Verify both are installed end-to-end.
- Full flow: install a three-level chain and verify all levels are installed.
- Full flow: install a spec with no deps and verify behavior is unchanged.
- Web: render `SpecDetail` with a version that has deps and verify the Dependencies section
  appears with correct links.
