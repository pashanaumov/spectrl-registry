import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import fse from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import {
  Registry,
  Resolver,
  computeHash,
  ResolverError,
  compareSemver,
  parseJsoncString,
} from '@spectrl/core';
import type { LockFile, LockEntry, Manifest } from '@spectrl/schema';
import { ManifestSchema } from '@spectrl/schema';
import {
  getRegistryPath,
  getProjectIndexPath,
  fileExists,
  formatPublicSpecKey,
  formatPublicSpecDirName,
  getPublicSpecPath,
} from '../../utils.js';
import { formatHighlight, ExitCode, CLIError, formatCommand } from '../../errors.js';
import { parseSpecRef } from '../../utils/spec-ref.js';
import { getSpec, ApiError, trackDownload } from '../../utils/api-client.js';
import { ensureInitialized } from '../init/index.js';
import { generateCatalog } from '../../catalog/generator.js';

// Track downloaded specs in current session to prevent duplicate tracking
const downloadedInSession = new Set<string>();

/**
 * Regenerate the catalog after a successful install. Non-fatal — a catalog
 * failure should never block the install from completing.
 */
async function tryGenerateCatalog(cwd: string): Promise<void> {
  try {
    await generateCatalog(cwd);
  } catch (error) {
    console.warn(
      `[spectrl] Warning: catalog generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the registry URL for downloading public specs
 *
 * @returns Registry URL from environment variable or default CloudFront URL
 */
function getRegistryUrl(): string {
  return process.env.REGISTRY_URL || 'https://storage.googleapis.com/spectrl-specs-prod';
}

/**
 * Collision detection result
 */
interface CollisionDetection {
  hasCollision: boolean;
  existingType: 'local' | 'public' | null;
  existingPath: string | null;
  existingKey: string | null;
}

/**
 * Detects if installing a spec would collide with an existing spec of opposite type
 *
 * @param name - Spec name (without username)
 * @param version - Spec version
 * @param isPublic - Whether the spec being installed is public
 * @param username - Username for public specs
 * @param cwd - Current working directory
 * @returns Collision detection result
 */
async function detectSpecCollision(
  name: string,
  version: string,
  isPublic: boolean,
  username: string | undefined,
  cwd: string,
): Promise<CollisionDetection> {
  try {
    const projectIndexPath = getProjectIndexPath(cwd);
    const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
    const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;

    if (isPublic) {
      // Installing public spec, check for local spec with same name
      const localKey = `${name}@${version}`;
      if (index[localKey]) {
        return {
          hasCollision: true,
          existingType: 'local',
          existingPath: join(cwd, '.spectrl', 'specs', localKey),
          existingKey: localKey,
        };
      }
    } else {
      // Installing local spec, check for public spec with same name (any username)
      for (const key of Object.keys(index)) {
        // Public specs have format: username/name@version
        if (key.includes('/')) {
          const parts = key.split('/');
          if (parts.length === 2 && parts[1] === `${name}@${version}`) {
            // Found a public spec with same name and version
            const publicUsername = parts[0];
            return {
              hasCollision: true,
              existingType: 'public',
              existingPath: join(cwd, '.spectrl', 'specs', `${publicUsername}-${name}@${version}`),
              existingKey: key,
            };
          }
        }
      }
    }

    return { hasCollision: false, existingType: null, existingPath: null, existingKey: null };
  } catch (error) {
    // If index doesn't exist or can't be read, no collision
    return { hasCollision: false, existingType: null, existingPath: null, existingKey: null };
  }
}

/**
 * Prompts user to resolve a spec collision
 *
 * @param existingType - Type of existing spec (local or public)
 * @param newType - Type of new spec being installed (local or public)
 * @param existingKey - Index key of existing spec
 * @param newKey - Index key of new spec
 * @returns User's choice: 'replace' or 'cancel'
 */
async function promptCollisionResolution(
  existingType: 'local' | 'public',
  newType: 'local' | 'public',
  existingKey: string,
  newKey: string,
): Promise<'replace' | 'cancel'> {
  const answer = await select<'replace' | 'cancel'>({
    message: `Warning: A ${existingType} spec '${existingKey}' already exists.\nInstalling ${newType} spec '${newKey}' may cause confusion in dependency resolution.\n\nWhat would you like to do?`,
    choices: [
      {
        name: `Replace ${existingType} spec with ${newType} spec`,
        value: 'replace' as const,
        description: `Remove '${existingKey}' and install '${newKey}'`,
      },
      {
        name: 'Cancel installation',
        value: 'cancel' as const,
        description: 'Keep existing spec and abort',
      },
    ],
    default: 'cancel', // Default to cancel for safety
  });

  return answer;
}

/**
 * Handles spec collision by either throwing an error (non-interactive) or prompting user (interactive)
 *
 * @param collision - Collision detection result
 * @param newSpecKey - Key of the spec being installed
 * @param newSpecType - Type of the spec being installed
 * @param cwd - Current working directory
 * @throws CLIError if in non-interactive mode or user cancels
 */
async function handleCollision(
  collision: CollisionDetection,
  newSpecKey: string,
  newSpecType: 'local' | 'public',
  cwd: string,
): Promise<void> {
  if (
    !collision.hasCollision ||
    !collision.existingType ||
    !collision.existingKey ||
    !collision.existingPath
  ) {
    return;
  }

  // Non-interactive mode: fail immediately
  if (!process.stdin.isTTY) {
    throw new CLIError(
      [
        'Spec name collision detected',
        `  ${collision.existingType === 'local' ? 'Local' : 'Public'} spec '${collision.existingKey}' already exists`,
        `  Attempted to install ${newSpecType} spec '${newSpecKey}'`,
        '',
        'This collision will cause ambiguity in dependency resolution.',
        '',
        'To resolve:',
        `  1. Remove the ${collision.existingType} spec: spectrl uninstall ${collision.existingKey}`,
        `  2. Or remove the ${newSpecType} spec from your index`,
        '  3. Then retry the installation',
      ].join('\n'),
      ExitCode.VALIDATION_ERROR,
    );
  }

  // Interactive mode: prompt user
  const action = await promptCollisionResolution(
    collision.existingType,
    newSpecType,
    collision.existingKey,
    newSpecKey,
  );

  if (action === 'cancel') {
    throw new CLIError('Installation cancelled by user', ExitCode.USER_CANCELLED);
  }

  // User chose to replace: remove existing spec
  const spinner = ora({
    text: `Removing existing ${collision.existingType} spec '${collision.existingKey}'`,
    spinner: 'line',
  }).start();

  try {
    await removeExistingPath(collision.existingPath);

    // Remove from index
    const projectIndexPath = getProjectIndexPath(cwd);
    const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
    const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;

    if (collision.existingKey in index) {
      const updatedIndex = { ...index };
      delete updatedIndex[collision.existingKey];
      await fs.writeFile(projectIndexPath, `${JSON.stringify(updatedIndex, null, 2)}\n`, 'utf-8');
    }

    spinner.succeed(`Removed ${collision.existingType} spec '${collision.existingKey}'`);
  } catch (error) {
    spinner.fail('Failed to remove existing spec');
    throw new CLIError(
      `Failed to remove existing spec: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.IO_ERROR,
    );
  }
}

/**
 * Symlink utility functions
 */

/**
 * Determines the appropriate symlink type based on the platform
 *
 * @returns 'junction' for Windows, 'dir' for Unix-like systems
 */
export function getSymlinkType(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

/**
 * Checks if a path is a symlink and validates its target
 *
 * @param linkPath - Path to check
 * @param expectedTarget - Expected target path for the symlink
 * @returns Object with exists, isSymlink, and isCorrect flags
 */
export async function checkSymlinkStatus(
  linkPath: string,
  expectedTarget: string,
): Promise<{ exists: boolean; isSymlink: boolean; isCorrect: boolean }> {
  try {
    const stats = await fse.lstat(linkPath);
    const isSymlink = stats.isSymbolicLink();

    if (!isSymlink) {
      return { exists: true, isSymlink: false, isCorrect: false };
    }

    // Read the symlink target
    const actualTarget = await fse.readlink(linkPath);

    // Resolve both paths to absolute for comparison
    const resolvedActual = resolve(dirname(linkPath), actualTarget);
    const resolvedExpected = resolve(expectedTarget);

    return {
      exists: true,
      isSymlink: true,
      isCorrect: resolvedActual === resolvedExpected,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, isSymlink: false, isCorrect: false };
    }
    throw error;
  }
}

/**
 * Safely removes a directory or symlink
 *
 * @param path - Path to remove
 * @throws CLIError if removal fails for reasons other than path not existing
 */
export async function removeExistingPath(path: string): Promise<void> {
  try {
    const stats = await fse.lstat(path);

    if (stats.isSymbolicLink()) {
      // Remove symlink (doesn't affect target)
      await fse.unlink(path);
    } else {
      // Remove directory recursively
      await fse.remove(path);
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // Ignore ENOENT - path doesn't exist
    if (err.code !== 'ENOENT') {
      throw new CLIError(
        `Failed to remove existing path ${path}: ${err.message}`,
        ExitCode.IO_ERROR,
      );
    }
  }
}

/**
 * Checks if the SPECTRL_USE_COPY environment variable is set
 *
 * @returns True if SPECTRL_USE_COPY=1, false otherwise
 */
export function shouldUseCopy(): boolean {
  return process.env.SPECTRL_USE_COPY === '1';
}

/**
 * Copies files from registry to project directory as fallback when symlinks fail
 *
 * @param registryFilesPath - Source path in registry (files directory)
 * @param projectPath - Destination path in project
 * @param manifest - Spec manifest containing list of files to copy
 * @throws CLIError if file copying fails
 */
async function copyFilesFromRegistry(
  registryFilesPath: string,
  projectPath: string,
  manifest: Manifest,
): Promise<void> {
  try {
    // Ensure project directory exists
    await fse.ensureDir(projectPath);

    // Copy manifest file from registry to project
    // Manifest is in parent directory of files directory
    const registryManifestPath = join(dirname(registryFilesPath), 'spectrl.json');
    const projectManifestPath = join(projectPath, 'spectrl.json');
    await fse.copy(registryManifestPath, projectManifestPath);

    // Ensure all unique parent directories exist before copying files
    const parentDirs = new Set<string>();
    for (const filePath of manifest.files) {
      const destFile = join(projectPath, filePath);
      parentDirs.add(dirname(destFile));
    }
    for (const dir of parentDirs) {
      await fse.ensureDir(dir);
    }

    // Copy each tracked file from registry to project
    for (const filePath of manifest.files) {
      const sourceFile = join(registryFilesPath, filePath);
      const destFile = join(projectPath, filePath);
      await fse.copy(sourceFile, destFile);
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    throw new CLIError(`Failed to copy files from registry: ${err.message}`, ExitCode.IO_ERROR);
  }
}

/**
 * Creates a symlink from project specs directory to registry, with fallback to file copying
 *
 * @param registryFilesPath - Absolute path to registry files directory
 * @param projectSymlinkPath - Path where symlink should be created
 * @param manifest - Spec manifest (used for fallback copying)
 * @param spinner - Ora spinner for logging messages
 * @returns 'symlink' if successful, 'copy' if fallback was used
 * @throws CLIError if registry path doesn't exist or operation fails
 */
export async function createSymlinkOrFallback(
  registryFilesPath: string,
  projectSymlinkPath: string,
  manifest: Manifest,
  spinner: ReturnType<typeof ora>,
): Promise<'symlink' | 'copy'> {
  // Check if copy mode is enabled via environment variable
  if (shouldUseCopy()) {
    spinner.info('Using file copy mode (SPECTRL_USE_COPY=1)');
    await copyFilesFromRegistry(registryFilesPath, projectSymlinkPath, manifest);
    return 'copy';
  }

  // Validate registry path exists
  const registryExists = await fse.pathExists(registryFilesPath);
  if (!registryExists) {
    throw new CLIError(
      `Registry path not found: ${registryFilesPath}\n\nHas this spec been published? Run: ${formatCommand('spectrl publish')}`,
      ExitCode.DEPENDENCY_ERROR,
    );
  }

  // Ensure parent directory exists
  try {
    await fse.ensureDir(dirname(projectSymlinkPath));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    throw new CLIError(
      `Failed to create parent directory for symlink: ${err.message}`,
      ExitCode.IO_ERROR,
    );
  }

  // Attempt to create symlink
  try {
    const symlinkType = getSymlinkType();
    await fse.symlink(registryFilesPath, projectSymlinkPath, symlinkType);
    return 'symlink';
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    // Handle permission errors with fallback to copying
    if (err.code === 'EPERM') {
      spinner.warn(
        'Permission denied creating symlink. ' +
          'Windows: Enable Developer Mode or run as Administrator. ' +
          'Falling back to file copy...',
      );

      // Clean up any partial symlink creation before copying
      try {
        await removeExistingPath(projectSymlinkPath);
      } catch {
        // Ignore cleanup errors - path may not exist
      }

      await copyFilesFromRegistry(registryFilesPath, projectSymlinkPath, manifest);
      return 'copy';
    }

    // Re-throw other errors
    throw new CLIError(`Failed to create symlink: ${err.message}`, ExitCode.IO_ERROR);
  }
}

/**
 * Statistics for tracking installation progress
 */
interface InstallStats {
  total: number; // Total specs processed
  symlinked: number; // Specs installed via symlink
  copied: number; // Specs installed via file copy (fallback)
  upgraded: number; // Specs upgraded from old copied files to symlinks
  skipped: number; // Specs that were already installed
}

/**
 * Parses a source URL or path to a filesystem path
 *
 * @param source - Source URL (file://, file:) or filesystem path
 * @param basePath - Base path for resolving relative paths
 * @returns Resolved filesystem path
 */
function parseSourcePath(source: string, basePath: string): string {
  // Parse source URL to filesystem path
  let sourcePath: string;
  if (source.startsWith('file://')) {
    sourcePath = source.slice(7);
  } else if (source.startsWith('file:')) {
    sourcePath = source.slice(5);
  } else {
    sourcePath = source;
  }

  // Resolve relative paths
  if (!sourcePath.startsWith('/')) {
    sourcePath = join(basePath, sourcePath);
  }

  return sourcePath;
}

/**
 * Reads manifest and file contents from a source location
 *
 * @param source - Source URL or path (supports file://, https://, or filesystem paths)
 * @param basePath - Base path for resolving relative paths
 * @returns Manifest and file contents map
 * @throws CLIError if files cannot be read
 */
async function readSourceFiles(
  source: string,
  basePath: string,
): Promise<{ manifest: Manifest; fileContents: Record<string, string> }> {
  // Check if source is an HTTP(S) URL (public registry)
  if (source.startsWith('https://') || source.startsWith('http://')) {
    try {
      // Download manifest from URL
      const manifestResponse = await fetch(source);
      if (!manifestResponse.ok) {
        throw new Error(`HTTP ${manifestResponse.status}`);
      }
      const manifestData = await manifestResponse.json();

      // Validate manifest structure with Zod
      const parseResult = ManifestSchema.safeParse(manifestData);
      if (!parseResult.success) {
        throw new Error(`Invalid manifest format: ${parseResult.error.issues[0].message}`);
      }
      const manifest = parseResult.data;

      // Extract base URL and s3Path from manifest URL
      // URL format: https://registry.com/specs/username/specname/version/spectrl.json
      const manifestUrl = new URL(source);
      const baseUrl = `${manifestUrl.protocol}//${manifestUrl.host}`;
      const pathParts = manifestUrl.pathname.split('/');
      // Remove 'spectrl.json' from the end
      pathParts.pop();
      const s3Path = pathParts.join('/');

      // Download all tracked files
      const fileContents: Record<string, string> = {};
      for (const filePath of manifest.files) {
        const fileUrl = `${baseUrl}${s3Path}/files/${filePath}`;
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${filePath}: HTTP ${fileResponse.status}`);
        }
        fileContents[filePath] = await fileResponse.text();
      }

      return { manifest, fileContents };
    } catch (error) {
      if (error instanceof Error) {
        throw new CLIError(
          `Failed to read files from ${source}: ${error.message}`,
          ExitCode.IO_ERROR,
        );
      }
      throw error;
    }
  }

  // Local file source (existing logic)
  const sourcePath = parseSourcePath(source, basePath);

  try {
    // Read manifest — prefer spectrl.jsonc, fall back to spectrl.json
    const jsoncPath = join(sourcePath, 'spectrl.jsonc');
    const jsonPath = join(sourcePath, 'spectrl.json');
    let manifestContent: string;
    try {
      manifestContent = await fs.readFile(jsoncPath, 'utf-8');
    } catch {
      manifestContent = await fs.readFile(jsonPath, 'utf-8');
    }
    const manifestData = parseJsoncString(manifestContent);

    // Validate manifest structure
    const parseResult = ManifestSchema.safeParse(manifestData);
    if (!parseResult.success) {
      throw new Error(`Invalid manifest in ${sourcePath}: ${parseResult.error.issues[0].message}`);
    }
    const manifest = parseResult.data;

    // Read all tracked files
    // Check if files/ subdirectory exists (registry structure) or read from root (source structure)
    const filesDir = join(sourcePath, 'files');
    let useFilesSubdir = false;
    try {
      const stat = await fs.stat(filesDir);
      useFilesSubdir = stat.isDirectory();
    } catch {
      // files/ subdirectory doesn't exist, read from root
      useFilesSubdir = false;
    }

    const fileContents: Record<string, string> = {};
    for (const filePath of manifest.files) {
      const fullPath = useFilesSubdir
        ? join(sourcePath, 'files', filePath)
        : join(sourcePath, filePath);
      fileContents[filePath] = await fs.readFile(fullPath, 'utf-8');
    }

    return { manifest, fileContents };
  } catch (error) {
    // Check if it's a file not found error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CLIError(`Missing source for ${source}`, ExitCode.IO_ERROR);
    }

    if (error instanceof Error) {
      throw new CLIError(
        `Failed to read files from ${source}: ${error.message}`,
        ExitCode.IO_ERROR,
      );
    }
    throw error;
  }
}

/**
 * Resolves the latest version for a spec name from the registry
 *
 * @param name - Spec name
 * @param registry - Registry instance
 * @returns Latest version string
 * @throws CLIError if spec not found or no versions available
 */
async function resolveLatestVersion(name: string, registry: Registry): Promise<string> {
  // List all versions for the spec name
  const versions = await registry.listVersions(name);

  if (versions.length === 0) {
    throw new CLIError(
      `Spec ${formatHighlight(name)} not found in registry`,
      ExitCode.DEPENDENCY_ERROR,
    );
  }

  // Sort versions using semver comparison (descending order)
  const sorted = versions.sort((a, b) => compareSemver(b, a));

  return sorted[0]; // highest version
}

/**
 * Install a spec from the public registry
 *
 * Fetches spec metadata from API, downloads manifest and files from S3/CloudFront,
 * saves to project directory, and updates the project index.
 *
 * @param parsed - Parsed spec reference with username, name, and optional version
 * @param options - Installation options with cwd
 */
export async function installFromPublic(
  parsed: { username: string; name: string; version?: string },
  options: { cwd: string; registry?: string },
): Promise<void> {
  const { username, name, version: requestedVersion } = parsed;
  const { cwd, registry: registryPath } = options;
  const spinner = ora({
    text: 'Resolving dependencies...',
    spinner: 'line',
  }).start();

  try {
    // Auto-initialize if needed
    await ensureInitialized(cwd, { skipAgents: !process.stdin.isTTY, spinner });

    // Fetch spec metadata from API
    let specMetadata: Awaited<ReturnType<typeof getSpec>>;
    try {
      specMetadata = await getSpec(username, name);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        throw new CLIError(
          `Spec ${formatHighlight(`${username}/${name}`)} not found in public registry`,
          ExitCode.DEPENDENCY_ERROR,
        );
      }
      throw error;
    }

    // Determine version (use latest if not specified)
    const targetVersion = requestedVersion || specMetadata.versions[0]?.version;

    if (!targetVersion) {
      throw new CLIError(
        `No versions available for ${formatHighlight(`${username}/${name}`)}`,
        ExitCode.DEPENDENCY_ERROR,
      );
    }

    const versionMeta = specMetadata.versions.find((v) => v.version === targetVersion);

    if (!versionMeta) {
      throw new CLIError(
        `Version ${formatHighlight(targetVersion)} not found for ${formatHighlight(`${username}/${name}`)}`,
        ExitCode.DEPENDENCY_ERROR,
      );
    }

    const specKey = formatPublicSpecKey(username, name, targetVersion);

    // Detect and handle collision with local spec
    spinner.stop();
    const collision = await detectSpecCollision(name, targetVersion, true, username, cwd);
    await handleCollision(collision, specKey, 'public', cwd);

    // Restart spinner for installation
    spinner.start('Resolving dependencies...');

    // Check if already installed with matching hash
    const projectSpecPath = getPublicSpecPath(cwd, username, name, targetVersion);
    const manifestPath = join(projectSpecPath, 'spectrl.json');

    try {
      const existingManifestContent = await fs.readFile(manifestPath, 'utf-8');
      const existingManifestData = JSON.parse(existingManifestContent);

      // Validate existing manifest
      const parseResult = ManifestSchema.safeParse(existingManifestData);
      if (!parseResult.success) {
        // Invalid manifest - proceed with installation
        throw new Error('Invalid manifest');
      }

      const existingManifest = parseResult.data;

      if (existingManifest.hash === versionMeta.hash) {
        spinner.stop();
        console.log(chalk.green(`+ ${specKey}`));

        // Update project index to ensure it's current
        const indexPath = getProjectIndexPath(cwd);
        let index: Record<string, { source: string; hash: string }> = {};
        try {
          const indexContent = await fs.readFile(indexPath, 'utf-8');
          index = JSON.parse(indexContent);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }

        const registryUrl = getRegistryUrl();
        const manifestUrl = `${registryUrl}/${versionMeta.s3Path}/spectrl.json`;
        index[specKey] = {
          source: manifestUrl,
          hash: versionMeta.hash,
        };

        const indexJson = JSON.stringify(index, null, 2);
        await fs.writeFile(indexPath, `${indexJson}\n`, 'utf-8');

        // Install transitive dependencies
        await installTransitiveDeps(existingManifest, { cwd, registry: registryPath });

        await tryGenerateCatalog(cwd);

        return;
      }
    } catch (error) {
      // File doesn't exist or can't be read - proceed with installation
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Re-throw non-ENOENT errors
        throw error;
      }
    }

    // Download manifest from S3/CloudFront
    const registryUrl = getRegistryUrl();
    const manifestUrl = `${registryUrl}/${versionMeta.s3Path}/spectrl.json`;

    let manifestResponse: Response;
    try {
      manifestResponse = await fetch(manifestUrl);
    } catch (error) {
      throw new CLIError(
        `Failed to download manifest: ${error instanceof Error ? error.message : String(error)}`,
        ExitCode.IO_ERROR,
      );
    }

    if (!manifestResponse.ok) {
      throw new CLIError(
        `Failed to download manifest: HTTP ${manifestResponse.status}`,
        ExitCode.IO_ERROR,
      );
    }

    const manifestData = await manifestResponse.json();

    // Validate manifest structure with Zod
    const parseResult = ManifestSchema.safeParse(manifestData);

    if (!parseResult.success) {
      throw new CLIError(
        `Downloaded manifest is invalid: ${parseResult.error.issues[0].message}`,
        ExitCode.VALIDATION_ERROR,
      );
    }

    const manifest = parseResult.data;

    // Add hash from API metadata to manifest (S3 manifest doesn't include hash)
    const manifestWithHash = { ...manifest, hash: versionMeta.hash };

    // Create project spec directory
    await fse.ensureDir(projectSpecPath);

    // Save manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifestWithHash, null, 2), 'utf-8');

    // Download each file
    for (const filePath of manifest.files) {
      const fileUrl = `${registryUrl}/${versionMeta.s3Path}/files/${filePath}`;

      let fileResponse: Response;
      try {
        fileResponse = await fetch(fileUrl);
      } catch (error) {
        throw new CLIError(
          `Failed to download file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          ExitCode.IO_ERROR,
        );
      }

      if (!fileResponse.ok) {
        throw new CLIError(
          `Failed to download file ${filePath}: HTTP ${fileResponse.status}`,
          ExitCode.IO_ERROR,
        );
      }

      const content = await fileResponse.text();
      const destFile = join(projectSpecPath, filePath);

      // Ensure parent directory exists
      await fse.ensureDir(dirname(destFile));

      // Write file
      await fs.writeFile(destFile, content, 'utf-8');
    }

    // Update project index
    const indexPath = getProjectIndexPath(cwd);

    let index: Record<string, { source: string; hash: string }> = {};
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(indexContent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new CLIError(
          `Failed to read project index: ${(error as Error).message}`,
          ExitCode.IO_ERROR,
        );
      }
    }

    // Add entry to index with manifest URL as source
    index[specKey] = {
      source: manifestUrl,
      hash: versionMeta.hash,
    };

    // Write updated index
    try {
      const indexJson = JSON.stringify(index, null, 2);
      await fs.writeFile(indexPath, `${indexJson}\n`, 'utf-8');
    } catch (error) {
      // Rollback: remove the downloaded files
      spinner.warn('Failed to update index, rolling back installation...');
      try {
        await fse.remove(projectSpecPath);
      } catch {
        // Ignore rollback errors
      }
      throw new CLIError(
        `Failed to update project index: ${(error as Error).message}`,
        ExitCode.IO_ERROR,
      );
    }

    spinner.stop();
    console.log(chalk.green(`+ ${specKey}`));

    // Track download (fire-and-forget, only if not already tracked in this session)
    if (!downloadedInSession.has(specKey)) {
      downloadedInSession.add(specKey);
      trackDownload(username, name, targetVersion);
    }

    // Install transitive dependencies
    await installTransitiveDeps(manifest, { cwd, registry: registryPath });

    await tryGenerateCatalog(cwd);
  } catch (error) {
    spinner.stop();

    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Handle ApiError
    if (error instanceof ApiError) {
      throw new CLIError(
        `API error: ${error.message}`,
        error.statusCode && error.statusCode >= 500 ? ExitCode.IO_ERROR : ExitCode.DEPENDENCY_ERROR,
      );
    }

    // Any other errors are likely I/O errors
    if (error instanceof Error) {
      throw new CLIError(error.message, ExitCode.IO_ERROR);
    }

    throw new CLIError('Unknown error during install', ExitCode.IO_ERROR);
  }
}
/**
 * Install transitive dependencies using BFS traversal
 *
 * Recursively installs all dependencies declared in a manifest's deps field.
 * Uses breadth-first search to discover and install the full transitive closure.
 *
 * @param manifest - Root manifest containing deps to install
 * @param options - Installation options with cwd and optional registry path
 */
export async function installTransitiveDeps(
  manifest: Manifest,
  options: { cwd: string; registry?: string },
): Promise<void> {
  const { cwd, registry: registryPath } = options;

  // Early return if no deps to install
  if (!manifest.deps || Object.keys(manifest.deps).length === 0) {
    return;
  }

  // Initialize BFS queue with direct dependencies
  const queue: Array<{ name: string; version: string }> = Object.entries(manifest.deps).map(
    ([name, version]) => ({ name, version }),
  );

  // Track visited deps to avoid duplicate processing
  const visited = new Set<string>();

  // Initialize registry for local lookups
  const registry = new Registry(registryPath ?? getRegistryPath());

  while (queue.length > 0) {
    const dep = queue.shift();
    if (!dep) break;
    const depKey = `${dep.name}@${dep.version}`;

    // Skip if already processed
    if (visited.has(depKey)) {
      continue;
    }
    visited.add(depKey);

    // Check if dep is in the project index
    const projectIndexPath = getProjectIndexPath(cwd);
    let isInIndex = false;

    try {
      const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
      const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;

      if (index[depKey]) {
        isInIndex = true;
      }
    } catch {
      // Index doesn't exist or can't be read - proceed with installation
    }

    // If dep is in index, check if it's already installed
    if (isInIndex) {
      const projectSpecPath = join(cwd, '.spectrl', 'specs', depKey);
      const manifestPath = join(projectSpecPath, 'spectrl.json');

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestContent);
        const parseResult = ManifestSchema.safeParse(manifestData);

        if (parseResult.success) {
          // Dep is in index AND installed - process its transitive deps and skip
          if (parseResult.data.deps) {
            for (const [transitiveName, transitiveVersion] of Object.entries(
              parseResult.data.deps,
            )) {
              queue.push({ name: transitiveName, version: transitiveVersion });
            }
          }
          continue;
        }
      } catch {
        // Manifest doesn't exist yet - it will be installed by the main loop, so skip
        continue;
      }
    }

    // Dep is not in index or not installed - try to install it
    // Check if dep is already installed at correct version (idempotency)
    let isAlreadyInstalled = false;

    try {
      const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
      const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;

      if (index[depKey]) {
        // Dep is in index - verify it exists on disk
        const projectSpecPath = join(cwd, '.spectrl', 'specs', depKey);
        const manifestPath = join(projectSpecPath, 'spectrl.json');

        try {
          const existingManifestContent = await fs.readFile(manifestPath, 'utf-8');
          const existingManifestData = JSON.parse(existingManifestContent);

          // Validate existing manifest
          const parseResult = ManifestSchema.safeParse(existingManifestData);
          if (parseResult.success) {
            isAlreadyInstalled = true;
          }
        } catch {
          // Manifest doesn't exist or can't be read - need to install
        }
      }
    } catch {
      // Index doesn't exist or can't be read - proceed with installation
    }

    if (isAlreadyInstalled) {
      // Dep already installed - still need to process its transitive deps
      const projectSpecPath = join(cwd, '.spectrl', 'specs', depKey);
      const manifestPath = join(projectSpecPath, 'spectrl.json');

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifestData = JSON.parse(manifestContent);
        const parseResult = ManifestSchema.safeParse(manifestData);

        if (parseResult.success && parseResult.data.deps) {
          // Add transitive deps to queue
          for (const [transitiveName, transitiveVersion] of Object.entries(parseResult.data.deps)) {
            queue.push({ name: transitiveName, version: transitiveVersion });
          }
        }
      } catch {
        // Ignore errors reading manifest - dep is installed, just can't process transitive deps
      }

      continue;
    }

    // Try to install from local registry first
    let depManifest: Manifest | null = null;
    let installedFromLocal = false;

    try {
      const exists = await registry.exists(dep.name, dep.version);
      if (exists) {
        // Install from local registry
        depManifest = await registry.getManifest(dep.name, dep.version);

        // Validate manifest
        const parseResult = ManifestSchema.safeParse(depManifest);
        if (!parseResult.success) {
          throw new CLIError(
            `Invalid manifest for ${depKey} in local registry: ${parseResult.error.issues[0].message}`,
            ExitCode.VALIDATION_ERROR,
          );
        }

        // Create symlink to registry
        const registryFilesPath = registry.paths.files(dep.name, dep.version);
        const projectSymlinkPath = join(cwd, '.spectrl', 'specs', depKey);

        await createSymlinkOrFallback(
          registryFilesPath,
          projectSymlinkPath,
          parseResult.data,
          ora({ text: `Installing ${depKey}`, spinner: 'line' }),
        );

        // Update project index
        const indexPath = getProjectIndexPath(cwd);
        let index: Record<string, { source: string; hash: string }> = {};

        try {
          const indexContent = await fs.readFile(indexPath, 'utf-8');
          index = JSON.parse(indexContent);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }

        const registrySpecPath = registry.paths.spec(dep.name, dep.version);
        index[depKey] = {
          source: registrySpecPath,
          hash: parseResult.data.hash || '',
        };

        await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');

        installedFromLocal = true;
        depManifest = parseResult.data;
      }
    } catch (error) {
      // Local registry lookup failed - will try public registry
      if (error instanceof CLIError) {
        throw error;
      }
    }

    // If not found in local registry, try public registry
    if (!installedFromLocal) {
      try {
        // For public registry, we need to search for the spec
        // Since deps in manifest are bare names (no username), we need to search
        // This is a limitation - we'll throw an error for now
        throw new CLIError(
          `Missing dependency: ${depKey}. Add it to .spectrl/spectrl-index.json or publish it to the registry first.`,
          ExitCode.DEPENDENCY_ERROR,
        );
      } catch (error) {
        if (error instanceof CLIError) {
          throw error;
        }
        throw new CLIError(
          `Failed to install dependency ${depKey}: ${error instanceof Error ? error.message : String(error)}`,
          ExitCode.DEPENDENCY_ERROR,
        );
      }
    }

    // Add transitive deps to queue
    if (depManifest?.deps) {
      for (const [transitiveName, transitiveVersion] of Object.entries(depManifest.deps)) {
        queue.push({ name: transitiveName, version: transitiveVersion });
      }
    }
  }

  // Regenerate catalog after installing all deps
  await tryGenerateCatalog(cwd);
}

/**
 * Install a single spec from the registry
 *
 * Looks up the spec in the registry, reads the manifest, creates a symlink from
 * project .spectrl/specs/ directory to registry, and updates the project index.
 *
 * @param specRef - Spec reference in format name@version
 * @param options - Installation options with cwd and optional registry path
 */
export async function installSingleSpec(
  specRef: string,
  options: { cwd: string; registry?: string },
): Promise<void> {
  try {
    const { cwd, registry: registryPath } = options;

    // Auto-initialize if needed
    await ensureInitialized(cwd, { skipAgents: !process.stdin.isTTY });

    // Parse spec reference to detect public vs local
    let parsed: ReturnType<typeof parseSpecRef>;
    try {
      parsed = parseSpecRef(specRef);
    } catch (error) {
      throw new CLIError(
        `Invalid spec reference format: ${specRef}. ${error instanceof Error ? error.message : String(error)}`,
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Route to public or local install based on spec reference
    if (parsed.isPublic && parsed.username) {
      // Public registry install (handles collision detection internally after version resolution)
      return await installFromPublic(
        { username: parsed.username, name: parsed.name, version: parsed.version },
        { cwd, registry: registryPath },
      );
    }

    // Local registry install (existing logic)
    const spinner = ora({
      text: `Installing ${formatHighlight(specRef)}`,
      spinner: 'line',
    }).start();

    try {
      let { name, version } = parsed;

      // Initialize registry
      const registry = new Registry(registryPath ?? getRegistryPath());

      // Resolve version if not specified
      if (!version) {
        spinner.text = `Resolving ${formatHighlight(name)}...`;
        version = await resolveLatestVersion(name, registry);
        spinner.text = `Resolved ${formatHighlight(name)} to version ${formatHighlight(version)}`;
      }

      // Update spec reference with resolved version
      const resolvedSpecRef = `${name}@${version}`;

      // Detect and handle collision after version resolution
      spinner.stop();
      const collision = await detectSpecCollision(name, version, false, undefined, cwd);
      await handleCollision(collision, resolvedSpecRef, 'local', cwd);
      spinner.start(`Installing ${formatHighlight(resolvedSpecRef)}`);

      // Check if spec exists in registry
      spinner.text = `Looking up ${formatHighlight(resolvedSpecRef)} in registry`;
      const exists = await registry.exists(name, version);
      if (!exists) {
        throw new CLIError(
          `Spec ${formatHighlight(resolvedSpecRef)} not found in registry`,
          ExitCode.DEPENDENCY_ERROR,
        );
      }

      // Read manifest from registry
      spinner.text = `Reading manifest for ${formatHighlight(resolvedSpecRef)}`;
      const manifest = await registry.getManifest(name, version);

      if (!manifest.hash) {
        throw new CLIError(
          `Manifest for ${resolvedSpecRef} is missing hash`,
          ExitCode.VALIDATION_ERROR,
        );
      }

      // Use new symlink naming pattern: {name}@{version}
      const registryFilesPath = registry.paths.files(name, version);
      const projectSymlinkPath = join(cwd, '.spectrl', 'specs', resolvedSpecRef);

      // Check symlink status
      spinner.text = `Checking ${formatHighlight(resolvedSpecRef)}`;
      const symlinkStatus = await checkSymlinkStatus(projectSymlinkPath, registryFilesPath);

      if (symlinkStatus.exists && symlinkStatus.isSymlink && symlinkStatus.isCorrect) {
        // Symlink already exists and points to correct target - skip
        spinner.succeed(
          `${formatHighlight(resolvedSpecRef)} already installed at ${formatHighlight(`.spectrl/specs/${resolvedSpecRef}`)}`,
        );

        // Still update project index to ensure it's up to date
        spinner.text = 'Updating project index';
        const indexPath = join(cwd, '.spectrl', 'spectrl-index.json');

        // Read existing index or create new one
        let index: Record<string, { source: string; hash: string }> = {};
        try {
          const indexContent = await fs.readFile(indexPath, 'utf-8');
          index = JSON.parse(indexContent);
        } catch (error) {
          // Index doesn't exist, will create new one
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }

        // Add entry to index with registry source path
        const registrySpecPath = registry.paths.spec(name, version);
        index[resolvedSpecRef] = {
          source: registrySpecPath,
          hash: manifest.hash,
        };

        // Write updated index
        const indexJson = JSON.stringify(index, null, 2);
        await fs.writeFile(indexPath, `${indexJson}\n`, 'utf-8');

        // Install transitive dependencies
        await installTransitiveDeps(manifest, { cwd, registry: registryPath });

        await tryGenerateCatalog(cwd);

        return;
      }

      // Handle upgrade from old copied files or incorrect symlink
      let isUpgrade = false;
      if (symlinkStatus.exists) {
        if (!symlinkStatus.isSymlink) {
          // Old directory with copied files - upgrade to symlink
          spinner.text = `Upgrading ${formatHighlight(resolvedSpecRef)} from copied files to symlink`;
          isUpgrade = true;
        } else {
          // Incorrect symlink - remove and recreate
          spinner.text = `Updating symlink for ${formatHighlight(resolvedSpecRef)}`;
        }

        // Remove existing path (directory or symlink)
        await removeExistingPath(projectSymlinkPath);
      }

      // Create symlink or fallback to copying
      spinner.text = `Installing ${formatHighlight(resolvedSpecRef)}`;
      const installMethod = await createSymlinkOrFallback(
        registryFilesPath,
        projectSymlinkPath,
        manifest,
        spinner,
      );

      // Validate that installation was successful before updating index
      const installExists = await fse.pathExists(projectSymlinkPath);
      if (!installExists) {
        throw new CLIError(
          `Installation verification failed: ${projectSymlinkPath} does not exist after installation`,
          ExitCode.IO_ERROR,
        );
      }

      // Update project index after successful installation
      spinner.text = 'Updating project index';
      const indexPath = join(cwd, '.spectrl', 'spectrl-index.json');

      // Read existing index or create new one
      let index: Record<string, { source: string; hash: string }> = {};
      try {
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(indexContent);
      } catch (error) {
        // Index doesn't exist, will create new one
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new CLIError(
            `Failed to read project index: ${(error as Error).message}`,
            ExitCode.IO_ERROR,
          );
        }
      }

      // Add entry to index with registry source path
      const registrySpecPath = registry.paths.spec(name, version);
      index[resolvedSpecRef] = {
        source: registrySpecPath,
        hash: manifest.hash,
      };

      // Write updated index with rollback on failure
      try {
        const indexJson = JSON.stringify(index, null, 2);
        await fs.writeFile(indexPath, `${indexJson}\n`, 'utf-8');
      } catch (error) {
        // Rollback: remove the installed symlink/directory
        spinner.warn('Failed to update index, rolling back installation...');
        try {
          await removeExistingPath(projectSymlinkPath);
        } catch {
          // Ignore rollback errors
        }
        throw new CLIError(
          `Failed to update project index: ${(error as Error).message}`,
          ExitCode.IO_ERROR,
        );
      }

      // Success message based on install method and upgrade status
      const methodText = installMethod === 'symlink' ? 'symlink' : 'copied files';
      const actionText = isUpgrade ? 'Upgraded' : 'Installed';
      spinner.succeed(
        `${actionText} ${formatHighlight(resolvedSpecRef)} using ${methodText} at ${formatHighlight(`.spectrl/specs/${resolvedSpecRef}`)}`,
      );

      // Install transitive dependencies
      await installTransitiveDeps(manifest, { cwd, registry: registryPath });

      await tryGenerateCatalog(cwd);
    } catch (error) {
      spinner.stop();

      // Re-throw CLIError as-is
      if (error instanceof CLIError) {
        throw error;
      }

      // Any other errors are likely I/O errors
      if (error instanceof Error) {
        throw new CLIError(error.message, ExitCode.IO_ERROR);
      }

      throw new CLIError('Unknown error during install', ExitCode.IO_ERROR);
    }
  } catch (error) {
    // Handle errors from parseSpecRef or routing
    if (error instanceof CLIError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new CLIError(error.message, ExitCode.IO_ERROR);
    }

    throw new CLIError('Unknown error during install', ExitCode.IO_ERROR);
  }
}

/**
 * Install all specs from the project index
 *
 * Reads .spectrl/spectrl-index.json, resolves the complete dependency closure,
 * computes hashes, materializes specs to the registry, copies files to project,
 * and writes a lock file.
 *
 * @param options - Installation options with cwd and optional registry path
 */
export async function install(options: { cwd: string; registry?: string }): Promise<void> {
  const spinner = ora({ text: 'Installing specs', spinner: 'line' }).start();

  try {
    const { cwd, registry: registryPath } = options;

    // Auto-initialize if needed
    await ensureInitialized(cwd, { skipAgents: !process.stdin.isTTY, spinner });

    // Step 1: First pass - install transitive dependencies for all specs in the index
    // This ensures all deps are available before the resolver validates the closure
    spinner.text = 'Installing transitive dependencies';
    const indexPath = join(cwd, '.spectrl', 'spectrl-index.json');

    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;
      const basePath = join(cwd, '.spectrl');

      for (const [key, entry] of Object.entries(index)) {
        try {
          // Read manifest from source to check for deps
          const { manifest } = await readSourceFiles(entry.source, basePath);

          // Install transitive dependencies if any exist
          // If a dependency is missing, skip it - the resolver will validate and report the error
          if (manifest.deps && Object.keys(manifest.deps).length > 0) {
            try {
              await installTransitiveDeps(manifest, { cwd, registry: registryPath });
            } catch (error) {
              // Skip missing dependency errors - let the resolver handle validation
              if (error instanceof CLIError && error.exitCode === ExitCode.DEPENDENCY_ERROR) {
                // Continue to next spec - resolver will validate the complete closure
                continue;
              }
              // Propagate other errors
              throw error;
            }
          }
        } catch (error) {
          // Skip IO errors (missing source files) - let the resolver handle validation
          if (error instanceof CLIError && error.exitCode === ExitCode.IO_ERROR) {
            // Continue to next spec - resolver will validate and report proper error
            continue;
          }
          // Propagate other errors
          throw error;
        }
      }
    } catch (error) {
      // If index doesn't exist, continue - will be handled by resolver
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Index doesn't exist, continue
      } else {
        // Other errors - let them propagate
        throw error;
      }
    }

    // Step 2: Resolve closure from project index
    spinner.text = 'Resolving dependencies';
    const projectIndexPath = getProjectIndexPath(cwd);
    const resolver = new Resolver();
    const resolved = await resolver.resolveClosureFromIndex(indexPath);

    // Handle empty index
    if (resolved.length === 0) {
      spinner.info('No specs to install');
      return;
    }

    // Initialize install statistics
    const stats: InstallStats = {
      total: resolved.length,
      symlinked: 0,
      copied: 0,
      upgraded: 0,
      skipped: 0,
    };

    spinner.text = `Resolving ${stats.total} spec(s)`;

    // Step 2: Compute hashes and materialize to registry
    const registry = new Registry(registryPath ?? getRegistryPath());
    const lockEntries: LockEntry[] = [];
    const basePath = join(cwd, '.spectrl');

    // Read existing project index or create new one
    let projectIndex: Record<string, { source: string; hash: string }> = {};
    try {
      const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
      projectIndex = JSON.parse(indexContent);
    } catch (error) {
      // Index doesn't exist, will create new one
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    for (const node of resolved) {
      const { name, version, source, deps } = node;
      const specKey = `${name}@${version}`;

      spinner.text = `Processing ${formatHighlight(specKey)}`;

      // Check if this is a public spec (HTTPS URL)
      const isPublicSpec = source.startsWith('https://') || source.startsWith('http://');

      // Read manifest and files from source
      const { manifest, fileContents } = await readSourceFiles(source, basePath);

      // Compute hash
      const hash = computeHash({ manifest, fileContents });

      if (isPublicSpec) {
        // Public spec: download files directly to project directory
        // Extract username from spec key if it contains a slash
        const specKeyParts = specKey.split('/');
        const projectSpecPath =
          specKeyParts.length > 1
            ? join(cwd, '.spectrl', 'specs', `${specKeyParts[0]}-${specKeyParts[1]}`)
            : join(cwd, '.spectrl', 'specs', specKey);

        // Check if already installed with matching hash
        const manifestPath = join(projectSpecPath, 'spectrl.json');
        let alreadyInstalled = false;
        try {
          const existingManifestContent = await fs.readFile(manifestPath, 'utf-8');
          const existingManifestData = JSON.parse(existingManifestContent);

          // Validate existing manifest
          const parseResult = ManifestSchema.safeParse(existingManifestData);
          if (parseResult.success && parseResult.data.hash === hash) {
            alreadyInstalled = true;
            stats.skipped++;
          }
        } catch {
          // File doesn't exist or can't be read - proceed with installation
        }

        if (!alreadyInstalled) {
          // Create directory and write files
          await fse.ensureDir(projectSpecPath);

          // Write manifest
          await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

          // Write all tracked files
          for (const filePath of manifest.files) {
            const destFile = join(projectSpecPath, filePath);
            await fse.ensureDir(dirname(destFile));
            await fs.writeFile(destFile, fileContents[filePath], 'utf-8');
          }

          stats.copied++;
        }

        // Update project index with public source
        projectIndex[specKey] = {
          source,
          hash,
        };
      } else {
        // Local spec: materialize to registry and create symlink (existing logic)
        // Check if spec exists in registry
        const exists = await registry.exists(name, version);

        if (exists) {
          // Verify hash matches
          const existingManifest = await registry.getManifest(name, version);
          if (existingManifest.hash !== hash) {
            throw new CLIError(`Integrity breach: hash mismatch for ${specKey}`, ExitCode.IO_ERROR);
          }
          // Skip already installed in registry
        } else {
          // Materialize to registry
          const manifestWithHash: Manifest = { ...manifest, hash };

          // Get source path for registry.publish
          const sourcePath = parseSourcePath(source, basePath);

          await registry.publish(manifestWithHash, sourcePath);
        }

        // Create symlink to registry files (or copy as fallback)
        const registrySpecPath = registry.paths.spec(name, version);
        const registryFilesPath = registry.paths.files(name, version);
        const projectSymlinkPath = join(cwd, '.spectrl', 'specs', specKey);

        // Check if path exists and handle upgrade from old copied files
        spinner.text = `Checking ${formatHighlight(specKey)}`;
        const symlinkStatus = await checkSymlinkStatus(projectSymlinkPath, registryFilesPath);

        if (symlinkStatus.exists && symlinkStatus.isSymlink && symlinkStatus.isCorrect) {
          // Symlink already exists and points to correct target - skip
          stats.skipped++;
        } else {
          // Need to create or update symlink
          let isUpgrade = false;

          if (symlinkStatus.exists && !symlinkStatus.isSymlink) {
            // Old directory with copied files - upgrade to symlink
            spinner.text = `Upgrading ${formatHighlight(specKey)} from copied files to symlink`;
            await removeExistingPath(projectSymlinkPath);
            isUpgrade = true;
          } else if (symlinkStatus.exists && !symlinkStatus.isCorrect) {
            // Incorrect symlink - remove and recreate
            spinner.text = `Updating symlink for ${formatHighlight(specKey)}`;
            await removeExistingPath(projectSymlinkPath);
          } else {
            // New installation
            spinner.text = `Creating symlink for ${formatHighlight(specKey)}`;
          }

          // Create symlink or fallback to copying
          const installMethod = await createSymlinkOrFallback(
            registryFilesPath,
            projectSymlinkPath,
            manifest,
            spinner,
          );

          // Validate that installation was successful
          const installExists = await fse.pathExists(projectSymlinkPath);
          if (!installExists) {
            throw new CLIError(
              `Installation verification failed: ${projectSymlinkPath} does not exist after installation`,
              ExitCode.IO_ERROR,
            );
          }

          // Update statistics based on install method and upgrade status
          if (isUpgrade) {
            stats.upgraded++;
          } else if (installMethod === 'symlink') {
            stats.symlinked++;
          } else {
            stats.copied++;
          }
        }

        // Update project index with registry source path
        projectIndex[specKey] = {
          source: registrySpecPath,
          hash,
        };
      }

      // Add to lock entries
      lockEntries.push({
        name,
        version,
        hash,
        source,
        deps,
      });
    }

    // Write updated project index with error handling
    spinner.text = 'Updating project index';
    try {
      const indexJson = JSON.stringify(projectIndex, null, 2);
      await fs.writeFile(projectIndexPath, `${indexJson}\n`, 'utf-8');
    } catch (error) {
      throw new CLIError(
        `Failed to update project index: ${(error as Error).message}`,
        ExitCode.IO_ERROR,
      );
    }

    // Step 3: Write lock file with error handling
    spinner.text = 'Writing lock file';

    // Sort entries by name@version for determinism
    lockEntries.sort((a, b) => {
      const keyA = `${a.name}@${a.version}`;
      const keyB = `${b.name}@${b.version}`;
      return keyA.localeCompare(keyB);
    });

    const lockFile: LockFile = {
      createdAt: new Date().toISOString(),
      entries: lockEntries,
    };

    const lockPath = join(cwd, '.spectrl', 'lock.json');
    try {
      await fs.writeFile(lockPath, `${JSON.stringify(lockFile, null, 2)}\n`, 'utf-8');
    } catch (error) {
      throw new CLIError(
        `Failed to write lock file: ${(error as Error).message}`,
        ExitCode.IO_ERROR,
      );
    }

    // Display summary with detailed breakdown
    const summary = [];
    if (stats.symlinked > 0) {
      summary.push(`${stats.symlinked} symlinked`);
    }
    if (stats.copied > 0) {
      summary.push(`${stats.copied} copied`);
    }
    if (stats.upgraded > 0) {
      summary.push(`${stats.upgraded} upgraded`);
    }
    if (stats.skipped > 0) {
      summary.push(`${stats.skipped} skipped`);
    }

    spinner.succeed(`Processed ${stats.total} spec(s) (${summary.join(', ')}), lock file written`);

    await tryGenerateCatalog(cwd);
  } catch (error) {
    spinner.stop();

    // Handle ResolverError with appropriate exit codes
    if (error instanceof ResolverError) {
      // Map resolver exit codes to CLI exit codes
      const exitCode = error.exitCode === 3 ? ExitCode.DEPENDENCY_ERROR : ExitCode.VALIDATION_ERROR;
      throw new CLIError(error.message, exitCode);
    }

    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Any other errors are likely I/O errors
    if (error instanceof Error) {
      throw new CLIError(error.message, ExitCode.IO_ERROR);
    }

    throw new CLIError('Unknown error during install', ExitCode.IO_ERROR);
  }
}
