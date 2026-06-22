import crypto from 'node:crypto';
import type { PublishRequest } from '../schemas/request';

export function calculateContentHash(
  manifest: PublishRequest['manifest'],
  files: Record<string, string>,
): string {
  console.log('Calculating content hash...');

  // Create a deterministic string representation
  const manifestString = JSON.stringify(manifest, Object.keys(manifest).sort());

  // Sort files by key for deterministic hashing
  const sortedFiles = Object.keys(files)
    .sort()
    .map((key) => `${key}:${files[key]}`)
    .join('|');

  const combined = `${manifestString}|${sortedFiles}`;

  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  console.log(`Content hash: sha256:${hash}`);
  return `sha256:${hash}`;
}
