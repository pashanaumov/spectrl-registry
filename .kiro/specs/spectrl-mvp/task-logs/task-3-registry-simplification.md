# Task 3: Update Registry Module for Simplified Structure

## What Was Implemented

Updated the registry module to use a simplified directory structure and removed locking mechanisms for a cleaner, more straightforward implementation.

### Subtasks Completed

- 3.1: Updated registry paths from `{name}/versions/{version}/` to `{name}/{version}/`
- 3.2: Removed proper-lockfile dependency and simplified publish/remove methods
- 3.3: Verified manifest storage correctly includes hash field
- 3.4: Updated all unit tests to match new structure (36 tests passing)

## Why These Decisions

**Simplified Path Structure**

The decision to remove the intermediate `versions/` directory was driven by the principle of simplicity. The extra directory level provided no functional benefit since version directories are already uniquely identified by their semver string. The flatter structure makes the registry easier to navigate and understand while maintaining the same isolation guarantees between versions.

The new structure `~/.spectrl/registry/{name}/{version}/` is more intuitive and aligns with common package manager conventions. It reduces path depth and makes manual inspection of the registry more straightforward.

**Removal of Locking**

Removing the proper-lockfile dependency and associated locking logic simplifies the codebase significantly. The MVP doesn't require concurrent write protection since:

1. Each version is immutable once published (enforced by the exists check)
2. Different versions write to isolated directories
3. The filesystem's atomic directory creation provides sufficient guarantees for the MVP use case

This decision reduces complexity, removes an external dependency, and makes the code easier to test and maintain. If concurrent access becomes a concern post-MVP, locking can be reintroduced with a clear understanding of the actual requirements.

**Default Registry Location**

Changed the default registry path from `.spectrl/registry` (project-local) to `~/.spectrl/registry` (machine-wide) to match the design specification. This ensures specs are shared across all projects on the machine, reducing duplication and enabling true reusability of published specs.

## Requirements Addressed

- Requirement 6.1: Registry stores specs under `~/.spectrl/registry/{name}/{version}/`
- Requirement 6.2: Registry stores tracked files under `files/` subdirectory
- Requirement 6.3: Registry stores manifest as `spectrl.json` in version directory
- Requirement 6.4: Registry preserves exact directory structure from manifest
- Requirement 6.5: Registry uses forward slashes in all stored paths
- Requirement 3.6: Simplified publish to direct file writes
- Requirement 3.7: Keep atomic directory creation

## Code Changes

### packages/core/src/registry.ts

- Updated file structure documentation comment
- Changed default rootPath from `.spectrl/registry` to `~/.spectrl/registry`
- Updated `paths.spec()` to return `{root}/{name}/{version}`
- Updated `paths.files()` to return `{root}/{name}/{version}/files`
- Updated `paths.manifest()` to return `{root}/{name}/{version}/spectrl.json`
- Removed `lockfile` import
- Simplified `publish()` method by removing lock acquisition/release
- Simplified `remove()` method by removing lock acquisition/release
- Updated `list()` method to read versions directly from spec directory
- Updated `listVersions()` method to read from spec path instead of versions path

### packages/core/src/registry.test.ts

- Updated all path expectations to remove `/versions/` segment
- Removed "Atomic Operations with Locking" test suite
- Updated test setup to create directories with new structure
- Renamed locking-related tests to focus on functionality
- All 36 tests passing with new structure

## Challenges & Considerations

**Path Migration**

The path structure change required careful updates across multiple methods (`list()`, `listVersions()`, `remove()`) to ensure they all work with the new flatter structure. Each method that previously navigated through a `versions/` directory needed adjustment.

**Test Coverage**

Ensured comprehensive test coverage was maintained while removing locking-related tests. The remaining tests still validate all core functionality: path construction, existence checks, manifest reading, publishing, and removal operations.

**Backward Compatibility**

This change is not backward compatible with any existing registries using the old structure. Since this is MVP development and no production registries exist yet, this is acceptable. Future migrations would need a tool to restructure existing registries.

## Verification

- All 36 unit tests passing
- No TypeScript diagnostics or errors
- Registry operations work correctly with new path structure
- Manifest storage includes hash field as expected
