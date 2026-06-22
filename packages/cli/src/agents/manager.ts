/**
 * Manager module for AGENTS.md file operations
 * Handles creation, detection, and modification of AGENTS.md files
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SPECTRL_MARKER, getNewFileContent, getAppendContent } from './template.js';
import { fileExists } from '../utils.js';
import { CLIError, ExitCode } from '../errors.js';

/**
 * Result of checking AGENTS.md status
 * Discriminated union for type-safe status checking
 */
export type AgentsStatus =
  | { exists: false }
  | { exists: true; hasMarker: true }
  | { exists: true; hasMarker: false };

/**
 * Check the status of AGENTS.md in the given directory
 * @param cwd Current working directory
 * @returns Status object indicating file existence and marker presence
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
 * Marker is written as the first line followed by the template
 * @param cwd Current working directory
 * @throws CLIError if file creation fails
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
 * Reads entire file, trims trailing whitespace, appends separator and content
 * Operation is atomic - no partial writes on failure
 * @param cwd Current working directory
 * @throws CLIError if file read or write fails
 */
export async function appendToAgentsFile(cwd: string): Promise<void> {
  const agentsPath = join(cwd, 'AGENTS.md');

  try {
    // Read existing content
    let existingContent = await readFile(agentsPath, 'utf-8');

    // Trim trailing whitespace
    existingContent = existingContent.trimEnd();

    // Append Spectrl section with separator
    const newContent = existingContent + getAppendContent();

    // Write atomically
    await writeFile(agentsPath, newContent, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new CLIError(`Failed to append to AGENTS.md: ${message}`, ExitCode.IO_ERROR);
  }
}
