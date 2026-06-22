import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { searchSpecs } from './api-client';
import { ApiError } from './schemas';

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'https://api.test.com';

// Setup MSW server for HTTP mocking
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('searchSpecs', () => {
  it('should validate and return search results with pagination', async () => {
    server.use(
      http.get('https://api.test.com/search', () => {
        return HttpResponse.json({
          results: [
            {
              specId: 'user/spec',
              version: '1.0.0',
              username: 'user',
              specName: 'spec',
              description: 'Test spec',
              tags: ['test'],
              publishedAt: '2024-01-01T00:00:00Z',
            },
          ],
          count: 1,
          nextToken: 'eyJzcGVjSWQiOiJ0ZXN0In0=',
          hasMore: true,
        });
      }),
    );

    const result = await searchSpecs('test');

    expect(result.results).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.nextToken).toBe('eyJzcGVjSWQiOiJ0ZXN0In0=');
    expect(result.hasMore).toBe(true);
  });

  it('should pass nextToken and limit parameters to API', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('https://api.test.com/search', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          results: [],
          count: 0,
          hasMore: false,
        });
      }),
    );

    await searchSpecs('api', { nextToken: 'token123', limit: 50 });

    expect(capturedUrl?.searchParams.get('q')).toBe('api');
    expect(capturedUrl?.searchParams.get('nextToken')).toBe('token123');
    expect(capturedUrl?.searchParams.get('limit')).toBe('50');
  });

  it('should reject invalid API response', async () => {
    server.use(
      http.get('https://api.test.com/search', () => {
        return HttpResponse.json({
          invalid: 'data',
        });
      }),
    );

    await expect(searchSpecs('test')).rejects.toThrow('Invalid search API response');
  });

  it('should handle API errors', async () => {
    server.use(
      http.get('https://api.test.com/search', () => {
        return HttpResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
      }),
    );

    await expect(searchSpecs('test')).rejects.toThrow(ApiError);
  });

  it('should handle response without pagination fields', async () => {
    server.use(
      http.get('https://api.test.com/search', () => {
        return HttpResponse.json({
          results: [],
          count: 0,
          hasMore: false,
        });
      }),
    );

    const result = await searchSpecs('test');

    expect(result.results).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.nextToken).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });
});
