# Design Document: AGENTS.md Auto-Generation

## Overview

This feature adds AGENTS.md file management to the `spectrl init` command. The design integrates seamlessly with the existing CLI architecture, following established patterns for file operations, error handling, and user interaction.

The implementation adds:

- AGENTS.md creation logic integrated into the init command
- Two new CLI flags: `--skip-agents` and `--force-agents`
- Interactive prompting for append operations
- Template management for the AGENTS.md content
- Idempotent behavior for safe re-runs

## Architecture

### High-Level Flow

```
spectrl init [--skip-agents | --force-agents]
    ↓
Parse flags
    ↓
Create .spectrl/spectrl-index.json (existing logic)
    ↓
AGENTS.md Logic:
    ├─ --skip-agents? → Skip entirely
    ├─ --force-agents? → Create/append without prompting (never overwrite)
    │   ├─ No file? → Create new
    │   ├─ Has marker? → Skip (idempotent)
    │   └─ No marker? → Append (preserve custom content)
    └─ Default flow:
        ├─ File exists?
        │   ├─ Has marker? → Skip (idempotent)
        │   └─ No marker? → Prompt to append
        └─ No file? → Prompt to create
    ↓
If Ctrl+C during prompt:
    ├─ Throw USER_CANCELLED error
    ├─ Clean up .spectrl if created this run
    └─ Abort init
    ↓
Configure .gitignore (existing logic)
    ↓
Success
```

### Component Structure

```
packages/cli/src/
├── commands/
│   ├── init.ts                    # Modified: orchestrates AGENTS.md logic
│   └── init.test.ts               # Modified: add AGENTS.md tests
├── agents/
│   ├── template.ts                # New: AGENTS.md template constant
│   ├── manager.ts                 # New: AGENTS.md file operations
│   └── manager.test.ts            # New: unit tests
├── utils.ts                       # Modified: add prompt utility
└── cli.ts                         # Modified: add flags to init command
```

## Components and Interfaces

### 1. Template Module (`agents/template.ts`)

**Purpose:** Define the AGENTS.md template content as a constant.

```typescript
/**
 * Marker used to identify Spectrl-generated content in AGENTS.md
 */
export const SPECTRL_MARKER = '<!-- Added by Spectrl -->';

/**
 * Complete AGENTS.md template content
 * This is the content that appears after the marker
 */
export const AGENTS_TEMPLATE = `# Instructions for AI Assistants

## What is Spectrl?
...
[Full template content from __AGENTS.md]
`;

/**
 * Get the complete AGENTS.md content for a new file
 * Includes marker as first line followed by template
 */
export function getNewFileContent(): string {
  return `${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`;
}

/**
 * Get the content to append to an existing AGENTS.md
 * Includes separator, marker, and template
 */
export function getAppendContent(): string {
  return `\n\n---\n\n${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`;
}
```

### 2. Manager Module (`agents/manager.ts`)

**Purpose:** Handle all AGENTS.md file operations.

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SPECTRL_MARKER, getNewFileContent, getAppendContent } from './template.js';
import { fileExists } from '../utils.js';
import { CLIError, ExitCode } from '../errors.js';

/**
 * Result of checking AGENTS.md status
 */
export type AgentsStatus =
  | { exists: false }
  | { exists: true; hasMarker: true }
  | { exists: true; hasMarker: false };

/**
 * Check the status of AGENTS.md in the given directory
 */
export async function checkAgentsStatus(cwd: string): Promise<AgentsStatus> {
  const agentsPath = join(cwd, 'AGENTS.md');

  if (!(await fileExists(agentsPath))) {
    return { exists: false };
  }

  try {
    const content = await readFile(agentsPath, 'utf-8');
    const hasMarker = content.includes(SPECTRL_MARKER);
    return { exists: true, hasMarker };
  } catch (error) {
    // If we can't read the file, treat it as if it doesn't exist
    return { exists: false };
  }
}

/**
 * Create a new AGENTS.md file with the Spectrl template
 */
export async function createAgentsFile(cwd: string): Promise<void> {
  const agentsPath = join(cwd, 'AGENTS.md');
  const content = getNewFileContent();

  try {
    await writeFile(agentsPath, content, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new CLIError(`Failed to create AGENTS.md: ${message}`, ExitCode.IO_ERROR);
  }
}

/**
 * Append Spectrl instructions to an existing AGENTS.md file
 */
export async function appendToAgentsFile(cwd: string): Promise<void> {
  const agentsPath = join(cwd, 'AGENTS.md');

  try {
    // Read existing content
    let existingContent = await readFile(agentsPath, 'utf-8');

    // Trim trailing whitespace
    existingContent = existingContent.trimEnd();

    // Append Spectrl section
    const newContent = existingContent + getAppendContent();

    // Write atomically
    await writeFile(agentsPath, newContent, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new CLIError(`Failed to append to AGENTS.md: ${message}`, ExitCode.IO_ERROR);
  }
}
```

### 3. Prompt Utility (`utils.ts`)

**Purpose:** Add interactive prompting capability using the `prompts` library.

```typescript
import prompts from 'prompts';

/**
 * Prompt user for yes/no selection with arrow key navigation
 * @param message The question to ask
 * @param defaultYes Whether the default is yes (true) or no (false)
 * @param options Optional custom labels for yes/no choices
 * @returns true for yes, false for no, or undefined if cancelled
 */
export async function promptYesNo(
  message: string,
  defaultYes: boolean = true,
  options?: { yesLabel?: string; noLabel?: string },
): Promise<boolean | undefined> {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message,
    choices: [
      { title: options?.yesLabel || 'Yes', value: true },
      { title: options?.noLabel || 'No', value: false },
    ],
    initial: defaultYes ? 0 : 1,
  });

  return response.value;
}
```

### 4. Modified Init Command (`commands/init.ts`)

**Purpose:** Orchestrate AGENTS.md logic within the init flow.

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import ora from 'ora';
import {
  getProjectIndexPath,
  getProjectDir,
  assertFileNotExists,
  ensureSpectrlGitignore,
  promptYesNo,
} from '../utils.js';
import { formatHighlight, formatInfo, formatWarning } from '../errors.js';
import { output } from '../utils.js';
import type { Index } from '@spectrl/schema';
import { checkAgentsStatus, createAgentsFile, appendToAgentsFile } from '../agents/manager.js';

export interface InitOptions {
  skipAgents?: boolean;
  forceAgents?: boolean;
}

/**
 * Initialize a new project with a local spec index
 */
export async function init(cwd: string, options: InitOptions = {}): Promise<void> {
  const spinner = ora({ text: 'Initializing project', spinner: 'line' }).start();

  try {
    // Validate flag conflicts
    if (options.skipAgents && options.forceAgents) {
      spinner.stop();
      throw new CLIError(
        'Cannot use both --skip-agents and --force-agents',
        ExitCode.VALIDATION_ERROR,
      );
    }

    const projectIndexPath = getProjectIndexPath(cwd);

    // Check if project index already exists
    await assertFileNotExists(projectIndexPath);

    // Create .spectrl directory
    const projectDir = getProjectDir(cwd);
    await mkdir(projectDir, { recursive: true });

    // Create empty project index
    const index: Index = {};

    // Write formatted JSON with 2-space indentation and trailing newline
    const content = `${JSON.stringify(index, null, 2)}\n`;
    await writeFile(projectIndexPath, content, 'utf-8');

    // Handle AGENTS.md based on flags and existing state
    await handleAgentsFile(cwd, options, spinner);

    // Configure .gitignore to track index/lock files but ignore specs
    spinner.text = 'Configuring .gitignore';
    const gitignoreUpdated = await ensureSpectrlGitignore(cwd);

    // Success message
    const gitignoreMessage = gitignoreUpdated
      ? ' and configured .gitignore'
      : ' (.gitignore already configured)';
    spinner.succeed(
      `Initialized project index at ${formatHighlight('.spectrl/spectrl-index.json')}${gitignoreMessage}`,
    );
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Handle AGENTS.md file creation/update based on options and current state
 */
async function handleAgentsFile(
  cwd: string,
  options: InitOptions,
  spinner: ora.Ora,
): Promise<void> {
  // Skip entirely if --skip-agents
  if (options.skipAgents) {
    return;
  }

  // Force overwrite if --force-agents
  if (options.forceAgents) {
    spinner.text = 'Creating AGENTS.md';
    try {
      await createAgentsFile(cwd);
      spinner.text = 'Initializing project';
      output.log(formatInfo('✓ Created AGENTS.md'));
    } catch (error) {
      // Non-critical - log warning and continue
      spinner.text = 'Initializing project';
      output.log(formatWarning('Failed to create AGENTS.md (non-critical)'));
    }
    return;
  }

  // Default flow: check status and handle accordingly
  const status = await checkAgentsStatus(cwd);

  if (!status.exists) {
    // Prompt to create new file
    spinner.stop();
    const shouldCreate = await promptYesNo('Create AGENTS.md to configure AI assistants?', true, {
      yesLabel: 'Yes (recommended)',
      noLabel: 'No',
    });

    // Handle cancellation (Ctrl+C)
    if (shouldCreate === undefined) {
      output.log(formatInfo('ℹ Skipped AGENTS.md creation'));
      output.log(
        formatInfo(
          "AI assistants won't automatically consult specs. You can create AGENTS.md manually later.",
        ),
      );
      spinner.start('Initializing project');
      return;
    }

    spinner.start('Initializing project');

    if (shouldCreate) {
      spinner.text = 'Creating AGENTS.md';
      try {
        await createAgentsFile(cwd);
        spinner.text = 'Initializing project';
        output.log(formatInfo('✓ Created AGENTS.md'));
      } catch (error) {
        // Non-critical - log warning and continue
        spinner.text = 'Initializing project';
        output.log(formatWarning('Failed to create AGENTS.md (non-critical)'));
      }
    } else {
      output.log(formatInfo('ℹ Skipped AGENTS.md creation'));
      output.log(
        formatInfo(
          "AI assistants won't automatically consult specs. You can create AGENTS.md manually later.",
        ),
      );
    }
    return;
  }

  if (status.hasMarker) {
    // Already has Spectrl instructions - idempotent
    spinner.text = 'Initializing project';
    output.log(formatInfo('✓ AGENTS.md already contains Spectrl instructions'));
    return;
  }

  // File exists without marker - prompt to append
  spinner.stop();
  const shouldAppend = await promptYesNo(
    'AGENTS.md found. Append Spectrl instructions to the bottom?',
    true,
    { yesLabel: 'Yes (recommended)', noLabel: 'No' },
  );

  // Handle cancellation (Ctrl+C)
  if (shouldAppend === undefined) {
    output.log(formatInfo('ℹ Skipped AGENTS.md update'));
    output.log(formatInfo('You can add Spectrl instructions manually if needed'));
    spinner.start('Initializing project');
    return;
  }

  spinner.start('Initializing project');

  if (shouldAppend) {
    spinner.text = 'Updating AGENTS.md';
    try {
      await appendToAgentsFile(cwd);
      spinner.text = 'Initializing project';
      output.log(formatInfo('✓ Added Spectrl instructions to AGENTS.md'));
    } catch (error) {
      // Non-critical - log warning and continue
      spinner.text = 'Initializing project';
      output.log(formatWarning('Failed to update AGENTS.md (non-critical)'));
    }
  } else {
    output.log(formatInfo('ℹ Skipped AGENTS.md update'));
    output.log(formatInfo('You can add Spectrl instructions manually if needed'));
  }
}
```

### 5. Modified CLI Entry Point (`cli.ts`)

**Purpose:** Add flags to the init command.

```typescript
import { command, subcommands, run, flag } from 'cmd-ts';
import { init } from './commands/init.js';
// ... other imports

/**
 * Initialize command - creates a new project index
 */
const initCmd = command({
  name: 'init',
  description: 'Initialize a new project with a local spec index',
  args: {
    skipAgents: flag({
      long: 'skip-agents',
      description: 'Skip AGENTS.md creation/update entirely',
      defaultValue: () => false,
    }),
    forceAgents: flag({
      long: 'force-agents',
      description: 'Force overwrite AGENTS.md with fresh template',
      defaultValue: () => false,
    }),
  },
  handler: async (args) => {
    await init(process.cwd(), {
      skipAgents: args.skipAgents,
      forceAgents: args.forceAgents,
    });
  },
});

// ... rest of CLI setup
```

## Data Models

### AgentsStatus Type

```typescript
type AgentsStatus =
  | { exists: false }
  | { exists: true; hasMarker: true }
  | { exists: true; hasMarker: false };
```

This discriminated union clearly represents the three possible states of AGENTS.md:

1. File doesn't exist
2. File exists with Spectrl marker (already configured)
3. File exists without marker (needs append prompt)

### InitOptions Interface

```typescript
interface InitOptions {
  skipAgents?: boolean;
  forceAgents?: boolean;
}
```

Simple options object for the init command flags.

## Error Handling

### Non-Critical Operations

AGENTS.md operations are non-critical - if they fail, the init command should continue successfully. This is implemented by:

1. Wrapping AGENTS.md operations in try-catch blocks
2. Logging warnings instead of throwing errors
3. Continuing with the rest of the init flow

### Critical Validation

Flag conflicts are critical and should fail fast:

```typescript
if (options.skipAgents && options.forceAgents) {
  throw new CLIError('Cannot use both --skip-agents and --force-agents', ExitCode.VALIDATION_ERROR);
}
```

### File Operation Errors

File operations use the existing error handling patterns:

- `CLIError` with appropriate exit codes
- Descriptive error messages
- Graceful degradation for non-critical operations

## Testing Strategy

### Unit Tests

**`agents/manager.test.ts`:**

- Test `checkAgentsStatus` with various file states
- Test `createAgentsFile` creates correct content
- Test `appendToAgentsFile` preserves existing content
- Test error handling for file operations

**`utils.test.ts`:**

- Test `promptYesNo` with various inputs
- Test default value handling
- Test invalid input re-prompting

### Integration Tests

**`commands/init.test.ts`:**

- Test init with no AGENTS.md (creates new)
- Test init with existing AGENTS.md without marker (prompts)
- Test init with existing AGENTS.md with marker (idempotent)
- Test init with `--skip-agents` flag
- Test init with `--force-agents` flag
- Test init with both flags (error)
- Test non-critical failure handling

### Test Utilities

Use existing test patterns:

- Temporary directories for file operations
- Mock file system operations where appropriate
- Mock stdin/stdout for prompt testing

## Implementation Considerations

### Line Endings

The implementation should preserve platform-appropriate line endings:

- Use Node.js default behavior (platform-specific)
- Don't force LF or CRLF
- Let the file system handle line ending conversion

### Atomic Operations

File writes should be atomic to prevent partial writes:

- Use `writeFile` which is atomic on most systems
- Read entire file, modify in memory, write back
- No streaming or partial writes

### Template Updates

The template is defined as a constant, making it easy to update:

- Single source of truth in `template.ts`
- No need to read from external files
- Version control tracks template changes

### Spinner Management

The spinner needs careful management during prompts:

- Stop spinner before prompting (blocks terminal)
- Restart spinner after prompt
- Update spinner text appropriately

### Idempotency

The implementation is idempotent by design:

- Marker detection prevents duplicate appends
- Multiple runs produce identical results
- Safe to run `spectrl init` multiple times

## Dependencies

### New Dependencies

- `prompts` - Lightweight, beautiful interactive prompts with arrow key navigation
- `@types/prompts` - TypeScript type definitions for prompts (dev dependency)

### Existing Dependencies

- `ora` - Spinner (already used)
- `chalk` - Colors (already used)
- `cmd-ts` - CLI framework (already used)
- `node:fs/promises` - File operations (already used)

## Migration Path

This is a new feature with no migration needed. Existing projects:

- Can run `spectrl init` again (idempotent)
- Will be prompted to add AGENTS.md if it doesn't exist
- Won't be affected if they already have AGENTS.md with custom content

## Future Enhancements

Out of scope for this implementation but possible future additions:

1. **Template versioning**: Track template version in marker for future updates
2. **Separate commands**: Add `spectrl agents` subcommand group if needed
3. **Tool-specific files**: Generate `.cursorrules`, `.clinerules`, etc.
4. **Auto-update**: Update AGENTS.md when specs are installed/removed
5. **Validation**: Validate user customizations don't break AI assistant parsing
6. **Non-interactive mode**: Support CI environments with environment variables

## Design Decisions

### Why integrate into init instead of separate command?

- Simpler user experience (one command does everything)
- Follows the pattern of other init-time setup (gitignore)
- Reduces command surface area
- Can add separate commands later if needed

### Why make AGENTS.md operations non-critical?

- Init should succeed even if AGENTS.md fails
- AGENTS.md is optional (can be added manually)
- Prevents init failures due to permission issues
- Matches the pattern of gitignore handling

### Why use a marker instead of parsing structure?

- Simple and reliable detection
- Works regardless of file structure
- Easy to implement and test
- Allows users to customize freely
- HTML comments are invisible to AI assistants

### Why prompt for both creation and append instead of automatic creation?

- Respects user control over their project structure
- Engineers appreciate agency over their tooling decisions
- Prevents forcing a specific workflow on users
- Allows users to decline and add manually later if they change their mind
- Follows principle of explicit consent
- "Recommended" label guides without forcing
- Clear explanation of implications helps users make informed decisions

### Why mark "Yes" as recommended?

- Provides guidance for users who are unsure
- Communicates best practice without being prescriptive
- Balances user agency with helpful defaults
- Makes the tool's opinion clear while respecting user choice

### Why use prompts library?

- Lightweight and minimal (aligns with project philosophy)
- Provides better UX with arrow key navigation
- Visual selection is more intuitive than typing y/n
- Handles edge cases (Ctrl+C, invalid input) automatically
- Small bundle size impact for significant UX improvement

## Implementation Changes

During implementation and testing, the following changes were made to improve the design:

### Change 1: --force-agents Behavior

**Original Design**: Overwrite existing AGENTS.md completely  
**Implemented Behavior**: Append without prompting (preserve custom content)

**Rationale**: Overwriting would destroy user's custom instructions, which is dangerous and unexpected. The new behavior:

- Creates new file if none exists
- Appends to existing file without marker (preserves custom content)
- Is idempotent if marker already exists
- Never destroys data

This aligns better with the principle of respecting user content while still providing the "force" behavior of skipping prompts.

### Change 2: Ctrl+C Cleanup

**Original Design**: Ctrl+C skips AGENTS.md and continues init  
**Implemented Behavior**: Ctrl+C aborts entire init and cleans up

**Rationale**: When users press Ctrl+C, they expect to abort the entire operation, not just skip one step. The new behavior:

- Throws CLIError with USER_CANCELLED exit code (130)
- Cleans up .spectrl directory if it was created during this run
- Leaves no partial initialization artifacts
- Matches standard CLI tool behavior

This provides a better user experience and prevents confusion from partial initialization.

### Change 3: Exit Code for Cancellation

**Added**: `USER_CANCELLED = 130` exit code in `ExitCode` enum

**Rationale**: Exit code 130 is the standard Unix exit code for SIGINT (Ctrl+C), calculated as 128 + signal number 2. This allows scripts and automation to distinguish between user cancellation and other errors.

### Testing Impact

These changes were discovered and validated during manual testing (Task 10). All requirements and tests were updated to reflect the new behavior. The changes improve safety, user experience, and align with standard CLI conventions.
