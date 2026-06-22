import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { writeFile, mkdir } from 'node:fs/promises';
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
  writeText,
  newSpec,
  newContent,
  newTypeWithPromptedName,
  getSpecHash,
} from './utils/index.js';

describe('natural workflow', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should support complete workflow: init → new → publish → install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Step 1: Initialize a project
    const projectDir = join(tmpDir, 'my-project');
    await mkdir(projectDir, { recursive: true });
    expect(await exists(projectDir)).toBe(true);

    const initResult = await init(projectDir);
    expect(initResult.exitCode).toBe(0);

    // Verify .spectrl directory was created
    const spectrlDir = join(projectDir, '.spectrl');
    expect(await exists(spectrlDir)).toBe(true);

    // Verify project index was created
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    expect(await exists(indexPath)).toBe(true);

    // Verify index is initialized as empty object
    const initialIndex = await readJSON(indexPath);
    expect(initialIndex).toEqual({});

    // Step 2: Create a new spec using 'spectrl new'
    const newResult = await newSpec(projectDir, 'my-feature-spec', '1.0.0');
    expect(newResult.exitCode).toBe(0);

    // Verify spec directory was created
    const specDir = join(projectDir, 'my-feature-spec');
    expect(await exists(specDir)).toBe(true);

    // Verify manifest was created (newSpec creates spectrl.jsonc)
    const manifestPath = join(specDir, 'spectrl.jsonc');
    expect(await exists(manifestPath)).toBe(true);

    // Step 3: Add spec files (simulating user creating their spec)
    await writeFile(
      join(specDir, 'requirements.md'),
      '# Requirements\n\n## User Stories\n',
      'utf-8',
    );
    await writeFile(join(specDir, 'design.md'), '# Design\n\n## Architecture\n', 'utf-8');

    // Verify spec files exist
    expect(await exists(join(specDir, 'requirements.md'))).toBe(true);
    expect(await exists(join(specDir, 'design.md'))).toBe(true);

    // Update manifest to include the files (write as spectrl.jsonc for publish)
    await writeJSON(join(specDir, 'spectrl.jsonc'), {
      name: 'my-feature-spec',
      version: '1.0.0',
      description: 'My feature spec',
      deps: {},
      files: ['index.md', 'requirements.md', 'design.md'],
    });

    // Step 4: Publish the spec
    const publishResult = await publish(specDir);
    expect(publishResult.exitCode).toBe(0);
    expect(publishResult.stdout).toContain('Published my-feature-spec@1.0.0');

    // Verify spec is in registry
    const registryPath = join(homedir(), '.spectrl/registry/my-feature-spec/1.0.0');
    expect(await exists(registryPath)).toBe(true);
    expect(await exists(join(registryPath, 'spectrl.json'))).toBe(true);
    expect(await exists(join(registryPath, 'files'))).toBe(true);
    expect(await exists(join(registryPath, 'files/requirements.md'))).toBe(true);
    expect(await exists(join(registryPath, 'files/design.md'))).toBe(true);

    // Step 5: Install the spec (add to index and run bulk install)
    const hash = await getSpecHash('my-feature-spec', '1.0.0');

    await writeJSON(indexPath, {
      'my-feature-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Run bulk install
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 1 spec(s)');
    expect(installResult.stderr).toContain('1 symlinked');

    // Verify lock file was created
    const lockPath = join(projectDir, '.spectrl/lock.json');
    expect(await exists(lockPath)).toBe(true);

    // Verify spec is in registry (install copies to registry, not project)
    const registrySpecPath = join(homedir(), '.spectrl/registry/my-feature-spec/1.0.0');
    expect(await exists(registrySpecPath)).toBe(true);
  });

  it('should support multi-developer workflow with version control', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Developer A: Create and publish a spec
    const specDir = join(tmpDir, 'auth-spec');
    await mkdir(specDir, { recursive: true });
    await init(specDir);

    await writeFile(join(specDir, 'requirements.md'), '# Auth Requirements\n', 'utf-8');
    await writeFile(join(specDir, 'design.md'), '# Auth Design\n', 'utf-8');

    await writeJSON(join(specDir, 'spectrl.json'), {
      name: 'auth-spec',
      version: '1.0.0',
      description: 'Auth spec',
      deps: {},
      files: ['index.md', 'requirements.md', 'design.md'],
    });
    await writeFile(join(specDir, 'index.md'), '# Auth Spec\n', 'utf-8');

    const publishResult = await publish(specDir);
    expect(publishResult.exitCode).toBe(0);

    // Developer A: Create project and add spec to index
    const devAProjectDir = join(tmpDir, 'dev-a-project');
    await init(devAProjectDir);

    const hash = await getSpecHash('auth-spec', '1.0.0');

    const devAIndexPath = join(devAProjectDir, '.spectrl/spectrl-index.json');
    await writeJSON(devAIndexPath, {
      'auth-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Developer A: Install specs
    const devAInstall = await install(devAProjectDir);
    expect(devAInstall.exitCode).toBe(0);
    expect(devAInstall.stderr).toContain('1 symlinked');

    // Developer A commits index to version control (simulated)
    // In real workflow: git add .spectrl/spectrl-index.json && git commit

    // Developer B: Clone repo (simulated by creating new project with same index)
    const devBProjectDir = join(tmpDir, 'dev-b-project');
    await init(devBProjectDir);

    // Copy the committed index file
    const devBIndexPath = join(devBProjectDir, '.spectrl/spectrl-index.json');
    await writeJSON(devBIndexPath, {
      'auth-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Developer B: Run bulk install to restore specs
    const devBInstall = await install(devBProjectDir);
    expect(devBInstall.exitCode).toBe(0);
    expect(devBInstall.stderr).toContain('Processed 1 spec(s)');
    expect(devBInstall.stderr).toContain('1 symlinked');

    // Verify Developer B has lock file
    const devBLockPath = join(devBProjectDir, '.spectrl/lock.json');
    expect(await exists(devBLockPath)).toBe(true);

    // Verify spec is in registry (accessible to both developers)
    const registrySpecPath = join(homedir(), '.spectrl/registry/auth-spec/1.0.0');
    expect(await exists(registrySpecPath)).toBe(true);
  });

  it('should handle iterative development: update spec → republish → reinstall', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish initial version
    const specDir = join(tmpDir, 'api-spec');
    await mkdir(specDir, { recursive: true });
    await init(specDir);

    await writeFile(join(specDir, 'api.md'), '# API v1\n', 'utf-8');

    await writeJSON(join(specDir, 'spectrl.json'), {
      name: 'api-spec',
      version: '1.0.0',
      description: 'API spec',
      deps: {},
      files: ['index.md', 'api.md'],
    });
    await writeFile(join(specDir, 'index.md'), '# API Spec\n', 'utf-8');

    await publish(specDir);

    // Create project and install v1.0.0
    const projectDir = join(tmpDir, 'project');
    await init(projectDir);

    const hash1 = await getSpecHash('api-spec', '1.0.0');

    await writeJSON(join(projectDir, '.spectrl/spectrl-index.json'), {
      'api-spec@1.0.0': { source: `file:${specDir}`, hash: hash1 },
    });

    const install1 = await install(projectDir);
    expect(install1.exitCode).toBe(0);
    expect(install1.stderr).toContain('1 symlinked');

    // Update spec to v2.0.0
    await writeFile(join(specDir, 'api.md'), '# API v2\n\n## Breaking Changes\n', 'utf-8');

    await writeJSON(join(specDir, 'spectrl.json'), {
      name: 'api-spec',
      version: '2.0.0',
      description: 'API spec',
      deps: {},
      files: ['index.md', 'api.md'],
    });

    await publish(specDir);

    // Update project index to use v2.0.0
    const hash2 = await getSpecHash('api-spec', '2.0.0');

    await writeJSON(join(projectDir, '.spectrl/spectrl-index.json'), {
      'api-spec@2.0.0': { source: `file:${specDir}`, hash: hash2 },
    });

    // Install v2.0.0
    const install2 = await install(projectDir);
    expect(install2.exitCode).toBe(0);
    expect(install2.stderr).toContain('1 symlinked');

    // Verify both versions exist in registry
    const registryV1 = join(homedir(), '.spectrl/registry/api-spec/1.0.0');
    const registryV2 = join(homedir(), '.spectrl/registry/api-spec/2.0.0');
    expect(await exists(registryV1)).toBe(true);
    expect(await exists(registryV2)).toBe(true);

    // Verify lock file reflects v2.0.0
    const lockPath = join(projectDir, '.spectrl/lock.json');
    const lock = await readJSON<{ entries: Array<{ name: string; version: string }> }>(lockPath);
    expect(lock.entries.some((e) => e.name === 'api-spec' && e.version === '2.0.0')).toBe(true);
  });

  it('should handle publishing multiple independent specs', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish first spec
    const spec1Dir = join(tmpDir, 'frontend-spec');
    await mkdir(spec1Dir, { recursive: true });
    await init(spec1Dir);

    await writeFile(join(spec1Dir, 'ui.md'), '# Frontend UI Spec\n', 'utf-8');

    await writeJSON(join(spec1Dir, 'spectrl.json'), {
      name: 'frontend-spec',
      version: '1.0.0',
      description: 'Frontend spec',
      deps: {},
      files: ['index.md', 'ui.md'],
    });
    await writeFile(join(spec1Dir, 'index.md'), '# Frontend Spec\n', 'utf-8');

    const publish1 = await publish(spec1Dir);
    expect(publish1.exitCode).toBe(0);
    expect(publish1.stdout).toContain('Published frontend-spec@1.0.0');

    // Create and publish second spec
    const spec2Dir = join(tmpDir, 'backend-spec');
    await mkdir(spec2Dir, { recursive: true });
    await init(spec2Dir);

    await writeFile(join(spec2Dir, 'api.md'), '# Backend API Spec\n', 'utf-8');

    await writeJSON(join(spec2Dir, 'spectrl.json'), {
      name: 'backend-spec',
      version: '1.0.0',
      description: 'Backend spec',
      deps: {},
      files: ['index.md', 'api.md'],
    });
    await writeFile(join(spec2Dir, 'index.md'), '# Backend Spec\n', 'utf-8');

    const publish2 = await publish(spec2Dir);
    expect(publish2.exitCode).toBe(0);
    expect(publish2.stdout).toContain('Published backend-spec@1.0.0');

    // Verify both specs are in registry
    expect(await exists(join(homedir(), '.spectrl/registry/frontend-spec/1.0.0'))).toBe(true);
    expect(await exists(join(homedir(), '.spectrl/registry/backend-spec/1.0.0'))).toBe(true);
  });

  it('should support authoring workflow without initialization', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec directory without initialization
    const specDir = join(tmpDir, 'no-init-spec');
    await mkdir(specDir, { recursive: true });

    // Create spec using 'spectrl new' without init
    const newResult = await newSpec(specDir, 'auth-feature', '1.0.0');
    expect(newResult.exitCode).toBe(0);
    expect(newResult.stderr).toContain('Created new spec auth-feature');

    // Verify spec was created
    const authSpecDir = join(specDir, 'auth-feature');
    expect(await exists(authSpecDir)).toBe(true);

    // Verify manifest was created (newSpec creates spectrl.jsonc)
    expect(await exists(join(authSpecDir, 'spectrl.jsonc'))).toBe(true);

    // Verify .spectrl directory was NOT created as side effect
    const spectrlDir = join(specDir, '.spectrl');
    expect(await exists(spectrlDir)).toBe(false);

    // Add spec files
    await writeFile(join(authSpecDir, 'requirements.md'), '# Auth Requirements\n', 'utf-8');

    // Write a publish-ready spectrl.jsonc with description and index.md
    await writeJSON(join(authSpecDir, 'spectrl.jsonc'), {
      name: 'auth-feature',
      version: '1.0.0',
      description: 'Auth feature spec',
      deps: {},
      files: ['index.md', 'requirements.md'],
    });

    // Publish spec without initialization
    const publishResult = await publish(authSpecDir);
    expect(publishResult.exitCode).toBe(0);
    expect(publishResult.stdout).toContain('Published auth-feature@1.0.0');

    // Verify spec is in registry
    const registryPath = join(homedir(), '.spectrl/registry/auth-feature/1.0.0');
    expect(await exists(registryPath)).toBe(true);
    expect(await exists(join(registryPath, 'files/requirements.md'))).toBe(true);
  });

  it('should auto-initialize when running install without prior init', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create project directory without initialization
    const projectDir = join(tmpDir, 'uninitialized-project');
    await mkdir(projectDir, { recursive: true });

    // Install without initialization — should auto-init and succeed
    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);

    // Verify .spectrl directory was auto-created
    const spectrlDir = join(projectDir, '.spectrl');
    expect(await exists(spectrlDir)).toBe(true);

    // Verify index was created
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    expect(await exists(indexPath)).toBe(true);
    const index = await readJSON(indexPath);
    expect(index).toEqual({});

    // Should report no specs to install
    expect(installResult.stderr).toContain('No specs to install');
  });

  it('should auto-initialize and install spec without prior init', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create and publish a spec
    const specDir = join(tmpDir, 'auto-init-spec');
    await createSpec(
      specDir,
      {
        name: 'auto-init-spec',
        version: '1.0.0',
        deps: {},
        files: ['readme.md'],
      },
      { 'readme.md': '# Auto Init Spec\n' },
    );
    await publish(specDir);

    const hash = await getSpecHash('auto-init-spec', '1.0.0');

    // Create project directory without initialization
    const projectDir = join(tmpDir, 'project');
    await mkdir(projectDir, { recursive: true });

    // Manually create .spectrl dir and index (simulating what auto-init does partially)
    // but skip init — write the index directly so bulk install triggers auto-init
    // Actually, we need to let auto-init create the dir, then write the index after
    // The real flow: install auto-inits (creates empty index), then processes it

    // First install without init — should auto-init and report empty
    const initResult = await install(projectDir);
    expect(initResult.exitCode).toBe(0);
    expect(await exists(join(projectDir, '.spectrl'))).toBe(true);

    // Now add spec to the auto-created index and install again
    const indexPath = join(projectDir, '.spectrl/spectrl-index.json');
    await writeJSON(indexPath, {
      'auto-init-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    const installResult = await install(projectDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 1 spec(s)');
    expect(installResult.stderr).toContain('1 symlinked');

    // Verify spec was installed
    expect(await exists(join(projectDir, '.spectrl/specs/auto-init-spec@1.0.0'))).toBe(true);
  });

  it('should support mixed workflow: author without init, consume with init', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Author workflow: Create and publish spec WITHOUT initialization
    const authorDir = join(tmpDir, 'author-workspace');
    await mkdir(authorDir, { recursive: true });

    // Create spec without init
    const newResult = await newSpec(authorDir, 'shared-spec', '1.0.0');
    expect(newResult.exitCode).toBe(0);

    const specDir = join(authorDir, 'shared-spec');
    await writeFile(join(specDir, 'spec.md'), '# Shared Specification\n', 'utf-8');

    // newSpec creates spectrl.jsonc — update it to include spec.md alongside index.md
    await writeJSON(join(specDir, 'spectrl.jsonc'), {
      name: 'shared-spec',
      version: '1.0.0',
      description: 'Shared spec',
      deps: {},
      files: ['index.md', 'spec.md'],
    });

    // Publish without init
    const publishResult = await publish(specDir);
    expect(publishResult.exitCode).toBe(0);
    expect(publishResult.stdout).toContain('Published shared-spec@1.0.0');

    // Verify no .spectrl directory in author workspace
    expect(await exists(join(authorDir, '.spectrl'))).toBe(false);

    // Consumer workflow: Install spec WITH initialization
    const consumerDir = join(tmpDir, 'consumer-project');
    await mkdir(consumerDir, { recursive: true });

    // Initialize consumer project
    const initResult = await init(consumerDir);
    expect(initResult.exitCode).toBe(0);

    // Verify .spectrl directory was created
    expect(await exists(join(consumerDir, '.spectrl'))).toBe(true);

    // Add spec to index
    const hash = await getSpecHash('shared-spec', '1.0.0');
    await writeJSON(join(consumerDir, '.spectrl/spectrl-index.json'), {
      'shared-spec@1.0.0': { source: `file:${specDir}`, hash },
    });

    // Install spec
    const installResult = await install(consumerDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 1 spec(s)');
    expect(installResult.stderr).toContain('1 symlinked');

    // Verify lock file was created in consumer project
    expect(await exists(join(consumerDir, '.spectrl/lock.json'))).toBe(true);

    // Verify spec is accessible in registry
    const registryPath = join(homedir(), '.spectrl/registry/shared-spec/1.0.0');
    expect(await exists(registryPath)).toBe(true);
  });

  it('should support interactive power creation: new power (prompted name) → edit → publish', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const workDir = join(tmpDir, 'power-workspace');
    await mkdir(workDir, { recursive: true });

    // Step 1: Create a power using interactive name prompt (spectrl new power → prompted name)
    const newResult = await newTypeWithPromptedName(workDir, 'power', 'my-workflow-power');
    expect(newResult.exitCode).toBe(0);
    expect(newResult.stderr).toContain('my-workflow-power');

    const powerDir = join(workDir, 'my-workflow-power');
    expect(await exists(powerDir)).toBe(true);
    expect(await exists(join(powerDir, 'spectrl.jsonc'))).toBe(true);
    expect(await exists(join(powerDir, 'index.md'))).toBe(true);

    // Verify the scaffolded manifest has type "power"
    const rawManifest = await readText(join(powerDir, 'spectrl.jsonc'));
    expect(rawManifest).toContain('"type": "power"');
    expect(rawManifest).toContain('"name": "my-workflow-power"');

    // Verify the index.md has power template content
    const indexContent = await readText(join(powerDir, 'index.md'));
    expect(indexContent).toContain('## When to Use');
    expect(indexContent).toContain('## Instructions');

    // Step 2: Edit the power — write real content and a publish-ready manifest
    await writeText(
      join(powerDir, 'index.md'),
      `# My Workflow Power

## When to Use

Apply when the agent is setting up a new feature branch.

## Instructions

1. Create a feature branch from main
2. Run the test suite before making changes
3. Commit with conventional commit messages
`,
    );

    await writeJSON(join(powerDir, 'spectrl.jsonc'), {
      name: 'my-workflow-power',
      version: '1.0.0',
      type: 'power',
      description: 'Agent instructions for feature branch workflows',
      files: ['index.md'],
      deps: {},
    });

    // Step 3: Publish the power
    const publishResult = await publish(powerDir);
    expect(publishResult.exitCode).toBe(0);
    expect(publishResult.stdout).toContain('Published my-workflow-power@1.0.0');

    // Verify power is in registry with correct files
    const registryPath = join(homedir(), '.spectrl/registry/my-workflow-power/1.0.0');
    expect(await exists(registryPath)).toBe(true);
    expect(await exists(join(registryPath, 'spectrl.json'))).toBe(true);
    expect(await exists(join(registryPath, 'files/index.md'))).toBe(true);
  });

  it('should support explicit power creation: new power <name> → publish → install', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Step 1: Create a power with explicit positional args
    const authorDir = join(tmpDir, 'author');
    await mkdir(authorDir, { recursive: true });

    const newResult = await newContent(authorDir, 'code-review-power', 'power');
    expect(newResult.exitCode).toBe(0);

    const powerDir = join(authorDir, 'code-review-power');

    // Step 2: Edit and make publish-ready
    await writeText(
      join(powerDir, 'index.md'),
      `# Code Review Power

## When to Use

Apply when reviewing pull requests or code changes.

## Instructions

1. Check for security vulnerabilities
2. Verify test coverage
3. Ensure consistent naming conventions
`,
    );

    await writeJSON(join(powerDir, 'spectrl.jsonc'), {
      name: 'code-review-power',
      version: '1.0.0',
      type: 'power',
      description: 'Agent instructions for code review',
      files: ['index.md'],
      deps: {},
    });

    // Step 3: Publish
    const publishResult = await publish(powerDir);
    expect(publishResult.exitCode).toBe(0);

    // Step 4: Install in a consumer project
    const consumerDir = join(tmpDir, 'consumer');
    await init(consumerDir);

    const hash = await getSpecHash('code-review-power', '1.0.0');
    await writeJSON(join(consumerDir, '.spectrl/spectrl-index.json'), {
      'code-review-power@1.0.0': { source: `file:${powerDir}`, hash },
    });

    const installResult = await install(consumerDir);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stderr).toContain('Processed 1 spec(s)');
    expect(installResult.stderr).toContain('1 symlinked');

    // Verify power is installed
    expect(await exists(join(consumerDir, '.spectrl/specs/code-review-power@1.0.0'))).toBe(true);
  });

  it('should install spec with transitive dependencies automatically', async () => {
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

    // Verify all three specs are installed
    expect(await exists(join(projectDir, '.spectrl/specs/root-spec@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/mid-spec@1.0.0'))).toBe(true);
    expect(await exists(join(projectDir, '.spectrl/specs/leaf-spec@1.0.0'))).toBe(true);

    // Verify all specs are in the index
    const index = await readJSON(indexPath);
    expect(index['root-spec@1.0.0']).toBeDefined();
    expect(index['mid-spec@1.0.0']).toBeDefined();
    expect(index['leaf-spec@1.0.0']).toBeDefined();

    // Verify lock file includes all specs
    const lock = await readJSON<{ entries: Array<{ name: string; version: string }> }>(
      join(projectDir, '.spectrl/lock.json'),
    );
    expect(lock.entries.some((e) => e.name === 'root-spec' && e.version === '1.0.0')).toBe(true);
    expect(lock.entries.some((e) => e.name === 'mid-spec' && e.version === '1.0.0')).toBe(true);
    expect(lock.entries.some((e) => e.name === 'leaf-spec' && e.version === '1.0.0')).toBe(true);

    // Verify catalog includes all specs
    const catalogPath = join(projectDir, '.spectrl/catalog.md');
    expect(await exists(catalogPath)).toBe(true);
    const catalog = await readText(catalogPath);
    expect(catalog).toContain('root-spec');
    expect(catalog).toContain('mid-spec');
    expect(catalog).toContain('leaf-spec');
  });
});
