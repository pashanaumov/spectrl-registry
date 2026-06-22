import { describe, it, expect } from 'vitest';
import { ManifestSchema, IndexSchema, LockEntrySchema, LockFileSchema } from './index.js';

describe('ManifestSchema', () => {
  it('should validate a valid manifest', () => {
    const validManifest = {
      name: 'test-spec',
      version: '1.0.0',
      type: 'spec' as const,
      deps: {
        'other-spec': '2.1.0',
      },
      files: ['README.md', 'docs/api.yaml'],
      hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
    };

    const result = ManifestSchema.parse(validManifest);
    expect(result).toEqual(validManifest);
  });

  it('should provide default empty deps object', () => {
    const manifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
    };

    const result = ManifestSchema.parse(manifest);
    expect(result.deps).toEqual({});
  });

  it('should reject invalid name format', () => {
    const invalidManifest = {
      name: 'Test_Spec',
      version: '1.0.0',
      files: ['README.md'],
    };

    expect(() => ManifestSchema.parse(invalidManifest)).toThrow();
  });

  it('should reject invalid version format', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0',
      files: ['README.md'],
    };

    expect(() => ManifestSchema.parse(invalidManifest)).toThrow();
  });

  it('should reject empty files array', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: [],
    };

    expect(() => ManifestSchema.parse(invalidManifest)).toThrow();
  });

  it('should reject invalid hash format', () => {
    const invalidManifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
      hash: 'abc123',
    };

    expect(() => ManifestSchema.parse(invalidManifest)).toThrow();
  });

  it('should accept valid hash format', () => {
    const validManifest = {
      name: 'test-spec',
      version: '1.0.0',
      files: ['README.md'],
      hash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    const result = ManifestSchema.parse(validManifest);
    expect(result.hash).toBe(
      'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  });
});

describe('IndexSchema', () => {
  it('should validate a valid project index', () => {
    const validIndex = {
      'test-spec@1.0.0': {
        source: 'file:./specs/test-spec/1.0.0',
        hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
      },
      'other-spec@2.1.0': {
        source: 'file:./specs/other-spec/2.1.0',
        hash: 'sha256:b4e6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
      },
    };

    const result = IndexSchema.parse(validIndex);
    expect(result).toEqual(validIndex);
  });

  it('should reject invalid key format', () => {
    const invalidIndex = {
      'test-spec': {
        source: 'file:./specs/test-spec/1.0.0',
      },
    };

    expect(() => IndexSchema.parse(invalidIndex)).toThrow();
  });

  it('should accept relative paths as source', () => {
    const indexWithRelativePath = {
      'test-spec@1.0.0': {
        source: 'not-a-url', // bare relative path is valid
        hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
      },
    };

    const result = IndexSchema.parse(indexWithRelativePath);
    expect(result).toEqual(indexWithRelativePath);
  });

  it('should reject empty source string', () => {
    const invalidIndex = {
      'test-spec@1.0.0': {
        source: '',
      },
    };

    expect(() => IndexSchema.parse(invalidIndex)).toThrow();
  });

  it('should accept empty index', () => {
    const emptyIndex = {};
    const result = IndexSchema.parse(emptyIndex);
    expect(result).toEqual({});
  });
});

describe('LockEntrySchema', () => {
  it('should validate a valid lock entry', () => {
    const validEntry = {
      name: 'test-spec',
      version: '1.0.0',
      hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
      source: 'file:./specs/test-spec/1.0.0',
      deps: ['other-spec@2.1.0'],
    };

    const result = LockEntrySchema.parse(validEntry);
    expect(result).toEqual(validEntry);
  });

  it('should accept empty deps array', () => {
    const entry = {
      name: 'test-spec',
      version: '1.0.0',
      hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
      source: 'file:./specs/test-spec/1.0.0',
      deps: [],
    };

    const result = LockEntrySchema.parse(entry);
    expect(result.deps).toEqual([]);
  });

  it('should reject invalid hash format', () => {
    const invalidEntry = {
      name: 'test-spec',
      version: '1.0.0',
      hash: 'abc123',
      source: 'file:./specs/test-spec/1.0.0',
      deps: [],
    };

    expect(() => LockEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject invalid dep format', () => {
    const invalidEntry = {
      name: 'test-spec',
      version: '1.0.0',
      hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
      source: 'file:./specs/test-spec/1.0.0',
      deps: ['other-spec'],
    };

    expect(() => LockEntrySchema.parse(invalidEntry)).toThrow();
  });
});

describe('LockFileSchema', () => {
  it('should validate a valid lock file', () => {
    const validLock = {
      createdAt: '2025-11-07T13:40:00Z',
      entries: [
        {
          name: 'test-spec',
          version: '1.0.0',
          hash: 'sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
          source: 'file:./specs/test-spec/1.0.0',
          deps: [],
        },
      ],
    };

    const result = LockFileSchema.parse(validLock);
    expect(result).toEqual(validLock);
  });

  it('should accept empty entries array', () => {
    const emptyLock = {
      createdAt: '2025-11-07T13:40:00Z',
      entries: [],
    };

    const result = LockFileSchema.parse(emptyLock);
    expect(result.entries).toEqual([]);
  });

  it('should reject invalid ISO-8601 format', () => {
    const invalidLock = {
      createdAt: '2025-11-07',
      entries: [],
    };

    expect(() => LockFileSchema.parse(invalidLock)).toThrow();
  });
});
