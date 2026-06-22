import { describe, it, expect } from 'vitest';
import { computeHash } from './hasher.js';
import type { Manifest } from '@spectrl/schema';

describe('computeHash', () => {
  const createTestManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
    name: 'test-spec',
    version: '1.0.0',
    deps: {},
    files: ['README.md'],
    ...overrides,
  });

  it('should produce deterministic output with identical inputs', () => {
    const manifest = createTestManifest();
    const fileContents = {
      'README.md': '# Test Spec\n\nThis is a test.',
    };

    const hash1 = computeHash({ manifest, fileContents });
    const hash2 = computeHash({ manifest, fileContents });

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/); // SHA-256 hex format with prefix
  });

  it('should normalize line endings to \\n', () => {
    const manifest = createTestManifest();

    // Test different line ending formats
    const unixContent = 'line1\nline2\nline3';
    const windowsContent = 'line1\r\nline2\r\nline3';
    const macContent = 'line1\rline2\rline3';

    const unixHash = computeHash({
      manifest,
      fileContents: { 'test.txt': unixContent },
    });

    const windowsHash = computeHash({
      manifest,
      fileContents: { 'test.txt': windowsContent },
    });

    const macHash = computeHash({
      manifest,
      fileContents: { 'test.txt': macContent },
    });

    // All should produce the same hash after normalization
    expect(unixHash).toBe(windowsHash);
    expect(unixHash).toBe(macHash);
  });

  it('should canonicalize manifest JSON with sorted keys', () => {
    // Create two manifests with same data but different key order
    const manifest1 = createTestManifest({
      name: 'test-spec',
      version: '1.0.0',
      files: ['file1.txt'],
      deps: { 'dep-a': '1.0.0', 'dep-b': '2.0.0' },
    });

    const manifest2 = createTestManifest({
      deps: { 'dep-b': '2.0.0', 'dep-a': '1.0.0' },
      files: ['file1.txt'],
      version: '1.0.0',
      name: 'test-spec',
    });

    const fileContents = { 'file1.txt': 'content' };

    const hash1 = computeHash({ manifest: manifest1, fileContents });
    const hash2 = computeHash({ manifest: manifest2, fileContents });

    // Should produce identical hashes despite different key order
    expect(hash1).toBe(hash2);
  });

  it('should sort file paths lexicographically', () => {
    const manifest = createTestManifest({
      files: ['z-file.txt', 'a-file.txt', 'middle-file.txt'],
    });

    // Create file contents in different order than manifest
    const fileContents1 = {
      'z-file.txt': 'z content',
      'a-file.txt': 'a content',
      'middle-file.txt': 'middle content',
    };

    const fileContents2 = {
      'middle-file.txt': 'middle content',
      'z-file.txt': 'z content',
      'a-file.txt': 'a content',
    };

    const hash1 = computeHash({ manifest, fileContents: fileContents1 });
    const hash2 = computeHash({ manifest, fileContents: fileContents2 });

    // Should produce identical hashes regardless of input order
    expect(hash1).toBe(hash2);
  });

  it('should exclude hash field from manifest canonicalization', () => {
    const manifestWithoutHash = createTestManifest();
    const manifestWithHash = createTestManifest({ hash: 'existing-hash-value' });

    const fileContents = { 'README.md': 'content' };

    const hash1 = computeHash({ manifest: manifestWithoutHash, fileContents });
    const hash2 = computeHash({ manifest: manifestWithHash, fileContents });

    // Should produce identical hashes regardless of existing hash field
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const manifest = createTestManifest();

    const fileContents1 = { 'README.md': 'content 1' };
    const fileContents2 = { 'README.md': 'content 2' };

    const hash1 = computeHash({ manifest, fileContents: fileContents1 });
    const hash2 = computeHash({ manifest, fileContents: fileContents2 });

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes for different manifests', () => {
    const manifest1 = createTestManifest({ name: 'spec-1' });
    const manifest2 = createTestManifest({ name: 'spec-2' });
    const fileContents = { 'README.md': 'same content' };

    const hash1 = computeHash({ manifest: manifest1, fileContents });
    const hash2 = computeHash({ manifest: manifest2, fileContents });

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty file contents', () => {
    const manifest = createTestManifest({ files: [] });
    const fileContents = {};

    const hash = computeHash({ manifest, fileContents });

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should handle complex nested dependencies', () => {
    const manifest = createTestManifest({
      deps: {
        'spec-z': '3.0.0',
        'spec-a': '1.0.0',
        'spec-m': '2.0.0',
      },
    });

    const fileContents = { 'README.md': 'content' };
    const hash = computeHash({ manifest, fileContents });

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should recursively sort nested object keys (deps)', () => {
    // This test specifically verifies that nested objects like 'deps' have their keys sorted
    // Without recursive sorting, different key orders in deps would produce different hashes
    const manifest1 = createTestManifest({
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
      deps: {
        'zebra-pkg': '1.0.0',
        'alpha-pkg': '2.0.0',
        'middle-pkg': '3.0.0',
      },
    });

    const manifest2 = createTestManifest({
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
      deps: {
        'alpha-pkg': '2.0.0',
        'middle-pkg': '3.0.0',
        'zebra-pkg': '1.0.0',
      },
    });

    const fileContents = { 'README.md': 'content' };

    const hash1 = computeHash({ manifest: manifest1, fileContents });
    const hash2 = computeHash({ manifest: manifest2, fileContents });

    // Should produce identical hashes despite different deps key order
    expect(hash1).toBe(hash2);
  });
});
