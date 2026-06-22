import type { PublishRequest } from '../schemas/request';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 100;

export function validateFileSize(files: Record<string, string>): void {
  let totalSize = 0;

  for (const [path, content] of Object.entries(files)) {
    const size = Buffer.byteLength(content, 'utf8');

    if (size > MAX_FILE_SIZE) {
      throw new Error(`FILE_TOO_LARGE: ${path} exceeds 10MB limit`);
    }

    totalSize += size;
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error('TOTAL_SIZE_EXCEEDED: Total file size exceeds 50MB limit');
  }
}

export function validateFileCount(files: Record<string, string>): void {
  const fileCount = Object.keys(files).length;

  if (fileCount > MAX_FILE_COUNT) {
    throw new Error(`FILE_COUNT_EXCEEDED: Maximum ${MAX_FILE_COUNT} files allowed`);
  }
}

export function sanitizeFilePath(path: string): void {
  // Check for absolute paths
  if (path.startsWith('/')) {
    throw new Error(`INVALID_PATH: Absolute paths not allowed: ${path}`);
  }

  // Check for parent directory references
  if (path.includes('..')) {
    throw new Error(`INVALID_PATH: Parent directory references not allowed: ${path}`);
  }

  // Check for empty path
  if (!path || path.trim() === '') {
    throw new Error('INVALID_PATH: Empty file path');
  }
}

export function validateManifestFiles(
  manifest: PublishRequest['manifest'],
  files: Record<string, string>,
): void {
  // Check that all files in manifest.files exist in files object
  for (const filePath of manifest.files) {
    if (!(filePath in files)) {
      throw new Error(`MISSING_FILE: File listed in manifest not provided: ${filePath}`);
    }
  }

  // Check that all files in files object are listed in manifest.files
  for (const filePath of Object.keys(files)) {
    if (!manifest.files.includes(filePath)) {
      throw new Error(`UNLISTED_FILE: File provided but not listed in manifest: ${filePath}`);
    }
  }
}

export function validateNamespaceOwnership(username: string, specName: string): void {
  // For now, we don't enforce namespace prefixes
  // Users can publish any spec name under their username
  // The specId will be username/specName
  console.log(`Namespace check: ${username} publishing ${specName}`);
}
