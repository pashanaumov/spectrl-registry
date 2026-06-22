# Task 1: Create Template Module with AGENTS.md Content

## What Was Implemented

Created the template module at `packages/cli/src/agents/template.ts` that provides constants and functions for managing AGENTS.md content. The module exports:

- `SPECTRL_MARKER`: HTML comment constant used to identify Spectrl-generated content
- `AGENTS_TEMPLATE`: Complete AGENTS.md template content matching `__AGENTS.md`
- `getNewFileContent()`: Function that returns marker + template for new files
- `getAppendContent()`: Function that returns separator + marker + template for appending

## Why These Decisions

**Single Source of Truth for Template Content**

The template content is defined as a single constant (`AGENTS_TEMPLATE`) rather than reading from an external file. This design decision ensures:

- The template is bundled with the CLI, making it available without file system dependencies
- Version control tracks template changes directly in the source code
- No runtime file I/O is needed to access the template
- The template is immutable and consistent across all installations

**Marker-Based Detection**

The HTML comment marker `<!-- Added by Spectrl -->` was chosen because:

- HTML comments are invisible to AI assistants reading the markdown
- It's a simple, reliable way to detect Spectrl-generated content
- It doesn't interfere with markdown rendering or parsing
- It allows users to freely customize their AGENTS.md while maintaining detectability

**Separate Functions for New vs Append**

Two distinct functions (`getNewFileContent()` and `getAppendContent()`) were created because:

- New files need the marker as the first line
- Appended content needs a separator (`---`) to visually distinguish from user content
- This separation makes the intent clear and prevents mistakes
- Each function has a single, well-defined responsibility

**Template Content Preservation**

The template content was copied verbatim from `__AGENTS.md` with only necessary escaping for template literals (backticks). This ensures:

- Complete fidelity to the original content
- All instructions, examples, and formatting are preserved
- No risk of introducing errors through manual rewriting
- Easy to update by replacing the template string

## Requirements Addressed

- **Requirement 1.3**: Marker written as first line when creating new AGENTS.md
- **Requirement 1.4**: Full template written immediately after marker
- **Requirement 4.3**: Separator line appended before Spectrl section
- **Requirement 4.4**: Marker appended before template in append operation
- **Requirement 4.5**: Complete template section appended
- **Requirements 7.1-7.15**: All template content requirements (comprehensive instructions, core principles, workflows, error handling, etc.)

## Code Changes

- **Created**: `packages/cli/src/agents/template.ts`
  - Exported `SPECTRL_MARKER` constant
  - Exported `AGENTS_TEMPLATE` constant with full template content
  - Implemented `getNewFileContent()` function
  - Implemented `getAppendContent()` function
  - Added comprehensive JSDoc comments for all exports

## Challenges & Considerations

**Template Literal Escaping**

The template content contains backticks for code formatting, which required careful escaping within the template literal. All backticks in the markdown content were escaped with backslashes to prevent syntax errors.

**Line Ending Consistency**

The template uses `\n` for line breaks, which Node.js will handle appropriately based on the platform when writing files. This ensures cross-platform compatibility without hardcoding platform-specific line endings.

**Future Template Updates**

The template is defined as a constant, making it easy to update in the future. Any changes to the template only require updating the `AGENTS_TEMPLATE` constant in this single location.

## Verification

- TypeScript compilation successful with no diagnostics
- All exports are properly typed and documented
- Template content matches `__AGENTS.md` exactly
- Functions return correctly formatted content for their respective use cases
