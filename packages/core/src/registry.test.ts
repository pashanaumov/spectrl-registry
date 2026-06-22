import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Registry } from './registry.js';
import type { Manifest } from '@spectrl/schema';

describe('Registry', () => {
  const testDir = '.test-registry';
  let registry: Registry;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    registry = new Registry(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
    name: 'test-spec',
    version: '1.0.0',
    type: 'spec',
    deps: {},
    files: ['README.md'],
    hash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ...overrides,
  });

  describe('Path Construction & Normalization', () => {
    it('should normalize paths to use forward slashes', () => {
      const registryWithBackslashes = new Registry('test\\registry\\path');
      expect(registryWithBackslashes.paths.root).toBe('test/registry/path');
    });

    it('should construct correct spec path', () => {
      const specPath = registry.paths.spec('my-spec', '1.0.0');
      expect(specPath).toBe(`${testDir}/my-spec/1.0.0`);
      expect(specPath).not.toContain('\\');
    });

    it('should construct correct files path', () => {
      const filesPath = registry.paths.files('my-spec', '2.1.0');
      expect(filesPath).toBe(`${testDir}/my-spec/2.1.0/files`);
      expect(filesPath).not.toContain('\\');
    });

    it('should construct correct manifest path', () => {
      const manifestPath = registry.paths.manifest('my-spec', '1.0.0');
      expect(manifestPath).toBe(`${testDir}/my-spec/1.0.0/spectrl.json`);
      expect(manifestPath).not.toContain('\\');
    });

    it('should reject paths with path traversal', () => {
      expect(() => new Registry('../outside')).toThrow('Path traversal not allowed');
    });

    it('should allow absolute paths for registry root', () => {
      // Absolute paths are allowed for the registry root to support testing and flexibility
      expect(() => new Registry('/tmp/test-registry')).not.toThrow();
    });
  });

  describe('exists()', () => {
    it('should return false for non-existent spec', async () => {
      const exists = await registry.exists('nonexistent', '1.0.0');
      expect(exists).toBe(false);
    });

    it('should return true for existing spec', async () => {
      // Create a spec directory
      const specPath = registry.paths.spec('test-spec', '1.0.0');
      await fs.mkdir(specPath, { recursive: true });

      const exists = await registry.exists('test-spec', '1.0.0');
      expect(exists).toBe(true);
    });

    it('should return false when registry does not exist', async () => {
      const emptyRegistry = new Registry('.nonexistent-registry');
      const exists = await emptyRegistry.exists('test-spec', '1.0.0');
      expect(exists).toBe(false);
    });

    it('should return false if path exists but is not a directory', async () => {
      // Create a file instead of directory
      const specPath = registry.paths.spec('test-spec', '1.0.0');
      await fs.mkdir(join(testDir, 'test-spec'), { recursive: true });
      await fs.writeFile(specPath, 'not a directory');

      const exists = await registry.exists('test-spec', '1.0.0');
      expect(exists).toBe(false);
    });
  });

  describe('getManifest()', () => {
    it('should read and validate manifest correctly', async () => {
      const manifest = createTestManifest();
      const manifestPath = registry.paths.manifest('test-spec', '1.0.0');

      // Create directory and write manifest
      await fs.mkdir(join(testDir, 'test-spec', '1.0.0'), { recursive: true });
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      const result = await registry.getManifest('test-spec', '1.0.0');
      expect(result).toEqual(manifest);
    });

    it('should throw error for missing manifest', async () => {
      await expect(registry.getManifest('nonexistent', '1.0.0')).rejects.toThrow(
        'Manifest not found: nonexistent@1.0.0',
      );
    });

    it('should throw error for invalid JSON', async () => {
      const manifestPath = registry.paths.manifest('test-spec', '1.0.0');
      await fs.mkdir(join(testDir, 'test-spec', '1.0.0'), { recursive: true });
      await fs.writeFile(manifestPath, 'invalid json {');

      await expect(registry.getManifest('test-spec', '1.0.0')).rejects.toThrow();
    });

    it('should validate manifest schema', async () => {
      const invalidManifest = {
        name: 'Invalid_Name',
        version: '1.0.0',
        files: ['README.md'],
      };

      const manifestPath = registry.paths.manifest('test-spec', '1.0.0');
      await fs.mkdir(join(testDir, 'test-spec', '1.0.0'), { recursive: true });
      await fs.writeFile(manifestPath, JSON.stringify(invalidManifest));

      await expect(registry.getManifest('test-spec', '1.0.0')).rejects.toThrow(
        'Manifest validation failed',
      );
    });
  });

  describe('list()', () => {
    it('should return empty array for empty registry', async () => {
      const specs = await registry.list();
      expect(specs).toEqual([]);
    });

    it('should return all installed specs', async () => {
      // Create multiple specs with multiple versions
      await fs.mkdir(join(testDir, 'spec-a', '1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'spec-a', '1.1.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'spec-b', '2.0.0'), { recursive: true });

      const specs = await registry.list();

      expect(specs).toHaveLength(3);
      expect(specs).toContainEqual({ name: 'spec-a', version: '1.0.0' });
      expect(specs).toContainEqual({ name: 'spec-a', version: '1.1.0' });
      expect(specs).toContainEqual({ name: 'spec-b', version: '2.0.0' });
    });

    it('should skip non-directory entries', async () => {
      // Create a spec and a file in registry root
      await fs.mkdir(join(testDir, 'spec-a', '1.0.0'), { recursive: true });
      await fs.writeFile(join(testDir, 'random-file.txt'), 'content');

      const specs = await registry.list();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toEqual({ name: 'spec-a', version: '1.0.0' });
    });

    it('should handle specs without version subdirectories', async () => {
      await fs.mkdir(join(testDir, 'spec-a', '1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'spec-b'), { recursive: true }); // No version subdirs

      const specs = await registry.list();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toEqual({ name: 'spec-a', version: '1.0.0' });
    });
  });

  describe('listVersions()', () => {
    it('should return all versions for a specific spec', async () => {
      await fs.mkdir(join(testDir, 'my-spec', '1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '1.1.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '2.0.0'), { recursive: true });

      const versions = await registry.listVersions('my-spec');

      expect(versions).toHaveLength(3);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
      expect(versions).toContain('2.0.0');
    });

    it('should return empty array for non-existent spec', async () => {
      const versions = await registry.listVersions('nonexistent');
      expect(versions).toEqual([]);
    });

    it('should skip non-directory entries in versions', async () => {
      await fs.mkdir(join(testDir, 'my-spec', '1.0.0'), { recursive: true });
      await fs.writeFile(join(testDir, 'my-spec', 'file.txt'), 'content');

      const versions = await registry.listVersions('my-spec');

      expect(versions).toHaveLength(1);
      expect(versions[0]).toBe('1.0.0');
    });

    it('should filter out non-semver directory names', async () => {
      await fs.mkdir(join(testDir, 'my-spec', '1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '2.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', 'invalid'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', 'v1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '1.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '1.0.0.0'), { recursive: true });

      const versions = await registry.listVersions('my-spec');

      expect(versions).toHaveLength(2);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
      expect(versions).not.toContain('invalid');
      expect(versions).not.toContain('v1.0.0');
      expect(versions).not.toContain('1.0');
      expect(versions).not.toContain('1.0.0.0');
    });

    it('should handle specs with only invalid version directories', async () => {
      await fs.mkdir(join(testDir, 'my-spec', 'invalid'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', 'also-invalid'), { recursive: true });

      const versions = await registry.listVersions('my-spec');

      expect(versions).toEqual([]);
    });

    it('should filter out versions with leading zeros', async () => {
      await fs.mkdir(join(testDir, 'my-spec', '1.0.0'), { recursive: true });
      await fs.mkdir(join(testDir, 'my-spec', '01.0.0'), { recursive: true }); // leading zero - invalid
      await fs.mkdir(join(testDir, 'my-spec', '1.00.0'), { recursive: true }); // leading zero - invalid
      await fs.mkdir(join(testDir, 'my-spec', '1.0.00'), { recursive: true }); // leading zero - invalid

      const versions = await registry.listVersions('my-spec');

      // Only valid semver without leading zeros should be included
      expect(versions).toHaveLength(1);
      expect(versions).toContain('1.0.0');
      expect(versions).not.toContain('01.0.0');
      expect(versions).not.toContain('1.00.0');
      expect(versions).not.toContain('1.0.00');
    });
  });

  describe('publish()', () => {
    let sourceDir: string;

    beforeEach(async () => {
      // Create source directory with test files
      sourceDir = join(testDir, 'source');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(join(sourceDir, 'docs'), { recursive: true });
      await fs.writeFile(join(sourceDir, 'README.md'), '# Test Spec');
      await fs.writeFile(join(sourceDir, 'docs', 'api.md'), '# API Documentation');
    });

    it('should create correct directory structure', async () => {
      const manifest = createTestManifest({
        files: ['README.md'],
      });

      await registry.publish(manifest, sourceDir);

      // Verify directory structure
      const specPath = registry.paths.spec('test-spec', '1.0.0');
      const filesPath = registry.paths.files('test-spec', '1.0.0');
      const manifestPath = registry.paths.manifest('test-spec', '1.0.0');

      const specStats = await fs.stat(specPath);
      const filesStats = await fs.stat(filesPath);
      const manifestStats = await fs.stat(manifestPath);

      expect(specStats.isDirectory()).toBe(true);
      expect(filesStats.isDirectory()).toBe(true);
      expect(manifestStats.isFile()).toBe(true);
    });

    it('should preserve file directory structure', async () => {
      const manifest = createTestManifest({
        files: ['README.md', 'docs/api.md'],
      });

      await registry.publish(manifest, sourceDir);

      // Verify files are in correct locations
      const filesPath = registry.paths.files('test-spec', '1.0.0');
      const readmeContent = await fs.readFile(join(filesPath, 'README.md'), 'utf-8');
      const apiContent = await fs.readFile(join(filesPath, 'docs', 'api.md'), 'utf-8');

      expect(readmeContent).toBe('# Test Spec');
      expect(apiContent).toBe('# API Documentation');
    });

    it('should prevent overwriting existing versions (immutability)', async () => {
      const manifest = createTestManifest();

      // Publish once
      await registry.publish(manifest, sourceDir);

      // Try to publish again
      await expect(registry.publish(manifest, sourceDir)).rejects.toThrow(
        'Spec test-spec@1.0.0 already exists in registry. Bump version to publish changes.',
      );
    });

    it('should write manifest to registry', async () => {
      const manifest = createTestManifest({
        name: 'my-spec',
        version: '2.0.0',
        files: ['README.md'],
        deps: { 'other-spec': '1.0.0' },
      });

      await registry.publish(manifest, sourceDir);

      const manifestPath = registry.paths.manifest('my-spec', '2.0.0');
      const savedContent = await fs.readFile(manifestPath, 'utf-8');
      const savedManifest = JSON.parse(savedContent);

      expect(savedManifest).toEqual(manifest);
    });

    it('should validate file paths before publishing', async () => {
      const manifest = createTestManifest({
        files: ['../outside.md'],
      });

      await expect(registry.publish(manifest, sourceDir)).rejects.toThrow(
        'Path traversal not allowed',
      );
    });

    it('should throw error if source files are missing', async () => {
      const manifest = createTestManifest({
        files: ['nonexistent.md'],
      });

      await expect(registry.publish(manifest, sourceDir)).rejects.toThrow();
    });

    it('should handle nested directory structures', async () => {
      // Create deeply nested structure
      await fs.mkdir(join(sourceDir, 'deep', 'nested', 'path'), { recursive: true });
      await fs.writeFile(join(sourceDir, 'deep', 'nested', 'path', 'file.txt'), 'content');

      const manifest = createTestManifest({
        files: ['README.md', 'deep/nested/path/file.txt'],
      });

      await registry.publish(manifest, sourceDir);

      const filesPath = registry.paths.files('test-spec', '1.0.0');
      const nestedContent = await fs.readFile(
        join(filesPath, 'deep', 'nested', 'path', 'file.txt'),
        'utf-8',
      );

      expect(nestedContent).toBe('content');
    });

    it('should allow publishing multiple versions', async () => {
      const manifest = createTestManifest();

      // Publish first version
      await registry.publish(manifest, sourceDir);

      // Verify we can publish another version
      const manifest2 = createTestManifest({ version: '1.0.1' });
      await expect(registry.publish(manifest2, sourceDir)).resolves.not.toThrow();
    });

    it('should validate paths stay within registry', async () => {
      const manifest = createTestManifest({
        files: ['README.md'],
      });

      // This should work normally
      await expect(registry.publish(manifest, sourceDir)).resolves.not.toThrow();

      // Verify the files are within registry
      const filesPath = registry.paths.files('test-spec', '1.0.0');
      expect(filesPath.startsWith(testDir)).toBe(true);
    });
  });

  describe('remove()', () => {
    beforeEach(async () => {
      // Create a test spec to remove
      const specPath = registry.paths.spec('test-spec', '1.0.0');
      const filesPath = registry.paths.files('test-spec', '1.0.0');
      const manifestPath = registry.paths.manifest('test-spec', '1.0.0');

      await fs.mkdir(filesPath, { recursive: true });
      await fs.writeFile(join(filesPath, 'README.md'), '# Test');

      const manifest = createTestManifest();
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
    });

    it('should delete spec version', async () => {
      await registry.remove('test-spec', '1.0.0');

      const exists = await registry.exists('test-spec', '1.0.0');
      expect(exists).toBe(false);
    });

    it('should clean up empty directories when last version is removed', async () => {
      await registry.remove('test-spec', '1.0.0');

      // Verify the entire spec directory is removed
      const specRootPath = join(testDir, 'test-spec');
      await expect(fs.access(specRootPath)).rejects.toThrow();
    });

    it('should not remove spec directory if other versions exist', async () => {
      // Create another version
      const specPath2 = registry.paths.spec('test-spec', '2.0.0');
      const filesPath2 = registry.paths.files('test-spec', '2.0.0');
      const manifestPath2 = registry.paths.manifest('test-spec', '2.0.0');

      await fs.mkdir(filesPath2, { recursive: true });
      await fs.writeFile(join(filesPath2, 'README.md'), '# Test v2');

      const manifest2 = createTestManifest({ version: '2.0.0' });
      await fs.writeFile(manifestPath2, JSON.stringify(manifest2));

      // Remove first version
      await registry.remove('test-spec', '1.0.0');

      // Verify second version still exists
      const exists2 = await registry.exists('test-spec', '2.0.0');
      expect(exists2).toBe(true);

      // Verify spec directory still exists
      const specRootPath = join(testDir, 'test-spec');
      await expect(fs.access(specRootPath)).resolves.not.toThrow();
    });

    it('should throw error for non-existent spec', async () => {
      await expect(registry.remove('nonexistent', '1.0.0')).rejects.toThrow(
        'Spec nonexistent@1.0.0 not found in registry',
      );
    });

    it('should allow operations after deletion', async () => {
      // Remove should complete without errors
      await registry.remove('test-spec', '1.0.0');

      // Verify we can perform other operations
      const specs = await registry.list();
      expect(specs).toEqual([]);
    });

    it('should validate paths stay within registry', async () => {
      // This should work normally
      await expect(registry.remove('test-spec', '1.0.0')).resolves.not.toThrow();

      // Verify nothing outside registry was affected
      const registryExists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      expect(registryExists).toBe(true);
    });
  });
});
