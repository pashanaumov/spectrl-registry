import { writeFile, mkdir, rm } from 'node:fs/promises';
import ora, { type Ora } from 'ora';
import {
  getProjectIndexPath,
  getProjectDir,
  assertFileNotExists,
  ensureSpectrlGitignore,
  fileExists,
  promptYesNo,
  output,
} from '../../utils.js';
import { formatHighlight, formatInfo, formatWarning, CLIError, ExitCode } from '../../errors.js';
import type { Index } from '@spectrl/schema';
import { checkAgentsStatus, createAgentsFile, appendToAgentsFile } from '../../agents/manager.js';

export interface InitOptions {
  skipAgents?: boolean;
  forceAgents?: boolean;
}

export interface EnsureInitResult {
  wasInitialized: boolean;
}

/**
 * Ensures the project is initialized. If .spectrl directory doesn't exist,
 * creates it with an empty index and handles AGENTS.md setup.
 * If it already exists, returns immediately.
 *
 * Unlike `init`, this function is idempotent — it does not error when
 * the project is already initialized.
 */
export async function ensureInitialized(
  cwd: string,
  options: { skipAgents?: boolean; spinner?: Ora } = {},
): Promise<EnsureInitResult> {
  const projectIndexPath = getProjectIndexPath(cwd);

  // Already initialized — nothing to do
  if (await fileExists(projectIndexPath)) {
    return { wasInitialized: false };
  }

  const projectDir = getProjectDir(cwd);
  const spinner = options.spinner ?? ora({ spinner: 'line' });
  const ownsSpinner = !options.spinner;

  if (ownsSpinner) {
    spinner.start('Initializing project');
  } else {
    spinner.text = 'Initializing spectrl in this project';
  }

  try {
    // Create .spectrl directory
    await mkdir(projectDir, { recursive: true });

    // Create empty project index
    const index: Index = {};
    const content = `${JSON.stringify(index, null, 2)}\n`;
    await writeFile(projectIndexPath, content, 'utf-8');

    // Handle AGENTS.md — skip prompts in non-interactive terminals
    const skipAgents = options.skipAgents ?? !process.stdin.isTTY;
    await handleAgentsFile(cwd, { skipAgents }, spinner);

    // Configure .gitignore
    spinner.text = 'Configuring .gitignore';
    await ensureSpectrlGitignore(cwd);

    // Confirmation message
    const msg = 'Initialized spectrl in this project';
    if (ownsSpinner) {
      spinner.succeed(msg);
    } else {
      output.log(formatInfo(`✓ ${msg}`));
    }

    return { wasInitialized: true };
  } catch (error) {
    // Clean up partially created .spectrl directory
    if (error instanceof CLIError && error.exitCode === ExitCode.USER_CANCELLED) {
      try {
        await rm(projectDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    if (ownsSpinner) {
      spinner.stop();
    }

    throw error;
  }
}

/**
 * Initialize a new project with a local spec index
 */
export async function init(cwd: string, options: InitOptions = {}): Promise<void> {
  output.log(
    formatWarning(
      'Note: "spectrl init" is deprecated. "spectrl install" now auto-initializes when needed.\n' +
        'This command will be removed in a future version.',
    ),
  );

  const spinner = ora({ text: 'Initializing project', spinner: 'line' }).start();
  const projectDir = getProjectDir(cwd);
  let shouldCleanup = false;

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
    await mkdir(projectDir, { recursive: true });
    shouldCleanup = true; // Enable cleanup if we created the directory

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

    // Clean up .spectrl directory if user cancelled and we created it
    if (shouldCleanup && error instanceof CLIError && error.exitCode === ExitCode.USER_CANCELLED) {
      try {
        await rm(projectDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    throw error;
  }
}

/**
 * Handle AGENTS.md file creation/update based on options and current state
 */
async function handleAgentsFile(cwd: string, options: InitOptions, spinner: Ora): Promise<void> {
  // Skip entirely if --skip-agents
  if (options.skipAgents) {
    return;
  }

  // Force create/append if --force-agents (without prompting)
  if (options.forceAgents) {
    const status = await checkAgentsStatus(cwd);

    if (!status.exists) {
      // Create new file
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
    } else if (!status.hasMarker) {
      // Append to existing file
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
      // Already has marker - idempotent
      spinner.text = 'Initializing project';
      output.log(formatInfo('✓ AGENTS.md already contains Spectrl instructions'));
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

    // Handle cancellation (Ctrl+C) - abort entire init
    if (shouldCreate === undefined) {
      throw new CLIError('Initialization cancelled by user', ExitCode.USER_CANCELLED);
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

  // Handle cancellation (Ctrl+C) - abort entire init
  if (shouldAppend === undefined) {
    throw new CLIError('Initialization cancelled by user', ExitCode.USER_CANCELLED);
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
