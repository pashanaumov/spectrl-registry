import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a temporary directory for testing
 * Returns the path and a cleanup function
 */
export async function createTempDir(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempPath = await mkdtemp(join(tmpdir(), 'spectrl-test-'));

  const cleanup = async () => {
    await rm(tempPath, { recursive: true, force: true });
  };

  return { path: tempPath, cleanup };
}
