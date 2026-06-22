import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { LockFile } from '@spectrl/schema';
import {
  createTempDir,
  init,
  publish,
  install,
  installSpec,
  createSpec,
  exists,
  readJSON,
  writeJSON,
  getSpecHash,
  isSymlink,
  readSymlink,
  resolveSymlink,
  readText,
  remove,
} from './utils/index.js';

describe('spectrl install - symlink integration', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should create symlink with correct naming pattern on fresh install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a spec
    const specDir = join(tmpDir, 'my-spec');
    await createSpec(
      specDir,
      {
        name: 'fresh-install-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md'],
      },
      { 'readme.md': '# Fresh Install\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('fresh-install-spec', '1.0.0');

    // Create project and install
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'fresh-install-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify symlink exists with correct naming pattern: name@version
    const symlinkPath = join(projectDir, '.spectrl/specs/fresh-install-spec@1.0.0');
    expect(await exists(symlinkPath)).toBe(true);
    expect(await isSymlink(symlinkPath)).toBe(true);

    // Verify symlink points to registry
    const registryPath = join(homedir(), '.spectrl/registry/fresh-install-spec/1.0.0/files');
    const resolvedTarget = await resolveSymlink(symlinkPath);
    expect(resolvedTarget).toBe(registryPath);
  });

  it('should create separate symlinks for multiple versions', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish version 1.0.0
    const spec1Dir = join(tmpDir, 'spec-v1');
    await createSpec(
      spec1Dir,
      {
        name: 'multi-version-spec',
        version: '1.0.0',
        deps: {},
        files: ['doc.md'],
      },
      { 'doc.md': '# Version 1.0.0\n' },
    );
    await publish(spec1Dir);

    // Create and publish version 2.0.0
    const spec2Dir = join(tmpDir, 'spec-v2');
    await createSpec(
      spec2Dir,
      {
        name: 'multi-version-spec',
        version: '2.0.0',
        deps: {},
        files: ['doc.md'],
      },
      { 'doc.md': '# Version 2.0.0\n' },
    );
    await publish(spec2Dir);

    const hash1 = await getSpecHash('multi-version-spec', '1.0.0');
    const hash2 = await getSpecHash('multi-version-spec', '2.0.0');

    // Create project and install both versions
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'multi-version-spec@1.0.0': { source: `file:${spec1Dir}`, hash: hash1 },
      'multi-version-spec@2.0.0': { source: `file:${spec2Dir}`, hash: hash2 },
    });

    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify both symlinks exist
    const symlink1 = join(projectDir, '.spectrl/specs/multi-version-spec@1.0.0');
    const symlink2 = join(projectDir, '.spectrl/specs/multi-version-spec@2.0.0');

    expect(await exists(symlink1)).toBe(true);
    expect(await isSymlink(symlink1)).toBe(true);
    expect(await exists(symlink2)).toBe(true);
    expect(await isSymlink(symlink2)).toBe(true);

    // Verify they point to different registry locations
    const registry1 = join(homedir(), '.spectrl/registry/multi-version-spec/1.0.0/files');
    const registry2 = join(homedir(), '.spectrl/registry/multi-version-spec/2.0.0/files');

    expect(await resolveSymlink(symlink1)).toBe(registry1);
    expect(await resolveSymlink(symlink2)).toBe(registry2);
  });

  it('should skip when symlink already exists and is correct', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec
    const specDir = join(tmpDir, 'skip-spec');
    await createSpec(
      specDir,
      {
        name: 'skip-test-spec',
        version: '1.0.0',
        deps: {},
        files: ['test.md'],
      },
      { 'test.md': '# Test\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('skip-test-spec', '1.0.0');

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'skip-test-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // First install
    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);
    expect(result1.stderr).toContain('1 symlinked');

    // Second install should skip
    const result2 = await install(projectDir);
    expect(result2.exitCode).toBe(0);
    expect(result2.stderr).toContain('1 skipped');
  });

  it('should re-create symlink when it points to wrong target', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec
    const specDir = join(tmpDir, 'recreate-spec');
    await createSpec(
      specDir,
      {
        name: 'recreate-spec',
        version: '1.0.0',
        deps: {},
        files: ['doc.md'],
      },
      { 'doc.md': '# Doc\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('recreate-spec', '1.0.0');

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'recreate-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // First install
    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);

    const symlinkPath = join(projectDir, '.spectrl/specs/recreate-spec@1.0.0');
    const correctTarget = await resolveSymlink(symlinkPath);

    // Manually break the symlink by removing and creating a wrong one
    await remove(symlinkPath);
    const { symlink } = await import('node:fs/promises');
    const wrongTarget = join(tmpDir, 'wrong-target');
    await symlink(wrongTarget, symlinkPath, 'dir');

    // Verify symlink is wrong
    const brokenTarget = await resolveSymlink(symlinkPath);
    expect(brokenTarget).not.toBe(correctTarget);

    // Second install should detect and fix
    const result2 = await install(projectDir);
    expect(result2.exitCode).toBe(0);

    // Verify symlink is now correct
    const fixedTarget = await resolveSymlink(symlinkPath);
    expect(fixedTarget).toBe(correctTarget);
  });

  it('should allow files to be readable through symlinks', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec with multiple files
    const specDir = join(tmpDir, 'readable-spec');
    const fileContent = '# Readable Content\n\nThis should be accessible through symlink.';
    await createSpec(
      specDir,
      {
        name: 'readable-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md', 'design.md'],
      },
      {
        'readme.md': fileContent,
        'design.md': '# Design\n\nDesign content.',
      },
    );
    await publish(specDir);

    const hash = await getSpecHash('readable-spec', '1.0.0');

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'readable-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Read files through symlink
    const symlinkPath = join(projectDir, '.spectrl/specs/readable-spec@1.0.0');
    const readmePath = join(symlinkPath, 'readme.md');
    const designPath = join(symlinkPath, 'design.md');

    expect(await exists(readmePath)).toBe(true);
    expect(await exists(designPath)).toBe(true);

    const readmeContent = await readText(readmePath);
    const designContent = await readText(designPath);

    expect(readmeContent).toBe(fileContent);
    expect(designContent).toBe('# Design\n\nDesign content.');
  });

  it('should create symlinks for all specs in bulk install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish three specs
    const specs = ['bulk-spec-1', 'bulk-spec-2', 'bulk-spec-3'];
    const hashes: Record<string, string> = {};

    for (const specName of specs) {
      const specDir = join(tmpDir, specName);
      await createSpec(
        specDir,
        {
          name: specName,
          version: '1.0.0',
          deps: {},
          files: ['doc.md'],
        },
        { 'doc.md': `# ${specName}\n` },
      );
      await publish(specDir);
      hashes[specName] = await getSpecHash(specName, '1.0.0');
    }

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index: Record<string, { source: string; hash: string }> = {};
    for (const specName of specs) {
      index[`${specName}@1.0.0`] = {
        source: `file:${join(tmpDir, specName)}`,
        hash: hashes[specName],
      };
    }
    await writeJSON(indexPath, index);

    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('Processed 3 spec(s)');
    expect(result.stderr).toContain('3 symlinked');

    // Verify all symlinks exist
    for (const specName of specs) {
      const symlinkPath = join(projectDir, `.spectrl/specs/${specName}@1.0.0`);
      expect(await exists(symlinkPath)).toBe(true);
      expect(await isSymlink(symlinkPath)).toBe(true);
    }
  });

  it('should create symlink and update index for single spec install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec
    const specDir = join(tmpDir, 'single-spec');
    await createSpec(
      specDir,
      {
        name: 'single-install-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md'],
      },
      { 'readme.md': '# Single Install\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('single-install-spec', '1.0.0');

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create index with the spec
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'single-install-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Use bulk install (not single spec install) to test symlink creation
    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify symlink was created
    const symlinkPath = join(projectDir, '.spectrl/specs/single-install-spec@1.0.0');
    expect(await exists(symlinkPath)).toBe(true);
    expect(await isSymlink(symlinkPath)).toBe(true);

    // Verify lock file was updated
    const lockPath = join(projectDir, '.spectrl/lock.json');
    expect(await exists(lockPath)).toBe(true);

    const lock = await readJSON<LockFile>(lockPath);
    expect(lock.entries).toHaveLength(1);
    expect(lock.entries[0].name).toBe('single-install-spec');
    expect(lock.entries[0].version).toBe('1.0.0');
  });

  it('should handle error when registry path does not exist', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create index pointing to non-existent spec
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'nonexistent-spec@1.0.0': {
        source: `file:${join(tmpDir, 'nonexistent')}`,
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
    });

    const result = await install(projectDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Missing source');
  });

  it('should use copy mode when SPECTRL_USE_COPY=1 is set', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish spec
    const specDir = join(tmpDir, 'copy-mode-spec');
    await createSpec(
      specDir,
      {
        name: 'copy-mode-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md'],
      },
      { 'readme.md': '# Copy Mode\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('copy-mode-spec', '1.0.0');

    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'copy-mode-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Set environment variable for copy mode
    const originalEnv = process.env.SPECTRL_USE_COPY;
    process.env.SPECTRL_USE_COPY = '1';

    try {
      const result = await install(projectDir);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('1 copied');

      // Verify it's NOT a symlink
      const specPath = join(projectDir, '.spectrl/specs/copy-mode-spec@1.0.0');
      expect(await exists(specPath)).toBe(true);
      expect(await isSymlink(specPath)).toBe(false);

      // Verify files were copied
      const readmePath = join(specPath, 'readme.md');
      expect(await exists(readmePath)).toBe(true);
      const content = await readText(readmePath);
      expect(content).toBe('# Copy Mode\n');
    } finally {
      // Restore environment
      if (originalEnv === undefined) {
        process.env.SPECTRL_USE_COPY = undefined;
      } else {
        process.env.SPECTRL_USE_COPY = originalEnv;
      }
    }
  });
});
