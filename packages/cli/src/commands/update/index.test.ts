import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { update } from './index.js';
import { CLIError } from '../../errors.js';

// Set API_URL before importing
process.env.API_URL = 'https://test-api.example.com/prod';

// Setup MSW server for mocking HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('update command', () => {
  let testDir: string;
  let originalCwd: string;
  let indexPath: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Save original working directory
    originalCwd = process.cwd();

    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create .spectrl directory
    await mkdir(join(testDir, '.spectrl'), { recursive: true });

    // Set index path
    indexPath = join(testDir, '.spectrl', 'spectrl-index.json');

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();

    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create an index file
   */
  async function createIndex(
    entries: Record<string, { source: string; hash: string }>,
  ): Promise<void> {
    await writeFile(indexPath, JSON.stringify(entries, null, 2));
  }

  describe('validation', () => {
    it('should throw error when project not initialized', async () => {
      // Don't create index file
      await expect(update()).rejects.toThrow(CLIError);
      await expect(update()).rejects.toThrow('Project not initialized');
    });

    it('should throw error for local spec reference', async () => {
      await createIndex({});

      await expect(update('my-spec@1.0.0', { cwd: testDir })).rejects.toThrow(CLIError);
      await expect(update('my-spec@1.0.0', { cwd: testDir })).rejects.toThrow(
        'Update only works with public specs',
      );
    });
  });

  describe('no updates available', () => {
    it('should show message when no public specs installed', async () => {
      // Create index with only local specs
      await createIndex({
        'my-spec@1.0.0': {
          source: 'file:///local/path',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      await update(undefined, { cwd: testDir });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });

    it('should show message when all specs are up to date', async () => {
      // Create index with public spec
      await createIndex({
        'alice/my-spec@1.0.0': {
          source: 'https://registry.example.com/alice/my-spec/1.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      // Mock API to return same version
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/alice/my-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { cwd: testDir });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });
  });

  describe('updates available', () => {
    it('should show table of available updates', async () => {
      // Create index with public spec at older version
      await createIndex({
        'alice/my-spec@1.0.0': {
          source: 'https://registry.example.com/alice/my-spec/1.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      // Mock API to return newer version
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '2.0.0',
                s3Path: 'specs/alice/my-spec/2.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                publishedAt: '2024-02-01T00:00:00Z',
              },
              {
                version: '1.0.0',
                s3Path: 'specs/alice/my-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { cwd: testDir });

      // Verify table is shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Updates available'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('alice/my-spec'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1.0.0'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2.0.0'));
    });

    it('should handle multiple specs with updates', async () => {
      // Create index with multiple public specs
      await createIndex({
        'alice/spec-a@1.0.0': {
          source: 'https://registry.example.com/alice/spec-a/1.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
        'bob/spec-b@2.0.0': {
          source: 'https://registry.example.com/bob/spec-b/2.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
        },
      });

      // Mock API responses
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/spec-a', () => {
          return HttpResponse.json({
            specId: 'alice/spec-a',
            username: 'alice',
            specName: 'spec-a',
            versions: [
              {
                version: '1.5.0',
                s3Path: 'specs/alice/spec-a/1.5.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
                publishedAt: '2024-02-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('https://test-api.example.com/prod/specs/bob/spec-b', () => {
          return HttpResponse.json({
            specId: 'bob/spec-b',
            username: 'bob',
            specName: 'spec-b',
            versions: [
              {
                version: '3.0.0',
                s3Path: 'specs/bob/spec-b/3.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000004',
                publishedAt: '2024-02-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { cwd: testDir });

      // Verify both specs are shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('alice/spec-a'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('bob/spec-b'));
    });
  });

  describe('version comparison', () => {
    it('should correctly compare semantic versions', async () => {
      // Create index with spec at 1.0.0
      await createIndex({
        'alice/my-spec@1.0.0': {
          source: 'https://registry.example.com/alice/my-spec/1.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      // Mock API to return 1.0.1 (patch update)
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '1.0.1',
                s3Path: 'specs/alice/my-spec/1.0.1',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                publishedAt: '2024-02-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { cwd: testDir });

      // Verify update is detected
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Updates available'));
    });

    it('should not show update when current version is latest', async () => {
      // Create index with spec at 2.0.0
      await createIndex({
        'alice/my-spec@2.0.0': {
          source: 'https://registry.example.com/alice/my-spec/2.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      // Mock API to return 1.0.0 (older version)
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/alice/my-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { cwd: testDir });

      // Verify no updates shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });
  });

  describe('update specific spec', () => {
    it('should throw error when spec not found', async () => {
      await createIndex({});

      // Mock API to return 404
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      await expect(update('alice/my-spec', { cwd: testDir })).rejects.toThrow(CLIError);
      await expect(update('alice/my-spec', { cwd: testDir })).rejects.toThrow('not found');
    });

    it('should throw error when no versions available', async () => {
      await createIndex({});

      // Mock API to return empty versions array
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [],
          });
        }),
      );

      await expect(update('alice/my-spec', { cwd: testDir })).rejects.toThrow(CLIError);
      await expect(update('alice/my-spec', { cwd: testDir })).rejects.toThrow(
        'No versions available',
      );
    });
  });

  describe('--all flag', () => {
    it('should skip update when no updates available', async () => {
      // Create index with spec at latest version
      await createIndex({
        'alice/my-spec@1.0.0': {
          source: 'https://registry.example.com/alice/my-spec/1.0.0/spectrl.json',
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
        },
      });

      // Mock API to return same version
      server.use(
        http.get('https://test-api.example.com/prod/specs/alice/my-spec', () => {
          return HttpResponse.json({
            specId: 'alice/my-spec',
            username: 'alice',
            specName: 'my-spec',
            versions: [
              {
                version: '1.0.0',
                s3Path: 'specs/alice/my-spec/1.0.0',
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
      );

      await update(undefined, { all: true, cwd: testDir });

      // Verify no updates message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });
  });
});
