import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { Registry, computeHash } from '@spectrl/core';
import {
  readAndValidateManifest,
  validateFilePaths,
  validateFilesExist,
  getRegistryPath,
} from '../../utils.js';
import { formatHighlight, ExitCode, CLIError, formatCommand } from '../../errors.js';
import { TokenManager } from '../../auth/token-manager.js';
import { publishSpec as publishToPublicRegistry } from '../../utils/api-client.js';
import type { Manifest } from '@spectrl/schema';

/**
 * Validate manifest fields required for publishing.
 * Throws CLIError for hard failures; emits warnings for soft issues.
 *
 * @param manifest - The manifest to validate
 * @param spinner - The ora spinner (used to emit warnings)
 */
function validateManifestForPublish(manifest: Manifest, spinner: ReturnType<typeof ora>): void {
  // Hard error: description is required
  if (!manifest.description || manifest.description.trim() === '') {
    spinner.stop();
    throw new CLIError(
      'Manifest must include a non-empty "description" field for publishing',
      ExitCode.VALIDATION_ERROR,
    );
  }

  // Hard error: index.md must be in files array
  if (!manifest.files.includes('index.md')) {
    spinner.stop();
    throw new CLIError(
      'Manifest "files" array must include "index.md" for publishing',
      ExitCode.VALIDATION_ERROR,
    );
  }

  // Soft warnings: agent metadata recommended for discoverability
  if (!manifest.agent) {
    spinner.warn('Missing "agent" field — add agent metadata for better discoverability');
  } else {
    if (!manifest.agent.purpose) {
      spinner.warn('Missing "agent.purpose" — add a purpose for better discoverability');
    }
    if (!manifest.agent.tags || manifest.agent.tags.length === 0) {
      spinner.warn('Missing "agent.tags" — add tags for better discoverability');
    }
  }
}

/**
 * Validate that all declared dependencies have the same type as the parent manifest.
 * Skips any dependency not found in the local registry.
 *
 * @param manifest - The manifest being published
 * @param registryPath - Optional registry path override
 */
async function validateDependencyTypes(manifest: Manifest, registryPath?: string): Promise<void> {
  const depEntries = Object.entries(manifest.deps);
  if (depEntries.length === 0) return;

  const registry = new Registry(registryPath ?? getRegistryPath());

  for (const [depName, depVersion] of depEntries) {
    let depManifest: Manifest;
    try {
      depManifest = await registry.getManifest(depName, depVersion);
    } catch {
      // Dependency not in local registry — skip type check, let resolution errors surface normally
      continue;
    }

    const depType = depManifest.type ?? 'spec';
    if (depType !== manifest.type) {
      throw new CLIError(
        `Dependency "${depName}@${depVersion}" is a ${depType} but "${manifest.name}" is a ${manifest.type} — cross-type dependencies are not allowed`,
        ExitCode.VALIDATION_ERROR,
      );
    }
  }
}

/**
 * Publish destination options
 */
type PublishDestination = 'local' | 'public';

/**
 * Publish a spec to local or public registry
 *
 * @param cwd - Current working directory
 * @param registryPath - Optional registry path (defaults to user-level registry)
 */
export async function publish(cwd: string, registryPath?: string): Promise<void> {
  const spinner = ora({ text: 'Publishing spec', spinner: 'line' }).start();

  try {
    // Load and validate manifest from spectrl.json
    spinner.text = 'Validating manifest';
    const manifest = await readAndValidateManifest(cwd);

    // Validate file paths for security (no path traversal, absolute paths, etc.)
    validateFilePaths(manifest.files);

    // Validate that all tracked files exist
    await validateFilesExist(manifest.files, cwd);

    // Validate manifest fields required for publishing (description, index.md, agent warnings)
    validateManifestForPublish(manifest, spinner);

    // Validate that no dependency has a different type than the parent manifest
    await validateDependencyTypes(manifest, registryPath);

    // Stop spinner for interactive prompt
    spinner.stop();

    // Prompt user for destination
    const destination = await select<PublishDestination>({
      message: 'Where do you want to publish?',
      choices: [
        {
          name: 'Local registry (~/.spectrl/registry/)',
          value: 'local',
          description: 'Publish to your local registry (private)',
        },
        {
          name: 'Public registry (spectrl.pro)',
          value: 'public',
          description: 'Publish to the public registry (requires authentication)',
        },
      ],
      default: 'local',
    });

    // Restart spinner
    spinner.start();

    if (destination === 'local') {
      await publishLocal(cwd, manifest, registryPath, spinner);
    } else {
      await publishPublic(cwd, manifest, spinner);
    }
  } catch (error) {
    spinner.stop();

    // Re-throw CLIError as-is (utilities already set correct exit codes)
    if (error instanceof CLIError) {
      throw error;
    }

    // Any other errors are likely I/O errors
    if (error instanceof Error) {
      throw new CLIError(error.message, ExitCode.IO_ERROR);
    }

    // Unknown error type
    throw new CLIError('Unknown error during publish', ExitCode.IO_ERROR);
  }
}

/**
 * Publish a spec to the local registry
 */
async function publishLocal(
  cwd: string,
  manifest: Manifest,
  registryPath: string | undefined,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  // Read file contents for all tracked files
  spinner.text = 'Reading tracked files';
  const fileContents: Record<string, string> = {};
  for (const filePath of manifest.files) {
    const fullPath = join(cwd, filePath);
    try {
      fileContents[filePath] = await readFile(fullPath, 'utf-8');
    } catch (error) {
      // This shouldn't happen since we validated files exist, but handle it anyway
      throw new CLIError(`Failed to read file: ${filePath}`, ExitCode.IO_ERROR);
    }
  }

  // Compute content hash
  spinner.text = 'Hashing content...';
  const hash = computeHash({ manifest, fileContents });

  // Create manifest with hash field
  const manifestWithHash: Manifest = {
    ...manifest,
    hash,
  };

  // Publish to registry (user-level by default: ~/.spectrl/registry)
  spinner.text = 'Writing to registry';
  const registry = new Registry(registryPath ?? getRegistryPath());
  await registry.publish(manifestWithHash, cwd);

  // Success message with spec name, version, and hash
  spinner.stop();
  console.log(chalk.dim(`  ${hash.substring(0, 16)}`));
  console.log(
    `Published ${formatHighlight(manifest.name)}@${formatHighlight(manifest.version)} to local registry`,
  );
}

/**
 * Publish a spec to the public registry
 */
async function publishPublic(
  cwd: string,
  manifest: Manifest,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  // Check authentication
  spinner.text = 'Checking authentication';
  const tokenManager = new TokenManager();
  const token = await tokenManager.get();

  if (!token) {
    spinner.stop();
    throw new CLIError(
      `You need to login first. Run: ${formatCommand('spectrl login')}`,
      ExitCode.AUTHENTICATION_ERROR,
    );
  }

  // Validate description is present (required by API) - fail fast before reading files
  // Note: this check is now handled by validateManifestForPublish before destination selection,
  // but we keep the agent auto-population for API compatibility.

  // Auto-populate agent field if missing (API requires it)
  let manifestToPublish: Manifest = { ...manifest };

  if (!manifestToPublish.agent) {
    spinner.text = 'Auto-populating agent field';
    manifestToPublish = {
      ...manifest,
      agent: {
        purpose: manifestToPublish.description || '',
        tags: [],
      },
    };
  }

  // Read file contents for all tracked files
  spinner.text = 'Reading tracked files';
  const filesRecord: Record<string, string> = {};
  for (const filePath of manifest.files) {
    const fullPath = join(cwd, filePath);
    try {
      const content = await readFile(fullPath, 'utf-8');
      filesRecord[filePath] = content;
    } catch (error) {
      throw new CLIError(`Failed to read file: ${filePath}`, ExitCode.IO_ERROR);
    }
  }

  // Publish to public registry via API
  spinner.text = 'Publishing to public registry';
  try {
    // Convert to Record<string, unknown> for API client (which accepts any manifest structure)
    const manifestRecord: Record<string, unknown> = { ...manifestToPublish };
    const result = await publishToPublicRegistry(token, manifestRecord, filesRecord);

    // Success message with public URL
    spinner.stop();
    console.log(
      `Published ${formatHighlight(result.specId)}@${formatHighlight(result.version)} to public registry`,
    );
    console.log(chalk.dim(`\n  ${result.url}\n`));
  } catch (error) {
    if (error instanceof Error) {
      throw new CLIError(
        `Failed to publish to public registry: ${error.message}`,
        ExitCode.IO_ERROR,
      );
    }
    throw error;
  }
}
