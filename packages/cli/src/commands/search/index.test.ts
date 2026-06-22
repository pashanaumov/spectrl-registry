import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { search } from './index.js';
import { CLIError, ExitCode } from '../../errors.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Set up MSW server for API mocking
const server = setupServer();

beforeAll(() => {
  // Set API_URL for tests
  process.env.API_URL = 'https://api.test.spectrl.dev';
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  mockConsoleLog.mockClear();
});

afterAll(() => {
  server.close();
  mockConsoleLog.mockRestore();
  process.env.API_URL = undefined;
});

describe('search command', () => {
  describe('successful searches', () => {
    it('should display search results in a formatted table', async () => {
      // Mock API to return valid search results
      server.use(
        http.get('https://api.test.spectrl.dev/search', ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');

          expect(query).toBe('api');

          return HttpResponse.json({
            results: [
              {
                specId: 'alice/api-spec',
                description: 'REST API specification template',
                tags: ['api', 'rest'],
                version: '2.1.0',
                publishedAt: '2024-12-08T00:00:00Z',
              },
              {
                specId: 'bob/graphql-api',
                description: 'GraphQL API design patterns',
                tags: ['api', 'graphql'],
                version: '1.5.2',
                publishedAt: '2024-11-15T00:00:00Z',
              },
            ],
            count: 2,
          });
        }),
      );

      await search('api');

      // Verify console output was called
      expect(mockConsoleLog).toHaveBeenCalled();

      // Verify the output contains expected text
      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Found 2 specs');
      expect(output).toContain('alice/api-spec');
      expect(output).toContain('bob/graphql-api');
      expect(output).toContain('REST API specification template');
      expect(output).toContain('GraphQL API design patterns');
      expect(output).toContain('api, rest');
      expect(output).toContain('api, graphql');
      expect(output).toContain('Install with: spectrl install <spec>');
    });

    it('should handle specs with missing optional fields', async () => {
      // Mock API to return results with missing description and tags
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [
              {
                specId: 'charlie/minimal-spec',
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
              },
            ],
            count: 1,
          });
        }),
      );

      await search('minimal');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Found 1 spec');
      expect(output).toContain('charlie/minimal-spec');
      expect(output).toContain('No description');
      expect(output).toContain('none');
    });

    it('should handle single search result correctly', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [
              {
                specId: 'alice/unique-spec',
                description: 'A unique specification',
                tags: ['unique'],
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
              },
            ],
            count: 1,
          });
        }),
      );

      await search('unique');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      // Should say "spec" not "specs" for singular
      expect(output).toContain('Found 1 spec');
      expect(output).not.toContain('Found 1 specs');
    });

    it('should trim whitespace from query', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');

          // Should be trimmed
          expect(query).toBe('test');

          return HttpResponse.json({
            results: [],
            count: 0,
          });
        }),
      );

      await search('  test  ');

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('empty results', () => {
    it('should display helpful message when no results found', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [],
            count: 0,
          });
        }),
      );

      await search('nonexistent');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('No specs found');
      expect(output).toContain('Try a different search term');
      expect(output).toContain('Example: spectrl search api');
    });
  });

  describe('validation', () => {
    it('should reject empty query string', async () => {
      await expect(search('')).rejects.toThrow(CLIError);
      await expect(search('')).rejects.toThrow('Search query cannot be empty');

      try {
        await search('');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should reject whitespace-only query', async () => {
      await expect(search('   ')).rejects.toThrow(CLIError);
      await expect(search('   ')).rejects.toThrow('Search query cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Use 404 instead of 500 to avoid retry logic timeout
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      await expect(search('test')).rejects.toThrow(CLIError);
      await expect(search('test')).rejects.toThrow('Search failed');
    });

    it('should handle network errors', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.error();
        }),
      );

      await expect(search('test')).rejects.toThrow(CLIError);
    });

    it('should handle invalid API response format', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          // Return invalid response that doesn't match schema
          return HttpResponse.json({
            invalid: 'response',
          });
        }),
      );

      await expect(search('test')).rejects.toThrow(CLIError);
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return new HttpResponse('not json', {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }),
      );

      await expect(search('test')).rejects.toThrow(CLIError);
    });
  });

  describe('edge cases', () => {
    it('should handle specs with empty tags array', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [
              {
                specId: 'alice/no-tags',
                description: 'Spec without tags',
                tags: [],
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
              },
            ],
            count: 1,
          });
        }),
      );

      await search('test');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('none');
    });

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(200);

      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [
              {
                specId: 'alice/long-desc',
                description: longDescription,
                tags: ['test'],
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
              },
            ],
            count: 1,
          });
        }),
      );

      // Should not throw - table should handle word wrapping
      await expect(search('test')).resolves.not.toThrow();
    });

    it('should handle many tags', async () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);

      server.use(
        http.get('https://api.test.spectrl.dev/search', () => {
          return HttpResponse.json({
            results: [
              {
                specId: 'alice/many-tags',
                description: 'Spec with many tags',
                tags: manyTags,
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
              },
            ],
            count: 1,
          });
        }),
      );

      await expect(search('test')).resolves.not.toThrow();

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('tag0');
    });

    it('should handle special characters in query', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/search', ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');

          // Should be properly URL encoded
          expect(query).toBe('test & special');

          return HttpResponse.json({
            results: [],
            count: 0,
          });
        }),
      );

      await search('test & special');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
