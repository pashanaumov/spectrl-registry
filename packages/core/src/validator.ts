import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { join, isAbsolute, normalize } from 'node:path';
import { ManifestSchema, type Manifest } from '@spectrl/schema';

/**
 * Validates a manifest against the schema and returns the parsed manifest
 * @param rawManifest - Raw manifest object to validate (typically from JSON.parse)
 * @returns Parsed and validated manifest
 * @throws Error with human-readable validation messages
 */
export function validateManifest(rawManifest: unknown): Manifest {
  try {
    return ManifestSchema.parse(rawManifest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e: z.ZodIssue) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
        return `${path}${e.message}`;
      });
      throw new Error(`Manifest validation failed:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validates file paths for security - checks for path traversal and absolute paths
 * @param paths - Array of file paths to validate
 * @throws Error if any path is unsafe
 */
export function validateFilePaths(paths: string[]): void {
  const seenPaths = new Set<string>();

  for (const path of paths) {
    // Check for path traversal
    if (path.includes('..')) {
      throw new Error(`Path traversal not allowed: ${path}`);
    }

    // Check for absolute paths (Unix and Windows style)
    if (isAbsolute(path) || /^[A-Za-z]:\\/.test(path)) {
      throw new Error(`Absolute paths not allowed: ${path}`);
    }

    // Normalize path and check for duplicates
    const normalizedPath = normalize(path).replace(/\\/g, '/');
    if (seenPaths.has(normalizedPath)) {
      throw new Error(`Duplicate file path: ${path}`);
    }
    seenPaths.add(normalizedPath);
  }
}

/**
 * Validates that all declared files exist in the filesystem
 * @param paths - Array of file paths to check
 * @param basePath - Base directory to resolve relative paths from
 * @throws Error if any file is missing
 */
export async function validateFilesExist(paths: string[], basePath: string): Promise<void> {
  const missingFiles: string[] = [];

  for (const filePath of paths) {
    const fullPath = join(basePath, filePath);
    try {
      await fs.access(fullPath);
    } catch {
      missingFiles.push(filePath);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`Files not found: ${missingFiles.join(', ')}`);
  }
}
