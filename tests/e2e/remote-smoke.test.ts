/**
 * Remote E2E smoke tests — run against api.spectrl.pro
 *
 * Usage:
 *   API_URL=https://api.spectrl.pro pnpm test:remote
 *   API_URL=https://api.spectrl.pro SPECTRL_TOKEN=<github_token> pnpm test:remote
 *
 * Tests without SPECTRL_TOKEN: search, get-spec (read-only endpoints)
 * Tests with SPECTRL_TOKEN: publish, install from remote, unpublish
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { join } from 'node:path';
import { createTempDir, exists, readJSON } from './utils/index.js';
import { runCLI } from './utils/cli.js';

const API_URL = process.env.API_URL || 'https://api.spectrl.pro';
const TOKEN = process.env.SPECTRL_TOKEN;
const TEST_USERNAME = process.env.SPECTRL_USERNAME || 'pashanaumov';

// Helper: run CLI with remote API
function remoteCLI(args: string[], cwd?: string) {
  return runCLI(args, { cwd, env: { API_URL } });
}

describe(`Remote E2E — ${API_URL}`, () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  // ── Read-only tests (no auth required) ──────────────────────────────────

  it('GET /search — returns valid response', async () => {
    const result = await remoteCLI(['search', 'test']);
    // Either finds results or shows "no results" — either way exits 0
    expect(result.exitCode).toBe(0);
  });

  it('GET /specs/:username/:name — 404 for unknown spec', async () => {
    const result = await remoteCLI(['info', `${TEST_USERNAME}/this-spec-does-not-exist-xyz`]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/not found|404|error/i);
  });

  // ── Auth-required tests (skipped without token) ──────────────────────────

  it.skipIf(!TOKEN)('publish → search → install → unpublish full cycle', async () => {
    const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
    cleanup = cleanupFn;

    const specName = `e2e-smoke-${Date.now()}`;
    const version = '1.0.0';
    const specDir = join(tmpDir, specName);

    // 1. Create a spec
    const newResult = await remoteCLI(
      ['new', specName, '--version', version, '--description', 'e2e smoke test spec'],
      tmpDir,
    );
    expect(newResult.exitCode).toBe(0);

    // Write a file
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      join(specDir, 'index.md'),
      '# E2E Smoke Test\n\nThis spec was created by automated tests.\n',
    );

    // Update manifest to include the file and description (required for remote publish)
    const { writeText } = await import('./utils/fs-helpers.js');
    await writeText(
      join(specDir, 'spectrl.jsonc'),
      JSON.stringify(
        {
          name: specName,
          version,
          description: 'e2e smoke test spec',
          files: ['index.md'],
          deps: {},
        },
        null,
        2,
      ),
    );

    // 2. Publish to remote (select "Public registry" option)
    const publishResult = await runCLI(['publish'], {
      cwd: specDir,
      env: { API_URL, SPECTRL_TOKEN: TOKEN },
      input: '\x1B[B\n', // arrow down + enter = select "Public registry"
    });
    expect(publishResult.exitCode).toBe(0);
    expect(publishResult.stdout).toContain('Published');

    // 3. Search for it
    const searchResult = await remoteCLI(['search', specName]);
    expect(searchResult.exitCode).toBe(0);
    expect(searchResult.stdout).toContain(specName);

    // 4. Get spec info
    const infoResult = await remoteCLI(['info', `${TEST_USERNAME}/${specName}`]);
    expect(infoResult.exitCode).toBe(0);
    expect(infoResult.stdout).toContain(version);

    // 5. Install from remote in a fresh project
    const { path: installDir, cleanup: installCleanup } = await createTempDir();
    const prevCleanup = cleanup;
    cleanup = async () => {
      await prevCleanup();
      await installCleanup();
    };

    const installResult = await remoteCLI(['install', `${TEST_USERNAME}/${specName}`], installDir);
    expect(installResult.exitCode).toBe(0);

    // Verify installed (remote specs use username-specname@version path format)
    const specPath = join(installDir, `.spectrl/specs/${TEST_USERNAME}-${specName}@${version}`);
    expect(await exists(specPath)).toBe(true);

    // 6. Unpublish
    const unpublishResult = await runCLI(['unpublish', `${TEST_USERNAME}/${specName}@${version}`], {
      cwd: tmpDir,
      env: { API_URL, SPECTRL_TOKEN: TOKEN },
      input: 'yes\n',
    });
    expect(unpublishResult.exitCode).toBe(0);

    // 7. Verify gone
    const afterUnpublish = await remoteCLI(['info', `${TEST_USERNAME}/${specName}`]);
    expect(afterUnpublish.exitCode).not.toBe(0);
  });
});
