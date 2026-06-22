# Task 11.3: Enhance list command

## What Was Implemented

Created a new `list` command that displays all installed specs from the project index with proper formatting and color coding.

### Implementation Details

1. **Created list command** at `packages/cli/src/commands/list/index.ts`
   - Reads project index from `.spectrl/spectrl-index.json`
   - Parses each entry to extract spec name and version
   - Detects source type (public vs local) by checking URL prefix
   - Formats output using cli-table3 with proper column widths
   - Uses color coding: blue for public specs, green for local specs
   - Displays total count of installed specs

2. **Registered command in CLI**
   - Exported from `packages/cli/src/commands/index.ts`
   - Added command definition in `packages/cli/src/cli.ts`
   - Command accessible via `spectrl list`

3. **Created comprehensive unit tests** at `packages/cli/src/commands/list/index.test.ts`
   - Tests for uninitialized project (should throw error)
   - Tests for empty index (shows helpful message)
   - Tests for local specs only
   - Tests for public specs only
   - Tests for mixed local and public specs
   - Tests for specs without version in key
   - Tests for corrupted index (invalid JSON)
   - Tests for singular/plural count formatting
   - All 9 tests passing

## Why These Decisions

### Color Coding Strategy

Used blue for public specs and green for local specs to provide visual distinction. This follows common CLI conventions where:

- Blue typically indicates remote/external resources
- Green typically indicates local/safe resources

This makes it easy for users to quickly identify the source of their installed specs at a glance.

### Source Detection Logic

Implemented simple URL prefix detection (`https://` or `http://`) to determine if a spec is public. This is reliable because:

- Public specs always have URLs pointing to S3/CloudFront
- Local specs always have file system paths
- No ambiguity between the two formats

### Table Layout

Chose column widths of 35/12/12 to accommodate:

- Long spec names with username prefix (e.g., `alice/my-very-long-spec-name`)
- Version strings (typically 5-10 characters)
- Source labels (6-7 characters)

### Error Handling

Implemented specific error handling for:

- Uninitialized projects (suggests running `spectrl init`)
- Corrupted index files (suggests reinitializing)
- File system errors (generic IO error)

This provides clear guidance to users on how to resolve issues.

### Empty State Messaging

When no specs are installed, the command shows:

- Clear message that no specs are installed
- Example of how to install a spec
- Specific command syntax

This helps new users understand the next steps.

## Requirements Addressed

- **FR-5**: Discovery and Management Commands - Implemented list command
- **AC-5**: `spectrl list` shows both local and public specs with proper formatting

## Code Changes

### New Files

- `packages/cli/src/commands/list/index.ts` - List command implementation
- `packages/cli/src/commands/list/index.test.ts` - Comprehensive unit tests

### Modified Files

- `packages/cli/src/commands/index.ts` - Added list export
- `packages/cli/src/cli.ts` - Added list command registration

## Challenges & Considerations

### Version Parsing

The key format in the project index is `name@version` or `username/name@version`. Used `lastIndexOf('@')` to correctly parse the version even when the spec name contains `@` characters. This handles edge cases like:

- `alice/my-spec@1.0.0` → name: `alice/my-spec`, version: `1.0.0`
- `my-spec@2.0.0` → name: `my-spec`, version: `2.0.0`
- `my-spec` (no version) → name: `my-spec`, version: `unknown`

### Console Output Testing

Captured console.log output in tests by temporarily replacing the function. This allows verification of the actual user-facing output without relying on implementation details.

### Consistency with Other Commands

Followed the same patterns as `search` and `info` commands:

- Similar error handling approach
- Consistent use of chalk for colors
- Same table styling with cli-table3
- Similar empty state messaging

## Test Results

All 9 unit tests passing:

- ✓ should throw error if project is not initialized
- ✓ should show helpful message when no specs are installed
- ✓ should list local specs with green color coding
- ✓ should list public specs with blue color coding
- ✓ should list mixed local and public specs
- ✓ should handle specs without version in key
- ✓ should throw error if index is corrupted (invalid JSON)
- ✓ should display correct count for single spec
- ✓ should display correct count for multiple specs

Build successful with no errors.
