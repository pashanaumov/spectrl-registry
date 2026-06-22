# Requirements Document

## Introduction

The `spectrl uninstall` command allows users to remove installed specs from their project. This is the inverse of `spectrl install` — it removes spec entries from the project index (`spectrl-index.json`), cleans up spec files from the project's `.spectrl/specs/` directory, updates the lock file, and warns users when other installed specs depend on the one being removed.

## Glossary

- **Project_Index**: The JSON file at `.spectrl/spectrl-index.json` that maps spec keys (`name@version` or `username/name@version`) to their source and hash.
- **Lock_File**: The JSON file at `.spectrl/lock.json` that records the resolved dependency closure with hashes for reproducibility.
- **Spec_Directory**: The directory at `.spectrl/specs/{key}` (symlink or copied files) where an installed spec's files reside in the project.
- **Spec_Reference**: A string identifying a spec, in the format `name@version` (local) or `username/name@version` (public).
- **Dependent_Spec**: A spec whose manifest `deps` field references the spec being uninstalled.
- **CLI**: The `spectrl` command-line interface binary.
- **Registry**: The user-level spec registry at `~/.spectrl/registry/` where local specs are published.

## Requirements

### Requirement 1: Parse and Validate Spec Reference

**User Story:** As a developer, I want to specify which spec to uninstall using the same reference format as install, so that the CLI is consistent and predictable.

#### Acceptance Criteria

1. WHEN a user runs `spectrl uninstall <spec-ref>`, THE CLI SHALL parse the spec reference using the same format as the install command (supporting `name@version`, `username/name@version`, `name`, and `username/name`).
2. IF the spec reference is empty or malformed, THEN THE CLI SHALL display a descriptive validation error and exit with a non-zero exit code.
3. WHEN a spec reference omits the version (e.g., `my-spec` or `alice/my-spec`), THE CLI SHALL remove all versions of that spec from the project index.

### Requirement 2: Remove Spec from Project Index

**User Story:** As a developer, I want the uninstall command to remove the spec entry from my project index, so that the spec is no longer tracked as a project dependency.

#### Acceptance Criteria

1. WHEN a valid spec reference is provided and the spec exists in the project index, THE CLI SHALL remove the matching entry from `.spectrl/spectrl-index.json`.
2. WHEN a valid spec reference is provided and the spec does not exist in the project index, THE CLI SHALL display a "not found" message indicating the spec is not installed and exit with a non-zero exit code.
3. WHEN the project is not initialized (no `.spectrl/spectrl-index.json`), THE CLI SHALL display an error indicating the project must be initialized first.
4. WHEN the spec entry is removed from the project index, THE CLI SHALL write the updated index back to disk atomically (write complete JSON, not partial).

### Requirement 3: Clean Up Spec Files

**User Story:** As a developer, I want the uninstall command to remove the spec's files from my project directory, so that removed specs do not leave orphaned files.

#### Acceptance Criteria

1. WHEN a spec is removed from the project index, THE CLI SHALL remove the corresponding directory (or symlink) from `.spectrl/specs/`.
2. WHEN the spec directory is a symlink, THE CLI SHALL remove only the symlink without affecting the registry target.
3. WHEN the spec directory contains copied files (not a symlink), THE CLI SHALL remove the entire directory recursively.
4. IF the spec directory does not exist on disk, THEN THE CLI SHALL proceed without error (idempotent cleanup).

### Requirement 4: Update Lock File

**User Story:** As a developer, I want the lock file to reflect the current state after uninstalling a spec, so that the lock file remains consistent with the project index.

#### Acceptance Criteria

1. WHEN a spec is removed from the project index, THE CLI SHALL remove the corresponding entry from `.spectrl/lock.json`.
2. WHEN the lock file does not exist, THE CLI SHALL skip lock file update without error.
3. WHEN the lock file is updated, THE CLI SHALL preserve all remaining entries and write valid JSON.

### Requirement 5: Dependency Warning

**User Story:** As a developer, I want to be warned if other installed specs depend on the spec I am removing, so that I do not accidentally break my dependency graph.

#### Acceptance Criteria

1. WHEN a spec is being uninstalled and other specs in the project index have it listed as a dependency, THE CLI SHALL display a warning listing the dependent specs.
2. WHEN a dependency warning is displayed in interactive mode, THE CLI SHALL prompt the user for confirmation before proceeding with removal.
3. WHEN a dependency warning is displayed in non-interactive mode, THE CLI SHALL proceed with removal and print the warning to stderr.
4. WHEN the user declines the confirmation prompt, THE CLI SHALL abort the uninstall and exit with exit code 130.

### Requirement 6: User Feedback

**User Story:** As a developer, I want clear feedback about what was removed, so that I can confirm the uninstall completed successfully.

#### Acceptance Criteria

1. WHEN a spec is successfully uninstalled, THE CLI SHALL display a success message including the spec key that was removed.
2. WHEN multiple versions of a spec are removed (version-less reference), THE CLI SHALL display the count and list of versions removed.
3. WHEN the uninstall operation encounters an I/O error during file removal, THE CLI SHALL display a descriptive error message and exit with exit code 2.

### Requirement 7: CLI Registration

**User Story:** As a developer, I want to use `spectrl uninstall` as a subcommand, so that it integrates naturally with the existing CLI.

#### Acceptance Criteria

1. THE CLI SHALL register `uninstall` as a subcommand accepting a positional `spec-ref` argument.
2. THE CLI SHALL display help text describing the uninstall command when `spectrl uninstall --help` is run.
