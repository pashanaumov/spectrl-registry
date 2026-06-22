import { describe, expect, it } from 'vitest';
import { SearchResultSchema, SpecVersionSchema } from './schemas';

const validSearchResult = {
  specId: 'user/my-spec',
  version: '1.0.0',
  username: 'user',
  specName: 'my-spec',
  description: 'A test spec',
  tags: ['test'],
  publishedAt: '2024-01-01T00:00:00Z',
};

const validSpecVersion = {
  version: '1.0.0',
  description: 'A test spec',
  tags: ['test'],
  publishedAt: '2024-01-01T00:00:00Z',
  s3Path: 'specs/user/my-spec/1.0.0',
  hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
  files: ['index.md'],
};

describe('SearchResultSchema', () => {
  it('accepts explicit type "spec"', () => {
    const result = SearchResultSchema.safeParse({ ...validSearchResult, type: 'spec' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('spec');
  });

  it('accepts explicit type "power"', () => {
    const result = SearchResultSchema.safeParse({ ...validSearchResult, type: 'power' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('power');
  });

  it('defaults type to "spec" when omitted', () => {
    const result = SearchResultSchema.safeParse(validSearchResult);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('spec');
  });

  it('rejects invalid type values', () => {
    const result = SearchResultSchema.safeParse({ ...validSearchResult, type: 'unknown' });
    expect(result.success).toBe(false);
  });
});

describe('SpecVersionSchema', () => {
  it('accepts explicit type "spec"', () => {
    const result = SpecVersionSchema.safeParse({ ...validSpecVersion, type: 'spec' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('spec');
  });

  it('accepts explicit type "power"', () => {
    const result = SpecVersionSchema.safeParse({ ...validSpecVersion, type: 'power' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('power');
  });

  it('defaults type to "spec" when omitted', () => {
    const result = SpecVersionSchema.safeParse(validSpecVersion);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('spec');
  });

  it('rejects invalid type values', () => {
    const result = SpecVersionSchema.safeParse({ ...validSpecVersion, type: 'document' });
    expect(result.success).toBe(false);
  });
});

describe('SpecVersionSchema - deps field', () => {
  it('accepts a version object with deps containing string values', () => {
    const versionWithDeps = {
      ...validSpecVersion,
      deps: {
        'shared-errors': '1.0.0',
        'base-types': '2.0.0',
      },
    };

    const result = SpecVersionSchema.safeParse(versionWithDeps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deps).toEqual({
        'shared-errors': '1.0.0',
        'base-types': '2.0.0',
      });
    }
  });

  it('accepts a version object with single dependency', () => {
    const versionWithDeps = {
      ...validSpecVersion,
      deps: {
        foo: '1.0.0',
      },
    };

    const result = SpecVersionSchema.safeParse(versionWithDeps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deps).toEqual({ foo: '1.0.0' });
    }
  });

  it('accepts a version object without deps field (field is optional)', () => {
    const versionWithoutDeps: Record<string, unknown> = { ...validSpecVersion };
    versionWithoutDeps.deps = undefined;

    const result = SpecVersionSchema.safeParse(versionWithoutDeps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deps).toBeUndefined();
    }
  });

  it('accepts a version object with empty deps object', () => {
    const versionWithEmptyDeps = {
      ...validSpecVersion,
      deps: {},
    };

    const result = SpecVersionSchema.safeParse(versionWithEmptyDeps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deps).toEqual({});
    }
  });

  it('rejects a version object with deps containing non-string values', () => {
    const versionWithInvalidDeps = {
      ...validSpecVersion,
      deps: {
        'shared-errors': 1.0, // Number instead of string
      },
    };

    const result = SpecVersionSchema.safeParse(versionWithInvalidDeps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('deps');
    }
  });

  it('rejects a version object with deps containing null values', () => {
    const versionWithNullDeps = {
      ...validSpecVersion,
      deps: {
        'shared-errors': null,
      },
    };

    const result = SpecVersionSchema.safeParse(versionWithNullDeps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('deps');
    }
  });

  it('rejects a version object with deps containing undefined values', () => {
    const versionWithUndefinedDeps = {
      ...validSpecVersion,
      deps: {
        'shared-errors': undefined,
      },
    };

    const result = SpecVersionSchema.safeParse(versionWithUndefinedDeps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('deps');
    }
  });

  it('rejects a version object with deps as an array', () => {
    const versionWithArrayDeps = {
      ...validSpecVersion,
      deps: ['shared-errors@1.0.0'],
    };

    const result = SpecVersionSchema.safeParse(versionWithArrayDeps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('deps');
    }
  });

  it('rejects a version object with deps as a string', () => {
    const versionWithStringDeps = {
      ...validSpecVersion,
      deps: 'shared-errors@1.0.0',
    };

    const result = SpecVersionSchema.safeParse(versionWithStringDeps);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('deps');
    }
  });
});
