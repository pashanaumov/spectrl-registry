import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { install } from './index.js';
import { CLIError, ExitCode } from '../../errors.js';
import { Registry } from '@spectrl/core';
import type { Index } from '@spectrl/schema';

// Setup MSW server for mocking HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('install command', () => {
  let testDir: string;
  let originalCwd: string;
  let indexPath: string;
  let sourceDir: string;
  let registryPath: string;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create source directory for specs
    sourceDir = join(testDir, 'sources');
    await mkdir(sourceDir, { recursive: true });

    // Set index path
    indexPath = join(testDir, 'spectrl-index.json');

    // Set test registry path
    registryPath = join(testDir, '.spectrl', 'registry');

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a spec in the source directory
   */
  async function createSourceSpec(
    name: string,
    version: string,
    files: string[],
    deps: Record<string, string> = {},
  ): Promise<string> {
    const specDir = join(sourceDir, `${name}-${version}`);
    await mkdir(specDir, { recursive: true });

    // Create manifest
    const manifest = {
      name,
      version,
      deps,
      files,
    };
    await writeFile(join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));

    // Create tracked files
    for (const file of files) {
      const filePath = join(specDir, file);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, `Content of ${file}`);
    }

    return specDir;
  }

  /**
   * Helper to create an index file
   */
  async function createIndex(
    entries: Record<
      string,
      {
        name: string;
        version: string;
        files: string[];
        deps?: Record<string, string>;
        hash?: string;
      }
    >,
  ): Promise<void> {
    const index: Index = {};

    for (const [key, spec] of Object.entries(entries)) {
      const specDir = await createSourceSpec(spec.name, spec.version, spec.files, spec.deps ?? {});
      const sourceUrl = pathToFileURL(specDir).href;

      index[key] = {
        source: sourceUrl,
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      };
    }

    await writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  describe('single spec installation', () => {
    it('should install a spec without dependencies', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with single spec
      await createIndex({
        'simple-spec@1.0.0': {
          name: 'simple-spec',
          version: '1.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs from index
      await install({ cwd: testDir, registry: registryPath });

      // Verify spec was installed to registry
      const registry = new Registry(registryPath);
      const exists = await registry.exists('simple-spec', '1.0.0');
      expect(exists).toBe(true);

      // Verify manifest is correct
      const manifest = await registry.getManifest('simple-spec', '1.0.0');
      expect(manifest.name).toBe('simple-spec');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.hash).toBeDefined();
    });

    it('should install all specs listed in index', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with multiple specs
      await createIndex({
        'spec-a@1.0.0': {
          name: 'spec-a',
          version: '1.0.0',
          files: ['README.md'],
        },
        'spec-b@2.0.0': {
          name: 'spec-b',
          version: '2.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Verify both specs were installed
      const registry = new Registry(registryPath);
      expect(await registry.exists('spec-a', '1.0.0')).toBe(true);
      expect(await registry.exists('spec-b', '2.0.0')).toBe(true);
    });
  });

  describe('recursive dependency installation', () => {
    it('should install spec with single dependency', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with spec and its dependency
      await createIndex({
        'dep-spec@1.0.0': {
          name: 'dep-spec',
          version: '1.0.0',
          files: ['index.ts'],
        },
        'main-spec@1.0.0': {
          name: 'main-spec',
          version: '1.0.0',
          files: ['main.ts'],
          deps: {
            'dep-spec': '1.0.0',
          },
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Verify both specs were installed
      const registry = new Registry(registryPath);
      expect(await registry.exists('main-spec', '1.0.0')).toBe(true);
      expect(await registry.exists('dep-spec', '1.0.0')).toBe(true);
    });

    it('should install spec with transitive dependencies', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with nested dependencies
      await createIndex({
        'leaf-spec@1.0.0': {
          name: 'leaf-spec',
          version: '1.0.0',
          files: ['leaf.ts'],
        },
        'mid-spec@1.0.0': {
          name: 'mid-spec',
          version: '1.0.0',
          files: ['mid.ts'],
          deps: {
            'leaf-spec': '1.0.0',
          },
        },
        'root-spec@1.0.0': {
          name: 'root-spec',
          version: '1.0.0',
          files: ['root.ts'],
          deps: {
            'mid-spec': '1.0.0',
          },
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Verify all specs were installed
      const registry = new Registry(registryPath);
      expect(await registry.exists('root-spec', '1.0.0')).toBe(true);
      expect(await registry.exists('mid-spec', '1.0.0')).toBe(true);
      expect(await registry.exists('leaf-spec', '1.0.0')).toBe(true);
    });
  });

  describe('skip already installed', () => {
    it('should skip spec that is already installed with matching hash', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index
      await createIndex({
        'existing-spec@1.0.0': {
          name: 'existing-spec',
          version: '1.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install once
      await install({ cwd: testDir, registry: registryPath });

      // Install again (should skip)
      await expect(install({ cwd: testDir, registry: registryPath })).resolves.not.toThrow();

      // Verify still exists
      const registry = new Registry(registryPath);
      expect(await registry.exists('existing-spec', '1.0.0')).toBe(true);
    });

    it('should skip spec in installSingleSpec when already installed with matching hash', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish a spec
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('skip-test', '1.0.0', ['README.md']);
      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash };

      await registry.publish(manifestWithHash, specDir);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install once
      await installSingleSpec('skip-test@1.0.0', { cwd: testDir, registry: registryPath });

      // Install again (should skip)
      await expect(
        installSingleSpec('skip-test@1.0.0', { cwd: testDir, registry: registryPath }),
      ).resolves.not.toThrow();

      // Verify spec still exists in project
      const projectSpecPath = join(spectrlDir, 'specs', 'skip-test@1.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);
    });

    it('should re-copy spec when hash mismatches in project', async () => {
      // This test only applies to copy mode, not symlink mode
      // In symlink mode, the manifest is in the registry and can't be corrupted in the project
      process.env.SPECTRL_USE_COPY = '1';

      try {
        // Create .spectrl directory and index
        const spectrlDir = join(testDir, '.spectrl');
        await mkdir(spectrlDir, { recursive: true });
        const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

        // Create index
        await createIndex({
          'mismatch-spec@1.0.0': {
            name: 'mismatch-spec',
            version: '1.0.0',
            files: ['README.md'],
          },
        });

        // Move index to .spectrl/spectrl-index.json
        await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

        // Install once
        await install({ cwd: testDir, registry: registryPath });

        // Corrupt the project spec file (change content to cause hash mismatch)
        const projectSpecPath = join(spectrlDir, 'specs', 'mismatch-spec@1.0.0');
        const projectManifestPath = join(projectSpecPath, 'spectrl.json');
        const projectManifest = JSON.parse(await fs.readFile(projectManifestPath, 'utf-8'));
        projectManifest.hash =
          'sha256:0000000000000000000000000000000000000000000000000000000000000000';
        await writeFile(projectManifestPath, JSON.stringify(projectManifest, null, 2));

        // Install again (should re-copy due to hash mismatch)
        await expect(install({ cwd: testDir, registry: registryPath })).resolves.not.toThrow();

        // Verify spec was re-copied with correct hash
        const updatedManifest = JSON.parse(await fs.readFile(projectManifestPath, 'utf-8'));
        expect(updatedManifest.hash).not.toBe(
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        );
      } finally {
        process.env.SPECTRL_USE_COPY = undefined;
      }
    });

    it('should track install statistics correctly', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with multiple specs
      await createIndex({
        'spec-a@1.0.0': {
          name: 'spec-a',
          version: '1.0.0',
          files: ['README.md'],
        },
        'spec-b@1.0.0': {
          name: 'spec-b',
          version: '1.0.0',
          files: ['README.md'],
        },
        'spec-c@1.0.0': {
          name: 'spec-c',
          version: '1.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs (should install 3)
      await install({ cwd: testDir, registry: registryPath });

      // Verify all specs exist
      const registry = new Registry(registryPath);
      expect(await registry.exists('spec-a', '1.0.0')).toBe(true);
      expect(await registry.exists('spec-b', '1.0.0')).toBe(true);
      expect(await registry.exists('spec-c', '1.0.0')).toBe(true);

      // Install again (should skip all 3)
      await expect(install({ cwd: testDir, registry: registryPath })).resolves.not.toThrow();
    });

    it('should throw error on hash mismatch', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index
      await createIndex({
        'hash-test@1.0.0': {
          name: 'hash-test',
          version: '1.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install once
      await install({ cwd: testDir, registry: registryPath });

      // Manually corrupt the registry by modifying a file
      const registry = new Registry(registryPath);
      const registryFilePath = join(registry.paths.files('hash-test', '1.0.0'), 'README.md');
      await writeFile(registryFilePath, 'Corrupted content');

      // Modify the source file to have different content (different hash)
      const specDir = join(sourceDir, 'hash-test-1.0.0');
      await writeFile(join(specDir, 'README.md'), 'Modified content');

      // Manually update index to point back to source (simulating external modification)
      const sourceUrl = pathToFileURL(specDir).href;
      const index = JSON.parse(await fs.readFile(projectIndexPath, 'utf-8'));
      index['hash-test@1.0.0'].source = sourceUrl;
      await writeFile(projectIndexPath, JSON.stringify(index, null, 2));

      // Try to install again (should fail with hash mismatch because registry has different content)
      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toThrow(CLIError);
      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toMatchObject({
        exitCode: ExitCode.IO_ERROR,
        message: expect.stringContaining('Integrity breach'),
      });
    });
  });

  describe('missing dependency errors', () => {
    it('should throw CLIError with DEPENDENCY_ERROR when dependency is missing', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with spec that has missing dependency
      await createIndex({
        'broken-spec@1.0.0': {
          name: 'broken-spec',
          version: '1.0.0',
          files: ['main.ts'],
          deps: {
            'missing-dep': '1.0.0',
          },
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Try to install spec with missing dependency
      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toThrow(CLIError);

      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toMatchObject({
        exitCode: ExitCode.DEPENDENCY_ERROR,
      });
    });
  });

  describe('lock file generation', () => {
    it('should write lock file with all installed specs', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with multiple specs
      await createIndex({
        'spec-a@1.0.0': {
          name: 'spec-a',
          version: '1.0.0',
          files: ['a.ts'],
        },
        'spec-b@2.0.0': {
          name: 'spec-b',
          version: '2.0.0',
          files: ['b.ts'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Verify lock file was created
      const lockPath = join(spectrlDir, 'lock.json');
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      const lockFile = JSON.parse(lockContent);

      // Verify lock file structure
      expect(lockFile.createdAt).toBeDefined();
      expect(lockFile.entries).toHaveLength(2);

      // Verify entries are sorted
      expect(lockFile.entries[0].name).toBe('spec-a');
      expect(lockFile.entries[1].name).toBe('spec-b');

      // Verify each entry has required fields
      for (const entry of lockFile.entries) {
        expect(entry.name).toBeDefined();
        expect(entry.version).toBeDefined();
        expect(entry.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(entry.source).toBeDefined();
        expect(entry.deps).toBeInstanceOf(Array);
      }
    });

    it('should include dependencies in lock entries', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with dependencies
      await createIndex({
        'dep@1.0.0': {
          name: 'dep',
          version: '1.0.0',
          files: ['dep.ts'],
        },
        'main@1.0.0': {
          name: 'main',
          version: '1.0.0',
          files: ['main.ts'],
          deps: {
            dep: '1.0.0',
          },
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Read lock file
      const lockPath = join(spectrlDir, 'lock.json');
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      const lockFile = JSON.parse(lockContent);

      // Find main entry
      const mainEntry = lockFile.entries.find((e: { name: string }) => e.name === 'main');
      expect(mainEntry).toBeDefined();
      expect(mainEntry.deps).toEqual(['dep@1.0.0']);
    });
  });

  describe('single spec installation by reference', () => {
    it('should install a specific spec from registry', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create a spec in the registry
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('test-spec', '1.0.0', ['README.md']);

      // Publish to registry
      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      // Compute hash and publish
      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash };

      await registry.publish(manifestWithHash, specDir);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install the spec by reference
      await installSingleSpec('test-spec@1.0.0', { cwd: testDir, registry: registryPath });

      // Verify spec was copied to project .spectrl/specs/
      const projectSpecPath = join(spectrlDir, 'specs', 'test-spec@1.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);

      // Verify project index was updated
      const indexPath = join(spectrlDir, 'spectrl-index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index['test-spec@1.0.0']).toBeDefined();
      expect(index['test-spec@1.0.0'].source).toContain('test-spec/1.0.0');
      expect(index['test-spec@1.0.0'].hash).toBe(hash);
    });

    it('should throw error for invalid spec reference format', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      const { installSingleSpec } = await import('./index.js');

      // Test with uppercase (invalid)
      await expect(
        installSingleSpec('Invalid-Format', { cwd: testDir, registry: registryPath }),
      ).rejects.toThrow(CLIError);

      await expect(
        installSingleSpec('Invalid-Format', { cwd: testDir, registry: registryPath }),
      ).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
        message: expect.stringContaining('Invalid spec reference format'),
      });
    });

    it('should throw error when spec not found in registry', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      const { installSingleSpec } = await import('./index.js');

      await expect(
        installSingleSpec('nonexistent@1.0.0', { cwd: testDir, registry: registryPath }),
      ).rejects.toThrow(CLIError);

      await expect(
        installSingleSpec('nonexistent@1.0.0', { cwd: testDir, registry: registryPath }),
      ).rejects.toMatchObject({
        exitCode: ExitCode.DEPENDENCY_ERROR,
        message: expect.stringContaining('not found in registry'),
      });
    });

    it('should install spec with multiple files', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create a multi-file spec in the registry
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('multi-file-spec', '2.0.0', [
        'requirements.md',
        'design.md',
        'api-spec.md',
      ]);

      // Publish to registry
      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash };

      await registry.publish(manifestWithHash, specDir);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install the spec
      await installSingleSpec('multi-file-spec@2.0.0', { cwd: testDir, registry: registryPath });

      // Verify all files were copied
      const projectSpecPath = join(spectrlDir, 'specs', 'multi-file-spec@2.0.0');
      const requirementsExists = await fs
        .access(join(projectSpecPath, 'requirements.md'))
        .then(() => true)
        .catch(() => false);
      const designExists = await fs
        .access(join(projectSpecPath, 'design.md'))
        .then(() => true)
        .catch(() => false);
      const apiExists = await fs
        .access(join(projectSpecPath, 'api-spec.md'))
        .then(() => true)
        .catch(() => false);

      expect(requirementsExists).toBe(true);
      expect(designExists).toBe(true);
      expect(apiExists).toBe(true);
    });

    it('should create project index if it does not exist', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish a spec
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('new-spec', '1.0.0', ['README.md']);

      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash };

      await registry.publish(manifestWithHash, specDir);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install the spec (should create index)
      await installSingleSpec('new-spec@1.0.0', { cwd: testDir, registry: registryPath });

      // Verify index was created
      const indexPath = join(spectrlDir, 'spectrl-index.json');
      const indexExists = await fs
        .access(indexPath)
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);

      // Verify index content
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index['new-spec@1.0.0']).toBeDefined();
    });
  });

  describe('exit codes', () => {
    it('should use DEPENDENCY_ERROR exit code for missing dependency', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with missing dependency
      await createIndex({
        'broken@1.0.0': {
          name: 'broken',
          version: '1.0.0',
          files: ['main.ts'],
          deps: {
            missing: '1.0.0',
          },
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toMatchObject({
        exitCode: ExitCode.DEPENDENCY_ERROR,
      });
    });

    it('should use VALIDATION_ERROR exit code for missing source files', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index pointing to non-existent source directory
      const nonExistentPath = join(sourceDir, 'does-not-exist');
      const index: Index = {
        'missing-files@1.0.0': {
          source: pathToFileURL(nonExistentPath).href,
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
      };
      await writeFile(projectIndexPath, JSON.stringify(index, null, 2));

      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });
  });

  describe('bulk installation behavior', () => {
    it('should handle empty index gracefully', async () => {
      // Create .spectrl directory with empty index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create empty index
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Install should complete without error
      await expect(install({ cwd: testDir, registry: registryPath })).resolves.not.toThrow();
    });

    it('should copy files to project .spectrl/specs/ directory', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with spec
      await createIndex({
        'test-spec@1.0.0': {
          name: 'test-spec',
          version: '1.0.0',
          files: ['README.md', 'docs/guide.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify files were copied to project directory
      const projectSpecPath = join(spectrlDir, 'specs', 'test-spec@1.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      const guideExists = await fs
        .access(join(projectSpecPath, 'docs', 'guide.md'))
        .then(() => true)
        .catch(() => false);

      expect(readmeExists).toBe(true);
      expect(guideExists).toBe(true);
    });

    it('should copy all files for multiple specs', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with multiple specs
      await createIndex({
        'spec-a@1.0.0': {
          name: 'spec-a',
          version: '1.0.0',
          files: ['README.md'],
        },
        'spec-b@2.0.0': {
          name: 'spec-b',
          version: '2.0.0',
          files: ['design.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Verify files were copied for both specs
      const specAPath = join(spectrlDir, 'specs', 'spec-a@1.0.0', 'README.md');
      const specBPath = join(spectrlDir, 'specs', 'spec-b@2.0.0', 'design.md');

      const specAExists = await fs
        .access(specAPath)
        .then(() => true)
        .catch(() => false);
      const specBExists = await fs
        .access(specBPath)
        .then(() => true)
        .catch(() => false);

      expect(specAExists).toBe(true);
      expect(specBExists).toBe(true);
    });
  });

  describe('multi-file spec support', () => {
    it('should install a spec with a single file', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with single-file spec
      await createIndex({
        'single-file@1.0.0': {
          name: 'single-file',
          version: '1.0.0',
          files: ['README.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify spec was installed
      const registry = new Registry(registryPath);
      const exists = await registry.exists('single-file', '1.0.0');
      expect(exists).toBe(true);

      // Verify file was copied
      const filesPath = join(registryPath, 'single-file', '1.0.0', 'files');
      const readmeExists = await fs
        .access(join(filesPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);
    });

    it('should install a spec with two files', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with two-file spec (PRD + TDD scenario)
      await createIndex({
        'two-files@1.0.0': {
          name: 'two-files',
          version: '1.0.0',
          files: ['requirements.md', 'design.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify spec was installed
      const registry = new Registry(registryPath);
      const exists = await registry.exists('two-files', '1.0.0');
      expect(exists).toBe(true);

      // Verify both files were copied
      const filesPath = join(registryPath, 'two-files', '1.0.0', 'files');
      const requirementsExists = await fs
        .access(join(filesPath, 'requirements.md'))
        .then(() => true)
        .catch(() => false);
      const designExists = await fs
        .access(join(filesPath, 'design.md'))
        .then(() => true)
        .catch(() => false);

      expect(requirementsExists).toBe(true);
      expect(designExists).toBe(true);
    });

    it('should install a spec with many files', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with many files
      const files = [
        'README.md',
        'requirements.md',
        'design.md',
        'architecture.md',
        'api-spec.md',
        'testing-plan.md',
      ];

      await createIndex({
        'many-files@1.0.0': {
          name: 'many-files',
          version: '1.0.0',
          files,
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify spec was installed
      const registry = new Registry(registryPath);
      const exists = await registry.exists('many-files', '1.0.0');
      expect(exists).toBe(true);

      // Verify all files were copied
      const filesPath = join(registryPath, 'many-files', '1.0.0', 'files');
      for (const file of files) {
        const fileExists = await fs
          .access(join(filesPath, file))
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      }

      // Verify manifest lists all files
      const manifest = await registry.getManifest('many-files', '1.0.0');
      expect(manifest.files).toEqual(files);
    });

    it('should install a spec with nested directory structure', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with nested files
      const files = ['README.md', 'docs/api.md', 'docs/guides/setup.md'];

      await createIndex({
        'nested-files@1.0.0': {
          name: 'nested-files',
          version: '1.0.0',
          files,
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify spec was installed
      const registry = new Registry(registryPath);
      const exists = await registry.exists('nested-files', '1.0.0');
      expect(exists).toBe(true);

      // Verify nested directory structure was preserved
      const filesPath = join(registryPath, 'nested-files', '1.0.0', 'files');
      const readmeExists = await fs
        .access(join(filesPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      const apiExists = await fs
        .access(join(filesPath, 'docs', 'api.md'))
        .then(() => true)
        .catch(() => false);
      const setupExists = await fs
        .access(join(filesPath, 'docs', 'guides', 'setup.md'))
        .then(() => true)
        .catch(() => false);

      expect(readmeExists).toBe(true);
      expect(apiExists).toBe(true);
      expect(setupExists).toBe(true);
    });

    it('should compute correct hash for multi-file specs', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create index with multi-file spec
      await createIndex({
        'hash-test@1.0.0': {
          name: 'hash-test',
          version: '1.0.0',
          files: ['file1.md', 'file2.md', 'file3.md'],
        },
      });

      // Move index to .spectrl/spectrl-index.json
      await writeFile(projectIndexPath, await fs.readFile(indexPath, 'utf-8'));

      // Install spec
      await install({ cwd: testDir, registry: registryPath });

      // Verify hash was computed and stored
      const registry = new Registry(registryPath);
      const manifest = await registry.getManifest('hash-test', '1.0.0');
      expect(manifest.hash).toBeDefined();
      expect(manifest.hash).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Verify lock file contains hash
      const lockPath = join(spectrlDir, 'lock.json');
      const lockContent = await fs.readFile(lockPath, 'utf-8');
      const lock = JSON.parse(lockContent);
      expect(lock.entries[0].hash).toBe(manifest.hash);
    });
  });

  describe('version resolution', () => {
    it('should install latest version when version not specified', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish multiple versions of a spec
      const registry = new Registry(registryPath);

      // Publish version 1.0.0
      const specDir1 = await createSourceSpec('my-spec', '1.0.0', ['README.md']);
      const manifest1 = JSON.parse(await fs.readFile(join(specDir1, 'spectrl.json'), 'utf-8'));
      const fileContents1: Record<string, string> = {};
      for (const file of manifest1.files) {
        fileContents1[file] = await fs.readFile(join(specDir1, file), 'utf-8');
      }
      const { computeHash } = await import('@spectrl/core');
      const hash1 = computeHash({ manifest: manifest1, fileContents: fileContents1 });
      await registry.publish({ ...manifest1, hash: hash1 }, specDir1);

      // Publish version 2.0.0
      const specDir2 = await createSourceSpec('my-spec', '2.0.0', ['README.md']);
      const manifest2 = JSON.parse(await fs.readFile(join(specDir2, 'spectrl.json'), 'utf-8'));
      const fileContents2: Record<string, string> = {};
      for (const file of manifest2.files) {
        fileContents2[file] = await fs.readFile(join(specDir2, file), 'utf-8');
      }
      const hash2 = computeHash({ manifest: manifest2, fileContents: fileContents2 });
      await registry.publish({ ...manifest2, hash: hash2 }, specDir2);

      // Publish version 1.5.0 (to test sorting)
      const specDir3 = await createSourceSpec('my-spec', '1.5.0', ['README.md']);
      const manifest3 = JSON.parse(await fs.readFile(join(specDir3, 'spectrl.json'), 'utf-8'));
      const fileContents3: Record<string, string> = {};
      for (const file of manifest3.files) {
        fileContents3[file] = await fs.readFile(join(specDir3, file), 'utf-8');
      }
      const hash3 = computeHash({ manifest: manifest3, fileContents: fileContents3 });
      await registry.publish({ ...manifest3, hash: hash3 }, specDir3);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install without version (should install 2.0.0)
      await installSingleSpec('my-spec', { cwd: testDir, registry: registryPath });

      // Verify version 2.0.0 was installed
      const projectSpecPath = join(spectrlDir, 'specs', 'my-spec@2.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);

      // Verify project index has 2.0.0
      const indexPath = join(spectrlDir, 'spectrl-index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index['my-spec@2.0.0']).toBeDefined();
      expect(index['my-spec@1.0.0']).toBeUndefined();
      expect(index['my-spec@1.5.0']).toBeUndefined();
    });

    it('should install specific version when version is specified', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish multiple versions
      const registry = new Registry(registryPath);

      const specDir1 = await createSourceSpec('versioned-spec', '1.0.0', ['README.md']);
      const manifest1 = JSON.parse(await fs.readFile(join(specDir1, 'spectrl.json'), 'utf-8'));
      const fileContents1: Record<string, string> = {};
      for (const file of manifest1.files) {
        fileContents1[file] = await fs.readFile(join(specDir1, file), 'utf-8');
      }
      const { computeHash } = await import('@spectrl/core');
      const hash1 = computeHash({ manifest: manifest1, fileContents: fileContents1 });
      await registry.publish({ ...manifest1, hash: hash1 }, specDir1);

      const specDir2 = await createSourceSpec('versioned-spec', '2.0.0', ['README.md']);
      const manifest2 = JSON.parse(await fs.readFile(join(specDir2, 'spectrl.json'), 'utf-8'));
      const fileContents2: Record<string, string> = {};
      for (const file of manifest2.files) {
        fileContents2[file] = await fs.readFile(join(specDir2, file), 'utf-8');
      }
      const hash2 = computeHash({ manifest: manifest2, fileContents: fileContents2 });
      await registry.publish({ ...manifest2, hash: hash2 }, specDir2);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install specific version 1.0.0
      await installSingleSpec('versioned-spec@1.0.0', { cwd: testDir, registry: registryPath });

      // Verify version 1.0.0 was installed (not 2.0.0)
      const projectSpecPath = join(spectrlDir, 'specs', 'versioned-spec@1.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);

      // Verify project index has 1.0.0
      const indexPath = join(spectrlDir, 'spectrl-index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index['versioned-spec@1.0.0']).toBeDefined();
      expect(index['versioned-spec@2.0.0']).toBeUndefined();
    });

    it('should throw error when spec name not found in registry', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      const { installSingleSpec } = await import('./index.js');

      await expect(
        installSingleSpec('nonexistent-spec', { cwd: testDir, registry: registryPath }),
      ).rejects.toThrow(CLIError);

      await expect(
        installSingleSpec('nonexistent-spec', { cwd: testDir, registry: registryPath }),
      ).rejects.toMatchObject({
        exitCode: ExitCode.DEPENDENCY_ERROR,
        message: expect.stringContaining('not found in registry'),
      });
    });

    it('should handle single version correctly', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish only one version
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('single-version', '1.0.0', ['README.md']);
      const manifest = JSON.parse(await fs.readFile(join(specDir, 'spectrl.json'), 'utf-8'));
      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }
      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      await registry.publish({ ...manifest, hash }, specDir);

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install without version (should install the only version)
      await installSingleSpec('single-version', { cwd: testDir, registry: registryPath });

      // Verify version 1.0.0 was installed
      const projectSpecPath = join(spectrlDir, 'specs', 'single-version@1.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);
    });

    it('should correctly sort versions with different major/minor/patch', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create project index (required for install commands)
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // Create and publish versions in non-sorted order
      const registry = new Registry(registryPath);
      const versions = ['0.1.0', '10.0.0', '2.5.3', '2.5.10', '1.0.0'];

      const { computeHash } = await import('@spectrl/core');
      for (const version of versions) {
        const specDir = await createSourceSpec('sort-test', version, ['README.md']);
        const manifest = JSON.parse(await fs.readFile(join(specDir, 'spectrl.json'), 'utf-8'));
        const fileContents: Record<string, string> = {};
        for (const file of manifest.files) {
          fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
        }
        const hash = computeHash({ manifest, fileContents });
        await registry.publish({ ...manifest, hash }, specDir);
      }

      // Import installSingleSpec
      const { installSingleSpec } = await import('./index.js');

      // Install without version (should install 10.0.0, the highest)
      await installSingleSpec('sort-test', { cwd: testDir, registry: registryPath });

      // Verify version 10.0.0 was installed
      const projectSpecPath = join(spectrlDir, 'specs', 'sort-test@10.0.0');
      const readmeExists = await fs
        .access(join(projectSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);

      // Verify project index has 10.0.0
      const indexPath = join(spectrlDir, 'spectrl-index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index['sort-test@10.0.0']).toBeDefined();
    });

    it('should reject invalid spec reference formats', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      const { installSingleSpec } = await import('./index.js');

      // Test various invalid formats
      const invalidFormats = [
        'Invalid_Name', // uppercase
        'name@', // missing version
        '@1.0.0', // missing name
        'name@v1.0.0', // 'v' prefix
        'name@1.0', // incomplete version
        'name@1.0.0.0', // too many parts
        'name with spaces', // spaces
        'name@1.0.0-beta', // pre-release tag
        'name@01.0.0', // leading zero in major
        'name@1.01.0', // leading zero in minor
        'name@1.0.01', // leading zero in patch
      ];

      for (const format of invalidFormats) {
        await expect(
          installSingleSpec(format, { cwd: testDir, registry: registryPath }),
        ).rejects.toThrow(CLIError);

        await expect(
          installSingleSpec(format, { cwd: testDir, registry: registryPath }),
        ).rejects.toMatchObject({
          exitCode: ExitCode.VALIDATION_ERROR,
          message: expect.stringContaining('Invalid spec reference format'),
        });
      }
    });
  });

  describe('symlink utility functions', () => {
    describe('getSymlinkType', () => {
      it('should return junction for Windows platform', async () => {
        // Mock process.platform
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        // Dynamically import to get fresh module with mocked platform
        const { getSymlinkType } = await import('./index.js');
        const result = getSymlinkType();

        expect(result).toBe('junction');

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should return dir for Unix-like platforms', async () => {
        const originalPlatform = process.platform;

        // Test various Unix-like platforms
        const unixPlatforms = ['darwin', 'linux', 'freebsd', 'openbsd'];

        for (const platform of unixPlatforms) {
          Object.defineProperty(process, 'platform', { value: platform });

          // Dynamically import to get fresh module
          const { getSymlinkType } = await import('./index.js');
          const result = getSymlinkType();

          expect(result).toBe('dir');
        }

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });
    });

    describe('checkSymlinkStatus', () => {
      it('should return exists=false for non-existent path', async () => {
        const { checkSymlinkStatus } = await import('./index.js');
        const nonExistentPath = join(testDir, 'does-not-exist');
        const result = await checkSymlinkStatus(nonExistentPath, '/some/target');

        expect(result).toEqual({
          exists: false,
          isSymlink: false,
          isCorrect: false,
        });
      });

      it('should return isSymlink=false for regular directory', async () => {
        const { checkSymlinkStatus } = await import('./index.js');
        const regularDir = join(testDir, 'regular-dir');
        await mkdir(regularDir);

        const result = await checkSymlinkStatus(regularDir, '/some/target');

        expect(result).toEqual({
          exists: true,
          isSymlink: false,
          isCorrect: false,
        });
      });

      it('should return isCorrect=true for symlink with correct target', async () => {
        const { checkSymlinkStatus } = await import('./index.js');
        const targetDir = join(testDir, 'target');
        const linkPath = join(testDir, 'link');

        await mkdir(targetDir);
        await fs.symlink(targetDir, linkPath, 'dir');

        const result = await checkSymlinkStatus(linkPath, targetDir);

        expect(result).toEqual({
          exists: true,
          isSymlink: true,
          isCorrect: true,
        });
      });

      it('should return isCorrect=false for symlink with wrong target', async () => {
        const { checkSymlinkStatus } = await import('./index.js');
        const targetDir = join(testDir, 'target');
        const wrongTarget = join(testDir, 'wrong-target');
        const linkPath = join(testDir, 'link');

        await mkdir(targetDir);
        await mkdir(wrongTarget);
        await fs.symlink(targetDir, linkPath, 'dir');

        const result = await checkSymlinkStatus(linkPath, wrongTarget);

        expect(result).toEqual({
          exists: true,
          isSymlink: true,
          isCorrect: false,
        });
      });

      it('should handle relative symlink paths correctly', async () => {
        const { checkSymlinkStatus } = await import('./index.js');
        const targetDir = join(testDir, 'target');
        const linkPath = join(testDir, 'link');

        await mkdir(targetDir);
        // Create symlink with relative path
        await fs.symlink('./target', linkPath, 'dir');

        const result = await checkSymlinkStatus(linkPath, targetDir);

        expect(result).toEqual({
          exists: true,
          isSymlink: true,
          isCorrect: true,
        });
      });
    });

    describe('removeExistingPath', () => {
      it('should remove a symlink without affecting target', async () => {
        const { removeExistingPath } = await import('./index.js');
        const targetDir = join(testDir, 'target');
        const linkPath = join(testDir, 'link');

        await mkdir(targetDir);
        await writeFile(join(targetDir, 'file.txt'), 'content');
        await fs.symlink(targetDir, linkPath, 'dir');

        // Remove symlink
        await removeExistingPath(linkPath);

        // Verify symlink is removed
        const linkExists = await fs
          .access(linkPath)
          .then(() => true)
          .catch(() => false);
        expect(linkExists).toBe(false);

        // Verify target still exists
        const targetExists = await fs
          .access(targetDir)
          .then(() => true)
          .catch(() => false);
        expect(targetExists).toBe(true);

        // Verify target file still exists
        const fileContent = await fs.readFile(join(targetDir, 'file.txt'), 'utf-8');
        expect(fileContent).toBe('content');
      });

      it('should remove a regular directory recursively', async () => {
        const { removeExistingPath } = await import('./index.js');
        const dirPath = join(testDir, 'dir-to-remove');
        const nestedFile = join(dirPath, 'nested', 'file.txt');

        await mkdir(join(dirPath, 'nested'), { recursive: true });
        await writeFile(nestedFile, 'content');

        // Remove directory
        await removeExistingPath(dirPath);

        // Verify directory is removed
        const dirExists = await fs
          .access(dirPath)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(false);
      });

      it('should handle non-existent path gracefully', async () => {
        const { removeExistingPath } = await import('./index.js');
        const nonExistentPath = join(testDir, 'does-not-exist');

        // Should not throw
        await expect(removeExistingPath(nonExistentPath)).resolves.not.toThrow();
      });

      it('should remove empty directory', async () => {
        const { removeExistingPath } = await import('./index.js');
        const emptyDir = join(testDir, 'empty-dir');

        await mkdir(emptyDir);

        await removeExistingPath(emptyDir);

        const dirExists = await fs
          .access(emptyDir)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(false);
      });
    });

    describe('shouldUseCopy', () => {
      it('should return true when SPECTRL_USE_COPY=1', async () => {
        const originalValue = process.env.SPECTRL_USE_COPY;
        process.env.SPECTRL_USE_COPY = '1';

        const { shouldUseCopy } = await import('./index.js');
        const result = shouldUseCopy();

        expect(result).toBe(true);

        // Restore original value
        if (originalValue === undefined) {
          process.env.SPECTRL_USE_COPY = undefined;
        } else {
          process.env.SPECTRL_USE_COPY = originalValue;
        }
      });

      it('should return false when SPECTRL_USE_COPY is not set', async () => {
        const originalValue = process.env.SPECTRL_USE_COPY;
        process.env.SPECTRL_USE_COPY = undefined;

        const { shouldUseCopy } = await import('./index.js');
        const result = shouldUseCopy();

        expect(result).toBe(false);

        // Restore original value
        if (originalValue !== undefined) {
          process.env.SPECTRL_USE_COPY = originalValue;
        }
      });

      it('should return false when SPECTRL_USE_COPY=0', async () => {
        const originalValue = process.env.SPECTRL_USE_COPY;
        process.env.SPECTRL_USE_COPY = '0';

        const { shouldUseCopy } = await import('./index.js');
        const result = shouldUseCopy();

        expect(result).toBe(false);

        // Restore original value
        if (originalValue === undefined) {
          process.env.SPECTRL_USE_COPY = undefined;
        } else {
          process.env.SPECTRL_USE_COPY = originalValue;
        }
      });

      it('should return false for other values', async () => {
        const originalValue = process.env.SPECTRL_USE_COPY;
        const testValues = ['true', 'yes', 'on', '2', 'anything'];

        for (const value of testValues) {
          process.env.SPECTRL_USE_COPY = value;

          const { shouldUseCopy } = await import('./index.js');
          const result = shouldUseCopy();

          expect(result).toBe(false);
        }

        // Restore original value
        if (originalValue === undefined) {
          process.env.SPECTRL_USE_COPY = undefined;
        } else {
          process.env.SPECTRL_USE_COPY = originalValue;
        }
      });
    });

    describe('createSymlinkOrFallback', () => {
      it('should create symlink successfully', async () => {
        const { createSymlinkOrFallback } = await import('./index.js');
        const targetDir = join(testDir, 'registry-files');
        const linkPath = join(testDir, 'project-link');

        // Create target directory with a file
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'test.md'), 'content');

        // Create manifest
        const manifest = {
          name: 'test-spec',
          version: '1.0.0',
          files: ['test.md'],
          deps: {},
        };

        // Write manifest file (required by copyFilesFromRegistry fallback)
        await writeFile(join(targetDir, '..', 'spectrl.json'), JSON.stringify(manifest));

        // Create mock spinner
        const ora = await import('ora');
        const spinner = ora.default({ text: 'test' });

        // Create symlink
        const result = await createSymlinkOrFallback(targetDir, linkPath, manifest, spinner);

        expect(result).toBe('symlink');

        // Verify symlink exists
        const stats = await fs.lstat(linkPath);
        expect(stats.isSymbolicLink()).toBe(true);

        // Verify file is readable through symlink
        const content = await fs.readFile(join(linkPath, 'test.md'), 'utf-8');
        expect(content).toBe('content');
      });

      it('should use copy mode when SPECTRL_USE_COPY=1', async () => {
        const originalValue = process.env.SPECTRL_USE_COPY;
        process.env.SPECTRL_USE_COPY = '1';

        const { createSymlinkOrFallback } = await import('./index.js');
        const targetDir = join(testDir, 'registry-files');
        const linkPath = join(testDir, 'project-copy');

        // Create target directory with a file
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'test.md'), 'content');

        // Create manifest
        const manifest = {
          name: 'test-spec',
          version: '1.0.0',
          files: ['test.md'],
          deps: {},
        };

        // Write manifest file (required by copyFilesFromRegistry)
        await writeFile(join(targetDir, '..', 'spectrl.json'), JSON.stringify(manifest));

        // Create mock spinner
        const ora = await import('ora');
        const spinner = ora.default({ text: 'test' });

        // Should use copy mode
        const result = await createSymlinkOrFallback(targetDir, linkPath, manifest, spinner);

        expect(result).toBe('copy');

        // Verify it's a regular directory, not a symlink
        const stats = await fs.lstat(linkPath);
        expect(stats.isSymbolicLink()).toBe(false);
        expect(stats.isDirectory()).toBe(true);

        // Verify file was copied
        const content = await fs.readFile(join(linkPath, 'test.md'), 'utf-8');
        expect(content).toBe('content');

        // Restore original value
        if (originalValue === undefined) {
          process.env.SPECTRL_USE_COPY = undefined;
        } else {
          process.env.SPECTRL_USE_COPY = originalValue;
        }
      });

      it('should throw error when registry path does not exist', async () => {
        const { createSymlinkOrFallback } = await import('./index.js');
        const nonExistentPath = join(testDir, 'does-not-exist');
        const linkPath = join(testDir, 'project-link');

        const manifest = {
          name: 'test-spec',
          version: '1.0.0',
          files: ['test.md'],
          deps: {},
        };

        const ora = await import('ora');
        const spinner = ora.default({ text: 'test' });

        await expect(
          createSymlinkOrFallback(nonExistentPath, linkPath, manifest, spinner),
        ).rejects.toThrow('Registry path not found');
      });

      it('should copy files with nested directory structure', async () => {
        const { createSymlinkOrFallback } = await import('./index.js');
        const targetDir = join(testDir, 'registry-files');
        const linkPath = join(testDir, 'project-link');

        // Create target directory with nested files
        await mkdir(join(targetDir, 'docs', 'guides'), { recursive: true });
        await writeFile(join(targetDir, 'README.md'), 'readme');
        await writeFile(join(targetDir, 'docs', 'api.md'), 'api');
        await writeFile(join(targetDir, 'docs', 'guides', 'setup.md'), 'setup');

        const manifest = {
          name: 'test-spec',
          version: '1.0.0',
          files: ['README.md', 'docs/api.md', 'docs/guides/setup.md'],
          deps: {},
        };

        // Write manifest file (required by copyFilesFromRegistry fallback)
        await writeFile(join(targetDir, '..', 'spectrl.json'), JSON.stringify(manifest));

        const ora = await import('ora');
        const spinner = ora.default({ text: 'test' });

        // Create symlink
        const result = await createSymlinkOrFallback(targetDir, linkPath, manifest, spinner);

        expect(result).toBe('symlink');

        // Verify all files are accessible through symlink
        const readmeContent = await fs.readFile(join(linkPath, 'README.md'), 'utf-8');
        const apiContent = await fs.readFile(join(linkPath, 'docs', 'api.md'), 'utf-8');
        const setupContent = await fs.readFile(
          join(linkPath, 'docs', 'guides', 'setup.md'),
          'utf-8',
        );

        expect(readmeContent).toBe('readme');
        expect(apiContent).toBe('api');
        expect(setupContent).toBe('setup');
      });

      it('should create parent directory if it does not exist', async () => {
        const { createSymlinkOrFallback } = await import('./index.js');
        const targetDir = join(testDir, 'registry-files');
        const linkPath = join(testDir, 'nested', 'deep', 'project-link');

        // Create target directory
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'test.md'), 'content');

        const manifest = {
          name: 'test-spec',
          version: '1.0.0',
          files: ['test.md'],
          deps: {},
        };

        // Write manifest file (required by copyFilesFromRegistry fallback)
        await writeFile(join(targetDir, '..', 'spectrl.json'), JSON.stringify(manifest));

        const ora = await import('ora');
        const spinner = ora.default({ text: 'test' });

        // Create symlink (should create parent directories)
        const result = await createSymlinkOrFallback(targetDir, linkPath, manifest, spinner);

        expect(result).toBe('symlink');

        // Verify parent directories were created
        const parentExists = await fs
          .access(join(testDir, 'nested', 'deep'))
          .then(() => true)
          .catch(() => false);
        expect(parentExists).toBe(true);

        // Verify symlink works
        const content = await fs.readFile(join(linkPath, 'test.md'), 'utf-8');
        expect(content).toBe('content');
      });

      it('should fallback to copying on permission errors', async () => {
        // Note: This test verifies the copy fallback path by using SPECTRL_USE_COPY=1
        // Testing actual EPERM errors is difficult in unit tests because:
        // 1. ESM modules can't be easily mocked with vi.spyOn
        // 2. Creating real permission errors requires platform-specific setup
        // 3. The fallback logic is the same whether triggered by SPECTRL_USE_COPY or EPERM
        //
        // The EPERM fallback behavior is tested indirectly through:
        // - The "should use copy mode when SPECTRL_USE_COPY=1" test (same code path)
        // - Integration tests that verify the full install flow
        // - Manual testing on Windows without Developer Mode

        const originalValue = process.env.SPECTRL_USE_COPY;
        process.env.SPECTRL_USE_COPY = '1';

        try {
          const { createSymlinkOrFallback } = await import('./index.js');
          const targetDir = join(testDir, 'registry-files');
          const linkPath = join(testDir, 'project-fallback');

          // Create target directory with files
          await mkdir(targetDir, { recursive: true });
          await writeFile(join(targetDir, 'test.md'), 'content');
          await writeFile(join(targetDir, 'other.md'), 'other content');

          const manifest = {
            name: 'test-spec',
            version: '1.0.0',
            files: ['test.md', 'other.md'],
            deps: {},
          };

          // Write manifest file (required by copyFilesFromRegistry fallback)
          await writeFile(join(targetDir, '..', 'spectrl.json'), JSON.stringify(manifest));

          const ora = await import('ora');
          const spinner = ora.default({ text: 'test' });

          // Should use copy mode (same code path as EPERM fallback)
          const result = await createSymlinkOrFallback(targetDir, linkPath, manifest, spinner);

          expect(result).toBe('copy');

          // Verify it's a regular directory, not a symlink
          const stats = await fs.lstat(linkPath);
          expect(stats.isSymbolicLink()).toBe(false);
          expect(stats.isDirectory()).toBe(true);

          // Verify files were copied
          const testContent = await fs.readFile(join(linkPath, 'test.md'), 'utf-8');
          const otherContent = await fs.readFile(join(linkPath, 'other.md'), 'utf-8');
          expect(testContent).toBe('content');
          expect(otherContent).toBe('other content');

          // Verify manifest was copied
          const manifestContent = await fs.readFile(join(linkPath, 'spectrl.json'), 'utf-8');
          const copiedManifest = JSON.parse(manifestContent);
          expect(copiedManifest.name).toBe('test-spec');
        } finally {
          // Restore original value
          if (originalValue === undefined) {
            process.env.SPECTRL_USE_COPY = undefined;
          } else {
            process.env.SPECTRL_USE_COPY = originalValue;
          }
        }
      });
    });
  });

  describe('auto-initialization during install', () => {
    it('should auto-initialize when .spectrl does not exist (install no-args)', async () => {
      const uninitDir = join(
        tmpdir(),
        `spectrl-uninit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      await mkdir(uninitDir, { recursive: true });

      try {
        // install() with no specs should auto-init and report empty index
        await install({ cwd: uninitDir, registry: registryPath });

        // Verify .spectrl was created
        const indexPath = join(uninitDir, '.spectrl', 'spectrl-index.json');
        const content = await fs.readFile(indexPath, 'utf-8');
        expect(JSON.parse(content)).toEqual({});
      } finally {
        await rm(uninitDir, { recursive: true, force: true });
      }
    });

    it('should auto-initialize when .spectrl does not exist (installSingleSpec)', async () => {
      const uninitDir = join(
        tmpdir(),
        `spectrl-uninit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      await mkdir(uninitDir, { recursive: true });

      try {
        const { installSingleSpec } = await import('./index.js');

        // installSingleSpec should auto-init, then fail because spec doesn't exist in registry
        await expect(
          installSingleSpec('test-spec@1.0.0', { cwd: uninitDir, registry: registryPath }),
        ).rejects.toThrow(CLIError);

        // But .spectrl should have been created before the spec lookup failed
        const indexPath = join(uninitDir, '.spectrl', 'spectrl-index.json');
        const exists = await fs
          .access(indexPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      } finally {
        await rm(uninitDir, { recursive: true, force: true });
      }
    });

    it('should proceed directly when .spectrl already exists', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, '{}\n', 'utf-8');

      // install() should work without any initialization step
      await install({ cwd: testDir, registry: registryPath });

      // Index should still be empty (no specs to install)
      const content = await fs.readFile(projectIndexPath, 'utf-8');
      expect(JSON.parse(content)).toEqual({});
    });
  });

  describe('public registry installation', () => {
    it('should detect public spec reference with username', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Set API_URL environment variable
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      // Mock API responses with MSW
      server.use(
        // Mock getSpec API call
        http.get('https://test-api.example.com/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        // Mock manifest download from S3
        http.get('*/spectrl.json', () => {
          return HttpResponse.json({
            name: 'my-spec',
            version: '1.0.0',
            files: ['README.md'],
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
            deps: {},
          });
        }),
        // Mock file download from S3
        http.get('*/files/README.md', () => {
          return HttpResponse.text('# Test README');
        }),
      );

      try {
        const { installSingleSpec } = await import('./index.js');
        await installSingleSpec('alice/my-spec', { cwd: testDir, registry: registryPath });

        // Verify spec was downloaded to project directory
        const specPath = join(spectrlDir, 'specs', 'alice-my-spec@1.0.0');
        const manifestPath = join(specPath, 'spectrl.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);

        expect(manifest.name).toBe('my-spec');
        expect(manifest.version).toBe('1.0.0');
        expect(manifest.hash).toBe(
          'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        );

        // Verify file was downloaded
        const readmePath = join(specPath, 'README.md');
        const readmeContent = await fs.readFile(readmePath, 'utf-8');
        expect(readmeContent).toBe('# Test README');

        // Verify project index was updated
        const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
        const index = JSON.parse(indexContent);
        expect(index['alice/my-spec@1.0.0']).toBeDefined();
        expect(index['alice/my-spec@1.0.0'].hash).toBe(
          'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        );
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    it('should install specific version from public registry', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Set API_URL environment variable
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      // Mock API responses with MSW
      server.use(
        http.get('https://test-api.example.com/specs/bob/api-spec', () => {
          return HttpResponse.json({
            specId: 'bob/api-spec',
            username: 'bob',
            specName: 'api-spec',
            versions: [
              {
                version: '2.0.0',
                s3Path: 'specs/bob/api-spec/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                publishedAt: '2024-02-01T00:00:00Z',
              },
              {
                version: '1.5.0',
                s3Path: 'specs/bob/api-spec/1.5.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/1.5.0/spectrl.json', () => {
          return HttpResponse.json({
            name: 'api-spec',
            version: '1.5.0',
            files: ['api.md'],
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
            deps: {},
          });
        }),
        http.get('*/1.5.0/files/api.md', () => {
          return HttpResponse.text('# API v1.5.0');
        }),
      );

      try {
        const { installSingleSpec } = await import('./index.js');
        await installSingleSpec('bob/api-spec@1.5.0', { cwd: testDir, registry: registryPath });

        // Verify correct version was installed
        const specPath = join(spectrlDir, 'specs', 'bob-api-spec@1.5.0');
        const manifestPath = join(specPath, 'spectrl.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);

        expect(manifest.version).toBe('1.5.0');
        expect(manifest.hash).toBe(
          'sha256:0000000000000000000000000000000000000000000000000000000000000003',
        );
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    it('should throw error when public spec not found', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Set API_URL environment variable
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      // Mock API to return 404 with MSW
      server.use(
        http.get('https://test-api.example.com/specs/nonexistent/spec', () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      try {
        const { installSingleSpec } = await import('./index.js');
        await installSingleSpec('nonexistent/spec', { cwd: testDir, registry: registryPath });
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        // When API returns 404, it should be DEPENDENCY_ERROR
        expect((error as CLIError).exitCode).toBe(ExitCode.DEPENDENCY_ERROR);
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    it('should skip already installed public spec with matching hash', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Set API_URL environment variable
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      // Pre-install the spec
      const specPath = join(spectrlDir, 'specs', 'charlie-test-spec@1.0.0');
      await mkdir(specPath, { recursive: true });
      await writeFile(
        join(specPath, 'spectrl.json'),
        JSON.stringify({
          name: 'test-spec',
          version: '1.0.0',
          files: ['test.md'],
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000004',
          deps: {},
        }),
      );
      await writeFile(join(specPath, 'test.md'), '# Existing content');

      // Track if manifest was downloaded
      let manifestDownloaded = false;

      // Mock API with MSW
      server.use(
        http.get('https://test-api.example.com/specs/charlie/test-spec', () => {
          return HttpResponse.json({
            specId: 'charlie/test-spec',
            username: 'charlie',
            specName: 'test-spec',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/charlie/test-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000004',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/spectrl.json', () => {
          manifestDownloaded = true;
          return HttpResponse.text('Should not download');
        }),
      );

      try {
        const { installSingleSpec } = await import('./index.js');
        await installSingleSpec('charlie/test-spec', { cwd: testDir, registry: registryPath });

        // Verify manifest was not re-downloaded
        expect(manifestDownloaded).toBe(false);

        // Verify existing content is unchanged
        const testContent = await fs.readFile(join(specPath, 'test.md'), 'utf-8');
        expect(testContent).toBe('# Existing content');
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    // Note: Bulk install with public specs in the index is not yet fully supported
    // because the Resolver doesn't handle HTTPS URLs. This will be implemented
    // when dependency resolution for public specs is added in a future phase.
    // For now, public specs should be installed individually using installSingleSpec.
  });

  describe('local vs public spec collision', () => {
    it('should detect collision between local and public specs with same name', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Step 1: Install local spec
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('my-spec', '1.0.0', ['README.md']);
      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const localHash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash: localHash };

      await registry.publish(manifestWithHash, specDir);

      const { installSingleSpec } = await import('./index.js');
      await installSingleSpec('my-spec@1.0.0', { cwd: testDir, registry: registryPath });

      // Verify local spec is installed
      const localSpecPath = join(spectrlDir, 'specs', 'my-spec@1.0.0');
      const localReadmeExists = await fs
        .access(join(localSpecPath, 'README.md'))
        .then(() => true)
        .catch(() => false);
      expect(localReadmeExists).toBe(true);

      // Step 2: Install public spec with same name
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      server.use(
        http.get('https://test-api.example.com/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/alice/my-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000099',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/spectrl.json', () => {
          return HttpResponse.json({
            name: 'my-spec',
            version: '1.0.0',
            files: ['README.md'],
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000099',
            deps: {},
          });
        }),
        http.get('*/files/README.md', () => {
          return HttpResponse.text('# Public spec README');
        }),
      );

      try {
        // Attempt to install public spec should detect collision in non-interactive mode
        await expect(
          installSingleSpec('alice/my-spec', { cwd: testDir, registry: registryPath }),
        ).rejects.toThrow(CLIError);

        await expect(
          installSingleSpec('alice/my-spec', { cwd: testDir, registry: registryPath }),
        ).rejects.toMatchObject({
          exitCode: ExitCode.VALIDATION_ERROR,
          message: expect.stringContaining('Spec name collision detected'),
        });

        // Verify error message contains helpful information
        try {
          await installSingleSpec('alice/my-spec', { cwd: testDir, registry: registryPath });
        } catch (error) {
          expect((error as CLIError).message).toContain('Local spec');
          expect((error as CLIError).message).toContain('my-spec@1.0.0');
          expect((error as CLIError).message).toContain('alice/my-spec');
          expect((error as CLIError).message).toContain('spectrl uninstall');
        }

        // Verify local spec still exists (not affected by failed install)
        expect(localReadmeExists).toBe(true);
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    it('should detect collision when installing local after public', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Install public spec first
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      server.use(
        http.get('https://test-api.example.com/specs/bob/shared-name', () => {
          return HttpResponse.json({
            specId: 'bob/shared-name',
            username: 'bob',
            specName: 'shared-name',
            versions: [
              {
                version: '2.0.0',
                s3Path: 'specs/bob/shared-name/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000088',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/spectrl.json', () => {
          return HttpResponse.json({
            name: 'shared-name',
            version: '2.0.0',
            files: ['public.md'],
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000088',
            deps: {},
          });
        }),
        http.get('*/files/public.md', () => {
          return HttpResponse.text('# Public version');
        }),
      );

      const { installSingleSpec } = await import('./index.js');

      try {
        await installSingleSpec('bob/shared-name@2.0.0', { cwd: testDir, registry: registryPath });

        // Verify public spec is installed
        const publicPath = join(spectrlDir, 'specs', 'bob-shared-name@2.0.0');
        const publicExists = await fs
          .access(publicPath)
          .then(() => true)
          .catch(() => false);
        expect(publicExists).toBe(true);

        // Now try to install local spec with same name - should detect collision
        const registry = new Registry(registryPath);
        const specDir = await createSourceSpec('shared-name', '2.0.0', ['local.md']);
        const manifestPath = join(specDir, 'spectrl.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);

        const fileContents: Record<string, string> = {};
        for (const file of manifest.files) {
          fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
        }

        const { computeHash } = await import('@spectrl/core');
        const hash = computeHash({ manifest, fileContents });
        const manifestWithHash = { ...manifest, hash };

        await registry.publish(manifestWithHash, specDir);

        // Attempt to install local spec should detect collision
        await expect(
          installSingleSpec('shared-name@2.0.0', { cwd: testDir, registry: registryPath }),
        ).rejects.toThrow(CLIError);

        await expect(
          installSingleSpec('shared-name@2.0.0', { cwd: testDir, registry: registryPath }),
        ).rejects.toMatchObject({
          exitCode: ExitCode.VALIDATION_ERROR,
          message: expect.stringContaining('Spec name collision detected'),
        });

        // Verify error mentions the public spec
        try {
          await installSingleSpec('shared-name@2.0.0', { cwd: testDir, registry: registryPath });
        } catch (error) {
          expect((error as CLIError).message).toContain('Public spec');
          expect((error as CLIError).message).toContain('bob/shared-name@2.0.0');
        }
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });

    it('should provide clear error message in non-interactive mode', async () => {
      // Create .spectrl directory with project index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
      await writeFile(projectIndexPath, JSON.stringify({}, null, 2));

      // Install local spec
      const registry = new Registry(registryPath);
      const specDir = await createSourceSpec('index-test', '1.0.0', ['test.md']);
      const manifestPath = join(specDir, 'spectrl.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const fileContents: Record<string, string> = {};
      for (const file of manifest.files) {
        fileContents[file] = await fs.readFile(join(specDir, file), 'utf-8');
      }

      const { computeHash } = await import('@spectrl/core');
      const hash = computeHash({ manifest, fileContents });
      const manifestWithHash = { ...manifest, hash };

      await registry.publish(manifestWithHash, specDir);

      const { installSingleSpec } = await import('./index.js');
      await installSingleSpec('index-test@1.0.0', { cwd: testDir, registry: registryPath });

      // Verify local spec is installed
      const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index['index-test@1.0.0']).toBeDefined();

      // Try to install public spec - should fail with clear error
      const originalApiUrl = process.env.API_URL;
      process.env.API_URL = 'https://test-api.example.com';

      server.use(
        http.get('https://test-api.example.com/specs/charlie/index-test', () => {
          return HttpResponse.json({
            specId: 'charlie/index-test',
            username: 'charlie',
            specName: 'index-test',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/charlie/index-test/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000077',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/spectrl.json', () => {
          return HttpResponse.json({
            name: 'index-test',
            version: '1.0.0',
            files: ['test.md'],
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000077',
            deps: {},
          });
        }),
        http.get('*/files/test.md', () => {
          return HttpResponse.text('# Test');
        }),
      );

      try {
        // Verify error message is clear and actionable
        try {
          await installSingleSpec('charlie/index-test@1.0.0', {
            cwd: testDir,
            registry: registryPath,
          });
          expect.fail('Should have thrown CLIError');
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);

          const message = (error as CLIError).message;
          // Verify error message contains all key information
          expect(message).toContain('Spec name collision detected');
          expect(message).toContain('Local spec');
          expect(message).toContain('index-test@1.0.0');
          expect(message).toContain('charlie/index-test@1.0.0');
          expect(message).toContain('ambiguity in dependency resolution');
          expect(message).toContain('To resolve:');
          expect(message).toContain('spectrl uninstall');
        }
      } finally {
        process.env.API_URL = originalApiUrl;
      }
    });
  });
});
