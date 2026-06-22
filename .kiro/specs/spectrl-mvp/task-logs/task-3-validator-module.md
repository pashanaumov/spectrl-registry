# Task 3: Implement Validator Module for Manifest and Path Validation

## What Was Implemented

Created a comprehensive validator module with three core functions for validating manifests and ensuring path security in the Spectrl registry system.

### Subtasks Completed

- **3.1**: Created validator.ts with validation functions (using plain functions instead of a class with static methods)
- **3.2**: Wrote comprehensive unit tests covering all validation scenarios

## Why These Decisions

**Plain Functions Over Class**: Initially planned to create a Validator class with static methods, but switched to plain functions based on user feedback. This approach is more idiomatic JavaScript/TypeScript and simpler to use and test.

**Zod Integration**: Leveraged the existing ManifestSchema from @spectrl/schema package to ensure consistency with the schema definitions. The error transformation converts Zod's technical validation errors into human-readable messages that developers can understand and act upon.

**Path Security**: Implemented comprehensive path validation to prevent security vulnerabilities:

- Path traversal attacks using `..` sequences
- Absolute paths that could escape the registry directory
- Cross-platform absolute path detection (Unix `/` and Windows `C:\` styles)
- Duplicate path detection with normalization

**File Existence Validation**: Used Node.js fs.promises.access() for efficient file existence checking without reading file contents, which is important for performance when validating large numbers of files.

## Requirements Addressed

- **Requirement 2.1**: Manifest validation using Zod schemas
- **Requirement 2.7**: Path validation for security
- **Requirement 2.8**: File existence verification
- **Requirement 10.1**: Path traversal prevention
- **Requirement 10.2**: Absolute path rejection
- **Requirement 10.3**: Human-readable error messages

## Code Changes

### Core Implementation

- `packages/core/src/validator.ts` - Main validator functions
- `packages/core/src/index.ts` - Added validator exports
- `packages/core/package.json` - Added zod dependency

### Functions Implemented

1. **validateManifest(data: unknown): Manifest**
   - Validates manifest against ManifestSchema
   - Transforms Zod errors into readable messages
   - Returns typed Manifest object

2. **validateFilePaths(paths: string[]): void**
   - Checks for path traversal (`..`)
   - Rejects absolute paths (Unix and Windows)
   - Detects duplicate paths with normalization
   - Throws descriptive errors for violations

3. **validateFilesExist(paths: string[], basePath: string): Promise<void>**
   - Verifies all declared files exist in filesystem
   - Uses async fs.access() for efficient checking
   - Reports all missing files in single error message

### Test Coverage

- `packages/core/src/validator.test.ts` - 20 comprehensive test cases covering:
  - Valid and invalid manifest validation
  - Path security edge cases
  - File existence scenarios
  - Error message formatting
  - Cross-platform compatibility

## Challenges & Considerations

**Cross-Platform Path Handling**: The initial implementation failed to detect Windows-style absolute paths (`C:\path`) on Unix systems. Fixed by adding regex pattern `/^[A-Za-z]:\\/.test(path)` to complement Node.js `isAbsolute()` function.

**Error Message Quality**: Focused on providing actionable error messages that clearly indicate what's wrong and how to fix it. Zod errors are transformed from technical validation messages to user-friendly descriptions.

**Test Environment Setup**: Created temporary directories for file existence tests with proper cleanup to avoid test pollution and ensure reliable test execution across different environments.

**Dependency Management**: Added zod dependency to core package to match the version used in schema package, ensuring compatibility and avoiding version conflicts.

## Integration Points

The validator module integrates seamlessly with:

- **@spectrl/schema**: Uses ManifestSchema for consistent validation
- **Core package exports**: Available as named exports from @spectrl/core
- **Future CLI commands**: Ready to be used by publish and install commands
- **Registry operations**: Provides security validation for file operations

This implementation provides a solid foundation for secure and reliable manifest and path validation throughout the Spectrl system.
