# Task 9: Update Documentation

## What Was Implemented

Updated all documentation to reflect the symlink implementation instead of file copying:

### README.md Updates

1. **"How It Works" section**: Added symlinks as a core concept, explaining that installed specs use symbolic links from `.spectrl/specs/{name}@{version}/` to the registry
2. **Install command documentation**: Updated to explain symlink behavior, platform-specific handling, and automatic fallback
3. **Version Control section**: Updated to clarify that symlinks (not copied files) are in `.spectrl/specs/` and documented the new naming pattern
4. **Example workflows**: Updated all installation examples to show symlink creation messages instead of file copying
5. **Installed structure examples**: Updated to show the `{name}@{version}` naming pattern with symlink indicators

### New Troubleshooting Section

Added comprehensive "Symlinks on Windows" section covering:

1. **Windows symlink requirements**: Explained Developer Mode and administrator privilege options
2. **Automatic fallback**: Documented the warning message users see when symlinks fail
3. **Verifying symlinks**: Provided platform-specific commands to check if symlinks are working:
   - Unix/macOS: `ls -la .spectrl/specs/`
   - Windows Command Prompt: `dir .spectrl\specs\`
   - Windows PowerShell: `Get-ChildItem` with LinkType and Target
4. **SPECTRL_USE_COPY environment variable**: Documented how to force file copy mode for rollback/debugging with examples for all platforms

### CLI Help Text Updates

Updated the install command description in `packages/cli/src/cli.ts` to mention:

- Symlink creation from `.spectrl/specs/{name}@{version}/` to registry
- Junction points on Windows (no admin required)
- Automatic fallback to file copying if symlinks fail

## Why These Decisions

The documentation updates were structured to provide a smooth transition for users:

1. **Gradual introduction**: The "How It Works" section introduces symlinks as a core concept early, so users understand the architecture before diving into commands
2. **Prominent troubleshooting**: Windows symlink permissions are a common pain point, so this section was placed prominently in the Troubleshooting area
3. **Platform-specific guidance**: Provided specific commands for each platform (Unix/macOS/Windows) to verify symlinks, making it easy for users to confirm correct behavior
4. **Rollback documentation**: The `SPECTRL_USE_COPY` environment variable is clearly documented as an escape hatch, providing confidence that users can always fall back if issues arise
5. **Consistent messaging**: All examples now show symlink creation messages that match the actual CLI output, reducing confusion

The naming pattern `.spectrl/specs/{name}@{version}/` is now consistently documented throughout, making it clear that multiple versions can coexist.

## Requirements Addressed

- **Requirement 6.1**: Documentation explains that symlinks are used instead of file copying
- **Requirement 6.2**: Documentation explains the naming pattern `.spectrl/specs/{name}@{version}/` for installed specs
- **Requirement 6.3**: Troubleshooting guidance for Windows users regarding Developer Mode and administrator privileges
- **Requirement 6.4**: Documentation explains how to verify that symlinks are working correctly on different platforms
- **Requirement 6.5**: Documentation explains the fallback behavior when symlinks cannot be created, plus the `SPECTRL_USE_COPY` rollback mechanism

## Code Changes

- `README.md` - Updated all sections to reflect symlink behavior
- `packages/cli/src/cli.ts` - Updated install command description

## Challenges & Considerations

- **Balancing detail with clarity**: The Windows troubleshooting section needed to be comprehensive without overwhelming users. Structured it with clear headings and progressive disclosure
- **Cross-platform examples**: Ensured all verification commands work on their respective platforms by providing platform-specific syntax
- **Consistency across examples**: Updated numerous example outputs throughout the README to show symlink messages consistently
- **Naming pattern visibility**: Made sure the `{name}@{version}` pattern is documented in multiple places so users understand it's a deliberate design choice
