import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveManifestPath,
  readManifestFile,
  MANIFEST_JSONC,
  MANIFEST_JSON,
} from './manifest-file.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'spectrl-test-'));
}

async function cleanup(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('resolveManifestPath', () => {
  describe('Property 9: JSONC manifest resolution', () => {
    // Feature: specs-and-powers, Property 9: JSONC manifest resolution
    // Validates: Requirements 8.2
    it('should prefer spectrl.jsonc over spectrl.json when both exist', async () => {
      const dirs: string[] = [];
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const dir = await makeTempDir();
          dirs.push(dir);
          await fs.writeFile(join(dir, MANIFEST_JSONC), '{}');
          await fs.writeFile(join(dir, MANIFEST_JSON), '{}');
          const resolved = await resolveManifestPath(dir);
          expect(resolved).toBe(join(dir, MANIFEST_JSONC));
        }),
        { numRuns: 5 },
      );
      await cleanup(dirs);
    });

    it('should fall back to spectrl.json when only spectrl.json exists', async () => {
      const dirs: string[] = [];
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const dir = await makeTempDir();
          dirs.push(dir);
          await fs.writeFile(join(dir, MANIFEST_JSON), '{}');
          const resolved = await resolveManifestPath(dir);
          expect(resolved).toBe(join(dir, MANIFEST_JSON));
        }),
        { numRuns: 5 },
      );
      await cleanup(dirs);
    });
  });

  describe('Unit tests', () => {
    const dirs: string[] = [];
    afterEach(() => cleanup(dirs));

    it('should return jsonc path when only jsonc exists', async () => {
      const dir = await makeTempDir();
      dirs.push(dir);
      await fs.writeFile(join(dir, MANIFEST_JSONC), '{}');
      const result = await resolveManifestPath(dir);
      expect(result).toBe(join(dir, MANIFEST_JSONC));
    });

    it('should return json path when only json exists', async () => {
      const dir = await makeTempDir();
      dirs.push(dir);
      await fs.writeFile(join(dir, MANIFEST_JSON), '{}');
      const result = await resolveManifestPath(dir);
      expect(result).toBe(join(dir, MANIFEST_JSON));
    });

    it('should throw when no manifest exists', async () => {
      const dir = await makeTempDir();
      dirs.push(dir);
      await expect(resolveManifestPath(dir)).rejects.toThrow('No manifest found');
    });
  });
});

describe('readManifestFile', () => {
  const dirs: string[] = [];
  afterEach(() => cleanup(dirs));

  it('should read and parse a spectrl.jsonc file', async () => {
    const dir = await makeTempDir();
    dirs.push(dir);
    const content = `{
      // a comment
      "name": "my-spec",
      "version": "1.0.0",
    }`;
    await fs.writeFile(join(dir, MANIFEST_JSONC), content);
    const result = await readManifestFile(dir);
    expect(result).toEqual({ name: 'my-spec', version: '1.0.0' });
  });

  it('should read and parse a spectrl.json file', async () => {
    const dir = await makeTempDir();
    dirs.push(dir);
    await fs.writeFile(join(dir, MANIFEST_JSON), '{"name":"test","version":"0.1.0"}');
    const result = await readManifestFile(dir);
    expect(result).toEqual({ name: 'test', version: '0.1.0' });
  });

  it('should prefer jsonc over json', async () => {
    const dir = await makeTempDir();
    dirs.push(dir);
    await fs.writeFile(join(dir, MANIFEST_JSONC), '{"source":"jsonc"}');
    await fs.writeFile(join(dir, MANIFEST_JSON), '{"source":"json"}');
    const result = await readManifestFile(dir);
    expect(result).toEqual({ source: 'jsonc' });
  });

  it('should throw on invalid JSONC content', async () => {
    const dir = await makeTempDir();
    dirs.push(dir);
    await fs.writeFile(join(dir, MANIFEST_JSONC), '{ invalid }');
    await expect(readManifestFile(dir)).rejects.toThrow('JSONC parse error');
  });
});
