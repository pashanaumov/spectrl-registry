import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkAgentsStatus,
  createAgentsFile,
  appendToAgentsFile,
  type AgentsStatus,
} from './manager.js';
import { SPECTRL_MARKER, getNewFileContent, getAppendContent } from './template.js';
import { CLIError, ExitCode } from '../errors.js';

describe('Manager Module', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('checkAgentsStatus', () => {
    it('should return { exists: false } for non-existent file', async () => {
      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: false });
    });

    it('should return { exists: true, hasMarker: true } for file containing marker', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const content = `${SPECTRL_MARKER}\n# Some content\nMore content`;
      await writeFile(agentsPath, content, 'utf-8');

      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: true, hasMarker: true });
    });

    it('should return { exists: true, hasMarker: false } for file without marker', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const content = '# Custom AGENTS.md\nNo Spectrl marker here';
      await writeFile(agentsPath, content, 'utf-8');

      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: true, hasMarker: false });
    });

    it('should treat unreadable file as non-existent', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      await writeFile(agentsPath, 'content', 'utf-8');

      // Make file unreadable by changing permissions (may not work on all systems)
      // Alternative: test with a file in a non-existent directory
      // For cross-platform compatibility, we'll simulate by testing the error handling path
      // by checking that read errors are caught and treated as non-existent

      // Create a scenario where the file exists but can't be read
      // We'll use a different approach: create the file, then remove read permissions
      try {
        await chmod(agentsPath, 0o000); // Remove all permissions

        const status = await checkAgentsStatus(testDir);

        // Should treat as non-existent when read fails
        expect(status).toEqual({ exists: false });
      } finally {
        // Restore permissions for cleanup
        try {
          await chmod(agentsPath, 0o644);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should detect marker anywhere in file content', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const content = `# Custom content\n\nSome text\n\n${SPECTRL_MARKER}\n\nMore content`;
      await writeFile(agentsPath, content, 'utf-8');

      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: true, hasMarker: true });
    });
  });

  describe('createAgentsFile', () => {
    it('should create file with correct content', async () => {
      await createAgentsFile(testDir);

      const agentsPath = join(testDir, 'AGENTS.md');
      const content = await readFile(agentsPath, 'utf-8');
      const expectedContent = getNewFileContent();

      expect(content).toBe(expectedContent);
    });

    it('should create file with marker as first line', async () => {
      await createAgentsFile(testDir);

      const agentsPath = join(testDir, 'AGENTS.md');
      const content = await readFile(agentsPath, 'utf-8');
      const firstLine = content.split('\n')[0];

      expect(firstLine).toBe(SPECTRL_MARKER);
    });

    it('should throw CLIError with IO_ERROR on write failure', async () => {
      // Use a non-existent parent directory to force write failure
      const invalidDir = join(testDir, 'does-not-exist', 'nested');

      await expect(createAgentsFile(invalidDir)).rejects.toThrow(CLIError);

      try {
        await createAgentsFile(invalidDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('Failed to create AGENTS.md');
      }
    });

    it('should include error details in error message', async () => {
      const invalidDir = join(testDir, 'does-not-exist', 'nested');

      try {
        await createAgentsFile(invalidDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect((error as CLIError).message).toContain('AGENTS.md');
      }
    });
  });

  describe('appendToAgentsFile', () => {
    it('should preserve existing content and append correctly', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const existingContent = '# My Custom AGENTS.md\n\nSome custom instructions';
      await writeFile(agentsPath, existingContent, 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');
      const expectedContent = existingContent + getAppendContent();

      expect(content).toBe(expectedContent);
    });

    it('should contain both existing and new content', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const existingContent = '# Custom content\nOriginal instructions';
      await writeFile(agentsPath, existingContent, 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');

      expect(content).toContain('Custom content');
      expect(content).toContain('Original instructions');
      expect(content).toContain(SPECTRL_MARKER);
      expect(content).toContain('---'); // Separator
    });

    it('should trim trailing whitespace before appending', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const existingContent = '# Custom content\n\n\n   \n\t\n'; // Multiple trailing whitespace
      await writeFile(agentsPath, existingContent, 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');
      const trimmedExisting = existingContent.trimEnd();
      const expectedContent = trimmedExisting + getAppendContent();

      expect(content).toBe(expectedContent);
    });

    it('should not have extra whitespace between trimmed content and separator', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      const existingContent = '# Custom content\n\n\n';
      await writeFile(agentsPath, existingContent, 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');
      const trimmedExisting = existingContent.trimEnd();
      const expectedContent = trimmedExisting + getAppendContent();

      // After trimming, should go directly to the append content (which starts with \n\n---)
      expect(content).toBe(expectedContent);
      // Verify the structure: trimmed content + separator + marker + template
      expect(content.startsWith('# Custom content')).toBe(true);
      expect(content).toContain('\n\n---\n\n');
    });

    it('should throw CLIError with IO_ERROR on read failure', async () => {
      // File doesn't exist - read will fail
      await expect(appendToAgentsFile(testDir)).rejects.toThrow(CLIError);

      try {
        await appendToAgentsFile(testDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('Failed to append to AGENTS.md');
      }
    });

    it('should throw CLIError with IO_ERROR on write failure', async () => {
      // Create file in a directory, then make it unwritable
      const agentsPath = join(testDir, 'AGENTS.md');
      await writeFile(agentsPath, 'content', 'utf-8');

      // Make file read-only
      try {
        await chmod(agentsPath, 0o444); // Read-only

        await expect(appendToAgentsFile(testDir)).rejects.toThrow(CLIError);

        try {
          await appendToAgentsFile(testDir);
          expect.fail('Should have thrown CLIError');
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        }
      } finally {
        // Restore permissions for cleanup
        try {
          await chmod(agentsPath, 0o644);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should include error details in error message', async () => {
      try {
        await appendToAgentsFile(testDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect((error as CLIError).message).toContain('AGENTS.md');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle empty existing file', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '', 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');

      // Empty string trimmed is empty, so append content starts immediately
      expect(content).toBe(getAppendContent());
    });

    it('should handle file with only whitespace', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '   \n\t\n  ', 'utf-8');

      await appendToAgentsFile(testDir);

      const content = await readFile(agentsPath, 'utf-8');

      // All whitespace trimmed, so append content starts immediately
      expect(content).toBe(getAppendContent());
    });

    it('should create then detect marker correctly', async () => {
      // Create file
      await createAgentsFile(testDir);

      // Check status
      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: true, hasMarker: true });
    });

    it('should append then detect marker correctly', async () => {
      const agentsPath = join(testDir, 'AGENTS.md');
      await writeFile(agentsPath, '# Custom', 'utf-8');

      // Append
      await appendToAgentsFile(testDir);

      // Check status
      const status = await checkAgentsStatus(testDir);

      expect(status).toEqual({ exists: true, hasMarker: true });
    });
  });
});
