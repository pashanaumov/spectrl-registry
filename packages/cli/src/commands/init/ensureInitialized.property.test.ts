import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fc from 'fast-check';
import { ensureInitialized } from './index.js';
import { SPECTRL_MARKER } from '../../agents/template.js';

describe('ensureInitialized property tests', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `spectrl-pbt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  /**
   * Property 1: Auto-initialization creates valid project context
   * Validates: Requirements 1.1, 1.3, 2.1
   *
   * For any directory that does not contain a .spectrl subdirectory,
   * calling ensureInitialized should create the .spectrl directory and
   * a spectrl-index.json file containing a valid empty JSON object ({}),
   * and return wasInitialized: true.
   */
  it('Property 1: Auto-initialization creates valid project context', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const testDir = join(baseDir, `prop1-${counter++}`);
        await mkdir(testDir, { recursive: true });

        const result = await ensureInitialized(testDir, { skipAgents: true });

        expect(result.wasInitialized).toBe(true);

        // Verify index file exists and is valid empty JSON
        const indexPath = join(testDir, '.spectrl', 'spectrl-index.json');
        const content = await readFile(indexPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed).toEqual({});
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Auto-initialization is idempotent for existing projects
   * Validates: Requirements 1.2, 2.2
   *
   * For any directory that already contains a .spectrl/spectrl-index.json file,
   * calling ensureInitialized should not modify the existing index file contents
   * and should return wasInitialized: false.
   */
  it('Property 2: Auto-initialization is idempotent for existing projects', async () => {
    let counter = 0;
    // Generate arbitrary index content (valid JSON objects with string values)
    const indexEntryArb = fc.record({
      source: fc.string({ minLength: 1, maxLength: 50 }),
      hash: fc.string({ minLength: 1, maxLength: 80 }),
    });
    const indexArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('\0')),
      indexEntryArb,
    );

    await fc.assert(
      fc.asyncProperty(indexArb, async (indexData) => {
        const testDir = join(baseDir, `prop2-${counter++}`);
        const spectrlDir = join(testDir, '.spectrl');
        await mkdir(spectrlDir, { recursive: true });

        const indexPath = join(spectrlDir, 'spectrl-index.json');
        const originalContent = JSON.stringify(indexData, null, 2);
        await writeFile(indexPath, originalContent, 'utf-8');

        const result = await ensureInitialized(testDir, { skipAgents: true });

        expect(result.wasInitialized).toBe(false);

        // Index content must be unchanged
        const afterContent = await readFile(indexPath, 'utf-8');
        expect(afterContent).toBe(originalContent);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: AGENTS.md with existing marker is preserved during auto-init
   * Validates: Requirements 5.3
   *
   * For any directory containing an AGENTS.md file that already includes
   * the Spectrl marker, calling ensureInitialized should not modify
   * the AGENTS.md file contents.
   */
  it('Property 3: AGENTS.md with existing marker is preserved during auto-init', async () => {
    let counter = 0;
    // Generate arbitrary content that contains the marker somewhere
    const contentArb = fc
      .tuple(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
      )
      .map(([before, after]) => `${before}${SPECTRL_MARKER}${after}`);

    await fc.assert(
      fc.asyncProperty(contentArb, async (agentsContent) => {
        const testDir = join(baseDir, `prop3-${counter++}`);
        await mkdir(testDir, { recursive: true });

        // Write AGENTS.md with marker
        await writeFile(join(testDir, 'AGENTS.md'), agentsContent, 'utf-8');

        await ensureInitialized(testDir, { skipAgents: false });

        // AGENTS.md must be unchanged
        const afterContent = await readFile(join(testDir, 'AGENTS.md'), 'utf-8');
        expect(afterContent).toBe(agentsContent);
      }),
      { numRuns: 100 },
    );
  });
});
