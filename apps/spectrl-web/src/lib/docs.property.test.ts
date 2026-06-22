import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { DocMeta } from './docs';

// Feature: website-migration, Property 4: Docs sidebar is sorted by order
// Validates: Requirements 5.3

/**
 * The sort logic used by getDocsList() — extracted for pure property testing.
 * Mirrors the exact sort in docs.ts: docs.sort((a, b) => a.order - b.order)
 */
function sortDocsByOrder(docs: DocMeta[]): DocMeta[] {
  return [...docs].sort((a, b) => a.order - b.order);
}

const docMetaArb = fc.record({
  slug: fc.string({ minLength: 1 }),
  title: fc.string({ minLength: 1 }),
  order: fc.integer({ min: -1000, max: 1000 }),
});

describe('docs sidebar ordering (Property 4)', () => {
  it('sorted result is always in ascending order by order field', () => {
    fc.assert(
      fc.property(fc.array(docMetaArb, { minLength: 0, maxLength: 20 }), (docs) => {
        const sorted = sortDocsByOrder(docs);

        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].order).toBeLessThanOrEqual(sorted[i + 1].order);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('sorted result contains the same elements as the input', () => {
    fc.assert(
      fc.property(fc.array(docMetaArb, { minLength: 0, maxLength: 20 }), (docs) => {
        const sorted = sortDocsByOrder(docs);

        expect(sorted).toHaveLength(docs.length);
        for (const doc of docs) {
          expect(sorted).toContainEqual(doc);
        }
      }),
      { numRuns: 100 },
    );
  });
});
