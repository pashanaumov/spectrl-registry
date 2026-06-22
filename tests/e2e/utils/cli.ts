import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the CLI binary
const CLI_PATH = join(__dirname, '../../../packages/cli/dist/cli.js');

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executes the spectrl CLI command
 */
export async function runCLI(args: string[], options: { cwd?: string } = {}): Promise<CLIResult> {
  try {
    const result = await execa('node', [CLI_PATH, ...args], {
      cwd: options.cwd,
      reject: false,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const execaError = error as { stdout?: string; stderr?: string; exitCode?: number };
    return {
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode || 1,
    };
  }
}

/**
 * Executes spectrl init
 */
export async function init(cwd: string, options?: { skipAgents?: boolean }): Promise<CLIResult> {
  const args = ['init'];
  if (options?.skipAgents !== false) {
    // Default to skipping agents in tests to avoid prompts
    args.push('--skip-agents');
  }
  return runCLI(args, { cwd });
}

/**
 * Executes spectrl publish
 * Automatically selects 'local' destination for the interactive prompt
 */
export async function publish(cwd: string): Promise<CLIResult> {
  try {
    // Use execa directly to provide stdin input for the interactive prompt
    // The prompt uses arrow keys, so we simulate pressing Enter to select the default (local)
    const result = await execa('node', [CLI_PATH, 'publish'], {
      cwd,
      reject: false,
      input: '\n', // Press Enter to select default (local)
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const execaError = error as { stdout?: string; stderr?: string; exitCode?: number };
    return {
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode || 1,
    };
  }
}

/**
 * Executes spectrl install (bulk mode)
 */
export async function install(cwd: string): Promise<CLIResult> {
  return runCLI(['install'], { cwd });
}

/**
 * Executes spectrl install with a spec reference (single spec mode)
 */
export async function installSpec(cwd: string, specRef: string): Promise<CLIResult> {
  return runCLI(['install', specRef], { cwd });
}

/**
 * Executes spectrl new to create a new spec (default type)
 */
export async function newSpec(
  cwd: string,
  name: string,
  version?: string,
  description?: string,
): Promise<CLIResult> {
  const args = ['new', name];
  if (version) {
    args.push('--version', version);
  }
  if (description) {
    args.push('--description', description);
  }
  return runCLI(args, { cwd });
}

/**
 * Executes spectrl new with an explicit type (spec or power)
 * Uses positional syntax: spectrl new <type> <name>
 */
export async function newContent(
  cwd: string,
  name: string,
  type: 'spec' | 'power',
  version?: string,
): Promise<CLIResult> {
  const args = ['new', type, name];
  if (version) {
    args.push('--version', version);
  }
  return runCLI(args, { cwd });
}

/**
 * Executes spectrl new with interactive prompts.
 * Sends stdin input to answer the type select and name input prompts.
 *
 * @param cwd - Working directory
 * @param typeIndex - 0 for spec (default), 1 for power
 * @param name - Name to type into the input prompt
 */
export async function newInteractive(
  cwd: string,
  typeIndex: number,
  name: string,
): Promise<CLIResult> {
  try {
    // Build stdin: arrow-down keys for type selection, then Enter, then name + Enter
    const downArrows = '\x1B[B'.repeat(typeIndex);
    const stdinInput = `${downArrows}\n${name}\n`;

    const result = await execa('node', [CLI_PATH, 'new'], {
      cwd,
      reject: false,
      input: stdinInput,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const execaError = error as { stdout?: string; stderr?: string; exitCode?: number };
    return {
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode || 1,
    };
  }
}

/**
 * Executes spectrl new <type> with interactive name prompt only.
 * Type is provided as positional, name is prompted.
 *
 * @param cwd - Working directory
 * @param type - 'spec' or 'power'
 * @param name - Name to type into the input prompt
 */
export async function newTypeWithPromptedName(
  cwd: string,
  type: 'spec' | 'power',
  name: string,
): Promise<CLIResult> {
  try {
    const result = await execa('node', [CLI_PATH, 'new', type], {
      cwd,
      reject: false,
      input: `${name}\n`,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const execaError = error as { stdout?: string; stderr?: string; exitCode?: number };
    return {
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode || 1,
    };
  }
}
