import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { info } from './index.js';
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

describe('info command', () => {
  describe('successful info display', () => {
    it('should display spec information with all versions', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return HttpResponse.json({
            specId: 'alice/api-spec',
            username: 'alice',
            specName: 'api-spec',
            versions: [
              {
                version: '2.1.0',
                description: 'REST API specification template',
                tags: ['api', 'rest', 'openapi'],
                publishedAt: '2024-12-08T00:00:00Z',
                s3Path: 'specs/alice/api-spec/2.1.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                downloads: 145,
              },
              {
                version: '2.0.0',
                description: 'REST API specification template',
                tags: ['api', 'rest'],
                publishedAt: '2024-11-15T00:00:00Z',
                s3Path: 'specs/alice/api-spec/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                downloads: 89,
              },
              {
                version: '1.5.0',
                publishedAt: '2024-10-01T00:00:00Z',
                s3Path: 'specs/alice/api-spec/1.5.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
                downloads: 234,
              },
            ],
          });
        }),
      );

      await info('alice/api-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Check header
      expect(output).toContain('alice/api-spec');

      // Check description
      expect(output).toContain('REST API specification template');

      // Check tags
      expect(output).toContain('Tags: api, rest, openapi');

      // Check versions
      expect(output).toContain('2.1.0');
      expect(output).toContain('2.0.0');
      expect(output).toContain('1.5.0');

      // Check downloads
      expect(output).toContain('145');
      expect(output).toContain('89');
      expect(output).toContain('234');

      // Check install instructions
      expect(output).toContain('Install latest: spectrl install alice/api-spec');
      expect(output).toContain('Install specific: spectrl install alice/api-spec@<version>');
    });

    it('should handle spec with missing optional fields', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/bob/minimal-spec', () => {
          return HttpResponse.json({
            specId: 'bob/minimal-spec',
            username: 'bob',
            specName: 'minimal-spec',
            versions: [
              {
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/bob/minimal-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      await info('bob/minimal-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      expect(output).toContain('bob/minimal-spec');
      expect(output).toContain('1.0.0');
      expect(output).toContain('0'); // Default downloads
      expect(output).not.toContain('Tags:'); // No tags section
    });

    it('should handle spec with no versions', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/charlie/empty-spec', () => {
          return HttpResponse.json({
            specId: 'charlie/empty-spec',
            username: 'charlie',
            specName: 'empty-spec',
            versions: [],
          });
        }),
      );

      await info('charlie/empty-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      expect(output).toContain('charlie/empty-spec');
      expect(output).toContain('No versions available');
    });

    it('should ignore version in spec reference', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return HttpResponse.json({
            specId: 'alice/api-spec',
            username: 'alice',
            specName: 'api-spec',
            versions: [
              {
                version: '2.1.0',
                publishedAt: '2024-12-08T00:00:00Z',
                s3Path: 'specs/alice/api-spec/2.1.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      // Version in reference should be ignored
      await info('alice/api-spec@1.0.0');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('alice/api-spec');
    });
  });

  describe('validation', () => {
    it('should reject local spec reference (no username)', async () => {
      await expect(info('my-spec')).rejects.toThrow(CLIError);
      await expect(info('my-spec')).rejects.toThrow(
        'Info command requires a public spec reference',
      );

      try {
        await info('my-spec');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should reject empty spec reference', async () => {
      await expect(info('')).rejects.toThrow(CLIError);
      await expect(info('')).rejects.toThrow('Invalid spec reference');
    });

    it('should reject invalid spec reference format', async () => {
      await expect(info('invalid/spec/format')).rejects.toThrow(CLIError);
      await expect(info('invalid/spec/format')).rejects.toThrow('Invalid spec reference');
    });

    it('should reject spec reference with invalid username', async () => {
      await expect(info('UPPERCASE/spec')).rejects.toThrow(CLIError);
      await expect(info('UPPERCASE/spec')).rejects.toThrow('Invalid spec reference');
    });

    it('should reject spec reference with invalid spec name', async () => {
      await expect(info('alice/INVALID_NAME')).rejects.toThrow(CLIError);
      await expect(info('alice/INVALID_NAME')).rejects.toThrow('Invalid spec reference');
    });
  });

  describe('error handling', () => {
    it('should handle spec not found (404)', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/nonexistent', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      await expect(info('alice/nonexistent')).rejects.toThrow(CLIError);
      await expect(info('alice/nonexistent')).rejects.toThrow('Spec not found: alice/nonexistent');

      try {
        await info('alice/nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
      }
    });

    it('should handle network errors', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return HttpResponse.error();
        }),
      );

      await expect(info('alice/api-spec')).rejects.toThrow(CLIError);
    });

    it('should handle invalid API response format', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return HttpResponse.json({
            invalid: 'response',
          });
        }),
      );

      await expect(info('alice/api-spec')).rejects.toThrow(CLIError);
    });

    it('should handle malformed JSON response', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return new HttpResponse('not json', {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }),
      );

      await expect(info('alice/api-spec')).rejects.toThrow(CLIError);
    });
  });

  describe('date formatting', () => {
    it('should format dates with relative time', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/api-spec', () => {
          return HttpResponse.json({
            specId: 'alice/api-spec',
            username: 'alice',
            specName: 'api-spec',
            versions: [
              {
                version: '1.0.0',
                publishedAt: recentDate.toISOString(),
                s3Path: 'specs/alice/api-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      await info('alice/api-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Should contain relative time
      expect(output).toMatch(/\d+ days? ago/);
    });
  });

  describe('download count formatting', () => {
    it('should format download counts with thousand separators', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/popular-spec', () => {
          return HttpResponse.json({
            specId: 'alice/popular-spec',
            username: 'alice',
            specName: 'popular-spec',
            versions: [
              {
                version: '3.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/popular-spec/3.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                downloads: 1234567,
              },
              {
                version: '2.0.0',
                publishedAt: '2024-11-01T00:00:00Z',
                s3Path: 'specs/alice/popular-spec/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                downloads: 12345,
              },
              {
                version: '1.0.0',
                publishedAt: '2024-10-01T00:00:00Z',
                s3Path: 'specs/alice/popular-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
                downloads: 999,
              },
            ],
          });
        }),
      );

      await info('alice/popular-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Check formatted numbers with thousand separators
      expect(output).toContain('1,234,567');
      expect(output).toContain('12,345');
      expect(output).toContain('999'); // No separator needed for < 1000
    });

    it('should display "0" for specs with zero downloads', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/new-spec', () => {
          return HttpResponse.json({
            specId: 'alice/new-spec',
            username: 'alice',
            specName: 'new-spec',
            versions: [
              {
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/new-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                downloads: 0,
              },
            ],
          });
        }),
      );

      await info('alice/new-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Should display "0" for zero downloads
      expect(output).toContain('0');
    });

    it('should handle missing downloads field (backwards compatibility)', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/legacy-spec', () => {
          return HttpResponse.json({
            specId: 'alice/legacy-spec',
            username: 'alice',
            specName: 'legacy-spec',
            versions: [
              {
                version: '1.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/legacy-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                // downloads field is missing
              },
            ],
          });
        }),
      );

      await info('alice/legacy-spec');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Should default to "0" when downloads field is missing
      expect(output).toContain('0');
    });

    it('should format various download count ranges correctly', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/range-test', () => {
          return HttpResponse.json({
            specId: 'alice/range-test',
            username: 'alice',
            specName: 'range-test',
            versions: [
              {
                version: '7.0.0',
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/7.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                downloads: 1,
              },
              {
                version: '6.0.0',
                publishedAt: '2024-11-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/6.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                downloads: 42,
              },
              {
                version: '5.0.0',
                publishedAt: '2024-10-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/5.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
                downloads: 1000,
              },
              {
                version: '4.0.0',
                publishedAt: '2024-09-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/4.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000004',
                downloads: 10000,
              },
              {
                version: '3.0.0',
                publishedAt: '2024-08-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/3.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000005',
                downloads: 100000,
              },
              {
                version: '2.0.0',
                publishedAt: '2024-07-01T00:00:00Z',
                s3Path: 'specs/alice/range-test/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000006',
                downloads: 1000000,
              },
            ],
          });
        }),
      );

      await info('alice/range-test');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Check various formatted ranges
      expect(output).toContain('1,000,000'); // 1 million
      expect(output).toContain('100,000'); // 100k
      expect(output).toContain('10,000'); // 10k
      expect(output).toContain('1,000'); // 1k
      expect(output).toContain('42'); // No separator
      expect(output).toContain('1'); // Single digit
    });
  });

  describe('edge cases', () => {
    it('should handle spec with empty tags array', async () => {
      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/no-tags', () => {
          return HttpResponse.json({
            specId: 'alice/no-tags',
            username: 'alice',
            specName: 'no-tags',
            versions: [
              {
                version: '1.0.0',
                description: 'Spec without tags',
                tags: [],
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/no-tags/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      await info('alice/no-tags');

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');

      // Should not show tags section for empty array
      expect(output).not.toContain('Tags:');
    });

    it('should handle many versions', async () => {
      const versions = Array.from({ length: 50 }, (_, i) => ({
        version: `1.${i}.0`,
        publishedAt: '2024-12-01T00:00:00Z',
        s3Path: `specs/alice/many-versions/1.${i}.0`,
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        downloads: i * 10,
      }));

      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/many-versions', () => {
          return HttpResponse.json({
            specId: 'alice/many-versions',
            username: 'alice',
            specName: 'many-versions',
            versions,
          });
        }),
      );

      // Should not throw with many versions
      await expect(info('alice/many-versions')).resolves.not.toThrow();
    });

    it('should handle very long description', async () => {
      const longDescription = 'A'.repeat(500);

      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/long-desc', () => {
          return HttpResponse.json({
            specId: 'alice/long-desc',
            username: 'alice',
            specName: 'long-desc',
            versions: [
              {
                version: '1.0.0',
                description: longDescription,
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/long-desc/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      await expect(info('alice/long-desc')).resolves.not.toThrow();
    });

    it('should handle many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);

      server.use(
        http.get('https://api.test.spectrl.dev/specs/alice/many-tags', () => {
          return HttpResponse.json({
            specId: 'alice/many-tags',
            username: 'alice',
            specName: 'many-tags',
            versions: [
              {
                version: '1.0.0',
                tags: manyTags,
                publishedAt: '2024-12-01T00:00:00Z',
                s3Path: 'specs/alice/many-tags/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
              },
            ],
          });
        }),
      );

      await expect(info('alice/many-tags')).resolves.not.toThrow();

      const output = mockConsoleLog.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('tag0');
    });
  });
});
