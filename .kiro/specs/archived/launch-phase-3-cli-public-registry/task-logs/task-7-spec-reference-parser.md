# Task 7: Implement Spec Reference Parser

## What Was Implemented

Created a comprehensive spec reference parser that handles both local and public spec formats with full validation and error handling.

### Main Implementation (`packages/cli/src/utils/spec-ref.ts`)

- **`parseSpecRef()` function**: Main parser that handles all spec reference formats
- **`formatSpecRef()` function**: Inverse function to convert parsed objects back to strings
- **`ParsedSpecRef` interface**: Type-safe return structure with username, name, version, and isPublic flag

### Subtasks Completed

#### 7.1: Comprehensive Unit Tests (`packages/cli/src/utils/spec-ref.test.ts`)

Created 51 unit tests covering:

- Local spec references (with and without versions)
- Public spec references (with and without versions)
- Version validation (strict semver, no leading zeros)
- Input validation (empty strings, null, undefined, non-strings)
- Name validation (lowercase, alphanumeric, hyphens, length limits)
- Username validation (GitHub-style rules, 1-39 characters)
- Public spec format validation (slash handling, missing components)
- Edge cases (consecutive hyphens, empty versions, etc.)
- Round-trip testing (parse → format → parse)

All 51 tests pass successfully.

## Why These Decisions

### Strict Validation Rules

The parser enforces strict validation to prevent security issues and ensure consistency:

1. **Lowercase only**: Prevents case-sensitivity issues across different filesystems and platforms
2. **No special characters**: Prevents path traversal attacks and filesystem issues
3. **Strict semver**: No leading zeros ensures consistent version comparison
4. **Length limits**: Username (1-39 chars) follows GitHub rules, spec names (1-100 chars) are reasonable
5. **No prerelease/build metadata**: Keeps versioning simple for MVP

### Separation of Local and Public Parsing

The implementation uses separate internal functions (`parseLocalSpecRef` and `parsePublicSpecRef`) because:

- Different validation rules apply (username only for public)
- Clearer error messages specific to each format
- Easier to maintain and test independently
- Better performance (no unnecessary checks)

### Format Detection via Slash

Using the presence of `/` to detect public vs local specs is simple and unambiguous:

- Local specs cannot contain `/` (would be invalid filename)
- Public specs must contain exactly one `/` (username/spec)
- No configuration or flags needed
- Matches user mental model (GitHub-style references)

### Comprehensive Error Messages

Each validation failure provides specific, actionable error messages:

- "Invalid spec name: X. Must be lowercase alphanumeric with hyphens, 1-100 characters"
- "Invalid version: X. Must be valid semver (e.g., 1.0.0) with no leading zeros"
- "Invalid username: X. Must be lowercase alphanumeric with hyphens, 1-39 characters"

This helps users quickly understand and fix their input.

### TypeScript Interface Design

The `ParsedSpecRef` interface includes:

- Optional `username` (only present for public specs)
- Optional `version` (only present when specified)
- Required `name` (always present)
- `isPublic` boolean flag (convenience for consumers)

This design makes it easy for consumers to check `isPublic` and then safely access `username` when needed, with TypeScript providing type safety.

## Requirements Addressed

- **FR-4**: Installing from Public Registry - Parser enables detection and handling of public spec references
- **NFR-3**: Backward Compatibility - Local spec format remains unchanged, public format is additive

## Code Changes

### New Files Created

1. **`packages/cli/src/utils/spec-ref.ts`** (220 lines)
   - Main parser implementation
   - Validation patterns and logic
   - Format conversion utilities

2. **`packages/cli/src/utils/spec-ref.test.ts`** (290 lines)
   - Comprehensive test suite
   - 51 test cases covering all scenarios
   - Edge case validation

## Integration Points

This parser will be used by:

- `install` command - to detect public vs local specs
- `publish` command - to validate spec references
- `info` command - to parse user input
- `search` command - to format results
- `unpublish` command - to parse and validate references
- `update` command - to handle spec references

The existing `parseSpecRef()` function in `install.ts` handles only local specs and will be replaced/augmented with this more comprehensive version in future tasks.

## Testing Results

All 51 tests pass:

- ✓ 6 local spec reference tests
- ✓ 7 public spec reference tests
- ✓ 7 version validation tests
- ✓ 6 input validation tests
- ✓ 11 name validation tests
- ✓ 4 public spec format validation tests
- ✓ 4 edge case tests
- ✓ 6 format function tests

No TypeScript compilation errors or linting issues.

## Challenges & Considerations

### Challenge: Balancing Strictness vs Flexibility

**Decision**: Chose strict validation for security and consistency
**Rationale**: Better to reject invalid input early than deal with filesystem/security issues later

### Challenge: Username Length Limit

**Decision**: Used 1-39 characters (GitHub's limit)
**Rationale**: Aligns with GitHub OAuth integration, prevents abuse, reasonable for usernames

### Challenge: Handling Edge Cases

**Decision**: Comprehensive validation with specific error messages
**Examples handled**:

- Consecutive hyphens (allowed)
- Single character names (allowed)
- Empty version after @ (rejected)
- Multiple slashes (rejected)
- Uppercase letters (rejected)

### Challenge: Version Format

**Decision**: Strict semver only (no prerelease/build metadata)
**Rationale**: Keeps MVP simple, can be extended later if needed

## Future Enhancements

Potential improvements for future phases:

1. Support for version ranges (e.g., `^1.0.0`, `~2.1.0`)
2. Support for prerelease versions (e.g., `1.0.0-alpha.1`)
3. Support for build metadata (e.g., `1.0.0+build.123`)
4. Alias support (e.g., `@latest`, `@stable`)
5. Organization/scope support (e.g., `@org/user/spec`)

These were intentionally excluded from MVP to keep the implementation simple and focused.
