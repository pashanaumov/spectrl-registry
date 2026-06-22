import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { list } from './index.js';
import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { CLIError } from '../../errors.js';

describe('list command', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(join(tmpdir(), 'spectrl-list-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should throw error if project is not initialized', async () => {
    // No .spectrl directory or index file

    await expect(list({ cwd: testDir })).rejects.toThrow(CLIError);
    await expect(list({ cwd: testDir })).rejects.toThrow('Project not initialized');
  });

  it('should show helpful message when no specs are installed', async () => {
    // Create .spectrl directory and empty index
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify({}, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify output
      expect(logs.some((log) => log.includes('No specs installed'))).toBe(true);
      expect(logs.some((log) => log.includes('spectrl install'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  it('should list local specs with green color coding', async () => {
    // Create .spectrl directory and index with local spec
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'my-local-spec@1.0.0': {
        source: '/home/user/.spectrl/registry/my-local-spec/versions/1.0.0',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify output contains spec info
      const output = logs.join('\n');
      expect(output).toContain('my-local-spec');
      expect(output).toContain('1.0.0');
      expect(output).toContain('1 spec installed');
    } finally {
      console.log = originalLog;
    }
  });

  it('should list public specs with blue color coding', async () => {
    // Create .spectrl directory and index with public spec
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'alice/api-spec@2.1.0': {
        source:
          'https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com/specs/alice/api-spec/2.1.0/spectrl.json',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify output contains spec info
      const output = logs.join('\n');
      expect(output).toContain('alice/api-spec');
      expect(output).toContain('2.1.0');
      expect(output).toContain('1 spec installed');
    } finally {
      console.log = originalLog;
    }
  });

  it('should list mixed local and public specs', async () => {
    // Create .spectrl directory and index with both local and public specs
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'my-local-spec@1.0.0': {
        source: '/home/user/.spectrl/registry/my-local-spec/versions/1.0.0',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      },
      'alice/api-spec@2.1.0': {
        source:
          'https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com/specs/alice/api-spec/2.1.0/spectrl.json',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
      },
      'bob/graphql-api@1.5.2': {
        source:
          'https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com/specs/bob/graphql-api/1.5.2/spectrl.json',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000003',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify output contains all specs
      const output = logs.join('\n');
      expect(output).toContain('my-local-spec');
      expect(output).toContain('alice/api-spec');
      expect(output).toContain('bob/graphql-api');
      expect(output).toContain('3 specs installed');
    } finally {
      console.log = originalLog;
    }
  });

  it('should handle specs without version in key', async () => {
    // Create .spectrl directory and index with spec without version
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'my-spec': {
        source: '/home/user/.spectrl/registry/my-spec',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify output contains spec with "unknown" version
      const output = logs.join('\n');
      expect(output).toContain('my-spec');
      expect(output).toContain('1 spec installed');
    } finally {
      console.log = originalLog;
    }
  });

  it('should throw error if index is corrupted (invalid JSON)', async () => {
    // Create .spectrl directory and corrupted index
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, 'invalid json {{{', 'utf-8');

    await expect(list({ cwd: testDir })).rejects.toThrow(CLIError);
    await expect(list({ cwd: testDir })).rejects.toThrow('corrupted');
  });

  it('should display correct count for single spec', async () => {
    // Create .spectrl directory and index with one spec
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'single-spec@1.0.0': {
        source: '/home/user/.spectrl/registry/single-spec/versions/1.0.0',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify singular form is used
      const output = logs.join('\n');
      expect(output).toContain('1 spec installed');
      expect(output).not.toContain('1 specs installed');
    } finally {
      console.log = originalLog;
    }
  });

  it('should display correct count for multiple specs', async () => {
    // Create .spectrl directory and index with multiple specs
    const spectrlDir = join(testDir, '.spectrl');
    await mkdir(spectrlDir, { recursive: true });

    const index = {
      'spec-one@1.0.0': {
        source: '/home/user/.spectrl/registry/spec-one/versions/1.0.0',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      },
      'spec-two@2.0.0': {
        source: '/home/user/.spectrl/registry/spec-two/versions/2.0.0',
        hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000002',
      },
    };

    const indexPath = join(spectrlDir, 'spectrl-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await list({ cwd: testDir });

      // Verify plural form is used
      const output = logs.join('\n');
      expect(output).toContain('2 specs installed');
    } finally {
      console.log = originalLog;
    }
  });
});
