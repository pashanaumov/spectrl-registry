import { createHash } from 'node:crypto';
import type { Manifest } from '@spectrl/schema';

export interface HasherOptions {
  manifest: Manifest;
  fileContents: Record<string, string>; // path → content
  // fileContents: { 'README.md': '# Title\n\nContent', 'docs/api.md': '## API\n...' }
}

/**
 * Computes deterministic SHA-256 hash from manifest and file contents
 *
 * Process:
 * 1. Canonicalize manifest JSON (sorted keys, no whitespace)
 * 2. Sort file paths lexicographically
 * 3. For each file: add path, then normalize and add content (line endings to \n)
 * 4. Return SHA-256 hex digest with sha256: prefix
 *
 * @param options - Manifest and file contents map
 * @returns Hash string in format "sha256:<hex>"
 */
export function computeHash(options: HasherOptions): string {
  const { manifest, fileContents } = options;

  // Create hasher instance using Node.js crypto
  const hasher = createHash('sha256');

  // 1. Canonicalize manifest (sorted keys, no whitespace)
  const canonicalManifest = canonicalizeManifest(manifest);
  hasher.update(canonicalManifest, 'utf8');

  // 2. Sort file paths lexicographically and process files
  const sortedPaths = Object.keys(fileContents).sort();

  for (const filePath of sortedPaths) {
    const content = fileContents[filePath];

    // Add file path to hash
    hasher.update(filePath, 'utf8');

    // Normalize content and add to hash
    const normalizedContent = normalizeContent(content);
    hasher.update(normalizedContent, 'utf8');
  }

  // Return hex digest with sha256: prefix
  return `sha256:${hasher.digest('hex')}`;
}

/**
 * Normalizes file content by converting line endings to \n
 *
 * @param content - Raw file content
 * @returns Normalized content with \n line endings
 */
function normalizeContent(content: string): string {
  // Convert Windows (\r\n) and Mac (\r) line endings to Unix (\n)
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Canonicalizes manifest JSON with sorted keys and no whitespace
 *
 * @param manifest - Manifest object
 * @returns Canonical JSON string
 */
function canonicalizeManifest(manifest: Manifest): string {
  // Create a copy without the hash field for canonical representation
  const { hash, ...manifestWithoutHash } = manifest;

  // Recursively sort all keys at all levels
  return canonicalStringify(manifestWithoutHash);
}

/**
 * Recursively serializes an object to canonical JSON with sorted keys and no whitespace
 *
 * @param value - The value to serialize
 * @returns Canonical JSON string
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    // Arrays: preserve order, recursively serialize elements
    return `[${value.map(canonicalStringify).join(',')}]`;
  }

  // Objects: sort keys, recursively serialize values
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
