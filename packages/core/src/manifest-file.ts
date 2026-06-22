import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { parseJsoncString } from './jsonc.js';

export const MANIFEST_JSONC = 'spectrl.jsonc';
export const MANIFEST_JSON = 'spectrl.json';

const MANIFEST_FILENAMES = [MANIFEST_JSONC, MANIFEST_JSON] as const;

/**
 * Resolves the manifest path in a directory, preferring spectrl.jsonc over spectrl.json.
 * @throws Error if neither file exists
 */
export async function resolveManifestPath(dir: string): Promise<string> {
  for (const filename of MANIFEST_FILENAMES) {
    const path = join(dir, filename);
    try {
      await fs.access(path);
      return path;
    } catch {
      // File doesn't exist, try next candidate
    }
  }
  throw new Error(`No manifest found in ${dir} (looked for spectrl.jsonc, spectrl.json)`);
}

/**
 * Reads and parses the manifest file from a directory as JSONC.
 * Resolves spectrl.jsonc first, falls back to spectrl.json.
 * @throws Error if no manifest found or content is invalid
 */
export async function readManifestFile(dir: string): Promise<unknown> {
  const manifestPath = await resolveManifestPath(dir);
  const content = await fs.readFile(manifestPath, 'utf-8');
  return parseJsoncString(content);
}
