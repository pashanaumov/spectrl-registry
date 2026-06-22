import { describe, expect, it } from 'vitest';
import { compareSemver } from './utils.js';

describe('compareSemver', () => {
  describe('basic comparisons', () => {
    it('should return 0 for equal versions', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('2.5.3', '2.5.3')).toBe(0);
      expect(compareSemver('0.0.1', '0.0.1')).toBe(0);
    });

    it('should return positive when first version is greater', () => {
      expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareSemver('1.1.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
    });

    it('should return negative when first version is less', () => {
      expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(compareSemver('1.0.0', '1.1.0')).toBeLessThan(0);
      expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    });
  });

  describe('major version comparisons', () => {
    it('should prioritize major version differences', () => {
      expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
      expect(compareSemver('10.0.0', '9.99.99')).toBeGreaterThan(0);
      expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should handle large major version numbers', () => {
      expect(compareSemver('100.0.0', '99.0.0')).toBeGreaterThan(0);
      expect(compareSemver('1.0.0', '100.0.0')).toBeLessThan(0);
    });
  });

  describe('minor version comparisons', () => {
    it('should compare minor versions when major is equal', () => {
      expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0);
      expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
      expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('should ignore patch when minor differs', () => {
      expect(compareSemver('1.2.0', '1.1.99')).toBeGreaterThan(0);
      expect(compareSemver('1.1.99', '1.2.0')).toBeLessThan(0);
    });
  });

  describe('patch version comparisons', () => {
    it('should compare patch versions when major and minor are equal', () => {
      expect(compareSemver('1.0.2', '1.0.1')).toBeGreaterThan(0);
      expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
      expect(compareSemver('1.0.10', '1.0.9')).toBeGreaterThan(0);
    });

    it('should handle large patch numbers', () => {
      expect(compareSemver('1.0.100', '1.0.99')).toBeGreaterThan(0);
      expect(compareSemver('1.0.1', '1.0.100')).toBeLessThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero versions', () => {
      expect(compareSemver('0.0.0', '0.0.0')).toBe(0);
      expect(compareSemver('0.0.1', '0.0.0')).toBeGreaterThan(0);
      expect(compareSemver('0.1.0', '0.0.1')).toBeGreaterThan(0);
      expect(compareSemver('1.0.0', '0.9.9')).toBeGreaterThan(0);
    });

    it('should reject versions with leading zeros', () => {
      // semver package correctly rejects invalid versions with leading zeros
      expect(() => compareSemver('1.0.0', '01.0.0')).toThrow('Invalid Version');
      expect(() => compareSemver('1.02.0', '1.2.0')).toThrow('Invalid Version');
    });
  });

  describe('sorting use case', () => {
    it('should correctly sort versions in ascending order', () => {
      const versions = ['2.0.0', '1.0.0', '1.1.0', '1.0.1', '10.0.0'];
      const sorted = versions.sort(compareSemver);

      expect(sorted).toEqual(['1.0.0', '1.0.1', '1.1.0', '2.0.0', '10.0.0']);
    });

    it('should correctly sort versions in descending order', () => {
      const versions = ['1.0.0', '2.0.0', '1.1.0', '1.0.1', '10.0.0'];
      const sorted = versions.sort((a, b) => compareSemver(b, a));

      expect(sorted).toEqual(['10.0.0', '2.0.0', '1.1.0', '1.0.1', '1.0.0']);
    });

    it('should handle duplicate versions in sorting', () => {
      const versions = ['1.0.0', '2.0.0', '1.0.0', '2.0.0'];
      const sorted = versions.sort(compareSemver);

      expect(sorted).toEqual(['1.0.0', '1.0.0', '2.0.0', '2.0.0']);
    });
  });

  describe('real-world version sequences', () => {
    it('should correctly order typical version progression', () => {
      const versions = ['0.1.0', '0.2.0', '1.0.0', '1.0.1', '1.1.0', '2.0.0', '2.1.0', '2.1.1'];

      // Shuffle and sort
      const shuffled = [...versions].sort(() => Math.random() - 0.5);
      const sorted = shuffled.sort(compareSemver);

      expect(sorted).toEqual(versions);
    });

    it('should handle pre-1.0 versions correctly', () => {
      const versions = ['0.0.1', '0.0.2', '0.1.0', '0.2.0', '1.0.0'];
      const sorted = [...versions].reverse().sort(compareSemver);

      expect(sorted).toEqual(versions);
    });
  });
});
