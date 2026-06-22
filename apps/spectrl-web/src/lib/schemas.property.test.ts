import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SearchResultSchema,
  SearchResponseSchema,
  SpecVersionSchema,
  GetSpecResponseSchema,
  ApiErrorResponseSchema,
} from './schemas';

/**
 * Property-based tests for Zod schema validation
 * Validates: Requirements 2.6
 */

// --- Arbitraries ---

/** Generate a valid sha256 hash string */
const hexCharArb = fc.constantFrom(...'0123456789abcdef'.split(''));
const sha256HashArb = fc
  .array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map((chars) => `sha256:${chars.join('')}`);

/** Generate a valid SearchResult object */
const searchResultArb = fc.record({
  specId: fc.string({ minLength: 1 }),
  version: fc.string({ minLength: 1 }),
  username: fc.string({ minLength: 1 }),
  specName: fc.string({ minLength: 1 }),
  description: fc.string(),
  type: fc.constantFrom('spec', 'power') as fc.Arbitrary<'spec' | 'power'>,
  tags: fc.array(fc.string()),
  publishedAt: fc.string({ minLength: 1 }),
});

/** Generate a valid SearchResponse object */
const searchResponseArb = fc.record({
  results: fc.array(searchResultArb),
  count: fc.nat(),
  nextToken: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  hasMore: fc.option(fc.boolean(), { nil: undefined }),
});

/** Generate a valid SpecVersion object */
const specVersionArb = fc.record({
  version: fc.string({ minLength: 1 }),
  description: fc.string(),
  tags: fc.option(fc.array(fc.string()), { nil: undefined }),
  publishedAt: fc.string({ minLength: 1 }),
  s3Path: fc.string({ minLength: 1 }),
  hash: sha256HashArb,
  files: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
  downloads: fc.option(fc.nat(), { nil: undefined }),
});

/** Generate a valid GetSpecResponse object */
const getSpecResponseArb = fc.record({
  specId: fc.string({ minLength: 1 }),
  username: fc.string({ minLength: 1 }),
  specName: fc.string({ minLength: 1 }),
  versions: fc.array(specVersionArb),
});

/** Generate a valid ApiErrorResponse object */
const apiErrorResponseArb = fc.record({
  error: fc.string(),
});

// --- Property 1: Schema validation accepts valid objects ---

describe('Property 1: Schema validation accepts valid objects', () => {
  // Feature: website-migration, Property 1: Schema validation accepts valid objects
  // **Validates: Requirements 2.6**

  it('SearchResultSchema accepts valid SearchResult objects', () => {
    fc.assert(
      fc.property(searchResultArb, (result) => {
        const parsed = SearchResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data).toEqual(result);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('SearchResponseSchema accepts valid SearchResponse objects', () => {
    fc.assert(
      fc.property(searchResponseArb, (response) => {
        const parsed = SearchResponseSchema.safeParse(response);
        expect(parsed.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('SpecVersionSchema accepts valid SpecVersion objects', () => {
    fc.assert(
      fc.property(specVersionArb, (version) => {
        const parsed = SpecVersionSchema.safeParse(version);
        expect(parsed.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('GetSpecResponseSchema accepts valid GetSpecResponse objects', () => {
    fc.assert(
      fc.property(getSpecResponseArb, (response) => {
        const parsed = GetSpecResponseSchema.safeParse(response);
        expect(parsed.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('ApiErrorResponseSchema accepts valid ApiErrorResponse objects', () => {
    fc.assert(
      fc.property(apiErrorResponseArb, (response) => {
        const parsed = ApiErrorResponseSchema.safeParse(response);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data).toEqual(response);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 2: Schema validation rejects objects with missing required fields ---

describe('Property 2: Schema validation rejects objects with missing required fields', () => {
  // Feature: website-migration, Property 2: Schema validation rejects objects with missing required fields
  // **Validates: Requirements 2.6**

  /** Helper: remove one or more random keys from an object */
  function removeRandomKeysArb(requiredKeys: string[]) {
    return fc.subarray(requiredKeys, { minLength: 1 }).map((keysToRemove) => new Set(keysToRemove));
  }

  const searchResultRequiredKeys = [
    'specId',
    'version',
    'username',
    'specName',
    'description',
    'tags',
    'publishedAt',
  ];

  it('SearchResultSchema rejects objects with missing required fields', () => {
    fc.assert(
      fc.property(
        searchResultArb,
        removeRandomKeysArb(searchResultRequiredKeys),
        (result, keysToRemove) => {
          const incomplete = { ...result };
          for (const key of keysToRemove) {
            delete (incomplete as Record<string, unknown>)[key];
          }
          const parsed = SearchResultSchema.safeParse(incomplete);
          expect(parsed.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  const searchResponseRequiredKeys = ['results', 'count'];

  it('SearchResponseSchema rejects objects with missing required fields', () => {
    fc.assert(
      fc.property(
        searchResponseArb,
        removeRandomKeysArb(searchResponseRequiredKeys),
        (response, keysToRemove) => {
          const incomplete = { ...response };
          for (const key of keysToRemove) {
            delete (incomplete as Record<string, unknown>)[key];
          }
          const parsed = SearchResponseSchema.safeParse(incomplete);
          expect(parsed.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  const specVersionRequiredKeys = [
    'version',
    'description',
    'publishedAt',
    's3Path',
    'hash',
    'files',
  ];

  it('SpecVersionSchema rejects objects with missing required fields', () => {
    fc.assert(
      fc.property(
        specVersionArb,
        removeRandomKeysArb(specVersionRequiredKeys),
        (version, keysToRemove) => {
          const incomplete = { ...version };
          for (const key of keysToRemove) {
            delete (incomplete as Record<string, unknown>)[key];
          }
          const parsed = SpecVersionSchema.safeParse(incomplete);
          expect(parsed.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  const getSpecResponseRequiredKeys = ['specId', 'username', 'specName', 'versions'];

  it('GetSpecResponseSchema rejects objects with missing required fields', () => {
    fc.assert(
      fc.property(
        getSpecResponseArb,
        removeRandomKeysArb(getSpecResponseRequiredKeys),
        (response, keysToRemove) => {
          const incomplete = { ...response };
          for (const key of keysToRemove) {
            delete (incomplete as Record<string, unknown>)[key];
          }
          const parsed = GetSpecResponseSchema.safeParse(incomplete);
          expect(parsed.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
