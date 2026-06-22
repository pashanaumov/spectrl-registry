import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateFilePaths, validateFilesExist, validateManifest } from './validator.js';

describe('validateManifest', () => {
  it('should validate a correct manifest', () => {
    const validManifest = {
      name: 'test-spec',
      version: '1.0.0',
      type: 'spec' as const,
      deps: { 'other-spec': '2.1.0' },
      files: ['README.md', 'docs/api.md'],
      hash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    const result = validateManifest(validManifest);
    expect(result).toEqual(validManifest);
  });

  it('should validate manifest with minimal required fields', () => {
    const minimalManifest = {
      name: 'minimal-spec',
      version: '0.1.0',
      files: ['README.md'],
    };

    const result = validateManifest(minimalManifest);
    expect(result).toEqual({
      ...minimalManifest,
      type: 'spec', // Should default to 'spec'
      deps: {}, // Should default to empty object
    });
  });

  it('should reject manifest with invalid name format', () => {
    const invalidManifest = {
      name: 'Invalid_Name',
      version: '1.0.0',
      files: ['README.md'],
    };

    expect(() => validateManifest(invalidManifest)).toThrow(
      'Manifest validation failed:\nname: Name must be lowercase alphanumeric with hyphens',
    );
  });

  it('should reject manifest with invalid version format', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0',
      files: ['README.md'],
    };

    expect(() => validateManifest(invalidManifest)).toThrow(
      'Manifest validation failed:\nversion: Version must be semver compliant (x.y.z)',
    );
  });

  it('should reject manifest with empty files array', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: [],
    };

    expect(() => validateManifest(invalidManifest)).toThrow(
      'Manifest validation failed:\nfiles: Files array cannot be empty',
    );
  });

  it('should reject manifest with invalid dependency version', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
      deps: { 'other-spec': '^2.0.0' },
    };

    expect(() => validateManifest(invalidManifest)).toThrow(
      'Manifest validation failed:\ndeps.other-spec: Dependency version must be exact semver',
    );
  });

  it('should reject manifest missing required fields', () => {
    const invalidManifest = {
      version: '1.0.0',
      files: ['README.md'],
    };

    expect(() => validateManifest(invalidManifest)).toThrow(
      'Manifest validation failed:\nname: Required',
    );
  });

  it('should handle multiple validation errors', () => {
    const invalidManifest = {
      name: 'Invalid_Name',
      version: 'invalid-version',
      files: [],
    };

    expect(() => validateManifest(invalidManifest)).toThrow('Manifest validation failed:');

    try {
      validateManifest(invalidManifest);
    } catch (error) {
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('name: Name must be lowercase alphanumeric with hyphens');
      expect(errorMessage).toContain('version: Version must be semver compliant (x.y.z)');
      expect(errorMessage).toContain('files: Files array cannot be empty');
    }
  });

  it('should reject non-object input', () => {
    expect(() => validateManifest('not an object')).toThrow('Manifest validation failed:');
    expect(() => validateManifest(null)).toThrow('Manifest validation failed:');
    expect(() => validateManifest(undefined)).toThrow('Manifest validation failed:');
  });
});

describe('validateFilePaths', () => {
  it('should accept valid relative paths', () => {
    const validPaths = ['README.md', 'docs/api.md', 'src/index.ts', 'nested/deep/file.txt'];

    expect(() => validateFilePaths(validPaths)).not.toThrow();
  });

  it('should reject paths with path traversal', () => {
    const pathsWithTraversal = [
      '../outside.md',
      'docs/../../../etc/passwd',
      'normal/../../bad.txt',
    ];

    for (const path of pathsWithTraversal) {
      expect(() => validateFilePaths([path])).toThrow(`Path traversal not allowed: ${path}`);
    }
  });

  it('should reject absolute paths', () => {
    const absolutePaths = ['/etc/passwd', '/home/user/file.txt', 'C:\\Windows\\System32\\file.txt'];

    for (const path of absolutePaths) {
      expect(() => validateFilePaths([path])).toThrow(`Absolute paths not allowed: ${path}`);
    }
  });

  it('should reject duplicate paths', () => {
    const duplicatePaths = [
      'README.md',
      'docs/api.md',
      'README.md', // duplicate
    ];

    expect(() => validateFilePaths(duplicatePaths)).toThrow('Duplicate file path: README.md');
  });

  it('should normalize paths when checking for duplicates', () => {
    const pathsWithDifferentSeparators = [
      'docs/api.md',
      'docs\\api.md', // Same path with different separator
    ];

    expect(() => validateFilePaths(pathsWithDifferentSeparators)).toThrow(
      'Duplicate file path: docs\\api.md',
    );
  });

  it('should handle empty paths array', () => {
    expect(() => validateFilePaths([])).not.toThrow();
  });
});

describe('validateFilesExist', () => {
  const testDir = '/tmp/spectrl-validator-test';

  beforeEach(async () => {
    // Create test directory and files
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'docs'), { recursive: true });
    await fs.writeFile(join(testDir, 'README.md'), '# Test');
    await fs.writeFile(join(testDir, 'docs', 'api.md'), '# API');
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should pass when all files exist', async () => {
    const existingFiles = ['README.md', 'docs/api.md'];

    await expect(validateFilesExist(existingFiles, testDir)).resolves.not.toThrow();
  });

  it('should throw when files are missing', async () => {
    const filesWithMissing = ['README.md', 'missing.txt', 'docs/missing.md'];

    await expect(validateFilesExist(filesWithMissing, testDir)).rejects.toThrow(
      'Files not found: missing.txt, docs/missing.md',
    );
  });

  it('should throw when single file is missing', async () => {
    const missingFile = ['nonexistent.txt'];

    await expect(validateFilesExist(missingFile, testDir)).rejects.toThrow(
      'Files not found: nonexistent.txt',
    );
  });

  it('should handle empty files array', async () => {
    await expect(validateFilesExist([], testDir)).resolves.not.toThrow();
  });

  it('should handle nested missing files', async () => {
    const nestedMissingFiles = ['README.md', 'deep/nested/missing.txt'];

    await expect(validateFilesExist(nestedMissingFiles, testDir)).rejects.toThrow(
      'Files not found: deep/nested/missing.txt',
    );
  });
});
