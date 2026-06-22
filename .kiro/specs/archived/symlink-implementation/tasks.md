# Implementation Plan

- [x] 1. Create symlink utility functions
  - Create helper functions for symlink operations in `packages/cli/src/commands/install.ts`
  - Implement `getSymlinkType()` to detect platform and return 'junction' for Windows or 'dir' for Unix
  - Implement `checkSymlinkStatus()` to verify if a path is a symlink and validate its target
  - Implement `removeExistingPath()` to safely remove directories or symlinks
  - Implement `shouldUseCopy()` to check SPECTRL_USE_COPY environment variable
  - _Requirements: 1.1, 1.4, 2.5, 5.4_

- [x] 2. Implement symlink creation with fallback
  - Create `createSymlinkOrFallback()` function that attempts symlink creation with platform-specific type
  - Add try-catch block to handle EPERM errors on Windows
  - Implement fallback to file copying when symlink creation fails with permission errors
  - Add logging for symlink success, fallback warnings, and error messages
  - Ensure parent directory exists before creating symlink
  - Return 'symlink' or 'copy' to indicate which method was used
  - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2_

- [x] 3. Implement file copying fallback function
  - Create `copyFilesFromRegistry()` function to copy files when symlinks fail
  - Copy manifest file from registry to project
  - Iterate through manifest.files and copy each file preserving directory structure
  - Ensure parent directories exist for each copied file
  - Reuse existing file copying logic from current implementation
  - _Requirements: 2.3, 2.4_

- [x] 4. Update installSingleSpec() to use symlinks
  - Modify `installSingleSpec()` to use new symlink naming pattern `{name}@{version}`
  - Replace file copying logic with `checkSymlinkStatus()` call
  - Add skip logic when symlink already exists and points to correct target
  - Add upgrade logic to remove old copied files and create symlinks
  - Call `createSymlinkOrFallback()` instead of file copying loop
  - Update success messages to indicate symlink creation or upgrade
  - Ensure project index is updated after successful symlink creation
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Update install() bulk function to use symlinks
  - Modify `install()` to use new symlink naming pattern `{name}@{version}`
  - Replace file copying logic in the resolved specs loop with symlink creation
  - Add skip logic for already-linked specs using `checkSymlinkStatus()`
  - Add upgrade logic for old copied files
  - Call `createSymlinkOrFallback()` for each spec instead of file copying
  - Update spinner messages to reflect symlink operations
  - Update statistics tracking to count symlinks vs copies
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Add registry path validation
  - Add check to verify registry files path exists before creating symlink
  - Throw CLIError with helpful message if registry path not found
  - Suggest running `spectrl publish` in error message
  - Use ExitCode.DEPENDENCY_ERROR for missing registry paths
  - _Requirements: 1.4, 5.1_

- [x] 7. Implement rollback mechanism
  - Add `shouldUseCopy()` check at the start of `createSymlinkOrFallback()`
  - If SPECTRL_USE_COPY=1, skip symlink creation and use file copying
  - Log informational message when copy mode is active
  - Ensure fallback function is called with correct parameters
  - _Requirements: Rollback Strategy (design document)_

- [x] 8. Update error handling
  - Ensure symlink operations don't leave project in inconsistent state
  - Add specific error handling for EPERM (permission denied) errors
  - Add generic error handling for other symlink failures
  - Ensure parent directory creation errors are caught and reported
  - Validate that index/lock files are only updated after successful symlink creation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Update documentation
  - Update README.md "How It Works" section to explain symlink behavior
  - Add troubleshooting section for Windows symlink permissions
  - Document the `SPECTRL_USE_COPY` environment variable for rollback
  - Add examples showing symlink verification commands for different platforms
  - Update CLI help text for `spectrl install` to mention symlinks
  - Document the new naming pattern `.spectrl/specs/{name}@{version}/`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Write unit tests for symlink utilities
  - Test `getSymlinkType()` returns correct value for current platform
  - Test `checkSymlinkStatus()` correctly identifies symlinks, directories, and non-existent paths
  - Test `checkSymlinkStatus()` validates symlink targets correctly
  - Test `removeExistingPath()` removes both directories and symlinks
  - Test `shouldUseCopy()` reads environment variable correctly
  - Test `createSymlinkOrFallback()` creates symlinks on supported platforms
  - Test `createSymlinkOrFallback()` falls back to copying on permission errors
  - Mock fs.symlink to simulate EPERM errors for fallback testing
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.3_

- [x] 11. Write integration tests for install command
  - Test fresh install creates symlink with correct naming pattern
  - Test installing multiple versions creates separate symlinks
  - Test upgrading from old copied files to symlinks
  - Test skip logic when symlink already exists and is correct
  - Test re-creation when symlink points to wrong target
  - Test files are readable through symlinks
  - Test bulk install creates symlinks for all specs
  - Test single spec install creates symlink and updates index
  - Test error handling when registry path doesn't exist
  - Test rollback mechanism with SPECTRL_USE_COPY=1
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
