import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ManifestSchema } from '@spectrl/schema';
import {
  createTempDir,
  publish,
  createSpec,
  exists,
  readJSON,
  readText,
  writeText,
  createDir,
} from './utils/index.js';

describe('spectrl publish', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    // Clean up temp directories
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('should publish spec to registry with correct structure', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create a spec
    const manifest = {
      name: 'test-spec',
      version: '1.0.0',
      deps: {},
      files: ['docs/readme.md', 'specs/api.yaml'],
    };

    const files = {
      'docs/readme.md': '# Test Spec\n\nThis is a test spec.\n',
      'specs/api.yaml': 'openapi: 3.0.0\ninfo:\n  title: Test API\n',
    };

    await createSpec(tmpDir, manifest, files);

    // Publish
    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(0);
    // Success message now outputs to stdout
    expect(result.stdout).toContain('Published');
    expect(result.stdout).toContain('test-spec');
    expect(result.stdout).toContain('1.0.0');

    // Verify registry structure
    const registryPath = join(homedir(), '.spectrl/registry/test-spec/1.0.0');
    expect(await exists(registryPath)).toBe(true);

    // Verify manifest exists with hash
    const manifestPath = join(registryPath, 'spectrl.json');
    expect(await exists(manifestPath)).toBe(true);

    const raw = await readJSON(manifestPath);
    const storedManifest = ManifestSchema.parse(raw);
    expect(storedManifest.name).toBe('test-spec');
    expect(storedManifest.version).toBe('1.0.0');
    expect(storedManifest.hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    // Verify files directory structure
    const filesDir = join(registryPath, 'files');
    expect(await exists(filesDir)).toBe(true);

    const readmePath = join(filesDir, 'docs/readme.md');
    expect(await exists(readmePath)).toBe(true);
    const readmeContent = await readText(readmePath);
    expect(readmeContent).toBe('# Test Spec\n\nThis is a test spec.\n');

    const apiPath = join(filesDir, 'specs/api.yaml');
    expect(await exists(apiPath)).toBe(true);
    const apiContent = await readText(apiPath);
    expect(apiContent).toBe('openapi: 3.0.0\ninfo:\n  title: Test API\n');
  });

  it('should error when manifest is invalid', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with invalid manifest (missing required fields)
    const manifest = {
      name: 'invalid-spec',
      // missing version
      files: ['readme.md'],
    };

    const files = {
      'readme.md': '# Invalid\n',
    };

    await createSpec(tmpDir, manifest, files);

    // Publish should fail
    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('version');
  });

  it('should error when tracked file is missing', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Create spec with file that doesn't exist
    const manifest = {
      name: 'missing-file-spec',
      version: '1.0.0',
      deps: {},
      files: ['missing.md'],
    };

    await createSpec(tmpDir, manifest, {});

    // Publish should fail
    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('missing.md');
  });

  it('should compute hash with sha256 prefix', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const manifest = {
      name: 'hash-test',
      version: '1.0.0',
      deps: {},
      files: ['test.txt'],
    };

    const files = {
      'test.txt': 'test content\n',
    };

    await createSpec(tmpDir, manifest, files);

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(0);

    // Verify hash is stored in manifest with correct format
    const registryPath = join(homedir(), '.spectrl/registry/hash-test/1.0.0');
    const manifestPath = join(registryPath, 'spectrl.json');
    const storedManifest = await readJSON(manifestPath);
    const parseResult = ManifestSchema.safeParse(storedManifest);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it('should retain type "power" in registry manifest when published with explicit type', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const manifest = {
      name: 'type-power-test',
      version: '1.0.0',
      type: 'power',
      description: 'A test power',
      deps: {},
      files: ['index.md'],
    };

    await createSpec(tmpDir, manifest, {
      'index.md': '# Power\n\n## Instructions\n\n1. Do the thing\n',
    });

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(0);

    // Verify type is preserved in registry manifest
    const registryPath = join(homedir(), '.spectrl/registry/type-power-test/1.0.0');
    const manifestPath = join(registryPath, 'spectrl.json');
    const raw = await readJSON(manifestPath);
    const parseResult = ManifestSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.type).toBe('power');
    }
  });

  it('should default type to "spec" in registry manifest when type field is omitted', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Manifest without type field
    const manifest = {
      name: 'type-default-test',
      version: '1.0.0',
      description: 'A test spec without explicit type',
      deps: {},
      files: ['index.md'],
    };

    await createSpec(tmpDir, manifest, {
      'index.md': '# Default Type Spec\n',
    });

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(0);

    // Verify type defaults to "spec" in registry manifest
    const registryPath = join(homedir(), '.spectrl/registry/type-default-test/1.0.0');
    const manifestPath = join(registryPath, 'spectrl.json');
    const raw = await readJSON(manifestPath);
    const parseResult = ManifestSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.type).toBe('spec');
    }
  });

  it('should publish JSONC manifest as standard JSON with comments stripped', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    // Write a spectrl.jsonc file with comments and trailing comma
    const jsoncContent = `{
  "name": "jsonc-publish-test",
  "version": "1.0.0",
  // Required for publishing
  "description": "A JSONC manifest test",
  "type": "spec",
  "files": ["index.md"],
  "deps": {},
  /* agent metadata */
  // "agent": {
  //   "purpose": "Testing JSONC support"
  // }
}
`;
    await createDir(tmpDir);
    await writeText(join(tmpDir, 'spectrl.jsonc'), jsoncContent);
    await writeText(join(tmpDir, 'index.md'), '# JSONC Test\n');

    const result = await publish(tmpDir);

    expect(result.exitCode).toBe(0);

    // Verify the registry stores standard JSON (no comments)
    const registryPath = join(homedir(), '.spectrl/registry/jsonc-publish-test/1.0.0');
    const manifestPath = join(registryPath, 'spectrl.json');
    expect(await exists(manifestPath)).toBe(true);

    const storedContent = await readText(manifestPath);

    // Must be valid JSON (no comments)
    expect(() => JSON.parse(storedContent)).not.toThrow();

    // Must not contain comment markers
    expect(storedContent).not.toContain('//');
    expect(storedContent).not.toContain('/*');

    // Validate with schema
    const raw = JSON.parse(storedContent);
    const parseResult = ManifestSchema.safeParse(raw);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.name).toBe('jsonc-publish-test');
      expect(parseResult.data.type).toBe('spec');
    }
  });
});
