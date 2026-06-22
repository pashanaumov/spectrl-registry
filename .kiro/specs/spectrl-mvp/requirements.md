# Requirements Document

## Introduction

Spectrl is a local-first spec registry that treats structured documents (PRDs, TDDs, ADRs) as versioned, installable artifacts. The MVP delivers core reproducibility: a CLI and local registry enabling deterministic initialization, publishing, and installation of specs with transitive dependencies without requiring backend infrastructure.

## Glossary

- **CLI**: The command-line interface binary (`spectrl`) that users invoke to interact with the system
- **Registry**: The machine-wide file-based storage at `~/.spectrl/registry` containing published spec versions
- **Manifest**: A `spectrl.json` file containing metadata (name, version, dependencies, tracked files)
- **Spec**: A versioned artifact consisting of a manifest and its tracked files
- **Project Index**: A `.spectrl/spectrl-index.json` file mapping spec references (name@version) to source locations
- **Lock File**: A `.spectrl/lock.json` file containing pinned dependency closure with hashes
- **Tracked Files**: Files declared in the manifest's `files` array that are included when publishing
- **Hash**: A SHA-256 hex hash in format `sha256:<hex>` derived from canonicalized manifest and file contents
- **Dependency**: Another spec referenced in the manifest's `deps` object with an exact version
- **Transitive Dependency**: A dependency of a dependency, resolved recursively to form a complete closure

## Requirements

### Requirement 1: Project Initialization

**User Story:** As a developer, I want to initialize a project index, so that I can declare which specs my project depends on.

#### Acceptance Criteria

1. WHEN the user runs `spectrl init`, THE CLI SHALL create a `.spectrl/spectrl-index.json` file
2. THE CLI SHALL populate the index with an empty specs object
3. IF a `.spectrl/spectrl-index.json` file already exists, THEN THE CLI SHALL exit with code 1
4. WHEN initialization succeeds, THE CLI SHALL exit with code 0
5. WHEN initialization fails, THE CLI SHALL output an error message to stderr

### Requirement 2: Manifest Validation

**User Story:** As a developer, I want my manifest to be validated against a schema, so that I catch errors before publishing.

#### Acceptance Criteria

1. THE CLI SHALL validate all manifests using Zod schemas before any operation
2. THE Manifest SHALL contain a string field named "name" matching pattern `^[a-z0-9-]+$`
3. THE Manifest SHALL contain a semver-compliant string field named "version" matching pattern `^\d+\.\d+\.\d+$`
4. THE Manifest SHALL contain an object field named "deps" mapping spec names to exact version strings
5. THE Manifest SHALL contain an array field named "files" with at least one relative file path
6. THE Manifest MAY contain an optional string field named "hash" matching pattern `^sha256:[a-f0-9]{64}$`
7. IF validation fails, THEN THE CLI SHALL exit with code 1
8. IF validation fails, THEN THE CLI SHALL output validation errors to stderr

### Requirement 3: Spec Publishing

**User Story:** As a developer, I want to publish my spec to the local registry, so that it can be installed and reused.

#### Acceptance Criteria

1. WHEN the user runs `spectrl publish`, THE CLI SHALL validate the manifest in the current directory
2. WHEN validation succeeds, THE CLI SHALL compute a SHA-256 hash over canonicalized manifest and normalized file contents
3. THE CLI SHALL sort file paths lexicographically before hashing
4. THE CLI SHALL normalize file content to use `\n` newlines before hashing
5. THE CLI SHALL canonicalize the manifest JSON with sorted keys and no whitespace before hashing
6. THE CLI SHALL copy tracked files to `~/.spectrl/registry/{name}/{version}/files/` preserving directory structure
7. THE CLI SHALL write the manifest as `spectrl.json` to `~/.spectrl/registry/{name}/{version}/`
8. THE CLI SHALL normalize all file paths to use forward slashes
9. IF any tracked file path contains `..`, THEN THE CLI SHALL exit with code 1
10. IF any tracked file is missing, THEN THE CLI SHALL exit with code 2
11. WHEN publishing succeeds, THE CLI SHALL exit with code 0
12. THE CLI SHALL not modify the project index during publish

### Requirement 4: Spec Installation with Transitive Dependencies

**User Story:** As a developer, I want to install specs with their full dependency closure, so that all transitive dependencies are resolved and verified.

#### Acceptance Criteria

1. WHEN the user runs `spectrl install`, THE CLI SHALL read `.spectrl/spectrl-index.json` from the current directory
2. THE CLI SHALL resolve the complete dependency closure from all specs listed in the index
3. THE CLI SHALL use breadth-first traversal with lexicographic sorting of dependencies
4. THE CLI SHALL verify each dependency exists in the project index
5. IF a transitive dependency is missing from the index, THEN THE CLI SHALL exit with code 3 with message "Missing dependency: {name}@{version}. Add it to .spectrl/spectrl-index.json"
6. THE CLI SHALL compute SHA-256 hashes for each spec in the closure
7. THE CLI SHALL materialize each spec to `~/.spectrl/registry/{name}/{version}/` if not already present
8. THE CLI SHALL write `.spectrl/lock.json` with all resolved entries including name, version, hash, source, and deps
9. THE CLI SHALL preserve the directory structure of all installed files
10. WHEN installation succeeds, THE CLI SHALL exit with code 0
11. IF `.spectrl/lock.json` exists, THE CLI SHALL verify hashes match for existing entries
12. IF a hash mismatch occurs, THEN THE CLI SHALL exit with code 2 with message "Integrity breach: hash mismatch for {name}@{version}"

### Requirement 5: Project Index Format

**User Story:** As a developer, I want a simple index format that explicitly lists all specs and their sources, so that dependency resolution is transparent.

#### Acceptance Criteria

1. THE Project Index SHALL be a JSON object mapping spec references to source objects
2. THE Project Index SHALL use keys in format `{name}@{version}` matching pattern `^[a-z0-9-]+@\d+\.\d+\.\d+$`
3. THE Project Index SHALL map each key to an object with a "source" field containing a URL
4. THE Project Index SHALL use `file:` URLs for source locations in MVP
5. THE Project Index SHALL be located at `.spectrl/spectrl-index.json` in the project root
6. THE Project Index SHALL be checked into version control
7. THE Project Index SHALL explicitly list all transitive dependencies with their sources

### Requirement 6: Registry Structure

**User Story:** As a developer, I want the registry to use a deterministic file layout, so that specs are reproducible across machines.

#### Acceptance Criteria

1. THE Registry SHALL store all specs under `~/.spectrl/registry/{name}/{version}/`
2. THE Registry SHALL store tracked files under the `files/` subdirectory
3. THE Registry SHALL store the manifest as `spectrl.json` in the version directory
4. THE Registry SHALL preserve the exact directory structure from the manifest's files array
5. THE Registry SHALL use forward slashes in all stored paths
6. THE Registry SHALL create parent directories as needed when writing files
7. THE Registry SHALL be machine-wide and shared across all projects

### Requirement 7: Error Handling

**User Story:** As a developer, I want clear error messages and exit codes, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN any operation succeeds, THE CLI SHALL exit with code 0
2. WHEN validation fails, THE CLI SHALL exit with code 1
3. WHEN file I/O fails, THE CLI SHALL exit with code 2
4. WHEN dependency resolution fails, THE CLI SHALL exit with code 3
5. THE CLI SHALL output all error messages to stderr
6. THE CLI SHALL output success messages to stdout
7. THE CLI SHALL include the operation name in error messages

### Requirement 7: Lock File Format

**User Story:** As a developer, I want a lock file that captures the complete resolved dependency graph with integrity hashes, so that installations are reproducible.

#### Acceptance Criteria

1. THE Lock File SHALL be a JSON object with "createdAt" and "entries" fields
2. THE Lock File SHALL use ISO-8601 format for the "createdAt" timestamp
3. THE Lock File SHALL contain an "entries" array with one object per resolved spec
4. EACH Lock Entry SHALL contain "name", "version", "hash", "source", and "deps" fields
5. THE "hash" field SHALL use format `sha256:<hex>` with 64 hexadecimal characters
6. THE "deps" field SHALL be an array of strings in format `{name}@{version}`
7. THE Lock File SHALL be located at `.spectrl/lock.json` in the project root
8. THE Lock File SHALL be machine-generated and checked into version control
9. THE Lock File entries SHALL be sorted lexicographically by `{name}@{version}` for determinism

### Requirement 8: Deterministic Behavior

**User Story:** As a developer, I want identical inputs to produce identical outputs, so that specs are reproducible.

#### Acceptance Criteria

1. THE CLI SHALL produce identical registry structures given identical manifests and files
2. THE CLI SHALL produce identical hashes given identical inputs
3. THE CLI SHALL sort all file operations lexicographically
4. THE CLI SHALL normalize line endings to `\n` before hashing
5. THE CLI SHALL canonicalize JSON with sorted keys before hashing
6. THE CLI SHALL sort dependency keys lexicographically before enqueuing during resolution
7. THE CLI SHALL write lock files with stable field order
8. THE Registry SHALL operate without network access
9. THE Registry SHALL not depend on timestamps or system-specific metadata for hashes

### Requirement 9: Dependency Resolution

**User Story:** As a developer, I want clear error messages when dependencies are missing or invalid, so that I can fix my project index.

#### Acceptance Criteria

1. WHEN a manifest name or version does not match its index key, THE CLI SHALL exit with code 1 with message "Manifest mismatch for {key}: found {name}@{version}"
2. WHEN a dependency is not found in the index, THE CLI SHALL exit with code 3 with message "Missing dependency {name}@{version}. Add it to .spectrl/spectrl-index.json"
3. WHEN a cyclic dependency is detected, THE CLI SHALL exit with code 3 with message "Cyclic dependency detected: {cycle path}"
4. WHEN an index key does not match the required pattern, THE CLI SHALL exit with code 1 with message "Invalid index key: {key}"
5. THE CLI SHALL detect cycles using a visited set during breadth-first traversal
6. THE CLI SHALL provide helpful error messages that guide users to fix their configuration

### Requirement 10: Offline Operation

**User Story:** As a developer, I want to work offline, so that I'm not dependent on network availability.

#### Acceptance Criteria

1. WHILE offline, THE CLI SHALL execute `spectrl init` successfully
2. WHILE offline, THE CLI SHALL execute `spectrl publish` successfully
3. WHILE offline, THE CLI SHALL execute `spectrl install` successfully if all sources are local files
4. THE CLI SHALL not make network requests in MVP
5. THE Project Index SHALL use `file:` URLs that reference local filesystem paths

### Requirement 11: Path Safety

**User Story:** As a developer, I want path traversal attacks prevented, so that publishing or installing specs cannot write outside the registry.

#### Acceptance Criteria

1. THE CLI SHALL reject any file path containing `..`
2. THE CLI SHALL reject any absolute file paths in the manifest
3. THE CLI SHALL normalize all paths to use forward slashes
4. THE CLI SHALL validate that all resolved paths remain within the registry directory
5. IF path validation fails, THEN THE CLI SHALL exit with code 1
