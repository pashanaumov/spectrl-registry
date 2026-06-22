# Requirements Document

## Introduction

The spec-validation feature adds a standalone `spectrl validate` command and integrates comprehensive validation into the existing `spectrl publish` command as a pre-publish gate. Validation checks go beyond the current Zod schema parsing and file existence checks to include content-level, convention, and semantic consistency checks. All issues are collected and reported together, distinguishing between errors (blocking) and warnings (informational).

## Glossary

- **Validator**: The shared validation module that runs all checks against a spec directory and returns a structured validation result
- **Validation_Result**: A structured object containing arrays of errors and warnings produced by the Validator
- **Validation_Issue**: A single error or warning with a severity level and descriptive message
- **Manifest**: The `spectrl.json` file defining a spec's name, version, dependencies, and tracked files
- **Spec_Directory**: The directory containing the Manifest and the files it references
- **Validate_Command**: The `spectrl validate` CLI command that runs the Validator and reports results
- **Publish_Command**: The existing `spectrl publish` CLI command that publishes specs to a registry

## Requirements

### Requirement 1: Shared Validation Module

**User Story:** As a developer, I want validation logic in a shared module, so that both the validate and publish commands use the same checks consistently.

#### Acceptance Criteria

1. THE Validator SHALL accept a Spec_Directory path and return a Validation_Result containing all errors and warnings
2. THE Validator SHALL run all validation checks to completion and collect all Validation_Issues before returning
3. WHEN the Validator encounters a check failure, THE Validator SHALL continue running remaining checks instead of stopping
4. THE Validation_Result SHALL categorize each Validation_Issue as either an error or a warning
5. THE Validator SHALL compose the existing checks (manifest schema validation, file path security validation, file existence validation) with the new checks defined in Requirements 2 through 9

### Requirement 2: Empty File Detection

**User Story:** As a spec author, I want to be told if any tracked file is empty, so that I do not accidentally publish placeholder files.

#### Acceptance Criteria

1. WHEN a file listed in the Manifest files array has zero bytes, THE Validator SHALL report an error for that file
2. WHEN all files listed in the Manifest files array have content greater than zero bytes, THE Validator SHALL report no empty-file errors

### Requirement 3: Orphaned File Detection

**User Story:** As a spec author, I want to be warned about files in my spec directory that are not tracked in the manifest, so that I do not forget to include relevant files.

#### Acceptance Criteria

1. WHEN a file exists in the Spec_Directory but is not listed in the Manifest files array, THE Validator SHALL report a warning for that file
2. THE Validator SHALL exclude the Manifest file itself (spectrl.json) from orphaned file detection
3. THE Validator SHALL exclude hidden files and directories (names starting with a dot) from orphaned file detection
4. THE Validator SHALL exclude common non-spec files (node_modules, dist, .git) from orphaned file detection
5. WHEN all non-excluded files in the Spec_Directory are listed in the Manifest files array, THE Validator SHALL report no orphaned-file warnings

### Requirement 4: Name Convention Validation

**User Story:** As a spec author, I want the validator to check that my spec name follows naming conventions, so that I catch naming issues before publishing.

#### Acceptance Criteria

1. WHEN the Manifest name contains characters other than lowercase letters, digits, and hyphens, THE Validator SHALL report an error
2. WHEN the Manifest name matches the pattern of lowercase alphanumeric characters and hyphens, THE Validator SHALL report no name-convention errors

### Requirement 5: Semver Version Validation

**User Story:** As a spec author, I want the validator to check that my version string is valid semver, so that I catch version format issues before publishing.

#### Acceptance Criteria

1. WHEN the Manifest version does not match the semver format (MAJOR.MINOR.PATCH where each component is a non-negative integer), THE Validator SHALL report an error
2. WHEN the Manifest version matches valid semver format, THE Validator SHALL report no version errors

### Requirement 6: Description Presence Warning

**User Story:** As a spec author, I want to be warned if my spec is missing a description, so that I am reminded to add one before publishing.

#### Acceptance Criteria

1. WHEN the Manifest description field is absent or empty, THE Validator SHALL report a warning
2. WHEN the Manifest description field contains a non-empty string, THE Validator SHALL report no description warnings

### Requirement 7: Dependency Validation

**User Story:** As a spec author, I want the validator to check that my dependency entries are well-formed, so that I catch dependency issues before publishing.

#### Acceptance Criteria

1. WHEN a dependency name in the Manifest deps record contains characters other than lowercase letters, digits, and hyphens, THE Validator SHALL report an error for that dependency
2. WHEN a dependency version in the Manifest deps record does not match semver format, THE Validator SHALL report an error for that dependency
3. WHEN all dependency names and versions are well-formed, THE Validator SHALL report no dependency errors

### Requirement 8: Self-Dependency Detection

**User Story:** As a spec author, I want the validator to catch if my spec lists itself as a dependency, so that I avoid circular references.

#### Acceptance Criteria

1. WHEN the Manifest deps record contains a key matching the Manifest name, THE Validator SHALL report an error
2. WHEN the Manifest deps record does not contain a key matching the Manifest name, THE Validator SHALL report no self-dependency errors

### Requirement 9: Agent Field Completeness

**User Story:** As a spec author, I want the validator to check that my agent metadata is complete when present, so that my spec is properly discoverable.

#### Acceptance Criteria

1. WHEN the Manifest agent field is present and the agent purpose is an empty string, THE Validator SHALL report a warning
2. WHEN the Manifest agent field is absent, THE Validator SHALL report no agent warnings
3. WHEN the Manifest agent field is present and the agent purpose is a non-empty string, THE Validator SHALL report no agent warnings

### Requirement 10: Standalone Validate Command

**User Story:** As a spec author, I want a `spectrl validate` command, so that I can check my spec for issues without publishing.

#### Acceptance Criteria

1. WHEN a user runs `spectrl validate`, THE Validate_Command SHALL invoke the Validator on the current working directory
2. WHEN the Validation_Result contains errors, THE Validate_Command SHALL display all errors and warnings and exit with a non-zero exit code
3. WHEN the Validation_Result contains only warnings and no errors, THE Validate_Command SHALL display all warnings and exit with a zero exit code
4. WHEN the Validation_Result contains no errors and no warnings, THE Validate_Command SHALL display a success message and exit with a zero exit code
5. THE Validate_Command SHALL display each Validation_Issue with its severity (error or warning) and descriptive message

### Requirement 11: Publish Command Integration

**User Story:** As a spec author, I want publish to run validation automatically, so that I cannot publish a spec with validation errors.

#### Acceptance Criteria

1. WHEN a user runs `spectrl publish`, THE Publish_Command SHALL invoke the Validator before proceeding with the publish operation
2. WHEN the Validation_Result contains errors, THE Publish_Command SHALL display all errors and warnings and abort the publish operation
3. WHEN the Validation_Result contains only warnings and no errors, THE Publish_Command SHALL display the warnings and proceed with the publish operation
4. THE Publish_Command SHALL replace its current individual validation calls with the unified Validator invocation
