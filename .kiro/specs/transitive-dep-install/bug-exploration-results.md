# Bug Condition Exploration Results

## Test Execution Date

Executed on unfixed code: $(date)

## Summary

All 4 bug condition exploration tests **FAILED as expected**, confirming the bug exists in the current implementation.

## Counterexamples Found

### Test 1: Single Transitive Dependency

**Scenario**: Root spec declares `deps: { "shared-errors": "1.0.0" }`

**Expected Behavior**:

- Both `root-spec@1.0.0` and `shared-errors@1.0.0` should be installed
- Both should appear in `.spectrl/specs/`, `spectrl-index.json`, and `catalog.md`

**Actual Behavior (Bug)**:

```
CLIError: Missing dependency: shared-errors@1.0.0. Add it to .spectrl/spectrl-index.json
```

**Root Cause**: The resolver reads `spectrl-index.json` and expects ALL dependencies (including transitive ones) to be manually listed. When it encounters a `deps` entry that's not in the index, it throws a "Missing dependency" error instead of automatically fetching and installing it.

### Test 2: Two-Level Transitive Chain

**Scenario**: `root-spec → dep-a → dep-b`

**Expected Behavior**:

- All three specs should be installed after running `spectrl install`

**Actual Behavior (Bug)**:

```
CLIError: Missing dependency: dep-a@1.0.0. Add it to .spectrl/spectrl-index.json
```

**Root Cause**: Same as Test 1 - the resolver requires `dep-a` to be manually added to the index, and even if it were, `dep-b` would also need to be manually added.

### Test 3: Multiple Direct Dependencies

**Scenario**: Root spec declares `deps: { "dep-1": "1.0.0", "dep-2": "1.0.0", "dep-3": "1.0.0" }`

**Expected Behavior**:

- All four specs (root + 3 deps) should be installed

**Actual Behavior (Bug)**:

```
CLIError: Missing dependency: dep-1@1.0.0. Add it to .spectrl/spectrl-index.json
```

**Root Cause**: Same as Test 1 - each dependency must be manually added to the index.

### Test 4: Diamond Dependency Pattern

**Scenario**:

```
root-spec → dep-a → shared-dep
         → dep-b → shared-dep
```

**Expected Behavior**:

- All four specs should be installed (shared-dep only once)

**Actual Behavior (Bug)**:

```
CLIError: Missing dependency: dep-a@1.0.0. Add it to .spectrl/spectrl-index.json
```

**Root Cause**: Same as Test 1 - dependencies must be manually added to the index.

## Bug Condition Analysis

### Formal Bug Condition C(X)

```
FUNCTION isBugCondition(manifest)
  INPUT: manifest of type Manifest
  OUTPUT: boolean

  RETURN Object.keys(manifest.deps).length > 0
         AND NOT allDepsInstalledInProject(manifest.deps)
END FUNCTION
```

### Current Implementation Behavior

The current `install` function in `packages/cli/src/commands/install/index.ts`:

1. **Reads `spectrl-index.json`**: Uses `Resolver.resolveClosureFromIndex()` to build the dependency graph
2. **Expects complete closure in index**: The resolver throws an error if any `deps` entry is not already in the index
3. **No automatic dep resolution**: There is no code path that:
   - Reads a manifest's `deps` field
   - Looks up those deps in the registry (local or public)
   - Adds them to the install queue
   - Recursively processes their deps

### Why This Breaks Composability

Users must manually add every transitive dependency to `spectrl-index.json` before running `spectrl install`. This defeats the purpose of declaring dependencies in manifests - the system doesn't automatically resolve and install them.

**Example of current broken workflow**:

```bash
# User wants to install a spec with deps
$ spectrl install my-spec@1.0.0

# my-spec declares deps: { "shared-errors": "1.0.0" }
# But install fails:
Error: Missing dependency: shared-errors@1.0.0. Add it to .spectrl/spectrl-index.json

# User must manually add shared-errors to index
$ # ... manually edit spectrl-index.json ...

# Then install again
$ spectrl install

# If shared-errors has its own deps, the process repeats
```

## Validation of Bug Condition

✅ **Confirmed**: The bug exists in the current implementation

✅ **Counterexamples documented**: All 4 test cases demonstrate the bug

✅ **Root cause identified**:

- `installFromPublic` returns immediately after installing root spec (line ~900)
- `installSingleSpec` returns immediately after installing root spec (line ~1100)
- `install` (from-index) only processes specs already in the index (line ~1200)
- No BFS walk over `manifest.deps` exists in any code path

## Next Steps

1. ✅ Task 1 complete: Bug condition exploration tests written and run on unfixed code
2. ⏭️ Task 2: Write preservation property tests (before implementing fix)
3. ⏭️ Task 3: Implement the fix with `installTransitiveDeps` BFS helper
4. ⏭️ Task 4: Verify bug condition tests pass after fix
5. ⏭️ Task 5: Verify preservation tests still pass after fix

## Test File Location

`packages/cli/src/commands/install/transitive-deps.test.ts`

## Notes

The tests are currently failing with `CLIError: Missing dependency` which is actually **earlier** in the execution than expected. This is good - it means the bug is even more fundamental than anticipated. The resolver itself is designed to require all deps in the index, rather than discovering them dynamically.

The fix will need to:

1. Add a BFS helper that walks `manifest.deps` recursively
2. Call this helper after installing the root spec in both `installFromPublic` and `installSingleSpec`
3. Ensure the helper checks both local and public registries for each dep
4. Update the index as each dep is installed
5. Handle idempotency (skip already-installed deps)
