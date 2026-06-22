import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Index, Manifest } from '@spectrl/schema';
import { IndexSchema, ManifestSchema } from '@spectrl/schema';
import { parseJsoncString } from './jsonc.js';

/**
 * Custom error class for resolver errors with exit codes
 */
export class ResolverError extends Error {
  constructor(
    message: string,
    public exitCode: number,
  ) {
    super(message);
    this.name = 'ResolverError';
  }
}

/**
 * Represents a resolved spec node with its dependencies
 */
export interface ResolvedNode {
  name: string;
  version: string;
  source: string;
  deps: string[]; // array of "name@version"
}

/**
 * Resolver handles dependency closure resolution from project index
 *
 * Reads from a project index file (.spectrl/spectrl-index.json) and performs
 * breadth-first traversal to resolve the complete dependency closure.
 */
export class Resolver {
  /**
   * Loads and validates the project index file
   *
   * @param indexPath - Path to the project index file
   * @returns Validated index object
   * @throws ResolverError if index file is missing or invalid
   */
  private async loadIndex(indexPath: string): Promise<Index> {
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content);

      // Validate against IndexSchema
      return IndexSchema.parse(data);
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        throw new ResolverError(`Index file not found: ${indexPath}`, 1);
      }
      throw error;
    }
  }

  /**
   * Type guard to check if an error is a file not found error
   */
  private isFileNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
    );
  }

  /**
   * Reads a manifest from a source location
   *
   * Supports file:// URLs, file: URLs, and relative/absolute filesystem paths.
   *
   * @param source - Source URL or path
   * @param basePath - Base path for resolving relative paths (defaults to cwd)
   * @returns Parsed manifest
   * @throws ResolverError if manifest cannot be read or is invalid
   */
  private async readManifestFromSource(source: string, basePath?: string): Promise<Manifest> {
    let filePath: string;

    // Handle file:// URLs
    if (source.startsWith('file://')) {
      filePath = source.slice(7); // Remove 'file://' prefix
    } else if (source.startsWith('file:')) {
      filePath = source.slice(5); // Remove 'file:' prefix
    } else {
      // Assume it's a filesystem path (relative or absolute)
      filePath = source;
    }

    // Resolve relative paths
    if (!path.isAbsolute(filePath)) {
      const base = basePath || process.cwd();
      filePath = path.resolve(base, filePath);
    }

    try {
      // Prefer spectrl.jsonc, fall back to spectrl.json
      let content: string;
      try {
        content = await fs.readFile(path.join(filePath, 'spectrl.jsonc'), 'utf-8');
      } catch {
        content = await fs.readFile(path.join(filePath, 'spectrl.json'), 'utf-8');
      }
      const data = parseJsoncString(content);

      // Validate with ManifestSchema
      const manifest = ManifestSchema.parse(data);
      return manifest;
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        throw new ResolverError(`Missing source for ${source}`, 1);
      }
      throw new ResolverError(`Failed to read manifest from source: ${source}`, 1);
    }
  }

  /**
   * Resolves complete dependency closure from project index
   *
   * Performs breadth-first traversal starting from all specs in the index.
   * Validates manifest identity matches index keys and ensures all dependencies exist.
   *
   * @param indexPath - Path to the project index file (.spectrl/spectrl-index.json)
   * @returns Sorted array of resolved nodes with dependencies
   * @throws ResolverError for validation errors, missing dependencies, or cycles
   */
  async resolveClosureFromIndex(indexPath: string): Promise<ResolvedNode[]> {
    // Load and validate project index
    const index = await this.loadIndex(indexPath);

    // Extract all keys as roots and sort lexicographically
    const keys = Object.keys(index).sort();

    // Validate all keys match the required pattern and extract name/version
    const keyPattern = /^([a-z0-9-]+)@(\d+\.\d+\.\d+)$/;
    const parsedKeys = new Map<string, { name: string; version: string }>();

    for (const key of keys) {
      const match = key.match(keyPattern);
      if (!match) {
        throw new ResolverError(`Invalid index key: ${key}`, 1);
      }
      const [, name, version] = match;
      parsedKeys.set(key, { name, version });
    }

    // First pass: collect all manifests and build dependency graph
    const manifests = new Map<string, { manifest: Manifest; source: string }>();
    const basePath = path.dirname(indexPath);

    for (const key of keys) {
      const parsed = parsedKeys.get(key);
      if (!parsed) {
        throw new ResolverError(`Internal error: missing parsed key ${key}`, 1);
      }
      const { name, version } = parsed;
      const entry = index[key];

      if (!entry || !entry.source) {
        throw new ResolverError(`Missing source for ${key}`, 1);
      }

      const manifest = await this.readManifestFromSource(entry.source, basePath);

      if (manifest.name !== name || manifest.version !== version) {
        throw new ResolverError(
          `Manifest mismatch for ${key}: found ${manifest.name}@${manifest.version}`,
          1,
        );
      }

      manifests.set(key, { manifest, source: entry.source });
    }

    // Second pass: verify all dependencies exist and detect cycles
    const depGraph = new Map<string, string[]>();

    for (const [key, { manifest }] of manifests) {
      const deps = Object.entries(manifest.deps)
        .map(([depName, depVersion]) => `${depName}@${depVersion}`)
        .sort();

      for (const dep of deps) {
        if (!index[dep]) {
          throw new ResolverError(
            `Missing dependency: ${dep}. Add it to .spectrl/spectrl-index.json`,
            3,
          );
        }
      }

      depGraph.set(key, deps);
    }

    // Detect cycles using DFS
    const detectCycle = (node: string, visited: Set<string>, recStack: Set<string>): boolean => {
      visited.add(node);
      recStack.add(node);

      const deps = depGraph.get(node) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (detectCycle(dep, visited, recStack)) {
            return true;
          }
        } else if (recStack.has(dep)) {
          throw new ResolverError(`Cyclic dependency detected: ${node} → ${dep}`, 3);
        }
      }

      recStack.delete(node);
      return false;
    };

    const visited = new Set<string>();
    for (const key of keys) {
      if (!visited.has(key)) {
        detectCycle(key, visited, new Set());
      }
    }

    // Build resolved nodes
    const resolved: ResolvedNode[] = [];
    for (const [key, { manifest, source }] of manifests) {
      const deps = Object.entries(manifest.deps)
        .map(([depName, depVersion]) => `${depName}@${depVersion}`)
        .sort();

      resolved.push({
        name: manifest.name,
        version: manifest.version,
        source,
        deps,
      });
    }

    // Return sorted array of resolved nodes
    // Precompute key strings to avoid repeated concatenation during sort
    const resolvedWithKeys = resolved.map((node) => ({
      node,
      key: `${node.name}@${node.version}`,
    }));
    resolvedWithKeys.sort((a, b) => a.key.localeCompare(b.key));
    return resolvedWithKeys.map((item) => item.node);
  }
}
