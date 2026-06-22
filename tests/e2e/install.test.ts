import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ManifestSchema, type LockFile } from '@spectrl/schema';
import {
  createTempDir,
  init,
  publish,
  install,
  createSpec,
  exists,
  readJSON,
  readText,
  writeJSON,
  getSpecHash,
} from './utils/index.js';

describe('spectrl install', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    // Clean up temp directories
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should install specs with transitive dependencies', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create install-base-spec (no dependencies)
    const baseSpecDir = join(tmpDir, 'specs/install-base-spec');
    const baseManifest = {
      name: 'install-base-spec',
      version: '0.5.0',
      deps: {},
      files: ['base.md'],
    };
    await createSpec(baseSpecDir, baseManifest, {
      'base.md': '# Base Spec\n',
    });

    // Publish install-base-spec
    const basePublishResult = await publish(baseSpecDir);
    expect(basePublishResult.exitCode).toBe(0);

    // Create install-app-spec (depends on install-base-spec)
    const appSpecDir = join(tmpDir, 'specs/install-app-spec');
    const appManifest = {
      name: 'install-app-spec',
      version: '1.0.0',
      deps: {
        'install-base-spec': '0.5.0',
      },
      files: ['app.md'],
    };
    await createSpec(appSpecDir, appManifest, {
      'app.md': '# App Spec\n',
    });

    // Publish install-app-spec
    const appPublishResult = await publish(appSpecDir);
    expect(appPublishResult.exitCode).toBe(0);

    // Get hashes from published specs

    const baseHash = await getSpecHash('install-base-spec', '0.5.0');
    const appHash = await getSpecHash('install-app-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create project index with both specs
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'install-app-spec@1.0.0': { source: `file:${appSpecDir}`, hash: appHash },
      'install-base-spec@0.5.0': { source: `file:${baseSpecDir}`, hash: baseHash },
    };
    await writeJSON(indexPath, index);

    // Install
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 2 spec(s)');

    // Verify both specs are in registry
    const baseRegistryPath = join(homedir(), '.spectrl/registry/install-base-spec/0.5.0');
    expect(await exists(baseRegistryPath)).toBe(true);

    const appRegistryPath = join(homedir(), '.spectrl/registry/install-app-spec/1.0.0');
    expect(await exists(appRegistryPath)).toBe(true);

    // Verify lock file
    const lockPath = join(projectDir, '.spectrl/lock.json');
    expect(await exists(lockPath)).toBe(true);

    const lock = await readJSON<LockFile>(lockPath);
    expect(lock.createdAt).toBeDefined();
    expect(lock.entries).toHaveLength(2);

    // Entries should be sorted lexicographically
    expect(lock.entries[0].name).toBe('install-app-spec');
    expect(lock.entries[0].version).toBe('1.0.0');
    expect(lock.entries[0].hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(lock.entries[0].deps).toEqual(['install-base-spec@0.5.0']);

    expect(lock.entries[1].name).toBe('install-base-spec');
    expect(lock.entries[1].version).toBe('0.5.0');
    expect(lock.entries[1].hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(lock.entries[1].deps).toEqual([]);
  });

  it('should skip already installed specs', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a spec
    const specDir = join(tmpDir, 'specs/skip-test-spec');
    const manifest = {
      name: 'skip-test-spec',
      version: '1.0.0',
      deps: {},
      files: ['test.md'],
    };
    await createSpec(specDir, manifest, {
      'test.md': '# Test\n',
    });

    await publish(specDir);

    // Get hash from published spec

    const hash = await getSpecHash('skip-test-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create project index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'skip-test-spec@1.0.0': { source: `file:${specDir}`, hash },
    };
    await writeJSON(indexPath, index);

    // First install
    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);
    expect(result1.stderr).toContain('Processed 1 spec(s)');
    expect(result1.stderr).toContain('1 symlinked');

    // Second install should also succeed (it will verify hash and skip)
    const result2 = await install(projectDir);
    expect(result2.exitCode).toBe(0);
    expect(result2.stderr).toContain('Processed 1 spec(s)');
    expect(result2.stderr).toContain('1 skipped');
  });

  it('should verify lock file entries are sorted', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create three specs: c-spec, a-spec, b-spec (alphabetically unsorted)
    const cSpecDir = join(tmpDir, 'specs/c-spec');
    await createSpec(
      cSpecDir,
      {
        name: 'c-spec',
        version: '1.0.0',
        deps: {},
        files: ['c.md'],
      },
      { 'c.md': '# C\n' },
    );
    await publish(cSpecDir);

    const aSpecDir = join(tmpDir, 'specs/a-spec');
    await createSpec(
      aSpecDir,
      {
        name: 'a-spec',
        version: '1.0.0',
        deps: {},
        files: ['a.md'],
      },
      { 'a.md': '# A\n' },
    );
    await publish(aSpecDir);

    const bSpecDir = join(tmpDir, 'specs/b-spec');
    await createSpec(
      bSpecDir,
      {
        name: 'b-spec',
        version: '1.0.0',
        deps: {},
        files: ['b.md'],
      },
      { 'b.md': '# B\n' },
    );
    await publish(bSpecDir);

    // Get hashes from published specs

    const cHash = await getSpecHash('c-spec', '1.0.0');
    const aHash = await getSpecHash('a-spec', '1.0.0');
    const bHash = await getSpecHash('b-spec', '1.0.0');

    // Create project
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create index in unsorted order
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'c-spec@1.0.0': { source: `file:${cSpecDir}`, hash: cHash },
      'a-spec@1.0.0': { source: `file:${aSpecDir}`, hash: aHash },
      'b-spec@1.0.0': { source: `file:${bSpecDir}`, hash: bHash },
    };
    await writeJSON(indexPath, index);

    // Install
    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify lock file entries are sorted
    const lockPath = join(projectDir, '.spectrl/lock.json');
    const lock = await readJSON<LockFile>(lockPath);

    expect(lock.entries).toHaveLength(3);
    expect(lock.entries[0].name).toBe('a-spec');
    expect(lock.entries[1].name).toBe('b-spec');
    expect(lock.entries[2].name).toBe('c-spec');
  });

  it('should install multi-file spec (PRD + TDD scenario)', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create a multi-file spec with PRD and TDD
    const specDir = join(tmpDir, 'specs/feature-spec');
    const manifest = {
      name: 'feature-spec',
      version: '1.0.0',
      deps: {},
      files: ['requirements.md', 'design.md', 'architecture.md'],
    };
    const files = {
      'requirements.md': '# Requirements\n\n## User Stories\n- Story 1\n- Story 2\n',
      'design.md': '# Design\n\n## Architecture\nSystem design details\n',
      'architecture.md': '# Architecture\n\n## Components\n- Component A\n- Component B\n',
    };
    await createSpec(specDir, manifest, files);

    // Publish
    const publishResult = await publish(specDir);
    expect(publishResult.exitCode).toBe(0);

    // Get hash from published spec

    const hash = await getSpecHash('feature-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Create project index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    const index = {
      'feature-spec@1.0.0': { source: `file:${specDir}`, hash },
    };
    await writeJSON(indexPath, index);

    // Install
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 1 spec(s)');

    // Verify spec is in registry
    const registryPath = join(homedir(), '.spectrl/registry/feature-spec/1.0.0');
    expect(await exists(registryPath)).toBe(true);

    // Verify all files were copied to registry
    const filesDir = join(registryPath, 'files');
    expect(await exists(join(filesDir, 'requirements.md'))).toBe(true);
    expect(await exists(join(filesDir, 'design.md'))).toBe(true);
    expect(await exists(join(filesDir, 'architecture.md'))).toBe(true);

    // Verify lock file includes all files in hash
    const lockPath = join(projectDir, '.spectrl/lock.json');
    const lock = await readJSON<LockFile>(lockPath);
    expect(lock.entries).toHaveLength(1);
    expect(lock.entries[0].name).toBe('feature-spec');
    expect(lock.entries[0].hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should handle natural workflow: publish then bulk install with skip logic', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a spec
    const specDir = join(tmpDir, 'my-spec');
    await createSpec(
      specDir,
      {
        name: 'workflow-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md'],
      },
      { 'readme.md': '# My Spec\n' },
    );
    await publish(specDir);

    // Get hash from published spec

    const hash = await getSpecHash('workflow-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Manually add to index (simulating what single-spec install would do)
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'workflow-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // First bulk install - should install the spec
    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);
    expect(result1.stderr).toContain('Processed 1 spec(s)');
    expect(result1.stderr).toContain('1 symlinked');

    // Verify spec was symlinked to project
    const projectSpecPath = join(projectDir, '.spectrl/specs/workflow-spec@1.0.0');
    expect(await exists(projectSpecPath)).toBe(true);

    // Second bulk install - should skip (already installed with matching hash)
    const result2 = await install(projectDir);
    expect(result2.exitCode).toBe(0);
    expect(result2.stderr).toContain('Processed 1 spec(s)');
    expect(result2.stderr).toContain('1 skipped');
  });

  it('should handle multiple specs with mixed install and skip', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish two specs
    const spec1Dir = join(tmpDir, 'spec1');
    await createSpec(
      spec1Dir,
      {
        name: 'mixed-spec-1',
        version: '1.0.0',
        deps: {},
        files: ['doc1.md'],
      },
      { 'doc1.md': '# Spec 1\n' },
    );
    await publish(spec1Dir);

    const spec2Dir = join(tmpDir, 'spec2');
    await createSpec(
      spec2Dir,
      {
        name: 'mixed-spec-2',
        version: '1.0.0',
        deps: {},
        files: ['doc2.md'],
      },
      { 'doc2.md': '# Spec 2\n' },
    );
    await publish(spec2Dir);

    // Get hashes

    const hash1 = await getSpecHash('mixed-spec-1', '1.0.0');
    const hash2 = await getSpecHash('mixed-spec-2', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Add both specs to index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'mixed-spec-1@1.0.0': { source: `file:${spec1Dir}`, hash: hash1 },
      'mixed-spec-2@1.0.0': { source: `file:${spec2Dir}`, hash: hash2 },
    });

    // First install - both should be installed
    const result1 = await install(projectDir);
    expect(result1.exitCode).toBe(0);
    expect(result1.stderr).toContain('Processed 2 spec(s)');
    expect(result1.stderr).toContain('2 symlinked');

    // Second install - both should be skipped
    const result2 = await install(projectDir);
    expect(result2.exitCode).toBe(0);
    expect(result2.stderr).toContain('Processed 2 spec(s)');
    expect(result2.stderr).toContain('2 skipped');
  });

  it('should support team collaboration: commit index, clone, bulk install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish specs (simulating published specs in registry)
    const spec1Dir = join(tmpDir, 'spec1');
    await createSpec(
      spec1Dir,
      {
        name: 'team-spec-1',
        version: '1.0.0',
        deps: {},
        files: ['doc1.md'],
      },
      { 'doc1.md': '# Team Spec 1\n' },
    );
    await publish(spec1Dir);

    const spec2Dir = join(tmpDir, 'spec2');
    await createSpec(
      spec2Dir,
      {
        name: 'team-spec-2',
        version: '2.0.0',
        deps: {},
        files: ['doc2.md'],
      },
      { 'doc2.md': '# Team Spec 2\n' },
    );
    await publish(spec2Dir);

    // Get hashes

    const hash1 = await getSpecHash('team-spec-1', '1.0.0');
    const hash2 = await getSpecHash('team-spec-2', '2.0.0');

    // Developer A: create project with index
    const devADir = join(tmpDir, 'dev-a');
    await init(devADir);

    const indexPath = join(devADir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'team-spec-1@1.0.0': { source: `file:${spec1Dir}`, hash: hash1 },
      'team-spec-2@2.0.0': { source: `file:${spec2Dir}`, hash: hash2 },
    });

    // Developer A runs bulk install
    const devAInstall = await install(devADir);
    expect(devAInstall.exitCode).toBe(0);
    expect(devAInstall.stderr).toContain('Processed 2 spec(s)');

    // Verify Developer A has specs installed
    expect(await exists(join(devADir, '.spectrl/specs/team-spec-1@1.0.0'))).toBe(true);
    expect(await exists(join(devADir, '.spectrl/specs/team-spec-2@2.0.0'))).toBe(true);

    // Developer B: clone repo (simulated by copying index only, not specs)
    const devBDir = join(tmpDir, 'dev-b');
    await init(devBDir);

    // Copy the index file (simulating git clone with committed index)
    const devBIndexPath = join(devBDir, '.spectrl/spectrl-index.json');
    await writeJSON(devBIndexPath, {
      'team-spec-1@1.0.0': { source: `file:${spec1Dir}`, hash: hash1 },
      'team-spec-2@2.0.0': { source: `file:${spec2Dir}`, hash: hash2 },
    });

    // Developer B runs bulk install to restore specs
    const devBInstall = await install(devBDir);
    expect(devBInstall.exitCode).toBe(0);
    expect(devBInstall.stderr).toContain('Processed 2 spec(s)');

    // Verify both developers have the same specs
    const devASpec1 = join(devADir, '.spectrl/specs/team-spec-1@1.0.0');
    const devBSpec1 = join(devBDir, '.spectrl/specs/team-spec-1@1.0.0');
    expect(await exists(devASpec1)).toBe(true);
    expect(await exists(devBSpec1)).toBe(true);

    const devASpec2 = join(devADir, '.spectrl/specs/team-spec-2@2.0.0');
    const devBSpec2 = join(devBDir, '.spectrl/specs/team-spec-2@2.0.0');
    expect(await exists(devASpec2)).toBe(true);
    expect(await exists(devBSpec2)).toBe(true);
  });

  it('should generate catalog.md in .spectrl/ after install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a spec
    const specDir = join(tmpDir, 'catalog-spec');
    await createSpec(
      specDir,
      {
        name: 'catalog-test-spec',
        version: '1.0.0',
        description: 'A spec for catalog testing',
        deps: {},
        files: ['index.md'],
        agent: { purpose: 'Consult when testing catalog generation', tags: ['test'] },
      },
      { 'index.md': '# Catalog Test\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('catalog-test-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'catalog-test-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Install
    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify catalog.md was generated
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    expect(await exists(catalogPath)).toBe(true);

    const catalogContent = await readText(catalogPath);

    // Should contain the spec entry
    expect(catalogContent).toContain('catalog-test-spec');
    expect(catalogContent).toContain('1.0.0');
    expect(catalogContent).toContain('spec');
    expect(catalogContent).toContain('A spec for catalog testing');
    expect(catalogContent).toContain('Consult when testing catalog generation');
  });

  it('should preserve type "power" through publish → install cycle', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a power
    const powerDir = join(tmpDir, 'my-power');
    await createSpec(
      powerDir,
      {
        name: 'cycle-power-test',
        version: '1.0.0',
        type: 'power',
        description: 'A power for cycle testing',
        deps: {},
        files: ['index.md'],
      },
      { 'index.md': '# Power\n\n## Instructions\n\n1. Follow these steps\n' },
    );
    await publish(powerDir);

    const hash = await getSpecHash('cycle-power-test', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'cycle-power-test@1.0.0': { source: `file:${powerDir}`, hash },
    });

    // Install
    const result = await install(projectDir);
    expect(result.exitCode).toBe(0);

    // Verify the installed manifest retains type: "power"
    // The registry stores the manifest at registry/{name}/{version}/spectrl.json
    const registryManifestPath = join(
      homedir(),
      '.spectrl/registry/cycle-power-test/1.0.0/spectrl.json',
    );
    expect(await exists(registryManifestPath)).toBe(true);

    const raw = await readJSON(registryManifestPath);
    const parseResult = ManifestSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.type).toBe('power');
    }

    // Verify catalog.md also reflects the power type
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    expect(await exists(catalogPath)).toBe(true);

    const catalogContent = await readText(catalogPath);
    expect(catalogContent).toContain('cycle-power-test');
    expect(catalogContent).toContain('power');
  });

  it('should install three-level transitive dependency chain', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create leaf-spec (no dependencies)
    const leafSpecDir = join(tmpDir, 'specs/leaf-spec');
    await createSpec(
      leafSpecDir,
      {
        name: 'leaf-spec',
        version: '1.0.0',
        deps: {},
        files: ['leaf.md'],
      },
      { 'leaf.md': '# Leaf Spec\n' },
    );
    await publish(leafSpecDir);

    // Create mid-spec (depends on leaf-spec)
    const midSpecDir = join(tmpDir, 'specs/mid-spec');
    await createSpec(
      midSpecDir,
      {
        name: 'mid-spec',
        version: '1.0.0',
        deps: {
          'leaf-spec': '1.0.0',
        },
        files: ['mid.md'],
      },
      { 'mid.md': '# Mid Spec\n' },
    );
    await publish(midSpecDir);

    // Create root-spec (depends on mid-spec)
    const rootSpecDir = join(tmpDir, 'specs/root-spec');
    await createSpec(
      rootSpecDir,
      {
        name: 'root-spec',
        version: '1.0.0',
        deps: {
          'mid-spec': '1.0.0',
        },
        files: ['root.md'],
      },
      { 'root.md': '# Root Spec\n' },
    );
    await publish(rootSpecDir);

    const rootHash = await getSpecHash('root-spec', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Add only root spec to index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'root-spec@1.0.0': { source: `file:${rootSpecDir}`, hash: rootHash },
    });

    // Install - should automatically discover and install all transitive deps
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 3 spec(s)');

    // Verify all three specs are symlinked
    expect(await exists(join(projectDir, '.spectrl/specs/root-spec@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/mid-spec@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/leaf-spec@1.0.0'))).toBe(true);

    // Verify all three specs are in index
    const updatedIndex = await readJSON(indexPath);
    expect(updatedIndex['root-spec@1.0.0']).toBeDefined();
    expect(updatedIndex['mid-spec@1.0.0']).toBeDefined();
    expect(updatedIndex['leaf-spec@1.0.0']).toBeDefined();

    // Verify all three specs are in catalog
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    const catalogContent = await readText(catalogPath);
    expect(catalogContent).toContain('root-spec');
    expect(catalogContent).toContain('mid-spec');
    expect(catalogContent).toContain('leaf-spec');
  });

  it('should handle diamond dependency pattern correctly', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create shared-dep (no dependencies)
    const sharedDepDir = join(tmpDir, 'specs/shared-dep');
    await createSpec(
      sharedDepDir,
      {
        name: 'shared-dep',
        version: '1.0.0',
        deps: {},
        files: ['shared.md'],
      },
      { 'shared.md': '# Shared Dependency\n' },
    );
    await publish(sharedDepDir);

    // Create dep-a (depends on shared-dep)
    const depADir = join(tmpDir, 'specs/dep-a');
    await createSpec(
      depADir,
      {
        name: 'dep-a',
        version: '1.0.0',
        deps: {
          'shared-dep': '1.0.0',
        },
        files: ['dep-a.md'],
      },
      { 'dep-a.md': '# Dependency A\n' },
    );
    await publish(depADir);

    // Create dep-b (also depends on shared-dep)
    const depBDir = join(tmpDir, 'specs/dep-b');
    await createSpec(
      depBDir,
      {
        name: 'dep-b',
        version: '1.0.0',
        deps: {
          'shared-dep': '1.0.0',
        },
        files: ['dep-b.md'],
      },
      { 'dep-b.md': '# Dependency B\n' },
    );
    await publish(depBDir);

    // Create root-diamond (depends on both dep-a and dep-b)
    const rootDiamondDir = join(tmpDir, 'specs/root-diamond');
    await createSpec(
      rootDiamondDir,
      {
        name: 'root-diamond',
        version: '1.0.0',
        deps: {
          'dep-a': '1.0.0',
          'dep-b': '1.0.0',
        },
        files: ['root.md'],
      },
      { 'root.md': '# Root Diamond\n' },
    );
    await publish(rootDiamondDir);

    const rootHash = await getSpecHash('root-diamond', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Add only root spec to index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'root-diamond@1.0.0': { source: `file:${rootDiamondDir}`, hash: rootHash },
    });

    // Install - should install all four specs with shared-dep only once
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 4 spec(s)');

    // Verify all four specs are installed
    expect(await exists(join(projectDir, '.spectrl/specs/root-diamond@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/dep-a@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/dep-b@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/shared-dep@1.0.0'))).toBe(true);

    // Verify shared-dep appears exactly once in index
    const updatedIndex = await readJSON(indexPath);
    expect(Object.keys(updatedIndex)).toHaveLength(4);
    expect(updatedIndex['shared-dep@1.0.0']).toBeDefined();

    // Verify shared-dep appears exactly once in lock file
    const lockPath = join(projectDir, '.spectrl/lock.json');
    const lock = await readJSON<LockFile>(lockPath);
    expect(lock.entries).toHaveLength(4);

    const sharedDepEntries = lock.entries.filter((e) => e.name === 'shared-dep');
    expect(sharedDepEntries).toHaveLength(1);
    expect(sharedDepEntries[0].version).toBe('1.0.0');

    // Verify catalog contains all four specs
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    const catalogContent = await readText(catalogPath);
    expect(catalogContent).toContain('root-diamond');
    expect(catalogContent).toContain('dep-a');
    expect(catalogContent).toContain('dep-b');
    expect(catalogContent).toContain('shared-dep');
  });

  it('should install spec with multiple direct dependencies', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create dep-1 (no dependencies)
    const dep1Dir = join(tmpDir, 'specs/dep-1');
    await createSpec(
      dep1Dir,
      {
        name: 'dep-1',
        version: '1.0.0',
        deps: {},
        files: ['dep1.md'],
      },
      { 'dep1.md': '# Dependency 1\n' },
    );
    await publish(dep1Dir);

    // Create dep-2 (no dependencies)
    const dep2Dir = join(tmpDir, 'specs/dep-2');
    await createSpec(
      dep2Dir,
      {
        name: 'dep-2',
        version: '1.0.0',
        deps: {},
        files: ['dep2.md'],
      },
      { 'dep2.md': '# Dependency 2\n' },
    );
    await publish(dep2Dir);

    // Create dep-3 (no dependencies)
    const dep3Dir = join(tmpDir, 'specs/dep-3');
    await createSpec(
      dep3Dir,
      {
        name: 'dep-3',
        version: '1.0.0',
        deps: {},
        files: ['dep3.md'],
      },
      { 'dep3.md': '# Dependency 3\n' },
    );
    await publish(dep3Dir);

    // Create root-multi (depends on all three)
    const rootMultiDir = join(tmpDir, 'specs/root-multi');
    await createSpec(
      rootMultiDir,
      {
        name: 'root-multi',
        version: '1.0.0',
        deps: {
          'dep-1': '1.0.0',
          'dep-2': '1.0.0',
          'dep-3': '1.0.0',
        },
        files: ['root.md'],
      },
      { 'root.md': '# Root Multi\n' },
    );
    await publish(rootMultiDir);

    const rootHash = await getSpecHash('root-multi', '1.0.0');

    // Create project and init
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    // Add only root spec to index
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'root-multi@1.0.0': { source: `file:${rootMultiDir}`, hash: rootHash },
    });

    // Install - should install all four specs
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 4 spec(s)');

    // Verify all specs are installed
    expect(await exists(join(projectDir, '.spectrl/specs/root-multi@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/dep-1@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/dep-2@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/dep-3@1.0.0'))).toBe(true);

    // Verify all specs are in index
    const updatedIndex = await readJSON(indexPath);
    expect(Object.keys(updatedIndex)).toHaveLength(4);

    // Verify catalog contains all specs
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    const catalogContent = await readText(catalogPath);
    expect(catalogContent).toContain('root-multi');
    expect(catalogContent).toContain('dep-1');
    expect(catalogContent).toContain('dep-2');
    expect(catalogContent).toContain('dep-3');
  });
});
