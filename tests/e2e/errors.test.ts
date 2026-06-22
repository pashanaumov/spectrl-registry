import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createSpec,
  createTempDir,
  init,
  install,
  publish,
  writeJSON,
  writeText,
} from './utils/index.js';

describe('spectrl error scenarios', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    // Clean up temp directories
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should error with code 3 when dependency is missing from index', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with dependency
    const specDir = join(tmpDir, 'specs/app-spec');
    const manifest = {
      name: 'app-spec',
      version: '1.0.0',
      deps: {
        'missing-dep': '1.0.0',
      },
      files: ['app.md'],
    };
    await createSpec(specDir, manifest, {
      'app.md': '# App\n',
    });

    await publish(specDir);

    // Get hash from published spec
    const { getSpecHash } = await import('./utils/registry.js');
    const hash = await getSpecHash('app-spec', '1.0.0');

    // Create project
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create index WITHOUT the dependency
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'app-spec@1.0.0': { source: `file:${specDir}`, hash },
    };
    await writeJSON(indexPath, index);

    // Install should fail
    const result = await install(projectDir);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('Missing dependency');
    expect(result.stderr).toContain('missing-dep@1.0.0');
    expect(result.stderr).toContain('Add it to .spectrl/spectrl-index.json');
  });

  it('should error with code 1 when manifest name/version mismatch', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec
    const specDir = join(tmpDir, 'specs/test-spec');
    const manifest = {
      name: 'test-spec',
      version: '1.0.0',
      deps: {},
      files: ['test.md'],
    };
    await createSpec(specDir, manifest, {
      'test.md': '# Test\n',
    });

    await publish(specDir);

    // Get hash from published spec (version 1.0.0)
    const { getSpecHash } = await import('./utils/registry.js');
    const hash = await getSpecHash('test-spec', '1.0.0');

    // Create project
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create index with WRONG version
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'test-spec@2.0.0': { source: `file:${specDir}`, hash }, // Wrong version!
    };
    await writeJSON(indexPath, index);

    // Install should fail
    const result = await install(projectDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Manifest mismatch');
    expect(result.stderr).toContain('test-spec@2.0.0');
    expect(result.stderr).toContain('test-spec@1.0.0');
  });

  it('should error with code 2 when hash mismatch (integrity breach)', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec
    const specDir = join(tmpDir, 'specs/integrity-test-spec');
    const manifest = {
      name: 'integrity-test-spec',
      version: '1.0.0',
      deps: {},
      files: ['test.md'],
    };
    await createSpec(specDir, manifest, {
      'test.md': '# Test\n',
    });

    await publish(specDir);

    // Get hash from published spec
    const { getSpecHash } = await import('./utils/registry.js');
    const hash = await getSpecHash('integrity-test-spec', '1.0.0');

    // Create project and install once
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'integrity-test-spec@1.0.0': { source: `file:${specDir}`, hash },
    };
    await writeJSON(indexPath, index);

    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);

    // Tamper with the registry file
    const registryPath = join(homedir(), '.spectrl/registry/integrity-test-spec/1.0.0');
    const tamperedFilePath = join(registryPath, 'files/test.md');
    await writeText(tamperedFilePath, '# Tampered content\n');

    // Modify source file to trigger hash mismatch
    await writeText(join(specDir, 'test.md'), '# Modified\n');

    // Second install should detect integrity breach
    const result2 = await install(projectDir);

    expect(result2.exitCode).toBe(2);
    expect(result2.stderr).toContain('Integrity breach');
    expect(result2.stderr).toContain('hash mismatch');
    expect(result2.stderr).toContain('integrity-test-spec@1.0.0');
  });

  it('should error with code 3 when cycle is detected', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec-a that depends on spec-b
    const specADir = join(tmpDir, 'specs/spec-a');
    await createSpec(
      specADir,
      {
        name: 'spec-a',
        version: '1.0.0',
        deps: {
          'spec-b': '1.0.0',
        },
        files: ['a.md'],
      },
      { 'a.md': '# A\n' },
    );
    await publish(specADir);

    // Create spec-b that depends on spec-a (cycle!)
    const specBDir = join(tmpDir, 'specs/spec-b');
    await createSpec(
      specBDir,
      {
        name: 'spec-b',
        version: '1.0.0',
        deps: {
          'spec-a': '1.0.0',
        },
        files: ['b.md'],
      },
      { 'b.md': '# B\n' },
    );
    await publish(specBDir);

    // Get hashes from published specs
    const { getSpecHash } = await import('./utils/registry.js');
    const hashA = await getSpecHash('spec-a', '1.0.0');
    const hashB = await getSpecHash('spec-b', '1.0.0');

    // Create project
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'spec-a@1.0.0': { source: `file:${specADir}`, hash: hashA },
      'spec-b@1.0.0': { source: `file:${specBDir}`, hash: hashB },
    };
    await writeJSON(indexPath, index);

    // Install should detect cycle
    const result = await install(projectDir);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('Cyclic dependency detected');
  });

  it('should output validation errors to stderr with exit code 1', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with invalid name (uppercase not allowed)
    const manifest = {
      name: 'Invalid-Name',
      version: '1.0.0',
      deps: {},
      files: ['test.md'],
    };
    await createSpec(tmpDir, manifest, {
      'test.md': '# Test\n',
    });

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBeTruthy();
    expect(result.stdout).toBe('');
  });

  it('should output file I/O errors to stderr with exit code 2', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with missing file
    const manifest = {
      name: 'test-spec',
      version: '1.0.0',
      deps: {},
      files: ['nonexistent.md'],
    };
    await createSpec(tmpDir, manifest, {});

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBeTruthy();
    expect(result.stderr).toContain('nonexistent.md');
  });

  it('should output resolution errors to stderr with exit code 3', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with dependency
    const specDir = join(tmpDir, 'specs/app-spec');
    await createSpec(
      specDir,
      {
        name: 'app-spec',
        version: '1.0.0',
        deps: {
          'missing-spec': '1.0.0',
        },
        files: ['app.md'],
      },
      { 'app.md': '# App\n' },
    );
    await publish(specDir);

    // Get hash from published spec
    const { getSpecHash } = await import('./utils/registry.js');
    const hash = await getSpecHash('app-spec', '1.0.0');

    // Create project
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'app-spec@1.0.0': { source: `file:${specDir}`, hash },
    };
    await writeJSON(indexPath, index);

    const result = await install(projectDir);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBeTruthy();
    expect(result.stderr).toContain('missing-spec@1.0.0');
  });
});
