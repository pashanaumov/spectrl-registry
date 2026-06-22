import { access, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { constants } from 'node:fs';

/**
 * Checks if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a JSON file and parses it
 */
export async function readJSON<T = unknown>(path: string): Promise<T> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Writes a JSON file with formatting
 */
export async function writeJSON(path: string, data: unknown): Promise<void> {
  // Ensure parent directory exists
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Reads a text file
 */
export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Writes a text file
 */
export async function writeText(path: string, content: string): Promise<void> {
  await writeFile(path, content);
}

/**
 * Creates a directory recursively
 */
export async function createDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Copies a directory recursively
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true });
}

/**
 * Removes a directory or file
 */
export async function remove(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    // Ignore errors if path doesn't exist
  }
}

/**
 * Creates a spec directory with manifest and files.
 *
 * Applies publish-compatible defaults so tests don't need to repeat boilerplate:
 *   - `description` defaults to "A test spec" when omitted
 *   - `index.md` is added to `files` when not already present, and the file is
 *     created on disk when not supplied in the `files` map
 */
export async function createSpec(
  basePath: string,
  manifest: Record<string, unknown>,
  files: Record<string, string>,
): Promise<string> {
  await createDir(basePath);

  // Apply defaults for publish-required fields
  const normalizedManifest = { ...manifest };
  if (!normalizedManifest.description) {
    normalizedManifest.description = 'A test spec';
  }
  const filesList = Array.isArray(normalizedManifest.files)
    ? (normalizedManifest.files as string[])
    : [];
  if (!filesList.includes('index.md')) {
    normalizedManifest.files = ['index.md', ...filesList];
  }

  // Write manifest
  await writeJSON(join(basePath, 'spectrl.json'), normalizedManifest);

  // Ensure index.md exists on disk if not provided
  const allFiles = { ...files };
  if (!allFiles['index.md']) {
    allFiles['index.md'] = `# ${String(normalizedManifest.name ?? 'Spec')}\n`;
  }

  // Write files
  for (const [filePath, content] of Object.entries(allFiles)) {
    const fullPath = join(basePath, filePath);
    const dir = dirname(fullPath);
    await createDir(dir);
    await writeText(fullPath, content);
  }

  return basePath;
}

/**
 * Checks if a path is a symlink
 */
export async function isSymlink(path: string): Promise<boolean> {
  try {
    const { lstat } = await import('node:fs/promises');
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Reads the target of a symlink
 */
export async function readSymlink(path: string): Promise<string> {
  const { readlink } = await import('node:fs/promises');
  return readlink(path);
}

/**
 * Resolves a symlink target to an absolute path
 */
export async function resolveSymlink(linkPath: string): Promise<string> {
  const { resolve: resolvePath } = await import('node:path');
  const target = await readSymlink(linkPath);
  return resolvePath(join(linkPath, '..'), target);
}
