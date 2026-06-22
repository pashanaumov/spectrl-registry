import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fc from 'fast-check';
import { publish } from './index.js';
import { CLIError, ExitCode } from '../../errors.js';
import { Registry } from '@spectrl/core';

// Mock the interactive prompt - default to 'local' for backward compatibility
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn().mockResolvedValue('local'),
}));

// Mock the TokenManager
vi.mock('../auth/token-manager.js', () => {
  return {
    TokenManager: class MockTokenManager {
      async get() {
        return null;
      }
      async store() {
        return undefined;
      }
      async delete() {
        return undefined;
      }
    },
  };
});

// Mock the API client
vi.mock('../utils/api-client.js', () => ({
  publishSpec: vi.fn(),
}));

describe('publish command', () => {
  let testDir: string;
  let originalCwd: string;
  let registryPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    registryPath = join(testDir, '.spectrl', 'registry');
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  describe('successful publish', () => {
    it('should publish spec with valid manifest and files', async () => {
      const manifest = {
        name: 'test-spec',
        version: '1.0.0',
        deps: {},
        description: 'A test spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Test Spec\n\nThis is a test.');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('test-spec', '1.0.0');
      expect(exists).toBe(true);
    });

    it('should compute and store hash in manifest', async () => {
      const manifest = {
        name: 'test-spec-hash',
        version: '1.0.0',
        deps: {},
        description: 'A test spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Test Spec');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const publishedManifest = await registry.getManifest('test-spec-hash', '1.0.0');
      expect(publishedManifest.hash).toBeDefined();
      expect(typeof publishedManifest.hash).toBe('string');
      expect(publishedManifest.hash?.length).toBeGreaterThan(0);
    });

    it('should use sha256: prefix in hash format', async () => {
      const manifest = {
        name: 'test-hash-format',
        version: '1.0.0',
        deps: {},
        description: 'A test spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Test Hash Format');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const publishedManifest = await registry.getManifest('test-hash-format', '1.0.0');
      expect(publishedManifest.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should store spec in registry at {name}/{version}/ structure', async () => {
      const manifest = {
        name: 'test-registry-structure',
        version: '2.1.0',
        deps: {},
        description: 'A test spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Registry Structure Test');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const specPath = registry.paths.spec('test-registry-structure', '2.1.0');
      const manifestPath = registry.paths.manifest('test-registry-structure', '2.1.0');
      const filesPath = registry.paths.files('test-registry-structure', '2.1.0');

      expect(specPath).toContain('test-registry-structure/2.1.0');
      expect(manifestPath).toContain('test-registry-structure/2.1.0/spectrl.json');
      expect(filesPath).toContain('test-registry-structure/2.1.0/files');

      const exists = await registry.exists('test-registry-structure', '2.1.0');
      expect(exists).toBe(true);
    });

    it('should not create or modify project index during publish', async () => {
      const manifest = {
        name: 'test-no-index',
        version: '1.0.0',
        deps: {},
        description: 'A test spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# No Index Test');

      await publish('.', registryPath);

      const { access } = await import('node:fs/promises');
      const indexPath = join(testDir, '.spectrl', 'spectrl-index.json');
      await expect(access(indexPath)).rejects.toThrow();
    });

    it('should publish spec with multiple files', async () => {
      const manifest = {
        name: 'multi-file-spec',
        version: '1.0.0',
        deps: {},
        description: 'A multi-file spec',
        files: ['index.md', 'docs/api.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Multi-file Spec');
      await mkdir('docs', { recursive: true });
      await writeFile('docs/api.md', '## API Documentation');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('multi-file-spec', '1.0.0');
      expect(exists).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should throw CLIError with VALIDATION_ERROR when manifest is invalid', async () => {
      const invalidManifest = {
        name: 'invalid-spec',
        // missing version, deps, files
      };
      await writeFile('spectrl.json', JSON.stringify(invalidManifest));

      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should throw CLIError with VALIDATION_ERROR when files array is empty', async () => {
      const manifest = {
        name: 'empty-files-spec',
        version: '1.0.0',
        deps: {},
        files: [],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest));

      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should throw CLIError with VALIDATION_ERROR when file path contains ..', async () => {
      const manifest = {
        name: 'path-traversal-spec',
        version: '1.0.0',
        deps: {},
        files: ['../outside.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest));

      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });
  });

  describe('file not found errors', () => {
    it('should throw CLIError with IO_ERROR when tracked file does not exist', async () => {
      const manifest = {
        name: 'missing-file-spec',
        version: '1.0.0',
        deps: {},
        files: ['nonexistent.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest));

      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.IO_ERROR,
      });
    });

    it('should throw CLIError with IO_ERROR when spectrl.json does not exist', async () => {
      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.IO_ERROR,
      });
    });
  });

  describe('exit codes', () => {
    it('should use VALIDATION_ERROR exit code for invalid manifest', async () => {
      const invalidManifest = { name: 'test' };
      await writeFile('spectrl.json', JSON.stringify(invalidManifest));

      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should use IO_ERROR exit code for missing files', async () => {
      const manifest = {
        name: 'test-spec',
        version: '1.0.0',
        deps: {},
        files: ['missing.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest));

      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.IO_ERROR,
      });
    });
  });

  describe('multi-file spec support', () => {
    it('should publish spec with a single file', async () => {
      const manifest = {
        name: 'single-file-spec',
        version: '1.0.0',
        deps: {},
        description: 'A single file spec',
        files: ['index.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Single File Spec');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('single-file-spec', '1.0.0');
      expect(exists).toBe(true);

      const publishedManifest = await registry.getManifest('single-file-spec', '1.0.0');
      expect(publishedManifest.files).toEqual(['index.md']);
    });

    it('should publish spec with two files (PRD + TDD scenario)', async () => {
      const manifest = {
        name: 'two-file-spec',
        version: '1.0.0',
        deps: {},
        description: 'A two-file spec',
        files: ['index.md', 'design.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', '# Requirements\n\nUser stories and acceptance criteria');
      await writeFile('design.md', '# Design\n\nArchitecture and implementation details');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('two-file-spec', '1.0.0');
      expect(exists).toBe(true);

      const publishedManifest = await registry.getManifest('two-file-spec', '1.0.0');
      expect(publishedManifest.files).toEqual(['index.md', 'design.md']);
    });

    it('should publish spec with many files', async () => {
      const files = ['index.md', 'requirements.md', 'design.md', 'architecture.md'];
      const manifest = {
        name: 'many-file-spec',
        version: '1.0.0',
        deps: {},
        description: 'A many-file spec',
        files,
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      for (const file of files) {
        await writeFile(file, `# ${file}\n\nContent for ${file}`);
      }

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('many-file-spec', '1.0.0');
      expect(exists).toBe(true);

      const publishedManifest = await registry.getManifest('many-file-spec', '1.0.0');
      expect(publishedManifest.files).toEqual(files);
    });

    it('should publish spec with nested directory structure', async () => {
      const files = ['index.md', 'docs/api.md', 'docs/guides/setup.md'];
      const manifest = {
        name: 'nested-spec',
        version: '1.0.0',
        deps: {},
        description: 'A nested spec',
        files,
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await mkdir('docs/guides', { recursive: true });
      await writeFile('index.md', '# Nested Spec');
      await writeFile('docs/api.md', '# API Documentation');
      await writeFile('docs/guides/setup.md', '# Setup Guide');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const exists = await registry.exists('nested-spec', '1.0.0');
      expect(exists).toBe(true);

      const publishedManifest = await registry.getManifest('nested-spec', '1.0.0');
      expect(publishedManifest.files).toEqual(files);
    });

    it('should compute hash including all files', async () => {
      const manifest = {
        name: 'hash-test-spec',
        version: '1.0.0',
        deps: {},
        description: 'A hash test spec',
        files: ['index.md', 'file2.md', 'file3.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', 'Content 1');
      await writeFile('file2.md', 'Content 2');
      await writeFile('file3.md', 'Content 3');

      await publish('.', registryPath);

      const registry = new Registry(registryPath);
      const publishedManifest = await registry.getManifest('hash-test-spec', '1.0.0');
      expect(publishedManifest.hash).toBeDefined();
      expect(publishedManifest.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should fail if any file in multi-file spec is missing', async () => {
      const manifest = {
        name: 'incomplete-spec',
        version: '1.0.0',
        deps: {},
        description: 'An incomplete spec',
        files: ['index.md', 'missing.md'],
      };
      await writeFile('spectrl.json', JSON.stringify(manifest, null, 2));
      await writeFile('index.md', 'This file exists');

      await expect(publish('.', registryPath)).rejects.toThrow(CLIError);
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.IO_ERROR,
      });
    });
  });

  // ─── Cross-type dependency validation tests ──────────────────────────────────

  describe('cross-type dependency validation', () => {
    // Helper: publish a dep manifest directly into the test registry
    async function publishDepToRegistry(
      name: string,
      version: string,
      type: 'spec' | 'power',
    ): Promise<void> {
      const depDir = join(
        tmpdir(),
        `spectrl-dep-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      await mkdir(depDir, { recursive: true });
      const manifest = {
        name,
        version,
        type,
        description: `A ${type} dep`,
        files: ['index.md'],
        deps: {},
      };
      await writeFile(join(depDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));
      await writeFile(join(depDir, 'index.md'), `# ${name}`);
      const savedCwd = process.cwd();
      process.chdir(depDir);
      try {
        await publish('.', registryPath);
      } finally {
        process.chdir(savedCwd);
        await rm(depDir, { recursive: true, force: true });
      }
    }

    it('should throw VALIDATION_ERROR when a spec depends on a power', async () => {
      await publishDepToRegistry('my-power-dep', '1.0.0', 'power');

      await writeValidManifest(testDir, {
        type: 'spec',
        deps: { 'my-power-dep': '1.0.0' },
      });
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should throw VALIDATION_ERROR when a power depends on a spec', async () => {
      await publishDepToRegistry('my-spec-dep', '1.0.0', 'spec');

      await writeValidManifest(testDir, {
        type: 'power',
        deps: { 'my-spec-dep': '1.0.0' },
      });
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should allow a spec to depend on a spec', async () => {
      await publishDepToRegistry('my-spec-dep', '1.0.0', 'spec');

      await writeValidManifest(testDir, {
        name: 'parent-spec',
        type: 'spec',
        deps: { 'my-spec-dep': '1.0.0' },
      });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should allow a power to depend on a power', async () => {
      await publishDepToRegistry('my-power-dep', '1.0.0', 'power');

      await writeValidManifest(testDir, {
        name: 'parent-power',
        type: 'power',
        deps: { 'my-power-dep': '1.0.0' },
      });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should skip type check and succeed when dependency is not in registry', async () => {
      await writeValidManifest(testDir, {
        type: 'spec',
        deps: { 'nonexistent-dep': '9.9.9' },
      });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should succeed when manifest has no dependencies', async () => {
      await writeValidManifest(testDir, { type: 'spec', deps: {} });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should include dep name and type in the error message', async () => {
      await publishDepToRegistry('bad-dep', '2.0.0', 'power');

      await writeValidManifest(testDir, {
        type: 'spec',
        deps: { 'bad-dep': '2.0.0' },
      });
      await expect(publish('.', registryPath)).rejects.toThrow(/bad-dep/);
      await expect(publish('.', registryPath)).rejects.toThrow(/power/);
    });
  });

  // ─── Publish-time validation tests ───────────────────────────────────────────

  // Helper: write a valid base manifest + index.md and any extra files
  async function writeValidManifest(
    dir: string,
    overrides: Record<string, unknown>,
    extraFiles: string[] = [],
  ) {
    const base: Record<string, unknown> = {
      name: 'my-spec',
      version: '1.0.0',
      deps: {},
      description: 'A description',
      files: ['index.md'],
    };
    const manifest = { ...base, ...overrides };
    await writeFile(join(dir, 'spectrl.json'), JSON.stringify(manifest, null, 2));
    await writeFile(join(dir, 'index.md'), '# Index');
    for (const f of extraFiles) {
      await writeFile(join(dir, f), `# ${f}`);
    }
  }

  describe('description enforcement', () => {
    it('should throw VALIDATION_ERROR when description is missing', async () => {
      await writeValidManifest(testDir, { description: undefined });
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should throw VALIDATION_ERROR when description is empty string', async () => {
      await writeValidManifest(testDir, { description: '' });
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should throw VALIDATION_ERROR when description is whitespace only', async () => {
      await writeValidManifest(testDir, { description: '   ' });
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should succeed when description is present', async () => {
      await writeValidManifest(testDir, { description: 'A valid description' });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });
  });

  describe('index.md enforcement', () => {
    it('should throw VALIDATION_ERROR when files does not include index.md', async () => {
      const manifest = {
        name: 'my-spec',
        version: '1.0.0',
        deps: {},
        description: 'A description',
        files: ['README.md'],
      };
      await writeFile(join(testDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));
      await writeFile(join(testDir, 'README.md'), '# Readme');
      await expect(publish('.', registryPath)).rejects.toMatchObject({
        exitCode: ExitCode.VALIDATION_ERROR,
      });
    });

    it('should succeed when files includes index.md', async () => {
      await writeValidManifest(testDir, {});
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should succeed when files includes index.md alongside other files', async () => {
      await writeValidManifest(testDir, { files: ['index.md', 'README.md'] }, ['README.md']);
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });
  });

  describe('agent metadata warnings (publish proceeds)', () => {
    it('should publish successfully when agent field is missing', async () => {
      await writeValidManifest(testDir, { agent: undefined });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should publish successfully when agent.purpose is missing', async () => {
      // agent.purpose is required by schema when agent is set; test with purpose present but tags absent
      await writeValidManifest(testDir, { agent: { purpose: 'Some purpose' } });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should publish successfully when agent.tags is missing', async () => {
      await writeValidManifest(testDir, { agent: { purpose: 'Some purpose' } });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });

    it('should publish successfully with full agent metadata', async () => {
      await writeValidManifest(testDir, {
        agent: { purpose: 'Some purpose', tags: ['tag1', 'tag2'] },
      });
      await expect(publish('.', registryPath)).resolves.toBeUndefined();
    });
  });

  // Property 7: Publish description enforcement
  // For any manifest that lacks a description (or has an empty/whitespace description),
  // attempting to publish should produce a hard VALIDATION_ERROR.
  describe('Property 7: Publish description enforcement', () => {
    it('rejects any manifest with missing or blank description', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(fc.constant(undefined), fc.constant(''), fc.stringMatching(/^\s+$/)),
          async (badDescription) => {
            const iterDir = join(
              tmpdir(),
              `spectrl-pbt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            );
            await mkdir(iterDir, { recursive: true });
            const iterRegistry = join(iterDir, '.spectrl', 'registry');

            try {
              const manifest: Record<string, unknown> = {
                name: 'my-spec',
                version: '1.0.0',
                deps: {},
                files: ['index.md'],
              };
              if (badDescription !== undefined) {
                manifest.description = badDescription;
              }
              await writeFile(join(iterDir, 'spectrl.json'), JSON.stringify(manifest));
              await writeFile(join(iterDir, 'index.md'), '# Index');

              const savedCwd = process.cwd();
              process.chdir(iterDir);
              try {
                await expect(publish('.', iterRegistry)).rejects.toMatchObject({
                  exitCode: ExitCode.VALIDATION_ERROR,
                });
              } finally {
                process.chdir(savedCwd);
              }
            } finally {
              await rm(iterDir, { recursive: true, force: true });
            }
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
