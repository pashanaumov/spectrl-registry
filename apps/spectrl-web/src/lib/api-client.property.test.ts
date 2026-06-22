import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import fc from 'fast-check';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { searchSpecs, getSpec } from './api-client';
import { ApiError, SearchResponseSchema, GetSpecResponseSchema } from './schemas';

/**
 * Property-based tests for API client invalid response rejection
 *
 * Feature: website-migration, Property 3: API client rejects invalid responses
 * **Validates: Requirements 2.1, 2.2, 2.4**
 */

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'https://api.test.com';
process.env.NEXT_PUBLIC_CDN_URL = 'https://cdn.test.com';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Arbitrary that generates JSON-serializable values which do NOT conform to the expected schemas.
 * We use fc.jsonValue() to ensure the value is valid JSON (no undefined, no functions, etc.)
 * and filter out values that would accidentally pass validation.
 */
const invalidSearchResponseArb = fc.jsonValue().filter((value) => {
  return !SearchResponseSchema.safeParse(value).success;
});

const invalidGetSpecResponseArb = fc.jsonValue().filter((value) => {
  return !GetSpecResponseSchema.safeParse(value).success;
});

describe('Property 3: API client rejects invalid responses', () => {
  // Feature: website-migration, Property 3: API client rejects invalid responses
  // **Validates: Requirements 2.1, 2.2, 2.4**

  it('searchSpecs throws ApiError for any invalid response body', async () => {
    await fc.assert(
      fc.asyncProperty(invalidSearchResponseArb, async (invalidData) => {
        server.use(
          http.get('https://api.test.com/search', () => {
            return HttpResponse.json(invalidData);
          }),
        );

        try {
          await searchSpecs('test');
          // If we get here, the function didn't throw — that's a failure
          expect.unreachable('searchSpecs should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).message).toContain('Invalid search API response');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('getSpec throws ApiError for any invalid response body', async () => {
    await fc.assert(
      fc.asyncProperty(invalidGetSpecResponseArb, async (invalidData) => {
        server.use(
          http.get('https://api.test.com/specs/:username/:spec', () => {
            return HttpResponse.json(invalidData);
          }),
        );

        try {
          await getSpec('testuser', 'testspec');
          expect.unreachable('getSpec should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).message).toContain('Invalid get spec API response');
        }
      }),
      { numRuns: 100 },
    );
  });
});
