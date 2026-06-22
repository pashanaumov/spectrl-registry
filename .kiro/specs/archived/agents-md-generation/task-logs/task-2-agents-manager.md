# Task 2: Create AGENTS.md Manager Module

## What Was Implemented

Created the `packages/cli/src/agents/manager.ts` module with complete file operation functions for managing AGENTS.md files. The module provides type-safe status checking, file creation, and content appending capabilities.

### Core Components

1. **AgentsStatus Type** - Discriminated union for type-safe file state representation
2. **checkAgentsStatus()** - Detects file existence and Spectrl marker presence
3. **createAgentsFile()** - Creates new AGENTS.md with marker as first line
4. **appendToAgentsFile()** - Appends Spectrl section with separator to existing files

## Why These Decisions

### Discriminated Union for Status

The `AgentsStatus` type uses a discriminated union pattern to represent three distinct states:

- File doesn't exist: `{ exists: false }`
- File exists with marker: `{ exists: true; hasMarker: true }`
- File exists without marker: `{ exists: true; hasMarker: false }`

This design provides compile-time type safety and makes it impossible to access `hasMarker` when `exists` is false. TypeScript's control flow analysis ensures that code checking `status.hasMarker` only compiles when `status.exists` is true, preventing runtime errors.

### Atomic File Operations

All file operations follow the atomic pattern: read entire file → modify in memory → write back. This ensures no partial writes occur on failure. The `appendToAgentsFile()` function reads the complete existing content, performs all modifications in memory, and only then writes the final result. If any step fails, the original file remains unchanged.

### Non-Throwing File Read Errors

The `checkAgentsStatus()` function treats unreadable files as non-existent rather than throwing errors. This design choice aligns with the requirement that AGENTS.md operations are non-critical. If a file exists but can't be read (permissions, corruption, etc.), the system gracefully degrades by treating it as absent, allowing the init command to continue successfully.

### Trailing Whitespace Handling

The `appendToAgentsFile()` function trims trailing whitespace before appending content. This prevents accumulation of blank lines when appending and ensures consistent formatting. The separator (`\n\n---\n\n`) provides proper visual separation regardless of how the existing file ends.

### Error Context Preservation

All error handling preserves the original error message while adding context about the operation that failed. This follows the existing CLI error pattern and provides users with actionable information when file operations fail.

## Requirements Addressed

This implementation addresses the following requirements from the spec:

- **Requirement 1.1**: File existence checking during init
- **Requirement 1.2**: Creating AGENTS.md with marker as first line
- **Requirement 1.3**: Writing complete template after marker
- **Requirement 1.4**: Logging success/failure appropriately
- **Requirement 2.1-2.8**: Detecting existing AGENTS.md and marker presence
- **Requirement 4.1-4.12**: Appending Spectrl section with proper formatting

## Code Changes

### New File: `packages/cli/src/agents/manager.ts`

Created complete manager module with:

- `AgentsStatus` type definition (discriminated union)
- `checkAgentsStatus(cwd)` - Status detection function
- `createAgentsFile(cwd)` - New file creation function
- `appendToAgentsFile(cwd)` - Content append function

All functions use:

- Existing `CLIError` and `ExitCode` patterns from errors module
- Template constants from `template.ts` module
- File utilities from `utils.ts` module
- Node.js `fs/promises` for async file operations

## Challenges & Considerations

### Import Path Resolution

Used `.js` extensions in import statements (`'./template.js'`, `'../utils.js'`) to ensure proper ESM module resolution. This follows the project's TypeScript configuration which targets ESNext modules with bundler resolution.

### Error Type Narrowing

Implemented proper type narrowing for error handling using `instanceof Error` checks. This ensures TypeScript correctly infers the error type when accessing the `message` property, while providing a fallback for non-Error exceptions.

### Marker Detection Strategy

Used simple string inclusion check (`content.includes(SPECTRL_MARKER)`) rather than regex or parsing. This is intentionally simple and robust - it works regardless of marker position, surrounding whitespace, or file structure. The HTML comment format ensures the marker is invisible to AI assistants while being easily detectable by the code.

### File Path Construction

Used `join(cwd, 'AGENTS.md')` consistently to construct file paths, ensuring cross-platform compatibility. The `join()` function handles path separators correctly on both Unix and Windows systems.

## Testing Considerations

The module is designed for easy unit testing:

- Pure functions with clear inputs/outputs
- Dependency injection via `cwd` parameter
- Mockable file system operations
- Predictable error handling

Future tests should cover:

- All three status states (non-existent, with marker, without marker)
- File creation success and failure cases
- Append operation with various existing content
- Error handling for permission issues
- Atomic operation behavior on write failures
