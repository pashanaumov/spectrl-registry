import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { install, installSingleSpec } from './index.js';

// Setup MSW server for mocking HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('download tracking integration', () => {
  let testDir: string;
  let originalCwd: string;
  let registryPath: string;
  let trackDownloadCalls: Array<{ username: string; specName: string; version: string }>;
  let originalApiUrl: string | undefined;

  beforeEach(async () => {
    // Save original working directory and API URL
    originalCwd = process.cwd();
    originalApiUrl = process.env.API_URL;

    // Set API URL for tests
    process.env.API_URL = 'https://test-api.spectrl.dev';

    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Set test registry path
    registryPath = join(testDir, '.spectrl', 'registry');

    // Change to test directory
    process.chdir(testDir);

    // Track download tracking calls
    trackDownloadCalls = [];

    // Mock the track-download endpoint
    server.use(
      http.post('*/track-download', async ({ request }) => {
        const body = (await request.json()) as {
          username: string;
          specName: string;
          version: string;
        };
        trackDownloadCalls.push(body);
        return HttpResponse.json({ success: true, downloads: 1 });
      }),
    );
  });

  afterEach(async () => {
    // Restore original working directory and API URL
    process.chdir(originalCwd);
    process.env.API_URL = originalApiUrl;

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('public registry installs', () => {
    it('should track download when installing from public registry', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Mock API responses for public registry install
      server.use(
        http.get('*/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/specs/:username/:name/:version/spectrl.json', ({ params }) => {
          return HttpResponse.json({
            name: params.name,
            version: params.version,
            files: ['README.md'],
            deps: {},
          });
        }),
        http.get('*/specs/:username/:name/:version/files/README.md', () => {
          return HttpResponse.text('# Test Spec');
        }),
      );

      // Install from public registry
      await installSingleSpec('testuser/test-spec', { cwd: testDir, registry: registryPath });

      // Verify tracking was called
      expect(trackDownloadCalls).toHaveLength(1);
      expect(trackDownloadCalls[0]).toEqual({
        username: 'testuser',
        specName: 'test-spec',
        version: '1.0.0',
      });
    });

    it('should NOT track download when spec is already cached', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Mock API responses
      server.use(
        http.get('*/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/specs/:username/:name/:version/spectrl.json', ({ params }) => {
          return HttpResponse.json({
            name: params.name,
            version: params.version,
            files: ['README.md'],
            deps: {},
          });
        }),
        http.get('*/specs/:username/:name/:version/files/README.md', () => {
          return HttpResponse.text('# Test Spec');
        }),
      );

      // First install - should track
      await installSingleSpec('testuser/cached-spec', { cwd: testDir, registry: registryPath });
      expect(trackDownloadCalls).toHaveLength(1);

      // Clear tracking calls
      trackDownloadCalls.length = 0;

      // Second install - should NOT track (already cached with matching hash)
      await installSingleSpec('testuser/cached-spec', { cwd: testDir, registry: registryPath });
      expect(trackDownloadCalls).toHaveLength(0);
    });

    it('should prevent duplicate tracking in same session', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Mock API responses
      server.use(
        http.get('*/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/specs/:username/:name/:version/spectrl.json', ({ params }) => {
          return HttpResponse.json({
            name: params.name,
            version: params.version,
            files: ['README.md'],
            deps: {},
          });
        }),
        http.get('*/specs/:username/:name/:version/files/README.md', () => {
          return HttpResponse.text('# Test Spec');
        }),
      );

      // Install spec
      await installSingleSpec('testuser/session-spec', { cwd: testDir, registry: registryPath });

      // Verify tracking was called once
      expect(trackDownloadCalls).toHaveLength(1);

      // Clear the cached files to force re-download
      const specPath = join(
        testDir,
        '.spectrl',
        'specs',
        'public',
        'testuser',
        'session-spec',
        '1.0.0',
      );
      await rm(specPath, { recursive: true, force: true });

      // Install again in same session - should NOT track again
      await installSingleSpec('testuser/session-spec', { cwd: testDir, registry: registryPath });

      // Should still be only 1 call (duplicate prevented)
      expect(trackDownloadCalls).toHaveLength(1);
    });

    it('should succeed even when tracking fails', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Mock tracking endpoint to fail
      server.use(
        http.post('*/track-download', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
        http.get('*/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/specs/:username/:name/:version/spectrl.json', ({ params }) => {
          return HttpResponse.json({
            name: params.name,
            version: params.version,
            files: ['README.md'],
            deps: {},
          });
        }),
        http.get('*/specs/:username/:name/:version/files/README.md', () => {
          return HttpResponse.text('# Test Spec');
        }),
      );

      // Install should succeed despite tracking failure
      await expect(
        installSingleSpec('testuser/fail-track', { cwd: testDir, registry: registryPath }),
      ).resolves.not.toThrow();
    });

    it('should succeed even when tracking times out', async () => {
      // Create .spectrl directory
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });

      // Mock tracking endpoint to delay (simulating timeout)
      server.use(
        http.post('*/track-download', async () => {
          // Delay longer than the 3-second timeout
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return HttpResponse.json({ success: true, downloads: 1 });
        }),
        http.get('*/specs/:username/:name', ({ params }) => {
          return HttpResponse.json({
            specId: `${params.username}/${params.name}`,
            username: params.username,
            specName: params.name,
            versions: [
              {
                version: '1.0.0',
                s3Path: `specs/${params.username}/${params.name}/1.0.0`,
                hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            ],
          });
        }),
        http.get('*/specs/:username/:name/:version/spectrl.json', ({ params }) => {
          return HttpResponse.json({
            name: params.name,
            version: params.version,
            files: ['README.md'],
            deps: {},
          });
        }),
        http.get('*/specs/:username/:name/:version/files/README.md', () => {
          return HttpResponse.text('# Test Spec');
        }),
      );

      // Install should succeed despite tracking timeout
      await expect(
        installSingleSpec('testuser/timeout-track', { cwd: testDir, registry: registryPath }),
      ).resolves.not.toThrow();
    });
  });

  describe('local installs', () => {
    it('should NOT track download for local installs', async () => {
      // Create .spectrl directory and index
      const spectrlDir = join(testDir, '.spectrl');
      await mkdir(spectrlDir, { recursive: true });
      const projectIndexPath = join(spectrlDir, 'spectrl-index.json');

      // Create a local spec
      const sourceDir = join(testDir, 'sources');
      await mkdir(sourceDir, { recursive: true });
      const specDir = join(sourceDir, 'local-spec-1.0.0');
      await mkdir(specDir, { recursive: true });

      // Create manifest
      const manifest = {
        name: 'local-spec',
        version: '1.0.0',
        files: ['README.md'],
        deps: {},
      };
      await writeFile(join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));
      await writeFile(join(specDir, 'README.md'), '# Local Spec');

      // Create index pointing to local spec
      const sourceUrl = pathToFileURL(specDir).href;
      const index = {
        'local-spec@1.0.0': {
          source: sourceUrl,
          hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
      };
      await writeFile(projectIndexPath, JSON.stringify(index, null, 2));

      // Install from local source
      await install({ cwd: testDir, registry: registryPath });

      // Verify tracking was NOT called
      expect(trackDownloadCalls).toHaveLength(0);
    });
  });
});
