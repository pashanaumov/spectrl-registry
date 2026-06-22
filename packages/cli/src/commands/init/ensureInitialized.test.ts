import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureInitialized } from './index.js';
import { SPECTRL_MARKER } from '../../agents/template.js';

describe('ensureInitialized', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `spectrl-ensure-init-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create .spectrl directory and index when not present, return wasInitialized: true', async () => {
    const result = await ensureInitialized(testDir, { skipAgents: true });

    expect(result.wasInitialized).toBe(true);

    // Verify .spectrl directory exists
    const indexPath = join(testDir, '.spectrl', 'spectrl-index.json');
    const content = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    expect(index).toEqual({});
  });

  it('should return wasInitialized: false when already initialized, not modify existing index', async () => {
    // Set up existing .spectrl with custom index content
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });
    const indexPath = join(spectrlDir, 'spectrl-index.json');
    const existingContent = JSON.stringify(
      { 'my-spec@1.0.0': { source: 'test', hash: 'abc' } },
      null,
      2,
    );
    await writeFile(indexPath, existingContent, 'utf-8');

    const result = await ensureInitialized(testDir, { skipAgents: true });

    expect(result.wasInitialized).toBe(false);

    // Verify index was not modified
    const content = await readFile(indexPath, 'utf-8');
    expect(content).toBe(existingContent);
  });

  it('should skip AGENTS.md prompts when skipAgents is true', async () => {
    const result = await ensureInitialized(testDir, { skipAgents: true });

    expect(result.wasInitialized).toBe(true);

    // AGENTS.md should not exist since we skipped
    const agentsPath = join(testDir, 'AGENTS.md');
    await expect(readFile(agentsPath, 'utf-8')).rejects.toThrow();
  });

  it('should not modify AGENTS.md when it already has the Spectrl marker', async () => {
    // Create AGENTS.md with existing marker
    const originalContent = `${SPECTRL_MARKER}\n# Existing instructions\n`;
    await writeFile(join(testDir, 'AGENTS.md'), originalContent, 'utf-8');

    const result = await ensureInitialized(testDir, { skipAgents: false });

    expect(result.wasInitialized).toBe(true);

    // AGENTS.md should be unchanged
    const content = await readFile(join(testDir, 'AGENTS.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });
});
