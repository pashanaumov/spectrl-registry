import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { createTempDir, init, exists, readJSON } from './utils/index.js';

describe('spectrl init', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should create .spectrl directory and spectrl-index.json', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const result = await init(tmpDir);

    expect(result.exitCode).toBe(0);
    // CLI uses ora spinner which outputs to stderr
    expect(result.stderr).toContain('Initialized project index');

    // Verify .spectrl directory exists
    const spectrlDir = join(tmpDir, '.spectrl');
    expect(await exists(spectrlDir)).toBe(true);

    // Verify spectrl-index.json exists and has correct format
    const indexPath = join(tmpDir, '.spectrl/spectrl-index.json');
    expect(await exists(indexPath)).toBe(true);

    const index = await readJSON(indexPath);
    expect(index).toEqual({});
  });

  it('should error when index already exists', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // First init should succeed
    const result1 = await init(tmpDir);
    expect(result1.exitCode).toBe(0);

    // Second init should fail
    const result2 = await init(tmpDir);
    expect(result2.exitCode).toBe(1);
    expect(result2.stderr).toContain('File already exists');
  });
});
