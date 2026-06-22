import { promises as fs } from 'node:fs';
import path from 'node:path';
import fse from 'fs-extra';
import type { Manifest } from '@spectrl/schema';
import { validateFilePaths, validateManifest } from './validator.js';

/**
 * Registry file structure:
 *
 * ~/.spectrl/registry/
 * └── {name}/
 *     └── {version}/
 *         ├── spectrl.json       # manifest with hash
 *         └── files/
 *             └── {original/path/structure}
 */

/**
 * Standardized path construction for registry operations
 */
export interface RegistryPaths {
  /** Root registry directory (typically ~/.spectrl/registry) */
  root: string;
  /** Path to a specific spec version directory */
  spec(name: string, version: string): string;
  /** Path to the files directory for a spec version */
  files(name: string, version: string): string;
  /** Path to the manifest file for a spec version */
  manifest(name: string, version: string): string;
}

/**
 * Normalizes the registry root path (allows absolute paths)
 * Only checks for path traversal (..), not absolute paths
 */
function normalizeRootPath(p: string): string {
  // Check for path traversal
  if (p.includes('..')) {
    throw new Error(`Path traversal not allowed: ${p}`);
  }

  // Convert to forward slashes for cross-platform consistency
  return p.replace(/\\/g, '/');
}

/**
 * Validates that a resolved path stays within the registry boundaries
 */
function validatePathWithinRegistry(resolvedPath: string, registryRoot: string): void {
  const normalizedResolved = path.resolve(resolvedPath).replace(/\\/g, '/');
  const normalizedRoot = path.resolve(registryRoot).replace(/\\/g, '/');

  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error(`Path escapes registry boundaries: ${resolvedPath}`);
  }
}

/**
 * Registry manages file I/O for the user-level spec registry (typically ~/.spectrl/registry/)
 *
 * Provides deterministic, safe operations for reading and writing specs
 * with path normalization and validation.
 */
export class Registry {
  public readonly paths: RegistryPaths;
  private readonly rootPath;

  /**
   * Creates a new Registry instance
   * @param rootPath - Root directory for the registry (typically ~/.spectrl/registry for user-level, or a custom path for testing)
   */
  constructor(rootPath = '~/.spectrl/registry') {
    // Normalize the root path (allows absolute paths for flexibility)
    this.rootPath = normalizeRootPath(rootPath);

    // Create paths interface
    this.paths = {
      root: this.rootPath,
      spec: (name: string, version: string) => {
        // Construct path directly without normalizePath since rootPath may be absolute
        return `${this.rootPath}/${name}/${version}`.replace(/\\/g, '/');
      },
      files: (name: string, version: string) => {
        return `${this.rootPath}/${name}/${version}/files`.replace(/\\/g, '/');
      },
      manifest: (name: string, version: string) => {
        return `${this.rootPath}/${name}/${version}/spectrl.json`.replace(/\\/g, '/');
      },
    };
  }

  /**
   * Checks if a spec version exists in the registry
   * @param name - Spec name
   * @param version - Spec version
   * @returns true if the spec version directory exists
   */
  async exists(name: string, version: string): Promise<boolean> {
    const specPath = this.paths.spec(name, version);

    // Validate path stays within registry
    validatePathWithinRegistry(specPath, this.rootPath);

    try {
      const stats = await fs.stat(specPath);
      return stats.isDirectory();
    } catch (error) {
      // ENOENT means it doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Reads and validates a manifest from the registry
   * @param name - Spec name
   * @param version - Spec version
   * @returns Validated manifest object
   * @throws Error if manifest doesn't exist or is invalid
   */
  async getManifest(name: string, version: string): Promise<Manifest> {
    const manifestPath = this.paths.manifest(name, version);

    // Validate path stays within registry
    validatePathWithinRegistry(manifestPath, this.rootPath);

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const data = JSON.parse(content);

      // Validate against schema using validator module
      return validateManifest(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Manifest not found: ${name}@${version}`);
      }
      throw error;
    }
  }

  /**
   * Lists all specs installed in the registry
   * @returns Array of spec name and version pairs
   */
  async list(): Promise<Array<{ name: string; version: string }>> {
    const specs: Array<{ name: string; version: string }> = [];

    try {
      // Check if registry root exists
      await fs.access(this.rootPath);
    } catch {
      // Registry doesn't exist yet, return empty list
      return specs;
    }

    // Read all spec names (directories in registry root)
    const entries = await fs.readdir(this.rootPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip non-directories
      if (!entry.isDirectory()) {
        continue;
      }

      const specName = entry.name;
      const specPath = path.join(this.rootPath, specName);

      try {
        // Read all versions for this spec (direct subdirectories)
        const versionEntries = await fs.readdir(specPath, { withFileTypes: true });

        for (const versionEntry of versionEntries) {
          if (versionEntry.isDirectory()) {
            specs.push({
              name: specName,
              version: versionEntry.name,
            });
          }
        }
      } catch {
        // Can't read spec directory, skip this spec
      }
    }

    return specs;
  }

  /**
   * Lists all versions of a specific spec
   * @param name - Spec name
   * @returns Array of version strings (only valid semver format)
   */
  async listVersions(name: string): Promise<string[]> {
    const specPath = path.join(this.rootPath, name);

    try {
      const entries = await fs.readdir(specPath, { withFileTypes: true });

      // Filter to directories only and validate semver format (no leading zeros)
      const versions = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(name)); // validate semver format without leading zeros

      return versions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Spec doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Removes a spec version from the registry
   *
   * @param name - Spec name
   * @param version - Spec version
   * @throws Error if spec doesn't exist or deletion fails
   */
  async remove(name: string, version: string): Promise<void> {
    // Check if spec exists
    if (!(await this.exists(name, version))) {
      throw new Error(`Spec ${name}@${version} not found in registry`);
    }

    // Remove the spec version directory
    const specPath = this.paths.spec(name, version);
    validatePathWithinRegistry(specPath, this.rootPath);

    await fse.remove(specPath);

    // Check if this was the last version, and clean up empty directories
    const specRootPath = path.join(this.rootPath, name);
    const remainingVersions = await fs.readdir(specRootPath);

    if (remainingVersions.length === 0) {
      // Remove the entire spec directory if no versions remain
      await fse.remove(specRootPath);
    }
  }

  /**
   * Publishes a spec to the registry with atomic directory creation
   *
   * Creates the directory structure, copies tracked files preserving their paths,
   * and writes the manifest.
   *
   * ```
   * ~/.spectrl/registry/
   * └── my-spec/
   *     ├── 1.0.0/    # Safe, isolated
   *     ├── 1.0.1/    # Safe, isolated
   *     └── 2.0.0/    # Safe, isolated
   * ```
   *
   * @param manifest - Validated manifest with hash
   * @param sourcePath - Base directory containing the tracked files
   * @throws Error if files are missing, paths are invalid, or I/O fails
   */
  async publish(manifest: Manifest, sourcePath: string): Promise<void> {
    // Validate manifest files array
    validateFilePaths(manifest.files);

    // Check if this version already exists (enforce immutability)
    if (await this.exists(manifest.name, manifest.version)) {
      throw new Error(
        `Spec ${manifest.name}@${manifest.version} already exists in registry. Bump version to publish changes.`,
      );
    }

    // Create directory structure for this spec version
    const specPath = this.paths.spec(manifest.name, manifest.version);
    const filesPath = this.paths.files(manifest.name, manifest.version);

    // Validate paths stay within registry
    validatePathWithinRegistry(specPath, this.rootPath);
    validatePathWithinRegistry(filesPath, this.rootPath);

    // Create directories atomically
    await fse.ensureDir(filesPath);

    // Copy each tracked file preserving directory structure
    for (const filePath of manifest.files) {
      const sourceFile = path.join(sourcePath, filePath);
      const destFile = path.join(filesPath, filePath);

      // Validate destination path stays within registry
      validatePathWithinRegistry(destFile, this.rootPath);

      // Ensure parent directory exists
      await fse.ensureDir(path.dirname(destFile));

      // Copy file
      await fse.copy(sourceFile, destFile, {
        overwrite: true,
        errorOnExist: false,
        preserveTimestamps: false, // Don't preserve timestamps for determinism
      });
    }

    // Write manifest to registry
    const manifestPath = this.paths.manifest(manifest.name, manifest.version);
    validatePathWithinRegistry(manifestPath, this.rootPath);

    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    await fs.writeFile(manifestPath, manifestJson, 'utf-8');
  }
}
