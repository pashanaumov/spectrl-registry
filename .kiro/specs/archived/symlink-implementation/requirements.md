# Requirements Document

## Introduction

This specification defines the requirements for transitioning Spectrl's installation mechanism from file copying to symbolic linking. The change eliminates file duplication between the global registry and project-local spec directories, treating `.spectrl/specs/` as a derived directory similar to `node_modules/`. This improves disk space efficiency and establishes the registry as the single source of truth for installed specs.

## Glossary

- **Spectrl**: The local-first spec registry system that manages structured documentation
- **Registry**: The global storage location at `~/.spectrl/registry/{name}/{version}/` containing published specs
- **Project Specs Directory**: The local directory at `.spectrl/specs/` within a project where installed specs are accessed
- **Symlink**: A symbolic link that references another file or directory location
- **Junction Point**: A Windows-specific directory symlink that does not require elevated permissions
- **Spec Manifest**: The `spectrl.json` file defining a spec's metadata, dependencies, and tracked files
- **Install Command**: The `spectrl install` command that materializes specs from the registry into a project

## Requirements

### Requirement 1

**User Story:** As a Spectrl user, I want installed specs to use symlinks instead of copied files, so that disk space is not wasted with duplicate content

#### Acceptance Criteria

1. WHEN the Install Command executes successfully, THE Spectrl SHALL create a symbolic link from `.spectrl/specs/{name}@{version}/` to the absolute path of `~/.spectrl/registry/{name}/{version}/files/`
2. WHEN the Install Command creates a symlink, THE Spectrl SHALL NOT copy files from the Registry to the Project Specs Directory
3. WHEN multiple versions of the same spec are installed, THE Spectrl SHALL create separate symlinks for each version using the naming pattern `{name}@{version}`
4. THE Spectrl SHALL verify that the Registry path exists before attempting to create a symlink
5. WHEN a symlink is created successfully, THE Spectrl SHALL log a message indicating the spec name, version, and symlink creation

### Requirement 2

**User Story:** As a Spectrl user on Windows, I want the installation to work without administrator privileges, so that I can use Spectrl in restricted environments

#### Acceptance Criteria

1. WHEN the Install Command runs on Windows, THE Spectrl SHALL attempt to create a Junction Point instead of a standard symbolic link
2. IF symlink creation fails with a permission error, THEN THE Spectrl SHALL log a warning message explaining the permission requirements
3. IF symlink creation fails with a permission error, THEN THE Spectrl SHALL fall back to copying files from the Registry to the Project Specs Directory
4. WHEN falling back to file copying, THE Spectrl SHALL log a message indicating that symlink creation failed and file copying is being used
5. THE Spectrl SHALL detect the operating system platform to determine whether to use junction points or standard symlinks

### Requirement 3

**User Story:** As a Spectrl user upgrading from an older version, I want existing copied files to be replaced with symlinks, so that I benefit from the new behavior without manual intervention

#### Acceptance Criteria

1. WHEN the Install Command encounters an existing directory at `.spectrl/specs/{name}@{version}/`, THE Spectrl SHALL check whether it is a symlink or regular directory
2. IF the existing path is a regular directory, THEN THE Spectrl SHALL remove the directory and its contents before creating a symlink
3. IF the existing path is a symlink pointing to the correct Registry location, THEN THE Spectrl SHALL skip the installation and log a message indicating the spec is already linked
4. IF the existing path is a symlink pointing to an incorrect location, THEN THE Spectrl SHALL remove the symlink and create a new symlink to the correct Registry location
5. WHEN upgrading from copied files to symlinks, THE Spectrl SHALL log a message indicating the upgrade action

### Requirement 4

**User Story:** As an AI agent, I want to read spec content through symlinks transparently, so that I can access installed specs without special handling

#### Acceptance Criteria

1. WHEN an AI agent or tool reads a file path within `.spectrl/specs/{name}@{version}/`, THE Spectrl SHALL ensure the symlink is followed automatically by the file system
2. THE Spectrl SHALL NOT require special symlink resolution logic for normal file reading operations
3. WHEN documentation or examples reference spec paths, THE Spectrl SHALL use the pattern `.spectrl/specs/{name}@{version}/` to indicate the versioned symlink location
4. THE Spectrl SHALL ensure that symlinks are created with appropriate permissions for reading by all users and processes
5. THE Spectrl SHALL maintain compatibility with standard file system traversal tools and APIs

### Requirement 5

**User Story:** As a Spectrl developer, I want comprehensive error handling for symlink operations, so that users receive clear guidance when issues occur

#### Acceptance Criteria

1. IF the Registry path does not exist during installation, THEN THE Spectrl SHALL throw an error message indicating the missing path and suggesting to run `spectrl publish`
2. IF symlink creation fails for reasons other than permissions, THEN THE Spectrl SHALL throw an error with the underlying system error message
3. WHEN a symlink operation fails, THE Spectrl SHALL NOT leave the Project Specs Directory in an inconsistent state
4. THE Spectrl SHALL validate that the parent directory `.spectrl/specs/` exists before creating symlinks
5. IF the parent directory does not exist, THEN THE Spectrl SHALL create it before proceeding with symlink creation

### Requirement 6

**User Story:** As a Spectrl user, I want clear documentation about symlink behavior, so that I understand how installed specs are stored and can troubleshoot issues

#### Acceptance Criteria

1. THE Spectrl SHALL include documentation explaining that symlinks are used instead of file copying
2. THE Spectrl SHALL include documentation explaining the naming pattern `.spectrl/specs/{name}@{version}/` for installed specs
3. THE Spectrl SHALL include troubleshooting guidance for Windows users regarding Developer Mode and administrator privileges
4. THE Spectrl SHALL include documentation explaining how to verify that symlinks are working correctly on different platforms
5. THE Spectrl SHALL include documentation explaining the fallback behavior when symlinks cannot be created
