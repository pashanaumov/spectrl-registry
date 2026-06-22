# Bugfix Requirements Document

## Introduction

`spectrl install` only installs the top-level spec and ignores any dependencies declared in its `spectrl.jsonc` manifest. This means transitive specs are never fetched, never written to `.spectrl/specs/`, and never reflected in `.spectrl/catalog.md` or `spectrl-index.json` — breaking the composability promise of the product.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a spec's manifest declares one or more entries in its `deps` field THEN the system installs only the top-level spec and does not install any declared dependencies
1.2 WHEN a dependency spec exists in the local registry at `~/.spectrl/registry/{name}/{version}/` THEN the system does not copy it into the project's `.spectrl/specs/` directory
1.3 WHEN `spectrl install` completes for a spec with dependencies THEN the system does not add the dependency entries to `.spectrl/catalog.md`
1.4 WHEN `spectrl install` completes for a spec with dependencies THEN the system does not add the dependency entries to `spectrl-index.json`

### Expected Behavior (Correct)

2.1 WHEN a spec's manifest declares one or more entries in its `deps` field THEN the system SHALL recursively resolve and install each declared dependency
2.2 WHEN a dependency spec exists in the local registry THEN the system SHALL copy it into the project's `.spectrl/specs/{name}@{version}/` directory
2.3 WHEN `spectrl install` completes for a spec with dependencies THEN the system SHALL add all resolved dependency entries to `.spectrl/catalog.md`
2.4 WHEN `spectrl install` completes for a spec with dependencies THEN the system SHALL add all resolved dependency entries to `spectrl-index.json`
2.5 WHEN a dependency is already installed at the correct version THEN the system SHALL skip reinstalling it and continue without error

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a spec has no `deps` declared in its manifest THEN the system SHALL CONTINUE TO install only that spec as before
3.2 WHEN `spectrl install` is run for a spec that is already installed THEN the system SHALL CONTINUE TO handle the already-installed case without error
3.3 WHEN `spectrl install` resolves a dependency THEN the system SHALL CONTINUE TO validate the dependency manifest with Zod before writing any files
3.4 WHEN a dependency cannot be found in the registry THEN the system SHALL CONTINUE TO surface a clear error message and exit with a non-zero code
