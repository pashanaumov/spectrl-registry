import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ManifestSchema } from './manifest.js';

// Arbitrary generators for manifest fields
const nameArb = fc.stringMatching(/^[a-z0-9-]+$/).filter((s) => s.length > 0 && s.length <= 100);

const versionArb = fc
  .tuple(fc.nat(99), fc.nat(99), fc.nat(99))
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

const typeArb = fc.constantFrom('spec', 'power');

const hashArb = fc
  .string({
    unit: fc.constantFrom(
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ),
    minLength: 64,
    maxLength: 64,
  })
  .map((hex) => `sha256:${hex}`);

const manifestArb = fc.record({
  name: nameArb,
  version: versionArb,
  type: fc.option(typeArb, { nil: undefined }),
  description: fc.option(fc.string(), { nil: undefined }),
  deps: fc.dictionary(nameArb, versionArb),
  files: fc.array(
    fc.string().filter((s) => s.length > 0),
    { minLength: 1 },
  ),
  hash: fc.option(hashArb, { nil: undefined }),
  agent: fc.option(
    fc.record({
      purpose: fc.string(),
      tags: fc.option(fc.array(fc.string()), { nil: undefined }),
    }),
    { nil: undefined },
  ),
});

describe('ManifestSchema', () => {
  describe('Property 1: Invalid type rejection', () => {
    // Feature: specs-and-powers, Property 1: Invalid type rejection
    // Validates: Requirements 1.1, 1.3
    it('should reject any string not in {"spec", "power"}', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => s !== 'spec' && s !== 'power'),
          manifestArb,
          (invalidType, manifest) => {
            const manifestWithInvalidType = {
              ...manifest,
              type: invalidType,
            };

            const result = ManifestSchema.safeParse(manifestWithInvalidType);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Manifest round-trip', () => {
    // Feature: specs-and-powers, Property 2: Manifest round-trip
    // Validates: Requirements 7.1, 7.2
    it('should produce equivalent manifest after parse → serialize → parse', () => {
      fc.assert(
        fc.property(manifestArb, (manifest) => {
          // First parse
          const parseResult1 = ManifestSchema.safeParse(manifest);
          if (!parseResult1.success) {
            // Skip invalid manifests
            return true;
          }

          // Serialize
          const serialized = JSON.stringify(parseResult1.data);

          // Parse again
          const parseResult2 = ManifestSchema.safeParse(JSON.parse(serialized));

          expect(parseResult2.success).toBe(true);
          if (parseResult2.success) {
            expect(parseResult2.data).toEqual(parseResult1.data);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: Default type materialization', () => {
    // Feature: specs-and-powers, Property 3: Default type materialization
    // Validates: Requirements 1.2, 1.4, 6.1, 6.2, 6.3, 7.3
    it('should default missing type to "spec" after parse+serialize', () => {
      fc.assert(
        fc.property(manifestArb, (manifest) => {
          // Remove type field to simulate legacy manifest
          const { type, ...manifestWithoutType } = manifest;

          const parseResult = ManifestSchema.safeParse(manifestWithoutType);
          if (!parseResult.success) {
            // Skip invalid manifests
            return true;
          }

          // After parsing, type should be "spec"
          expect(parseResult.data.type).toBe('spec');

          // After serialization, type should be present as "spec"
          const serialized = JSON.parse(JSON.stringify(parseResult.data));
          expect(serialized.type).toBe('spec');
        }),
        { numRuns: 100 },
      );
    });
  });

  // Additional unit tests for specific edge cases
  describe('Unit tests', () => {
    it('should accept valid spec manifest', () => {
      const validSpec = {
        name: 'test-spec',
        version: '1.0.0',
        type: 'spec' as const,
        description: 'A test spec',
        files: ['README.md'],
        deps: {},
      };

      const result = ManifestSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('spec');
      }
    });

    it('should accept valid power manifest', () => {
      const validPower = {
        name: 'test-power',
        version: '1.0.0',
        type: 'power' as const,
        description: 'A test power',
        files: ['index.md'],
        deps: {},
      };

      const result = ManifestSchema.safeParse(validPower);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('power');
      }
    });

    it('should default to "spec" when type is omitted', () => {
      const manifestWithoutType = {
        name: 'legacy-spec',
        version: '1.0.0',
        files: ['README.md'],
        deps: {},
      };

      const result = ManifestSchema.safeParse(manifestWithoutType);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('spec');
      }
    });

    it('should reject invalid type value', () => {
      const invalidManifest = {
        name: 'test',
        version: '1.0.0',
        type: 'invalid-type',
        files: ['README.md'],
        deps: {},
      };

      const result = ManifestSchema.safeParse(invalidManifest);
      expect(result.success).toBe(false);
    });
  });
});
