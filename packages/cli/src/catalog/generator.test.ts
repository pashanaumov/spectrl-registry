import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateCatalogMarkdown } from './generator.js';
import type { CatalogEntry } from './generator.js';

// Arbitrary generators
const nameArb = fc.stringMatching(/^[a-z0-9-]+$/).filter((s) => s.length > 0 && s.length <= 50);

const versionArb = fc
  .tuple(fc.nat(9), fc.nat(9), fc.nat(9))
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

const typeArb = fc.constantFrom('spec' as const, 'power' as const);

// A catalog entry with all fields present
const fullEntryArb: fc.Arbitrary<CatalogEntry> = fc.record({
  name: nameArb,
  version: versionArb,
  type: typeArb,
  description: fc.string({ minLength: 1, maxLength: 80 }),
  purpose: fc.string({ minLength: 1, maxLength: 80 }),
});

// A catalog entry where description and/or purpose may be empty
const sparseEntryArb: fc.Arbitrary<CatalogEntry> = fc.record({
  name: nameArb,
  version: versionArb,
  type: typeArb,
  description: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 80 })),
  purpose: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 80 })),
});

describe('generateCatalogMarkdown', () => {
  describe('Property 6: Catalog content correctness', () => {
    // Feature: specs-and-powers, Property 6: Catalog content correctness
    // Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

    it('should contain the correct name, version, and type for each entry', () => {
      fc.assert(
        fc.property(fc.array(fullEntryArb, { minLength: 1, maxLength: 10 }), (entries) => {
          const markdown = generateCatalogMarkdown(entries);

          for (const entry of entries) {
            expect(markdown).toContain(entry.name);
            expect(markdown).toContain(entry.version);
            expect(markdown).toContain(entry.type);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should use agent.purpose as "When to Use" when available (non-empty)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: nameArb,
              version: versionArb,
              type: typeArb,
              description: fc.string({ minLength: 1, maxLength: 80 }),
              // purpose is always non-empty here
              purpose: fc.string({ minLength: 1, maxLength: 80 }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          (entries) => {
            const markdown = generateCatalogMarkdown(entries);

            for (const entry of entries) {
              // The purpose value should appear in the markdown
              expect(markdown).toContain(entry.purpose);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use description as fallback when purpose is empty', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: nameArb,
              version: versionArb,
              type: typeArb,
              description: fc.string({ minLength: 1, maxLength: 80 }),
              purpose: fc.constant(''), // empty purpose → fallback to description
            }),
            { minLength: 1, maxLength: 5 },
          ),
          (entries) => {
            const markdown = generateCatalogMarkdown(entries);

            for (const entry of entries) {
              // description should appear in the markdown (used as fallback)
              expect(markdown).toContain(entry.description);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should display empty value when both description and purpose are empty', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: nameArb,
              version: versionArb,
              type: typeArb,
              description: fc.constant(''),
              purpose: fc.constant(''),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          (entries) => {
            const markdown = generateCatalogMarkdown(entries);

            // Markdown should still be generated without errors
            expect(markdown).toContain('# Spectrl Catalog');
            // Each entry name should still appear
            for (const entry of entries) {
              expect(markdown).toContain(entry.name);
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should label each entry as "spec" or "power" in the type column', () => {
      fc.assert(
        fc.property(fc.array(sparseEntryArb, { minLength: 1, maxLength: 10 }), (entries) => {
          const markdown = generateCatalogMarkdown(entries);

          for (const entry of entries) {
            // Each entry's type must appear in the output
            expect(markdown).toContain(entry.type);
          }

          // The markdown must contain the Type column header
          expect(markdown).toContain('Type');
        }),
        { numRuns: 100 },
      );
    });

    it('should include the auto-generated header comment', () => {
      fc.assert(
        fc.property(fc.array(sparseEntryArb, { maxLength: 5 }), (entries) => {
          const markdown = generateCatalogMarkdown(entries);
          expect(markdown).toContain('<!-- Auto-generated by Spectrl. Do not edit manually. -->');
          expect(markdown).toContain('# Spectrl Catalog');
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Unit tests', () => {
    it('should produce correct markdown for a single spec entry', () => {
      const entries: CatalogEntry[] = [
        {
          name: 'api-design',
          version: '1.0.0',
          type: 'spec',
          description: 'API design conventions',
          purpose: 'Consult when designing REST APIs',
        },
      ];

      const markdown = generateCatalogMarkdown(entries);

      expect(markdown).toContain('api-design');
      expect(markdown).toContain('1.0.0');
      expect(markdown).toContain('spec');
      expect(markdown).toContain('API design conventions');
      expect(markdown).toContain('Consult when designing REST APIs');
    });

    it('should produce correct markdown for a power entry', () => {
      const entries: CatalogEntry[] = [
        {
          name: 'code-review',
          version: '2.0.0',
          type: 'power',
          description: 'Code review checklist',
          purpose: 'Follow during code reviews',
        },
      ];

      const markdown = generateCatalogMarkdown(entries);

      expect(markdown).toContain('code-review');
      expect(markdown).toContain('2.0.0');
      expect(markdown).toContain('power');
      expect(markdown).toContain('Code review checklist');
      expect(markdown).toContain('Follow during code reviews');
    });

    it('should produce a valid markdown table with header and separator rows', () => {
      const entries: CatalogEntry[] = [
        { name: 'my-spec', version: '1.0.0', type: 'spec', description: 'desc', purpose: 'use' },
      ];

      const markdown = generateCatalogMarkdown(entries);
      const lines = markdown.split('\n').filter((l) => l.startsWith('|'));

      // Header row, separator row, data row
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('Name');
      expect(lines[0]).toContain('Version');
      expect(lines[0]).toContain('Type');
      expect(lines[0]).toContain('Description');
      expect(lines[0]).toContain('When to Use');
      // Separator row contains only dashes and pipes
      expect(lines[1]).toMatch(/^[\|\s\-]+$/);
    });

    it('should handle empty entries array', () => {
      const markdown = generateCatalogMarkdown([]);
      expect(markdown).toContain('# Spectrl Catalog');
      expect(markdown).toContain('Name');
    });
  });
});
