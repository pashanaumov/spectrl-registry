# Requirements Document: AGENTS.md Auto-Generation

## Introduction

This specification defines the requirements for creating and managing an AGENTS.md file that configures AI assistants to use Spectrl specs as the primary source of truth. The file provides comprehensive instructions to AI tools, ensuring they consult installed specs before generating code, reviewing changes, or answering technical questions.

The feature integrates into the existing `spectrl init` command with intelligent handling of pre-existing AGENTS.md files and provides flags for explicit control over the behavior.

## Glossary

- **AGENTS.md**: A markdown file in the project root that provides instructions to AI assistants
- **AI Assistant**: Tools like Claude, Cursor, Cline, Windsurf, GitHub Copilot that provide code assistance
- **System Prompt**: Instructions automatically loaded by AI tools that guide their behavior
- **Spectrl Section**: The portion of AGENTS.md containing Spectrl-specific instructions
- **Spectrl Marker**: HTML comment `<!-- Added by Spectrl -->` used to identify auto-generated content
- **Append Operation**: Adding Spectrl instructions to the end of an existing AGENTS.md file
- **CLI**: The Spectrl command-line interface tool

## Product Requirements

### User Story 1: New Project Initialization

**As a** developer starting a new project with Spectrl,  
**I want** to choose whether AGENTS.md is created,  
**So that** I have control over my project structure while getting helpful guidance.

#### User Journey

1. Developer runs `spectrl init` in a new project
2. CLI creates `.spectrl/spectrl-index.json`
3. CLI detects no existing AGENTS.md
4. CLI prompts: "Create AGENTS.md to configure AI assistants?" with "Yes (recommended)" and "No" options
5. If developer chooses "Yes":
   - CLI creates AGENTS.md with full Spectrl template
   - Developer commits AGENTS.md to git
   - AI assistants automatically read AGENTS.md and consult specs
6. If developer chooses "No":
   - CLI explains implications (no automatic AI assistant configuration)
   - CLI continues without creating AGENTS.md
   - Developer can create it manually later if desired

#### Success Criteria

- User has explicit control over AGENTS.md creation
- "Yes" option is clearly marked as recommended
- Choosing "No" provides clear explanation of implications
- AI assistants work correctly when "Yes" is chosen
- AGENTS.md is human-readable and customizable
- File is suitable for version control (no machine-specific paths)

### User Story 2: Adding Spectrl to Existing Project

**As a** developer adding Spectrl to an existing project that already has AGENTS.md,  
**I want** to preserve my custom instructions while adding Spectrl guidance,  
**So that** both my custom rules and Spectrl instructions work together.

#### User Journey

1. Developer has existing project with custom AGENTS.md
2. Developer runs `spectrl init`
3. CLI detects existing AGENTS.md
4. CLI prompts: "AGENTS.md found. Append Spectrl instructions to the bottom? (Y/n)"
5. Developer chooses Yes
6. CLI appends Spectrl section with clear separator
7. AI assistants now follow both custom instructions and Spectrl guidance

#### Success Criteria

- No data loss - custom instructions preserved
- Clear separation between custom and Spectrl sections
- User has explicit control via prompt
- AI assistants respect both sets of instructions

### User Story 3: Declining AGENTS.md Update

**As a** developer who wants to manage AGENTS.md manually,  
**I want** to decline automatic updates,  
**So that** I maintain full control over AI assistant configuration.

#### User Journey

1. Developer has existing AGENTS.md with custom structure
2. Developer runs `spectrl init`
3. CLI prompts about appending Spectrl instructions
4. Developer chooses No
5. CLI provides helpful message about manual setup options
6. `spectrl init` completes successfully

#### Success Criteria

- User choice is respected without nagging
- Helpful guidance provided for manual setup
- `spectrl init` completes successfully regardless of choice

### User Story 4: Re-running Init

**As a** developer who has already initialized Spectrl,  
**I want** re-running `spectrl init` to be safe and idempotent,  
**So that** I don't accidentally duplicate content or lose customizations.

#### User Journey

1. Developer has project with Spectrl already initialized
2. Developer runs `spectrl init` again (accidentally or intentionally)
3. CLI detects existing `.spectrl/` directory and AGENTS.md with Spectrl marker
4. CLI skips creating AGENTS.md (already has Spectrl section)
5. CLI logs confirmation that setup is already complete
6. No prompts, no changes, no duplicates

#### Success Criteria

- Idempotent behavior - safe to run multiple times
- No duplicate content in AGENTS.md
- No unnecessary prompts
- Clear feedback about current state

### User Story 5: Forcing AGENTS.md Setup Without Prompts

**As a** developer who wants to ensure AGENTS.md has Spectrl instructions,  
**I want** to add them without prompting,  
**So that** I can automate setup or quickly add instructions without interaction.

#### User Journey

1. Developer runs `spectrl init --force-agents`
2. CLI checks if AGENTS.md exists
3. If no AGENTS.md: CLI creates it with Spectrl template
4. If AGENTS.md exists without marker: CLI appends Spectrl instructions (preserving custom content)
5. If AGENTS.md has marker: CLI is idempotent (no changes)
6. CLI logs appropriate confirmation message
7. Developer has AGENTS.md with Spectrl instructions, custom content preserved

#### Success Criteria

- Explicit flag provides clear intent
- No prompts when flag is used
- Custom content is always preserved (never overwritten)
- Idempotent behavior when marker already exists
- Clear feedback about the operation
- Works in automated/CI environments

### User Story 6: Skipping AGENTS.md Entirely

**As a** developer who doesn't want AGENTS.md in my project,  
**I want** to skip its creation entirely,  
**So that** I can use Spectrl without AI assistant configuration.

#### User Journey

1. Developer runs `spectrl init --skip-agents`
2. CLI creates `.spectrl/` directory and index
3. CLI skips all AGENTS.md logic (no checks, no prompts, no creation)
4. `spectrl init` completes successfully
5. No AGENTS.md file exists

#### Success Criteria

- Explicit flag provides clear intent
- No prompts or checks related to AGENTS.md
- `spectrl init` completes successfully
- No AGENTS.md file is created or modified

## Functional Requirements

### Requirement 1: AGENTS.md Creation Prompt on Init

**User Story:** As a developer, I want to choose whether AGENTS.md is created during project initialization, so that I have control over my project structure

#### Acceptance Criteria

1. WHEN `spectrl init` runs, THE CLI SHALL check if AGENTS.md exists in the current directory
2. IF AGENTS.md does NOT exist, THEN THE CLI SHALL prompt the user for creation
3. THE prompt text SHALL be: "Create AGENTS.md to configure AI assistants?"
4. THE prompt SHALL display two choices using the `prompts` library
5. THE first choice SHALL be "Yes (recommended)" with value true
6. THE second choice SHALL be "No" with value false
7. THE prompt SHALL default to "Yes (recommended)" as the initially selected choice
8. THE prompt SHALL allow navigation between choices using arrow keys (up/down)
9. THE prompt SHALL allow selection by pressing Enter key on the highlighted choice
10. WHEN user selects "Yes", THE CLI SHALL create AGENTS.md with the Spectrl marker as the first line
11. WHEN user selects "Yes", THE CLI SHALL write the full template immediately after the marker
12. WHEN creation succeeds, THE CLI SHALL log "✓ Created AGENTS.md"
13. WHEN user selects "No", THE CLI SHALL log "ℹ Skipped AGENTS.md creation"
14. WHEN user selects "No", THE CLI SHALL log "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
15. THE created AGENTS.md SHALL be a plain text markdown file with UTF-8 encoding
16. THE created AGENTS.md SHALL use platform-appropriate line endings (LF on Unix, CRLF on Windows)
17. THE CLI SHALL create AGENTS.md in the current working directory (project root)
18. IF file creation fails due to permissions, THE CLI SHALL log a warning but continue (non-critical operation)
19. THE CLI SHALL continue with init successfully regardless of user choice

_Requirements: User Story 1_

### Requirement 2: Detecting Existing AGENTS.md

**User Story:** As a developer with an existing AGENTS.md, I want Spectrl to detect it and handle it intelligently, so that my custom instructions are preserved

#### Acceptance Criteria

1. WHEN `spectrl init` runs and AGENTS.md exists, THE CLI SHALL read the file contents
2. THE CLI SHALL search for the marker `<!-- Added by Spectrl -->` in the file contents
3. IF the marker is found, THE CLI SHALL consider Spectrl instructions already present
4. IF the marker is NOT found, THE CLI SHALL consider this a custom AGENTS.md without Spectrl
5. THE detection SHALL be case-sensitive for the marker
6. THE detection SHALL work regardless of marker position in the file
7. IF file read fails, THE CLI SHALL treat it as if the file doesn't exist (proceed to create)
8. THE detection SHALL complete before any prompts are shown to the user

_Requirements: User Story 2, User Story 4_

### Requirement 3: Prompting for Append

**User Story:** As a developer, I want to explicitly approve adding Spectrl instructions to my existing AGENTS.md, so that I maintain control over the file

#### Acceptance Criteria

1. WHEN existing AGENTS.md is detected without Spectrl marker, THE CLI SHALL prompt the user
2. THE prompt text SHALL be: "AGENTS.md found. Append Spectrl instructions to the bottom?"
3. THE prompt SHALL display two choices: "Yes" and "No"
4. THE prompt SHALL allow navigation between choices using arrow keys (up/down)
5. THE prompt SHALL default to "Yes" as the initially selected choice
6. THE prompt SHALL allow selection by pressing Enter key on the highlighted choice
7. THE prompt SHALL display before any file modifications occur
8. THE prompt SHALL use the `prompts` library for interactive selection

_Requirements: User Story 2, User Story 3_

### Requirement 4: Appending Spectrl Section

**User Story:** As a developer who approves the append, I want Spectrl instructions added cleanly to my existing AGENTS.md, so that both custom and Spectrl content coexist properly

#### Acceptance Criteria

1. WHEN user approves append, THE CLI SHALL read the current AGENTS.md contents
2. THE CLI SHALL trim trailing whitespace from the existing content
3. THE CLI SHALL append a separator line: `\n\n---\n\n`
4. THE CLI SHALL append the Spectrl marker: `<!-- Added by Spectrl -->`
5. THE CLI SHALL append the complete Spectrl template section
6. THE CLI SHALL write the combined content back to AGENTS.md
7. THE CLI SHALL preserve the original file encoding (UTF-8)
8. THE CLI SHALL preserve the original line ending style (LF or CRLF)
9. WHEN append succeeds, THE CLI SHALL log "✓ Added Spectrl instructions to AGENTS.md"
10. IF write fails, THE CLI SHALL log an error but continue with init (non-critical operation)
11. THE append operation SHALL be atomic (no partial writes on failure)
12. THE appended section SHALL be clearly separated from user content with `---` divider

_Requirements: User Story 2_

### Requirement 5: Declining Creation or Append

**User Story:** As a developer who declines AGENTS.md creation or update, I want helpful guidance about my options, so that I understand the implications and can set up Spectrl manually if desired

#### Acceptance Criteria

1. WHEN user declines creation (new project), THE CLI SHALL log "ℹ Skipped AGENTS.md creation"
2. WHEN user declines creation, THE CLI SHALL log "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
3. WHEN user declines append (existing file), THE CLI SHALL log "ℹ Skipped AGENTS.md update"
4. WHEN user declines append, THE CLI SHALL log "You can add Spectrl instructions manually if needed"
5. THE CLI SHALL NOT create or modify AGENTS.md when declined
6. THE CLI SHALL continue with the rest of `spectrl init` successfully
7. THE CLI SHALL exit with code 0 (success) regardless of decline
8. THE decline SHALL be respected without additional prompts
9. THE guidance messages SHALL be written to stdout (not stderr)
10. THE guidance messages SHALL clearly explain the implications of declining

_Requirements: User Story 1, User Story 3_

### Requirement 6: Idempotent Behavior

**User Story:** As a developer, I want to safely re-run `spectrl init`, so that I don't create duplicate content or lose customizations

#### Acceptance Criteria

1. WHEN `spectrl init` runs and AGENTS.md contains the Spectrl marker, THE CLI SHALL detect it
2. THE CLI SHALL NOT prompt to append again
3. THE CLI SHALL log "✓ AGENTS.md already contains Spectrl instructions"
4. THE CLI SHALL NOT modify the existing AGENTS.md file
5. THE CLI SHALL continue with the rest of init successfully
6. THE operation SHALL be idempotent - multiple runs produce identical results
7. THE CLI SHALL NOT create duplicate Spectrl sections
8. THE detection SHALL work even if user has added content after the Spectrl section

_Requirements: User Story 4_

### Requirement 7: AGENTS.md Template Content

**User Story:** As an AI assistant, I want clear, comprehensive instructions in AGENTS.md, so that I know how to use Spectrl specs correctly

#### Acceptance Criteria

1. THE template SHALL include a "What is Spectrl?" introduction section
2. THE template SHALL include a "Core Principles" section with decision-making guidelines
3. THE template SHALL include a "Primary Source of Truth" section listing when to consult specs
4. THE template SHALL include an "Installed Specs" section directing AI to `.spectrl/specs/`
5. THE template SHALL include a "How to Use Specs" section with if/else decision trees
6. THE template SHALL include guidance on when to infer vs. ask questions
7. THE template SHALL include multi-file spec reading strategies
8. THE template SHALL include dependency following guidelines with circuit breakers
9. THE template SHALL include conflict resolution procedures
10. THE template SHALL include error handling for missing, malformed, or conflicting specs
11. THE template SHALL include example workflows for common scenarios
12. THE template SHALL use markdown formatting for readability
13. THE template SHALL use bold text for critical instructions (e.g., "ALWAYS")
14. THE template SHALL include the citation format: `[spec:name@version]`
15. THE template SHALL be human-readable and understandable without technical knowledge

_Requirements: User Story 1, User Story 2_

### Requirement 8: Flag - --force-agents

**User Story:** As a developer, I want to ensure AGENTS.md has Spectrl instructions without prompting, so that I can automate setup or quickly add instructions

#### Acceptance Criteria

1. THE CLI SHALL accept a `--force-agents` flag for `spectrl init`
2. WHEN `--force-agents` is provided, THE CLI SHALL check for existing AGENTS.md
3. WHEN `--force-agents` is provided, THE CLI SHALL NOT prompt the user
4. IF AGENTS.md does NOT exist, THE CLI SHALL create it with the Spectrl marker and template
5. IF AGENTS.md exists WITHOUT Spectrl marker, THE CLI SHALL append Spectrl instructions (preserving custom content)
6. IF AGENTS.md exists WITH Spectrl marker, THE CLI SHALL be idempotent (no changes)
7. WHEN creating new file, THE CLI SHALL log "✓ Created AGENTS.md"
8. WHEN appending to existing file, THE CLI SHALL log "✓ Added Spectrl instructions to AGENTS.md"
9. WHEN already has marker, THE CLI SHALL log "✓ AGENTS.md already contains Spectrl instructions"
10. THE CLI SHALL NEVER overwrite or destroy existing custom content
11. IF file operations fail, THE CLI SHALL log an error but continue with init (non-critical operation)
12. THE flag SHALL work independently of other flags

_Requirements: User Story 5_

**Note**: This requirement was updated during implementation. The original requirement specified "overwrite any existing AGENTS.md" but this was changed to "append without prompting" to preserve custom content, which is safer and more user-friendly.

### Requirement 9: Flag - --skip-agents

**User Story:** As a developer, I want to skip AGENTS.md creation entirely, so that I can use Spectrl without AI assistant configuration

#### Acceptance Criteria

1. THE CLI SHALL accept a `--skip-agents` flag for `spectrl init`
2. WHEN `--skip-agents` is provided, THE CLI SHALL NOT check for existing AGENTS.md
3. WHEN `--skip-agents` is provided, THE CLI SHALL NOT prompt the user
4. WHEN `--skip-agents` is provided, THE CLI SHALL NOT create or modify AGENTS.md
5. THE CLI SHALL continue with the rest of `spectrl init` successfully
6. THE CLI SHALL NOT log any messages about AGENTS.md
7. THE flag SHALL work independently of other flags
8. IF both `--skip-agents` and `--force-agents` are provided, THE CLI SHALL exit with error code 1 and message "Cannot use both --skip-agents and --force-agents"

_Requirements: User Story 6_

### Requirement 10: Cancellation Cleanup

**User Story:** As a developer who cancels init with Ctrl+C, I want the partial initialization cleaned up, so that I don't have leftover files

#### Acceptance Criteria

1. WHEN user presses Ctrl+C during any AGENTS.md prompt, THE CLI SHALL abort the entire init operation
2. THE CLI SHALL throw a CLIError with exit code 130 (USER_CANCELLED)
3. THE CLI SHALL display error message "Initialization cancelled by user"
4. IF .spectrl directory was created during this init run, THE CLI SHALL delete it
5. THE CLI SHALL NOT delete .spectrl if it existed before this init run
6. THE CLI SHALL NOT modify any existing AGENTS.md file
7. THE cleanup operation SHALL be silent (no additional messages)
8. IF cleanup fails, THE CLI SHALL ignore the error and continue with abort

_Requirements: User Story 1, User Story 2_

**Note**: This requirement was added during implementation after discovering that Ctrl+C left partial initialization artifacts.

## Non-Functional Requirements

### Compatibility

1. AGENTS.md SHALL use UTF-8 encoding
2. AGENTS.md SHALL use platform-appropriate line endings (LF on Unix, CRLF on Windows)
3. THE markdown syntax SHALL be valid according to CommonMark specification
4. THE template SHALL be compatible with all major AI assistant tools

### Usability

1. All prompts SHALL have clear defaults indicated in the prompt text
2. All prompts SHALL accept both full words and single characters (y/n)
3. Error messages SHALL be actionable and include suggested fixes
4. Log messages SHALL use consistent formatting (✓ for success, ℹ for info, ⚠ for warnings)

### Maintainability

1. THE template content SHALL be defined in a single constant for easy updates
2. THE Spectrl marker SHALL be configurable via constant
3. THE append logic SHALL be extracted into a reusable function
4. THE code SHALL separate template generation from file I/O for testability

### Performance

1. THE AGENTS.md creation operation SHALL complete in less than 100ms
2. THE file detection and reading SHALL complete in less than 50ms

## Out of Scope

The following are explicitly NOT part of this feature:

- Auto-updating AGENTS.md when specs are installed/removed (specs are in `.spectrl/specs/`)
- Tool-specific rule files (`.cursorrules`, `.clinerules`) - may be added later
- Web UI for editing AGENTS.md
- Validation of user customizations to AGENTS.md
- Migration of existing custom instructions to Spectrl format
- Automatic conflict resolution between multiple AGENTS.md sources
- Non-interactive mode handling for CI environments
- Separate commands for AGENTS.md management (all functionality via `spectrl init` flags)
