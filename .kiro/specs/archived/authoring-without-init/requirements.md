# Requirements Document

## Introduction

This feature removes the unnecessary initialization requirement from the spec authoring workflow. Currently, `spectrl new` and `spectrl publish` require running `spectrl init` first, which creates project infrastructure (`.spectrl` folder, lock files) that serves no purpose during authoring. Initialization should only be required when consuming specs through `spectrl install`, where dependency resolution and project context are actually needed.

## Glossary

- **Spectrl CLI**: The command-line interface tool for managing specs
- **Authoring Workflow**: The process of creating and publishing specs using `spectrl new` and `spectrl publish`
- **Consumption Workflow**: The process of installing and using specs in a project using `spectrl install`
- **Project Context**: The `.spectrl` directory, lock files, and registry state needed for dependency resolution
- **Spec Manifest**: The `spectrl.json` file that defines a spec's metadata, version, and dependencies

## Requirements

### Requirement 1

**User Story:** As a spec author, I want to create new specs without initialization, so that I can start authoring immediately without unnecessary setup overhead

#### Acceptance Criteria

1. WHEN a user executes `spectrl new [name]` in any directory, THE Spectrl CLI SHALL create a new spec manifest without requiring prior initialization
2. THE Spectrl CLI SHALL NOT check for the existence of a `.spectrl` directory when executing `spectrl new`
3. THE Spectrl CLI SHALL NOT create a `.spectrl` directory as a side effect of executing `spectrl new`
4. THE Spectrl CLI SHALL create a valid `spectrl.json` manifest file in the target directory when executing `spectrl new`

### Requirement 2

**User Story:** As a spec author, I want to publish specs without initialization, so that I can share my work without setting up project infrastructure

#### Acceptance Criteria

1. WHEN a user executes `spectrl publish` in a directory containing a valid spec manifest, THE Spectrl CLI SHALL publish the spec without requiring prior initialization
2. THE Spectrl CLI SHALL NOT check for the existence of a `.spectrl` directory when executing `spectrl publish`
3. THE Spectrl CLI SHALL validate the spec manifest and tracked files before publishing
4. THE Spectrl CLI SHALL compute content hashes for the spec without requiring project context
5. THE Spectrl CLI SHALL output the published spec to the configured registry location

### Requirement 3

**User Story:** As a project maintainer, I want initialization to be required only for consumption workflows, so that project context is established when actually needed

#### Acceptance Criteria

1. WHEN a user executes `spectrl install` in a directory without initialization, THE Spectrl CLI SHALL display an error message indicating initialization is required
2. THE Spectrl CLI SHALL require a `.spectrl` directory to exist before executing `spectrl install`
3. THE Spectrl CLI SHALL provide a clear error message directing users to run `spectrl init` when project context is missing
4. THE Spectrl CLI SHALL NOT require initialization for `spectrl new` or `spectrl publish` commands

### Requirement 4

**User Story:** As a CLI user, I want clear error messages that distinguish between authoring and consumption contexts, so that I understand when initialization is needed

#### Acceptance Criteria

1. WHEN initialization is required but missing, THE Spectrl CLI SHALL display an error message that explains why initialization is needed for the specific command
2. THE Spectrl CLI SHALL NOT display initialization-related errors for `spectrl new` or `spectrl publish` commands
3. THE Spectrl CLI SHALL provide actionable guidance in error messages, including the command to run for initialization
4. THE Spectrl CLI SHALL distinguish between "project not initialized" errors and other validation errors in its output
