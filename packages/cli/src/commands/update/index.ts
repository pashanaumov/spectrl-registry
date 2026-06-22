import chalk from 'chalk';
import Table from 'cli-table3';
import semver from 'semver';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import fse from 'fs-extra';
import { getProjectIndexPath, formatPublicSpecKey, getPublicSpecPath } from '../../utils.js';
import { parseSpecRef } from '../../utils/spec-ref.js';
import { getSpec, ApiError } from '../../utils/api-client.js';
import { CLIError, ExitCode, formatHighlight, formatCommand } from '../../errors.js';
import { output } from '../../utils.js';
import { installFromPublic } from '../install/index.js';

/**
 * Update information for a spec
 */
interface UpdateInfo {
  specKey: string;
  username: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
}

/**
 * Read the project index
 *
 * @param cwd - Current working directory
 * @returns Project index object
 * @throws {CLIError} If index cannot be read
 */
async function readProjectIndex(
  cwd: string,
): Promise<Record<string, { source: string; hash: string }>> {
  try {
    const indexPath = getProjectIndexPath(cwd);
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(indexContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CLIError(
        `Project not initialized\n\nRun: ${formatCommand('spectrl init')}`,
        ExitCode.VALIDATION_ERROR,
      );
    }

    throw new CLIError(
      `Failed to read project index: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.IO_ERROR,
    );
  }
}

/**
 * Check for available updates for all public specs
 *
 * @param cwd - Current working directory
 * @returns Array of update information
 */
async function checkForUpdates(cwd: string): Promise<UpdateInfo[]> {
  const index = await readProjectIndex(cwd);
  const updates: UpdateInfo[] = [];

  // Filter for public specs (source starts with https:// or http://)
  const publicSpecs = Object.entries(index).filter(
    ([_, data]) => data.source.startsWith('https://') || data.source.startsWith('http://'),
  );

  if (publicSpecs.length === 0) {
    return [];
  }

  // Check each public spec for updates
  for (const [specKey] of publicSpecs) {
    try {
      // Parse spec key to extract username, name, and current version
      // Public spec keys have format: username/name@version
      const parsed = parseSpecRef(specKey);

      if (!parsed.isPublic || !parsed.username || !parsed.version) {
        continue;
      }

      const { username, name, version: currentVersion } = parsed;

      // Fetch latest version from API
      const specMetadata = await getSpec(username, name);

      if (specMetadata.versions.length === 0) {
        continue;
      }

      const latestVersion = specMetadata.versions[0].version;

      // Compare versions using semver
      if (semver.valid(currentVersion) && semver.valid(latestVersion)) {
        if (semver.gt(latestVersion, currentVersion)) {
          updates.push({
            specKey,
            username,
            name,
            currentVersion,
            latestVersion,
          });
        }
      }
    } catch (error) {
      // Skip specs that fail to fetch (network errors, not found, etc.)
      // Don't fail the entire update check because of one spec
    }
  }

  return updates;
}

/**
 * Update a single spec to a specific version
 *
 * This removes the old version from the index and project directory,
 * then installs the new version.
 *
 * @param username - Spec owner's username
 * @param name - Spec name
 * @param newVersion - New version to install
 * @param cwd - Current working directory
 */
async function updateSingleSpec(
  username: string,
  name: string,
  newVersion: string,
  cwd: string,
): Promise<void> {
  // Read current index to find old version
  const index = await readProjectIndex(cwd);

  // Find all versions of this spec currently installed
  const oldVersionKeys = Object.keys(index).filter((key) => {
    const parsed = parseSpecRef(key);
    return parsed.isPublic && parsed.username === username && parsed.name === name;
  });

  // Install new version first (this will handle collision detection)
  await installFromPublic(
    {
      username,
      name,
      version: newVersion,
    },
    { cwd, registry: undefined },
  );

  // Remove old versions from index and filesystem
  if (oldVersionKeys.length > 0) {
    const indexPath = getProjectIndexPath(cwd);
    const updatedIndex = await readProjectIndex(cwd);

    for (const oldKey of oldVersionKeys) {
      // Skip if this is the version we just installed
      if (oldKey === formatPublicSpecKey(username, name, newVersion)) {
        continue;
      }

      // Remove from index
      delete updatedIndex[oldKey];

      // Remove from filesystem
      const parsed = parseSpecRef(oldKey);
      if (parsed.version) {
        const oldPath = getPublicSpecPath(cwd, username, name, parsed.version);
        try {
          await fse.remove(oldPath);
        } catch (error) {
          // Ignore errors removing old files - they might not exist
        }
      }
    }

    // Write updated index
    await fs.writeFile(indexPath, `${JSON.stringify(updatedIndex, null, 2)}\n`, 'utf-8');
  }
}

/**
 * Update command - check for and install spec updates
 *
 * Supports two modes:
 * 1. No arguments: Show available updates
 * 2. Specific spec: Update that spec
 * 3. --all flag: Update all specs
 *
 * @param specRef - Optional spec reference to update
 * @param options - Command options
 * @param options.all - Update all specs
 * @param options.cwd - Current working directory
 */
export async function update(
  specRef?: string,
  options: { all?: boolean; cwd?: string } = {},
): Promise<void> {
  const cwd = options.cwd || process.cwd();

  try {
    // If specific spec provided, update it
    if (specRef) {
      return await updateSpecificSpec(specRef, cwd);
    }

    // Check for updates
    output.log(chalk.dim('Checking for updates...\n'));

    const updates = await checkForUpdates(cwd);

    if (updates.length === 0) {
      output.log(chalk.green('✓ All specs are up to date\n'));
      return;
    }

    // Show updates table
    output.log(chalk.bold('Updates available:\n'));

    const table = new Table({
      head: [chalk.cyan('Spec'), chalk.cyan('Installed'), chalk.cyan('Latest')],
      colWidths: [30, 15, 15],
      style: {
        head: [],
        border: ['dim'],
      },
    });

    for (const { username, name, currentVersion, latestVersion } of updates) {
      table.push([
        chalk.bold(`${username}/${name}`),
        chalk.yellow(currentVersion),
        chalk.green(latestVersion),
      ]);
    }

    output.log(table.toString());
    output.log('');
    output.log(chalk.dim("Run 'spectrl update <spec>' to update a specific spec"));
    output.log(chalk.dim("Run 'spectrl update --all' to update all specs\n"));

    // If --all flag, update all
    if (options.all) {
      output.log(chalk.bold('Updating all specs...\n'));

      for (const { username, name, latestVersion } of updates) {
        output.log(chalk.dim(`Updating ${formatHighlight(`${username}/${name}`)}...`));
        await updateSingleSpec(username, name, latestVersion, cwd);
      }

      output.log('');
      output.log(
        chalk.green(`✓ Updated ${updates.length} spec${updates.length === 1 ? '' : 's'}\n`),
      );
    }
  } catch (error) {
    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Wrap other errors
    throw new CLIError(
      `Update failed: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.IO_ERROR,
    );
  }
}

/**
 * Update a specific spec by reference
 *
 * @param specRef - Spec reference (username/name or username/name@version)
 * @param cwd - Current working directory
 */
async function updateSpecificSpec(specRef: string, cwd: string): Promise<void> {
  try {
    // Parse spec reference
    const parsed = parseSpecRef(specRef);

    if (!parsed.isPublic || !parsed.username) {
      throw new CLIError(
        'Update only works with public specs. Use format: username/spec or username/spec@version',
        ExitCode.VALIDATION_ERROR,
      );
    }

    const { username, name, version: requestedVersion } = parsed;

    // If version specified, install that version directly
    if (requestedVersion) {
      output.log(
        chalk.dim(`Updating to ${formatHighlight(`${username}/${name}@${requestedVersion}`)}...\n`),
      );
      await updateSingleSpec(username, name, requestedVersion, cwd);
      output.log('');
      output.log(
        chalk.green(`✓ Updated to ${formatHighlight(`${username}/${name}@${requestedVersion}`)}\n`),
      );
      return;
    }

    // No version specified, fetch latest
    output.log(
      chalk.dim(`Fetching latest version of ${formatHighlight(`${username}/${name}`)}...\n`),
    );

    try {
      const specMetadata = await getSpec(username, name);

      if (specMetadata.versions.length === 0) {
        throw new CLIError(
          `No versions available for ${formatHighlight(`${username}/${name}`)}`,
          ExitCode.DEPENDENCY_ERROR,
        );
      }

      const latestVersion = specMetadata.versions[0].version;

      output.log(
        chalk.dim(`Updating to ${formatHighlight(`${username}/${name}@${latestVersion}`)}...\n`),
      );
      await updateSingleSpec(username, name, latestVersion, cwd);
      output.log('');
      output.log(
        chalk.green(`✓ Updated to ${formatHighlight(`${username}/${name}@${latestVersion}`)}\n`),
      );
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        throw new CLIError(
          `Spec ${formatHighlight(`${username}/${name}`)} not found in public registry`,
          ExitCode.DEPENDENCY_ERROR,
        );
      }

      throw error;
    }
  } catch (error) {
    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Wrap other errors
    throw new CLIError(
      `Update failed: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.IO_ERROR,
    );
  }
}
