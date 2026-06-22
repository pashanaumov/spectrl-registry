import { describe, it, expect } from 'vitest';
import { parseSpecRef, formatSpecRef, type ParsedSpecRef } from './spec-ref.js';

describe('parseSpecRef', () => {
  describe('local spec references', () => {
    it('should parse local spec without version', () => {
      const result = parseSpecRef('my-spec');
      expect(result).toEqual({
        name: 'my-spec',
        isPublic: false,
      });
    });

    it('should parse local spec with version', () => {
      const result = parseSpecRef('my-spec@1.0.0');
      expect(result).toEqual({
        name: 'my-spec',
        version: '1.0.0',
        isPublic: false,
      });
    });

    it('should parse local spec with hyphens in name', () => {
      const result = parseSpecRef('my-api-spec@2.1.3');
      expect(result).toEqual({
        name: 'my-api-spec',
        version: '2.1.3',
        isPublic: false,
      });
    });

    it('should parse local spec with numbers in name', () => {
      const result = parseSpecRef('spec123@1.0.0');
      expect(result).toEqual({
        name: 'spec123',
        version: '1.0.0',
        isPublic: false,
      });
    });

    it('should parse local spec with single character name', () => {
      const result = parseSpecRef('a');
      expect(result).toEqual({
        name: 'a',
        isPublic: false,
      });
    });

    it('should parse local spec with long name', () => {
      const longName = `a${'-b'.repeat(49)}`; // 99 chars
      const result = parseSpecRef(longName);
      expect(result).toEqual({
        name: longName,
        isPublic: false,
      });
    });
  });

  describe('public spec references', () => {
    it('should parse public spec without version', () => {
      const result = parseSpecRef('alice/my-spec');
      expect(result).toEqual({
        username: 'alice',
        name: 'my-spec',
        isPublic: true,
      });
    });

    it('should parse public spec with version', () => {
      const result = parseSpecRef('alice/my-spec@1.0.0');
      expect(result).toEqual({
        username: 'alice',
        name: 'my-spec',
        version: '1.0.0',
        isPublic: true,
      });
    });

    it('should parse public spec with hyphens in username', () => {
      const result = parseSpecRef('alice-bob/my-spec@1.0.0');
      expect(result).toEqual({
        username: 'alice-bob',
        name: 'my-spec',
        version: '1.0.0',
        isPublic: true,
      });
    });

    it('should parse public spec with numbers in username', () => {
      const result = parseSpecRef('user123/my-spec@1.0.0');
      expect(result).toEqual({
        username: 'user123',
        name: 'my-spec',
        version: '1.0.0',
        isPublic: true,
      });
    });

    it('should parse public spec with hyphens in spec name', () => {
      const result = parseSpecRef('alice/my-api-spec@2.1.3');
      expect(result).toEqual({
        username: 'alice',
        name: 'my-api-spec',
        version: '2.1.3',
        isPublic: true,
      });
    });

    it('should parse public spec with single character username', () => {
      const result = parseSpecRef('a/spec');
      expect(result).toEqual({
        username: 'a',
        name: 'spec',
        isPublic: true,
      });
    });

    it('should parse public spec with single character spec name', () => {
      const result = parseSpecRef('alice/s');
      expect(result).toEqual({
        username: 'alice',
        name: 's',
        isPublic: true,
      });
    });
  });

  describe('version validation', () => {
    it('should accept valid semver versions', () => {
      expect(parseSpecRef('spec@0.0.0')).toHaveProperty('version', '0.0.0');
      expect(parseSpecRef('spec@1.0.0')).toHaveProperty('version', '1.0.0');
      expect(parseSpecRef('spec@10.20.30')).toHaveProperty('version', '10.20.30');
      expect(parseSpecRef('spec@999.999.999')).toHaveProperty('version', '999.999.999');
    });

    it('should reject versions with leading zeros', () => {
      expect(() => parseSpecRef('spec@01.0.0')).toThrow('Invalid version');
      expect(() => parseSpecRef('spec@1.02.0')).toThrow('Invalid version');
      expect(() => parseSpecRef('spec@1.0.03')).toThrow('Invalid version');
    });

    it('should reject versions with missing components', () => {
      expect(() => parseSpecRef('spec@1')).toThrow('Invalid version');
      expect(() => parseSpecRef('spec@1.0')).toThrow('Invalid version');
    });

    it('should reject versions with extra components', () => {
      expect(() => parseSpecRef('spec@1.0.0.0')).toThrow('Invalid version');
    });

    it('should reject versions with non-numeric components', () => {
      expect(() => parseSpecRef('spec@a.b.c')).toThrow('Invalid version');
      expect(() => parseSpecRef('spec@1.x.0')).toThrow('Invalid version');
    });

    it('should reject versions with prerelease tags', () => {
      expect(() => parseSpecRef('spec@1.0.0-alpha')).toThrow('Invalid version');
      expect(() => parseSpecRef('spec@1.0.0-beta.1')).toThrow('Invalid version');
    });

    it('should reject versions with build metadata', () => {
      expect(() => parseSpecRef('spec@1.0.0+build')).toThrow('Invalid version');
    });
  });

  describe('input validation', () => {
    it('should reject empty string', () => {
      expect(() => parseSpecRef('')).toThrow('must be a non-empty string');
    });

    it('should reject whitespace-only string', () => {
      expect(() => parseSpecRef('   ')).toThrow('must be a non-empty string');
    });

    it('should reject null', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      expect(() => parseSpecRef(null as any)).toThrow('must be a non-empty string');
    });

    it('should reject undefined', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      expect(() => parseSpecRef(undefined as any)).toThrow('must be a non-empty string');
    });

    it('should reject non-string types', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      expect(() => parseSpecRef(123 as any)).toThrow('must be a non-empty string');
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      expect(() => parseSpecRef({} as any)).toThrow('must be a non-empty string');
    });

    it('should trim whitespace', () => {
      const result = parseSpecRef('  my-spec  ');
      expect(result).toEqual({
        name: 'my-spec',
        isPublic: false,
      });
    });
  });

  describe('name validation', () => {
    it('should reject uppercase letters in local spec name', () => {
      expect(() => parseSpecRef('MySpec')).toThrow('Invalid spec name');
      expect(() => parseSpecRef('my-Spec')).toThrow('Invalid spec name');
    });

    it('should reject uppercase letters in public spec name', () => {
      expect(() => parseSpecRef('alice/MySpec')).toThrow('Invalid spec name');
    });

    it('should reject uppercase letters in username', () => {
      expect(() => parseSpecRef('Alice/my-spec')).toThrow('Invalid username');
    });

    it('should reject special characters in name', () => {
      expect(() => parseSpecRef('my_spec')).toThrow('Invalid spec name');
      expect(() => parseSpecRef('my.spec')).toThrow('Invalid spec name');
      expect(() => parseSpecRef('my spec')).toThrow('Invalid spec name');
      expect(() => parseSpecRef('my$spec')).toThrow('Invalid spec name');
    });

    it('should reject special characters in username', () => {
      expect(() => parseSpecRef('alice_bob/spec')).toThrow('Invalid username');
      expect(() => parseSpecRef('alice.bob/spec')).toThrow('Invalid username');
    });

    it('should reject name starting with hyphen', () => {
      expect(() => parseSpecRef('-spec')).toThrow('Invalid spec name');
    });

    it('should reject name ending with hyphen', () => {
      expect(() => parseSpecRef('spec-')).toThrow('Invalid spec name');
    });

    it('should reject username starting with hyphen', () => {
      expect(() => parseSpecRef('-alice/spec')).toThrow('Invalid username');
    });

    it('should reject username ending with hyphen', () => {
      expect(() => parseSpecRef('alice-/spec')).toThrow('Invalid username');
    });

    it('should reject name that is too long', () => {
      const tooLong = `a${'-b'.repeat(50)}`; // 101 chars
      expect(() => parseSpecRef(tooLong)).toThrow('Invalid spec name');
    });

    it('should reject username that is too long', () => {
      const tooLong = `a${'-b'.repeat(20)}`; // 41 chars
      expect(() => parseSpecRef(`${tooLong}/spec`)).toThrow('Invalid username');
    });
  });

  describe('public spec format validation', () => {
    it('should reject public spec with missing username', () => {
      expect(() => parseSpecRef('/my-spec')).toThrow('Invalid public spec reference');
    });

    it('should reject public spec with missing spec name', () => {
      expect(() => parseSpecRef('alice/')).toThrow('Invalid public spec reference');
    });

    it('should reject public spec with multiple slashes', () => {
      expect(() => parseSpecRef('alice/bob/spec')).toThrow('Invalid spec name');
    });

    it('should reject public spec with @ before /', () => {
      expect(() => parseSpecRef('alice@1.0.0/spec')).toThrow('Invalid username');
    });
  });

  describe('edge cases', () => {
    it('should handle spec name with consecutive hyphens', () => {
      const result = parseSpecRef('my--spec');
      expect(result).toEqual({
        name: 'my--spec',
        isPublic: false,
      });
    });

    it('should handle username with consecutive hyphens', () => {
      const result = parseSpecRef('alice--bob/spec');
      expect(result).toEqual({
        username: 'alice--bob',
        name: 'spec',
        isPublic: true,
      });
    });

    it('should handle spec with @ in name position but no version', () => {
      // This should fail because @ requires a version
      expect(() => parseSpecRef('spec@')).toThrow('Invalid version');
    });

    it('should handle public spec with @ but no version', () => {
      expect(() => parseSpecRef('alice/spec@')).toThrow('Invalid version');
    });
  });
});

describe('formatSpecRef', () => {
  it('should format local spec without version', () => {
    const parsed: ParsedSpecRef = {
      name: 'my-spec',
      isPublic: false,
    };
    expect(formatSpecRef(parsed)).toBe('my-spec');
  });

  it('should format local spec with version', () => {
    const parsed: ParsedSpecRef = {
      name: 'my-spec',
      version: '1.0.0',
      isPublic: false,
    };
    expect(formatSpecRef(parsed)).toBe('my-spec@1.0.0');
  });

  it('should format public spec without version', () => {
    const parsed: ParsedSpecRef = {
      username: 'alice',
      name: 'my-spec',
      isPublic: true,
    };
    expect(formatSpecRef(parsed)).toBe('alice/my-spec');
  });

  it('should format public spec with version', () => {
    const parsed: ParsedSpecRef = {
      username: 'alice',
      name: 'my-spec',
      version: '1.0.0',
      isPublic: true,
    };
    expect(formatSpecRef(parsed)).toBe('alice/my-spec@1.0.0');
  });

  it('should be inverse of parseSpecRef for local specs', () => {
    const inputs = ['my-spec', 'my-spec@1.0.0', 'api-spec@2.1.3'];
    for (const input of inputs) {
      const parsed = parseSpecRef(input);
      const formatted = formatSpecRef(parsed);
      expect(formatted).toBe(input);
    }
  });

  it('should be inverse of parseSpecRef for public specs', () => {
    const inputs = ['alice/my-spec', 'alice/my-spec@1.0.0', 'bob/api-spec@2.1.3'];
    for (const input of inputs) {
      const parsed = parseSpecRef(input);
      const formatted = formatSpecRef(parsed);
      expect(formatted).toBe(input);
    }
  });
});
