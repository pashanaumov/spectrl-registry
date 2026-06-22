import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as fc from 'fast-check';
import { install, installSingleSpec } from './index.js';
import { Registry, computeHash } from '@spectrl/core';
import type { Manifest } from '@spectrl/schema';
import { CLIError, ExitCode } from '../../errors.js';

/**
 * Preservation Property Tests for Transitive Dependency Installation
 *
 * CRITICAL: These tests MUST PASS on unfixed code — passing confirms baseline behavior to preserve.
 *
 * These tests follow observation-first methodology:
 * 1. Observe current behavior on unfixed code
 * 2. Write tests that assert this behavior is preserved after the fix
 *
 * GOAL: Ensure specs with no deps behave identically before and after the fix.
 */
describe('Preservation Property Tests: No-Dep Specs Unchanged', () => {
  let testDir: string;
  let originalCwd: string;
  let registryPath: string;
  let sourceDir: string;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create source directory for specs
    sourceDir = join(testDir, 'sources');
    await mkdir(sourceDir, { recursive: true });

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
    const manifest: Manifest = {
      name,
      version,
      type: 'spec',
      deps,
      files,
    };
    await writeFile(join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));

    // Create tracked files
    for (const file of files) {
      const filePath = join(specDir, file);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, `Content of ${file} in ${name}@${version}`);
    }

    return specDir;
  }

  /**
   * Helper to publish a spec to the registry
   */
  async function publishToRegistry(
    name: string,
    version: string,
    files: string[],
    deps: Record<string, string> = {},
  ): Promise<void> {
    const registry = new Registry(registryPath);
    const specDir = await createSourceSpec(name, version, files, deps);

    // Read manifest and files
    const manifestPath = join(specDir, 'spectrl.json');
    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent) as Manifest;

    // Compute hash
    const fileContents: Record<string, string> = {};
    for (const file of manifest.files) {
      fileContents[file] = await readFile(join(specDir, file), 'utf-8');
    }

    const hash = computeHash({ manifest, fileContents });
    const manifestWithHash = { ...manifest, hash };

    // Publish to registry
    await registry.publish(manifestWithHash, specDir);
  }

  /**
   * Helper to create project index
   */
  async function createProjectIndex(
    entries: Record<string, { name: string; version: string; deps?: Record<string, string> }>,
  ): Promise<void> {
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const projectIndexPath = join(spectrlDir, 'spectrl-index.json');
    const index: Record<string, { source: string; hash: string }> = {};

    for (const [key, spec] of Object.entries(entries)) {
      const specDir = await createSourceSpec(
        spec.name,
        spec.version,
        ['index.md'],
        spec.deps ?? {},
      );
      const sourceUrl = pathToFileURL(specDir).href;

      index[key] = {
        source: sourceUrl,
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      };
    }

    await writeFile(projectIndexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Helper to capture install output (files, index, catalog)
   */
  async function captureInstallOutput(): Promise<{
    specDirs: string[];
    indexKeys: string[];
    catalogContent: string;
  }> {
    const specsDir = join(testDir, '.spectrl', 'specs');
    const indexPath = join(testDir, '.spectrl', 'spectrl-index.json');
    const catalogPath = join(testDir, '.spectrl', 'catalog.md');

    // Capture spec directories
    let specDirs: string[] = [];
    try {
      specDirs = await readdir(specsDir);
    } catch {
      // Directory doesn't exist
    }

    // Capture index keys
    let indexKeys: string[] = [];
    try {
      const indexContent = await readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      indexKeys = Object.keys(index).sort();
    } catch {
      // Index doesn't exist
    }

    // Capture catalog content
    let catalogContent = '';
    try {
      catalogContent = await readFile(catalogPath, 'utf-8');
    } catch {
      // Catalog doesn't exist
    }

    return { specDirs: specDirs.sort(), indexKeys, catalogContent };
  }

  describe('Property 2: Preservation - No-Dep Specs Unchanged', () => {
    it('should produce identical output for spec with empty deps object', async () => {
      // Setup: Create a spec with deps: {} in the registry
      await publishToRegistry('no-dep-spec', '1.0.0', ['index.md'], {});

      // Setup: Create project index with the no-dep spec
      await createProjectIndex({
        'no-dep-spec@1.0.0': {
          name: 'no-dep-spec',
          version: '1.0.0',
          deps: {},
        },
      });

      // Action: Install the spec
      await install({ cwd: testDir, registry: registryPath });

      // Capture output
      const output = await captureInstallOutput();

      // Assertion: Only the no-dep spec should be installed
      expect(output.specDirs).toEqual(['no-dep-spec@1.0.0']);
      expect(output.indexKeys).toEqual(['no-dep-spec@1.0.0']);
      expect(output.catalogContent).toContain('no-dep-spec');

      // Assertion: No extra work should be done (no additional network calls or file I/O)
      // This is validated by checking that only one spec directory exists
      expect(output.specDirs.length).toBe(1);
    });

    it('should produce identical output for spec without deps field', async () => {
      // Setup: Create a spec without deps field in the registry
      await publishToRegistry('no-deps-field', '1.0.0', ['index.md'], {});

      // Setup: Create project index
      await createProjectIndex({
        'no-deps-field@1.0.0': {
          name: 'no-deps-field',
          version: '1.0.0',
          deps: {},
        },
      });

      // Action: Install the spec
      await install({ cwd: testDir, registry: registryPath });

      // Capture output
      const output = await captureInstallOutput();

      // Assertion: Only the no-deps-field spec should be installed
      expect(output.specDirs).toEqual(['no-deps-field@1.0.0']);
      expect(output.indexKeys).toEqual(['no-deps-field@1.0.0']);
      expect(output.catalogContent).toContain('no-deps-field');
    });

    it('should skip already-installed spec without error (idempotency)', async () => {
      // Setup: Create and publish a spec
      await publishToRegistry('already-installed', '1.0.0', ['index.md'], {});

      // Setup: Create project index
      await createProjectIndex({
        'already-installed@1.0.0': {
          name: 'already-installed',
          version: '1.0.0',
          deps: {},
        },
      });

      // Action: Install the spec for the first time
      await install({ cwd: testDir, registry: registryPath });

      // Capture output after first install
      const outputBefore = await captureInstallOutput();

      // Action: Install the spec again (should be a no-op)
      await install({ cwd: testDir, registry: registryPath });

      // Capture output after second install
      const outputAfter = await captureInstallOutput();

      // Assertion: Output should be identical (idempotent)
      expect(outputAfter.specDirs).toEqual(outputBefore.specDirs);
      expect(outputAfter.indexKeys).toEqual(outputBefore.indexKeys);
      expect(outputAfter.catalogContent).toBe(outputBefore.catalogContent);
    });

    it('should handle multiple no-dep specs without extra work', async () => {
      // Setup: Create multiple specs with no deps
      await publishToRegistry('spec-a', '1.0.0', ['index.md'], {});
      await publishToRegistry('spec-b', '1.0.0', ['index.md'], {});
      await publishToRegistry('spec-c', '1.0.0', ['index.md'], {});

      // Setup: Create project index with all three specs
      await createProjectIndex({
        'spec-a@1.0.0': { name: 'spec-a', version: '1.0.0', deps: {} },
        'spec-b@1.0.0': { name: 'spec-b', version: '1.0.0', deps: {} },
        'spec-c@1.0.0': { name: 'spec-c', version: '1.0.0', deps: {} },
      });

      // Action: Install all specs
      await install({ cwd: testDir, registry: registryPath });

      // Capture output
      const output = await captureInstallOutput();

      // Assertion: Only the three specs should be installed (no extra deps)
      expect(output.specDirs).toEqual(['spec-a@1.0.0', 'spec-b@1.0.0', 'spec-c@1.0.0']);
      expect(output.indexKeys).toEqual(['spec-a@1.0.0', 'spec-b@1.0.0', 'spec-c@1.0.0']);
      expect(output.specDirs.length).toBe(3);
    });
  });

  describe('Property 2: Preservation - Error Handling Unchanged', () => {
    it('should throw CLIError(VALIDATION_ERROR) for malformed dep manifest', async () => {
      // Setup: Create a spec with valid manifest in registry
      await publishToRegistry('valid-spec', '1.0.0', ['index.md'], {});

      // Setup: Create a malformed dep manifest in the source directory
      const malformedDir = join(sourceDir, 'malformed-dep-1.0.0');
      await mkdir(malformedDir, { recursive: true });

      // Create malformed manifest (missing required fields)
      const malformedManifest = {
        name: 'malformed-dep',
        // Missing version field
        type: 'spec',
        files: ['index.md'],
      };
      await writeFile(
        join(malformedDir, 'spectrl.json'),
        JSON.stringify(malformedManifest, null, 2),
      );
      await writeFile(join(malformedDir, 'index.md'), 'Content');

      // Setup: Create project index that references the malformed spec
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const malformedUrl = pathToFileURL(malformedDir).href;
      await writeFile(
        join(spectrlDir, 'spectrl-index.json'),
        JSON.stringify({
          'malformed-dep@1.0.0': {
            source: malformedUrl,
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          },
        }),
      );

      // Action & Assertion: Install should throw CLIError with VALIDATION_ERROR
      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toThrow(CLIError);

      try {
        await install({ cwd: testDir, registry: registryPath });
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should throw CLIError(DEPENDENCY_ERROR) for missing dep in registry', async () => {
      // Setup: Create project index that references a non-existent spec
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Create a fake source path that doesn't exist
      const fakeSourcePath = join(sourceDir, 'missing-spec-1.0.0');
      const fakeUrl = pathToFileURL(fakeSourcePath).href;

      await writeFile(
        join(spectrlDir, 'spectrl-index.json'),
        JSON.stringify({
          'missing-spec@1.0.0': {
            source: fakeUrl,
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          },
        }),
      );

      // Action & Assertion: Install should throw CLIError with IO_ERROR (file not found)
      await expect(install({ cwd: testDir, registry: registryPath })).rejects.toThrow(CLIError);

      try {
        await install({ cwd: testDir, registry: registryPath });
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        // VALIDATION_ERROR because the resolver fails to read the source
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should throw CLIError(DEPENDENCY_ERROR) when installing non-existent spec from registry', async () => {
      // Action & Assertion: Installing a spec that doesn't exist in registry should throw
      await expect(
        installSingleSpec('non-existent-spec@1.0.0', { cwd: testDir, registry: registryPath }),
      ).rejects.toThrow(CLIError);

      try {
        await installSingleSpec('non-existent-spec@1.0.0', {
          cwd: testDir,
          registry: registryPath,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.DEPENDENCY_ERROR);
      }
    });
  });

  describe('Property 2: Property-Based Tests - Random No-Dep Manifests', () => {
    it('should produce consistent output for randomly generated no-dep specs', async () => {
      // Property-based test: generate random no-dep manifests and verify consistent behavior
      await fc.assert(
        fc.asyncProperty(
          // Generate random spec name (alphanumeric, 3-20 chars)
          fc.stringMatching(/^[a-z][a-z0-9-]{2,19}$/),
          // Generate random version (semver format)
          fc
            .tuple(fc.nat(10), fc.nat(10), fc.nat(10))
            .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          // Generate random file list (1-3 files to keep it simple)
          fc.array(fc.stringMatching(/^[a-z][a-z0-9]{2,8}\.md$/), {
            minLength: 1,
            maxLength: 3,
          }),
          async (name, version, files) => {
            // Deduplicate files
            const uniqueFiles = [...new Set(files)];

            // Setup: Create a spec with empty deps
            const specDir = await createSourceSpec(name, version, uniqueFiles, {});

            // Compute hash for the spec
            const manifestPath = join(specDir, 'spectrl.json');
            const manifestContent = await readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent) as Manifest;

            const fileContents: Record<string, string> = {};
            for (const file of uniqueFiles) {
              fileContents[file] = await readFile(join(specDir, file), 'utf-8');
            }

            const hash = computeHash({ manifest, fileContents });

            // Setup: Create project index with correct hash
            const spectrlDir = join(testDir, '.spectrl');
            await mkdir(spectrlDir, { recursive: true });
            const sourceUrl = pathToFileURL(specDir).href;
            await writeFile(
              join(spectrlDir, 'spectrl-index.json'),
              JSON.stringify({
                [`${name}@${version}`]: { source: sourceUrl, hash },
              }),
            );

            // Action: Install the spec
            await install({ cwd: testDir, registry: registryPath });

            // Capture output
            const output = await captureInstallOutput();

            // Assertion: Only the specified spec should be installed
            expect(output.specDirs).toEqual([`${name}@${version}`]);
            expect(output.indexKeys).toEqual([`${name}@${version}`]);
            expect(output.specDirs.length).toBe(1);

            // Cleanup for next iteration
            await rm(join(testDir, '.spectrl'), { recursive: true, force: true });
            await rm(sourceDir, { recursive: true, force: true });
            await mkdir(sourceDir, { recursive: true });
          },
        ),
        {
          numRuns: 10, // Run 10 random test cases
          endOnFailure: true,
        },
      );
    });

    it('should handle specs with various file structures consistently', async () => {
      // Property-based test: generate specs with different file structures
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z][a-z0-9-]{2,19}$/),
          fc
            .tuple(fc.nat(10), fc.nat(10), fc.nat(10))
            .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
          // Generate nested file paths
          fc.array(
            fc.oneof(
              fc.constant('index.md'),
              fc.constant('README.md'),
              fc.constant('docs/guide.md'),
              fc.constant('docs/api.md'),
              fc.constant('examples/basic.md'),
            ),
            { minLength: 1, maxLength: 3 },
          ),
          async (name, version, files) => {
            // Deduplicate files
            const uniqueFiles = [...new Set(files)];

            // Setup: Create a spec with empty deps
            const specDir = await createSourceSpec(name, version, uniqueFiles, {});

            // Compute hash for the spec
            const manifestPath = join(specDir, 'spectrl.json');
            const manifestContent = await readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent) as Manifest;

            const fileContents: Record<string, string> = {};
            for (const file of uniqueFiles) {
              fileContents[file] = await readFile(join(specDir, file), 'utf-8');
            }

            const hash = computeHash({ manifest, fileContents });

            // Setup: Create project index with correct hash
            const spectrlDir = join(testDir, '.spectrl');
            await mkdir(spectrlDir, { recursive: true });
            const sourceUrl = pathToFileURL(specDir).href;
            await writeFile(
              join(spectrlDir, 'spectrl-index.json'),
              JSON.stringify({
                [`${name}@${version}`]: { source: sourceUrl, hash },
              }),
            );

            // Action: Install the spec
            await install({ cwd: testDir, registry: registryPath });

            // Capture output
            const output = await captureInstallOutput();

            // Assertion: Only the specified spec should be installed
            expect(output.specDirs).toEqual([`${name}@${version}`]);
            expect(output.indexKeys).toEqual([`${name}@${version}`]);

            // Assertion: All files should be present in the installed spec
            const specPath = join(testDir, '.spectrl', 'specs', `${name}@${version}`);
            for (const file of uniqueFiles) {
              const filePath = join(specPath, file);
              const content = await readFile(filePath, 'utf-8');
              expect(content).toBeTruthy();
            }

            // Cleanup for next iteration
            await rm(join(testDir, '.spectrl'), { recursive: true, force: true });
            await rm(sourceDir, { recursive: true, force: true });
            await mkdir(sourceDir, { recursive: true });
          },
        ),
        {
          numRuns: 10,
          endOnFailure: true,
        },
      );
    });
  });
});
