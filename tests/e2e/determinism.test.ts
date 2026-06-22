import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Manifest, LockFile } from '@spectrl/schema';
import {
  createTempDir,
  init,
  publish,
  install,
  createSpec,
  writeJSON,
  readJSON,
  readText,
} from './utils/index.js';

describe('spectrl determinism', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    // Clean up temp directories
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should produce identical lock files on repeated installs', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create lock-base-spec
    const baseSpecDir = join(tmpDir, 'specs/lock-base-spec');
    await createSpec(
      baseSpecDir,
      {
        name: 'lock-base-spec',
        version: '1.0.0',
        deps: {},
        files: ['base.md'],
      },
      { 'base.md': '# Base\n' },
    );
    await publish(baseSpecDir);

    // Create lock-app-spec
    const appSpecDir = join(tmpDir, 'specs/lock-app-spec');
    await createSpec(
      appSpecDir,
      {
        name: 'lock-app-spec',
        version: '1.0.0',
        deps: {
          'lock-base-spec': '1.0.0',
        },
        files: ['app.md'],
      },
      { 'app.md': '# App\n' },
    );
    await publish(appSpecDir);

    // Get hashes from published specs
    const { getSpecHash } = await import('./utils/registry.js');
    const appHash = await getSpecHash('lock-app-spec', '1.0.0');
    const baseHash = await getSpecHash('lock-base-spec', '1.0.0');

    // First project install
    const project1Dir = join(tmpDir, 'project1');
    await init(project1Dir);

    const index1Path = join(project1Dir, '.spectrl/spectrl-index.json');
    const index = {
      'lock-app-spec@1.0.0': { source: `file:${appSpecDir}`, hash: appHash },
      'lock-base-spec@1.0.0': { source: `file:${baseSpecDir}`, hash: baseHash },
    };
    await writeJSON(index1Path, index);

    const result1 = await install(project1Dir);
    expect(result1.exitCode).toBe(0);

    const lock1Path = join(project1Dir, '.spectrl/lock.json');
    const lock1 = await readJSON<LockFile>(lock1Path);

    // Second project install (specs already in registry from first install)
    const project2Dir = join(tmpDir, 'project2');
    await init(project2Dir);

    const index2Path = join(project2Dir, '.spectrl/spectrl-index.json');
    await writeJSON(index2Path, index);

    const result2 = await install(project2Dir);
    expect(result2.exitCode).toBe(0);

    const lock2Path = join(project2Dir, '.spectrl/lock.json');
    const lock2 = await readJSON<LockFile>(lock2Path);

    // Compare lock files (excluding createdAt timestamp)
    expect(lock1.entries).toEqual(lock2.entries);

    // Verify hashes are identical
    expect(lock1.entries[0].hash).toBe(lock2.entries[0].hash);
    expect(lock1.entries[1].hash).toBe(lock2.entries[1].hash);
  });

  it('should produce identical hashes for identical specs', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create first spec
    const spec1Dir = join(tmpDir, 'specs/spec1');
    await createSpec(
      spec1Dir,
      {
        name: 'hash-test-spec',
        version: '1.0.0',
        deps: {},
        files: ['test.md'],
      },
      {
        'test.md': '# Test Content\n',
      },
    );

    const result1 = await publish(spec1Dir);
    expect(result1.exitCode).toBe(0);

    // Get hash from registry manifest
    const registryPath = join(homedir(), '.spectrl/registry/hash-test-spec/1.0.0');
    const manifest1 = await readJSON<Manifest>(join(registryPath, 'spectrl.json'));
    const hash1 = manifest1.hash;

    // Create second spec in different location with identical manifest and content
    const spec2Dir = join(tmpDir, 'specs/spec2');
    await createSpec(
      spec2Dir,
      {
        name: 'hash-test-spec',
        version: '2.0.0', // Different version
        deps: {},
        files: ['test.md'],
      },
      {
        'test.md': '# Test Content\n',
      },
    );

    const result2 = await publish(spec2Dir);
    expect(result2.exitCode).toBe(0);

    // Get hash from registry manifest
    const registryPath2 = join(homedir(), '.spectrl/registry/hash-test-spec/2.0.0');
    const manifest2 = await readJSON<Manifest>(join(registryPath2, 'spectrl.json'));
    const hash2 = manifest2.hash;

    // Hashes should be different (version is part of the hash)
    expect(hash1).not.toBe(hash2);

    // But both should be valid sha256 hashes
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should preserve directory structure in registry', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const files = {
      'docs/readme.md': '# Test\n',
      'specs/api.yaml': 'openapi: 3.0.0\n',
    };

    // Create and publish spec with nested directory structure
    const specDir = join(tmpDir, 'specs/structure-test-spec');
    await createSpec(
      specDir,
      {
        name: 'structure-test-spec',
        version: '1.0.0',
        deps: {},
        files: ['docs/readme.md', 'specs/api.yaml'],
      },
      files,
    );

    const result = await publish(specDir);
    expect(result.exitCode).toBe(0);

    // Verify registry preserves directory structure
    const registryPath = join(homedir(), '.spectrl/registry/structure-test-spec/1.0.0');
    const manifest = await readJSON<Manifest>(join(registryPath, 'spectrl.json'));
    const readme = await readText(join(registryPath, 'files/docs/readme.md'));
    const api = await readText(join(registryPath, 'files/specs/api.yaml'));

    // Verify manifest
    expect(manifest.name).toBe('structure-test-spec');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.files).toEqual(['index.md', 'docs/readme.md', 'specs/api.yaml']);
    expect(manifest.hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    // Verify files are preserved with correct content
    expect(readme).toBe('# Test\n');
    expect(api).toBe('openapi: 3.0.0\n');
  });

  it('should produce different hashes for different content', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create first spec
    const spec1Dir = join(tmpDir, 'specs/spec1');
    await createSpec(
      spec1Dir,
      {
        name: 'diff-hash-spec-a',
        version: '1.0.0',
        deps: {},
        files: ['test.md'],
      },
      {
        'test.md': '# Content A\n',
      },
    );

    const result1 = await publish(spec1Dir);
    expect(result1.exitCode).toBe(0);

    // Get hash from registry manifest
    const registryPath1 = join(homedir(), '.spectrl/registry/diff-hash-spec-a/1.0.0');
    const manifest1 = await readJSON<Manifest>(join(registryPath1, 'spectrl.json'));
    const hash1 = manifest1.hash;

    // Create second spec with different content
    const spec2Dir = join(tmpDir, 'specs/spec2');
    await createSpec(
      spec2Dir,
      {
        name: 'diff-hash-spec-b',
        version: '1.0.0',
        deps: {},
        files: ['test.md'],
      },
      {
        'test.md': '# Content B\n',
      },
    );

    const result2 = await publish(spec2Dir);
    expect(result2.exitCode).toBe(0);

    // Get hash from registry manifest
    const registryPath2 = join(homedir(), '.spectrl/registry/diff-hash-spec-b/1.0.0');
    const manifest2 = await readJSON<Manifest>(join(registryPath2, 'spectrl.json'));
    const hash2 = manifest2.hash;

    // Hashes should be different (different content = different hash)
    expect(hash1).not.toBe(hash2);
  });
});
