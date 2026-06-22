import { homedir } from 'node:os';
import { join } from 'node:path';
import { remove } from './fs-helpers.js';

/**
 * Gets the registry path
 */
export function getRegistryPath(): string {
  return join(homedir(), '.spectrl/registry');
}

/**
 * Cleans the entire registry
 */
export async function cleanRegistry(): Promise<void> {
  await remove(getRegistryPath());
}

/**
 * Cleans a specific spec from the registry
 */
export async function cleanSpec(name: string, version?: string): Promise<void> {
  const registryPath = getRegistryPath();
  if (version) {
    await remove(join(registryPath, name, version));
  } else {
    await remove(join(registryPath, name));
  }
}

/**
 * Gets the hash of a published spec from the registry
 */
export async function getSpecHash(name: string, version: string): Promise<string> {
  const { readJSON } = await import('./fs-helpers.js');
  const registryPath = getRegistryPath();
  const manifestPath = join(registryPath, name, version, 'spectrl.json');
  const manifest = await readJSON<{ hash?: string }>(manifestPath);
  if (!manifest.hash) {
    throw new Error(`No hash found in manifest for ${name}@${version}`);
  }
  return manifest.hash;
}
