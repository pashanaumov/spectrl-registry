import { access, constants, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { select } from '@inquirer/prompts';
import { ExitCode, CLIError } from './errors.js';

import {
  validateManifest as coreValidateManifest,
  validateFilePaths as coreValidateFilePaths,
  validateFilesExist as coreValidateFilesExist,
  resolveManifestPath,
  readManifestFile,
  parseJsoncString,
} from '@spectrl/core';
import type { Manifest } from '@spectrl/schema';

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is readable
 */
export async function isReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is writable
 */
export async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Assert that a file exists, throw CLIError if not
 */
export async function assertFileExists(path: string, operation?: string): Promise<void> {
  if (!(await fileExists(path))) {
    throw new CLIError(`File not found: ${path}`, ExitCode.IO_ERROR);
  }
}

/**
 * Assert that a file does not exist, throw CLIError if it does
 */
export async function assertFileNotExists(path: string, operation?: string): Promise<void> {
  if (await fileExists(path)) {
    throw new CLIError(`File already exists: ${path}`, ExitCode.VALIDATION_ERROR);
  }
}

/**
 * Get the path to the manifest file (spectrl.jsonc or spectrl.json) in a directory.
 * Prefers spectrl.jsonc, falls back to spectrl.json for backward compatibility.
 */
export async function getManifestPath(cwd: string): Promise<string> {
  return resolveManifestPath(cwd);
}

/**
 * Get the path to the default index file in a directory
 */
export function getDefaultIndexPath(cwd: string): string {
  return join(cwd, 'spectrl-index.json');
}

/**
 * Get the path to the project index file (.spectrl/spectrl-index.json)
 */
export function getProjectIndexPath(cwd: string): string {
  return join(cwd, '.spectrl', 'spectrl-index.json');
}

/**
 * Get the path to the .spectrl directory
 */
export function getProjectDir(cwd: string): string {
  return join(cwd, '.spectrl');
}

/**
 * Get the path to the user-level registry directory
 * Located at ~/.spectrl/registry
 */
export function getRegistryPath(): string {
  return join(homedir(), '.spectrl', 'registry');
}

/**
 * Format a public spec key for use in index files and API calls
 *
 * @param username - Spec owner's username
 * @param name - Spec name
 * @param version - Spec version
 * @returns Formatted spec key (e.g., "alice/my-spec@1.0.0")
 *
 * @example
 * formatPublicSpecKey("alice", "my-spec", "1.0.0") // "alice/my-spec@1.0.0"
 */
export function formatPublicSpecKey(username: string, name: string, version: string): string {
  return `${username}/${name}@${version}`;
}

/**
 * Format a public spec directory name for filesystem paths
 *
 * Uses hyphens instead of slashes to avoid directory nesting issues.
 *
 * @param username - Spec owner's username
 * @param name - Spec name
 * @param version - Spec version
 * @returns Formatted directory name (e.g., "alice-my-spec@1.0.0")
 *
 * @example
 * formatPublicSpecDirName("alice", "my-spec", "1.0.0") // "alice-my-spec@1.0.0"
 */
export function formatPublicSpecDirName(username: string, name: string, version: string): string {
  return `${username}-${name}@${version}`;
}

/**
 * Get the full path to a public spec's directory in the project
 *
 * @param cwd - Current working directory
 * @param username - Spec owner's username
 * @param name - Spec name
 * @param version - Spec version
 * @returns Full path to spec directory
 *
 * @example
 * getPublicSpecPath("/project", "alice", "my-spec", "1.0.0")
 * // "/project/.spectrl/specs/alice-my-spec@1.0.0"
 */
export function getPublicSpecPath(
  cwd: string,
  username: string,
  name: string,
  version: string,
): string {
  return join(cwd, '.spectrl', 'specs', formatPublicSpecDirName(username, name, version));
}

/**
 * Type guard to check if error has a string code property (NodeJS.ErrnoException)
 */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    // After 'in' check, we know error has a code property
    typeof error.code === 'string'
  );
}

/**
 * Type guard to check if error is an Error
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Read and parse a JSON or JSONC file with better error handling.
 * Supports single-line comments (//), multi-line comments (/* *\/), and trailing commas.
 * Note: This returns unknown and requires validation with Zod or similar
 */
export async function readJsonFile(path: string): Promise<unknown> {
  try {
    const content = await readFile(path, 'utf-8');
    return parseJsoncString(content);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new CLIError(`File not found: ${path}`, ExitCode.IO_ERROR);
    }
    if (error instanceof CLIError) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('JSONC parse error')) {
      throw new CLIError(`Invalid JSON in ${path}: ${error.message}`, ExitCode.VALIDATION_ERROR);
    }
    const message = isError(error) ? error.message : 'Unknown error';
    throw new CLIError(`Failed to read ${path}: ${message}`, ExitCode.IO_ERROR);
  }
}

/**
 * Read, parse, and validate manifest file (supports spectrl.jsonc and spectrl.json).
 * Uses core JSONC-aware manifest resolution and wraps errors with appropriate CLI exit codes.
 */
export async function readAndValidateManifest(cwd: string): Promise<Manifest> {
  let rawManifest: unknown;
  try {
    rawManifest = await readManifestFile(cwd);
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    const message = isError(error) ? error.message : 'Unknown error';
    // Distinguish between "not found" and parse errors
    if (message.includes('No manifest found')) {
      throw new CLIError(message, ExitCode.IO_ERROR);
    }
    if (message.startsWith('JSONC parse error')) {
      throw new CLIError(`Invalid JSON in manifest: ${message}`, ExitCode.VALIDATION_ERROR);
    }
    throw new CLIError(`Failed to read manifest: ${message}`, ExitCode.IO_ERROR);
  }

  try {
    return coreValidateManifest(rawManifest);
  } catch (error) {
    const message = isError(error) ? error.message : 'Unknown validation error';
    throw new CLIError(message, ExitCode.VALIDATION_ERROR);
  }
}

/**
 * Validate file paths for security (wraps core validator with CLI error)
 * Checks for path traversal, absolute paths, and duplicates
 */
export function validateFilePaths(paths: string[]): void {
  try {
    coreValidateFilePaths(paths);
  } catch (error) {
    const message = isError(error) ? error.message : 'Invalid file paths';
    throw new CLIError(message, ExitCode.VALIDATION_ERROR);
  }
}

/**
 * Validate that all files exist (wraps core validator with CLI error)
 */
export async function validateFilesExist(paths: string[], basePath: string): Promise<void> {
  try {
    await coreValidateFilesExist(paths, basePath);
  } catch (error) {
    const message = isError(error) ? error.message : 'Files not found';
    throw new CLIError(message, ExitCode.IO_ERROR);
  }
}

/**
 * Prompt user for yes/no selection with arrow key navigation
 * @param message The question to ask
 * @param defaultYes Whether the default is yes (true) or no (false)
 * @param options Optional custom labels for yes/no choices
 * @returns true for yes, false for no, or undefined if cancelled (Ctrl+C)
 */
export async function promptYesNo(
  message: string,
  defaultYes = true,
  options?: { yesLabel?: string; noLabel?: string },
): Promise<boolean | undefined> {
  try {
    const yesLabel = options?.yesLabel || 'Yes';
    const noLabel = options?.noLabel || 'No';

    const answer = await select({
      message,
      choices: [
        { name: yesLabel, value: true },
        { name: noLabel, value: false },
      ],
      default: defaultYes,
    });

    return answer;
  } catch (error) {
    // User cancelled with Ctrl+C
    return undefined;
  }
}

/**
 * Console output helpers for consistent stdout/stderr usage
 */
export const output = {
  /**
   * Write to stdout (for normal output)
   */
  log(message: string): void {
    console.log(message);
  },

  /**
   * Write to stderr (for errors)
   */
  error(message: string): void {
    console.error(message);
  },
} as const;

/**
 * Gitignore pattern for Spectrl
 * Ignores downloaded specs but allows index and lock files to be committed
 */
const SPECTRL_GITIGNORE_PATTERN = `
# Spectrl local registry
# Track index and lock files, but ignore downloaded specs (like node_modules)
.spectrl/specs/
`;

/**
 * Check if gitignore file contains any Spectrl-related pattern
 * Returns true if any .spectrl pattern is found (even old ones)
 * This is a read-only check that never modifies the file
 */
export async function hasSpectrlGitignorePattern(cwd: string): Promise<boolean> {
  const gitignorePath = join(cwd, '.gitignore');

  try {
    const content = await readFile(gitignorePath, 'utf-8');
    // Check for any .spectrl pattern (new or old)
    return content.includes('.spectrl/');
  } catch (error) {
    // If file doesn't exist or can't be read, return false
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return false;
    }
    // For other errors, assume pattern doesn't exist
    return false;
  }
}

/**
 * Ensure .gitignore has the Spectrl pattern
 * - If .gitignore doesn't exist, create it with the pattern
 * - If .gitignore exists but missing pattern, append it
 * - If .gitignore already has any .spectrl pattern, do nothing (idempotent)
 * - Never modifies existing lines, only appends to the end
 *
 * @returns true if pattern was added, false if it already existed
 */
export async function ensureSpectrlGitignore(cwd: string): Promise<boolean> {
  const gitignorePath = join(cwd, '.gitignore');

  // Check if pattern already exists
  if (await hasSpectrlGitignorePattern(cwd)) {
    return false; // Pattern already exists, nothing to do
  }

  try {
    // Try to read existing content
    let existingContent = '';
    try {
      existingContent = await readFile(gitignorePath, 'utf-8');
    } catch (error) {
      // File doesn't exist, that's fine - we'll create it
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error; // Re-throw if it's not a "file not found" error
      }
    }

    // Prepare new content
    let newContent = existingContent;

    // If file has content and doesn't end with newline, add one
    if (existingContent.length > 0 && !existingContent.endsWith('\n')) {
      newContent += '\n';
    }

    // Append the Spectrl pattern
    newContent += SPECTRL_GITIGNORE_PATTERN;

    // Write the file (create or overwrite)
    const { writeFile } = await import('node:fs/promises');
    await writeFile(gitignorePath, newContent, 'utf-8');

    return true; // Pattern was added
  } catch (error) {
    // If we can't write the file, throw a CLI error
    const message = isError(error) ? error.message : 'Failed to update .gitignore';
    throw new CLIError(`Failed to configure .gitignore: ${message}`, ExitCode.IO_ERROR);
  }
}
