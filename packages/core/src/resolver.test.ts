import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Resolver, ResolverError } from './resolver.js';
import type { Index, Manifest } from '@spectrl/schema';

describe('Resolver', () => {
  let tempDir: string;
  let indexPath: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    indexPath = join(tempDir, '.spectrl', 'spectrl-index.json');
    await fs.mkdir(join(tempDir, '.spectrl'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestIndex = (entries: Index): Index => entries;

  const createTestManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
    name: 'test-spec',
    version: '1.0.0',
    deps: {},
    files: ['README.md'],
    ...overrides,
  });

  // Helper to create index entry with hash
  const createIndexEntry = (source: string) => ({
    source,
    hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
  });

  /**
   * Helper to create a spec directory with manifest file
   */
  const createSpecDir = async (manifest: Manifest, basePath?: string): Promise<string> => {
    const base = basePath || tempDir;
    const specDir = join(base, 'specs', `${manifest.name}`, manifest.version);
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));
    await fs.writeFile(join(specDir, 'README.md'), '# Test spec');
    return specDir;
  };

  describe('resolveClosureFromIndex', () => {
    it('should resolve single spec with no dependencies', async () => {
      const manifest = createTestManifest({ name: 'standalone', version: '1.0.0', deps: {} });
      await createSpecDir(manifest);

      const index = createTestIndex({
        'standalone@1.0.0': createIndexEntry('../specs/standalone/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('standalone');
      expect(nodes[0].version).toBe('1.0.0');
      expect(nodes[0].deps).toEqual([]);
    });

    it('should resolve spec with single dependency', async () => {
      const baseManifest = createTestManifest({ name: 'base-spec', version: '1.0.0', deps: {} });
      const appManifest = createTestManifest({
        name: 'app-spec',
        version: '1.0.0',
        deps: { 'base-spec': '1.0.0' },
      });

      await createSpecDir(baseManifest);
      await createSpecDir(appManifest);

      const index = createTestIndex({
        'app-spec@1.0.0': createIndexEntry('../specs/app-spec/1.0.0'),
        'base-spec@1.0.0': createIndexEntry('../specs/base-spec/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(2);

      // Find nodes by name
      const appNode = nodes.find((n) => n.name === 'app-spec');
      const baseNode = nodes.find((n) => n.name === 'base-spec');

      expect(appNode).toBeDefined();
      expect(baseNode).toBeDefined();
      expect(appNode?.deps).toEqual(['base-spec@1.0.0']);
      expect(baseNode?.deps).toEqual([]);
    });

    it('should resolve transitive dependencies (A→B→C)', async () => {
      const cManifest = createTestManifest({ name: 'dep-c', version: '1.0.0', deps: {} });
      const bManifest = createTestManifest({
        name: 'dep-b',
        version: '1.0.0',
        deps: { 'dep-c': '1.0.0' },
      });
      const aManifest = createTestManifest({
        name: 'dep-a',
        version: '1.0.0',
        deps: { 'dep-b': '1.0.0' },
      });

      await createSpecDir(cManifest);
      await createSpecDir(bManifest);
      await createSpecDir(aManifest);

      const index = createTestIndex({
        'dep-a@1.0.0': createIndexEntry('../specs/dep-a/1.0.0'),
        'dep-b@1.0.0': createIndexEntry('../specs/dep-b/1.0.0'),
        'dep-c@1.0.0': createIndexEntry('../specs/dep-c/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(3);

      const aNode = nodes.find((n) => n.name === 'dep-a');
      const bNode = nodes.find((n) => n.name === 'dep-b');
      const cNode = nodes.find((n) => n.name === 'dep-c');

      expect(aNode?.deps).toEqual(['dep-b@1.0.0']);
      expect(bNode?.deps).toEqual(['dep-c@1.0.0']);
      expect(cNode?.deps).toEqual([]);
    });

    it('should sort dependencies lexicographically', async () => {
      const dep1Manifest = createTestManifest({ name: 'dep-1', version: '1.0.0', deps: {} });
      const dep2Manifest = createTestManifest({ name: 'dep-2', version: '1.0.0', deps: {} });
      const dep3Manifest = createTestManifest({ name: 'dep-3', version: '1.0.0', deps: {} });
      const mainManifest = createTestManifest({
        name: 'main',
        version: '1.0.0',
        deps: { 'dep-3': '1.0.0', 'dep-1': '1.0.0', 'dep-2': '1.0.0' },
      });

      await createSpecDir(dep1Manifest);
      await createSpecDir(dep2Manifest);
      await createSpecDir(dep3Manifest);
      await createSpecDir(mainManifest);

      const index = createTestIndex({
        'main@1.0.0': createIndexEntry('../specs/main/1.0.0'),
        'dep-1@1.0.0': createIndexEntry('../specs/dep-1/1.0.0'),
        'dep-2@1.0.0': createIndexEntry('../specs/dep-2/1.0.0'),
        'dep-3@1.0.0': createIndexEntry('../specs/dep-3/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      const mainNode = nodes.find((n) => n.name === 'main');
      expect(mainNode?.deps).toEqual(['dep-1@1.0.0', 'dep-2@1.0.0', 'dep-3@1.0.0']);
    });

    it('should return nodes sorted lexicographically by name@version', async () => {
      const zManifest = createTestManifest({ name: 'z-spec', version: '1.0.0', deps: {} });
      const aManifest = createTestManifest({ name: 'a-spec', version: '1.0.0', deps: {} });
      const mManifest = createTestManifest({ name: 'm-spec', version: '1.0.0', deps: {} });

      await createSpecDir(zManifest);
      await createSpecDir(aManifest);
      await createSpecDir(mManifest);

      const index = createTestIndex({
        'z-spec@1.0.0': createIndexEntry('../specs/z-spec/1.0.0'),
        'a-spec@1.0.0': createIndexEntry('../specs/a-spec/1.0.0'),
        'm-spec@1.0.0': createIndexEntry('../specs/m-spec/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].name).toBe('a-spec');
      expect(nodes[1].name).toBe('m-spec');
      expect(nodes[2].name).toBe('z-spec');
    });

    it('should handle diamond dependency pattern', async () => {
      const sharedManifest = createTestManifest({ name: 'shared', version: '1.0.0', deps: {} });
      const depAManifest = createTestManifest({
        name: 'dep-a',
        version: '1.0.0',
        deps: { shared: '1.0.0' },
      });
      const depBManifest = createTestManifest({
        name: 'dep-b',
        version: '1.0.0',
        deps: { shared: '1.0.0' },
      });
      const mainManifest = createTestManifest({
        name: 'main',
        version: '1.0.0',
        deps: { 'dep-a': '1.0.0', 'dep-b': '1.0.0' },
      });

      await createSpecDir(sharedManifest);
      await createSpecDir(depAManifest);
      await createSpecDir(depBManifest);
      await createSpecDir(mainManifest);

      const index = createTestIndex({
        'main@1.0.0': createIndexEntry('../specs/main/1.0.0'),
        'dep-a@1.0.0': createIndexEntry('../specs/dep-a/1.0.0'),
        'dep-b@1.0.0': createIndexEntry('../specs/dep-b/1.0.0'),
        'shared@1.0.0': createIndexEntry('../specs/shared/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(4);

      // Shared should only appear once
      const sharedNodes = nodes.filter((n) => n.name === 'shared');
      expect(sharedNodes).toHaveLength(1);
    });

    it('should support file:// URLs', async () => {
      const manifest = createTestManifest({ name: 'test', version: '1.0.0', deps: {} });
      const specDir = await createSpecDir(manifest);

      const index = createTestIndex({
        'test@1.0.0': createIndexEntry(`file://${specDir}`),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('test');
    });

    it('should support file: URLs (without //)', async () => {
      const manifest = createTestManifest({ name: 'test', version: '1.0.0', deps: {} });
      const specDir = await createSpecDir(manifest);

      const index = createTestIndex({
        'test@1.0.0': createIndexEntry(`file:${specDir}`),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();
      const nodes = await resolver.resolveClosureFromIndex(indexPath);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('test');
    });
  });

  describe('error handling', () => {
    it('should throw error with exit code 1 for invalid index key (Zod validation)', async () => {
      // Zod will catch invalid keys before our custom validation
      const index = {
        'invalid-key': createIndexEntry('../specs/test/1.0.0'),
      };

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();

      // Zod throws ZodError, which is fine - it still prevents invalid keys
      await expect(resolver.resolveClosureFromIndex(indexPath)).rejects.toThrow();
    });

    it('should throw ResolverError with exit code 1 for missing source', async () => {
      const index = createTestIndex({
        'test@1.0.0': createIndexEntry('../specs/nonexistent/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();

      await expect(resolver.resolveClosureFromIndex(indexPath)).rejects.toThrow(ResolverError);

      try {
        await resolver.resolveClosureFromIndex(indexPath);
      } catch (error) {
        expect((error as ResolverError).exitCode).toBe(1);
        expect((error as ResolverError).message).toContain('Missing source');
      }
    });

    it('should throw ResolverError with exit code 1 for manifest mismatch', async () => {
      const manifest = createTestManifest({ name: 'wrong-name', version: '1.0.0', deps: {} });
      await createSpecDir(manifest);

      const index = createTestIndex({
        'test@1.0.0': createIndexEntry('../specs/wrong-name/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();

      await expect(resolver.resolveClosureFromIndex(indexPath)).rejects.toThrow(ResolverError);

      try {
        await resolver.resolveClosureFromIndex(indexPath);
      } catch (error) {
        expect((error as ResolverError).exitCode).toBe(1);
        expect((error as ResolverError).message).toContain('Manifest mismatch');
        expect((error as ResolverError).message).toContain('test@1.0.0');
        expect((error as ResolverError).message).toContain('wrong-name@1.0.0');
      }
    });

    it('should throw ResolverError with exit code 3 for missing dependency', async () => {
      const manifest = createTestManifest({
        name: 'app',
        version: '1.0.0',
        deps: { 'missing-dep': '1.0.0' },
      });
      await createSpecDir(manifest);

      const index = createTestIndex({
        'app@1.0.0': createIndexEntry('../specs/app/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();

      await expect(resolver.resolveClosureFromIndex(indexPath)).rejects.toThrow(ResolverError);

      try {
        await resolver.resolveClosureFromIndex(indexPath);
      } catch (error) {
        expect((error as ResolverError).exitCode).toBe(3);
        expect((error as ResolverError).message).toContain('Missing dependency: missing-dep@1.0.0');
        expect((error as ResolverError).message).toContain('.spectrl/spectrl-index.json');
      }
    });

    it('should throw ResolverError with exit code 3 for cyclic dependency', async () => {
      const aManifest = createTestManifest({
        name: 'dep-a',
        version: '1.0.0',
        deps: { 'dep-b': '1.0.0' },
      });
      const bManifest = createTestManifest({
        name: 'dep-b',
        version: '1.0.0',
        deps: { 'dep-a': '1.0.0' },
      });

      await createSpecDir(aManifest);
      await createSpecDir(bManifest);

      const index = createTestIndex({
        'dep-a@1.0.0': createIndexEntry('../specs/dep-a/1.0.0'),
        'dep-b@1.0.0': createIndexEntry('../specs/dep-b/1.0.0'),
      });

      await fs.writeFile(indexPath, JSON.stringify(index));

      const resolver = new Resolver();

      await expect(resolver.resolveClosureFromIndex(indexPath)).rejects.toThrow(ResolverError);

      try {
        await resolver.resolveClosureFromIndex(indexPath);
      } catch (error) {
        expect((error as ResolverError).exitCode).toBe(3);
        expect((error as ResolverError).message).toContain('Cyclic dependency detected');
      }
    });

    it('should throw ResolverError with exit code 1 for missing index file', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent', 'spectrl-index.json');
      const resolver = new Resolver();

      await expect(resolver.resolveClosureFromIndex(nonExistentPath)).rejects.toThrow(
        ResolverError,
      );

      try {
        await resolver.resolveClosureFromIndex(nonExistentPath);
      } catch (error) {
        expect((error as ResolverError).exitCode).toBe(1);
        expect((error as ResolverError).message).toContain('Index file not found');
      }
    });
  });
});
