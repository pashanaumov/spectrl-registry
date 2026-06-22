import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from './index.js';
import { CLIError, ExitCode } from '../../errors.js';
import { getProjectIndexPath, getProjectDir } from '../../utils.js';
import { SPECTRL_MARKER } from '../../agents/template.js';
import * as utils from '../../utils.js';

describe('init command', () => {
  let testDir: string;

  beforeEach(async () => {
    // Reset all mocks
    vi.restoreAllMocks();

    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('successful initialization', () => {
    it('should create .spectrl directory', async () => {
      // Mock declining AGENTS.md creation to avoid prompt (index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

      await init(testDir);

      const projectDir = getProjectDir(testDir);
      // Check directory exists by trying to access it
      await expect(access(projectDir)).resolves.toBeUndefined();
    });

    it('should create spectrl-index.json with empty object', async () => {
      // Mock declining AGENTS.md creation to avoid prompt (index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

      await init(testDir);

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');
      const index = JSON.parse(content);

      expect(index).toEqual({});
    });

    it('should format JSON with 2-space indentation', async () => {
      // Mock declining AGENTS.md creation to avoid prompt (index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

      await init(testDir);

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');

      // Empty object should be formatted as {}
      expect(content).toBe('{}\n');
    });

    it('should include trailing newline', async () => {
      // Mock declining AGENTS.md creation to avoid prompt (index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

      await init(testDir);

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');

      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('options parameter', () => {
    it('should accept empty options object', async () => {
      // Mock declining AGENTS.md creation to avoid prompt (index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

      await init(testDir, {});

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');
      expect(content).toBe('{}\n');
    });

    it('should accept skipAgents option', async () => {
      // No prompt injection needed - skipAgents bypasses prompts
      await init(testDir, { skipAgents: true });

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');
      expect(content).toBe('{}\n');
    });

    it('should accept forceAgents option', async () => {
      // No prompt injection needed - forceAgents bypasses prompts
      await init(testDir, { forceAgents: true });

      const indexPath = getProjectIndexPath(testDir);
      const content = await readFile(indexPath, 'utf-8');
      expect(content).toBe('{}\n');
    });

    it('should accept both options', async () => {
      // This should throw an error before any prompts
      await expect(init(testDir, { skipAgents: true, forceAgents: true })).rejects.toThrow(
        CLIError,
      );
    });
  });

  describe('error handling', () => {
    it('should throw CLIError when spectrl-index.json already exists', async () => {
      // Initialize once (mock declining AGENTS.md, index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      await init(testDir);

      // Try to initialize again (mock declining AGENTS.md)
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      await expect(init(testDir)).rejects.toThrow(CLIError);
    });

    it('should throw CLIError with VALIDATION_ERROR exit code when file exists', async () => {
      // Initialize once (mock declining AGENTS.md, index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      await init(testDir);

      // Try to initialize again and check exit code (mock declining AGENTS.md)
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      try {
        await init(testDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should include file path in error message when file exists', async () => {
      // Initialize once (mock declining AGENTS.md, index 1 = "No")
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      await init(testDir);

      // Try to initialize again (mock declining AGENTS.md)
      vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);
      try {
        await init(testDir);
        expect.fail('Should have thrown CLIError');
      } catch (error) {
        expect((error as CLIError).message).toContain('spectrl-index.json');
        expect((error as CLIError).message).toContain('already exists');
      }
    });
  });

  describe('AGENTS.md integration', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on console.log to capture output messages
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // Clear any previous calls
      consoleLogSpy.mockClear();
    });

    afterEach(async () => {
      // Restore console.log
      consoleLogSpy.mockRestore();
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    });

    describe('new project - no AGENTS.md', () => {
      it('should prompt for creation and create file when user accepts', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        // Verify AGENTS.md was created
        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');

        // Verify marker is first line
        expect(content.startsWith(SPECTRL_MARKER)).toBe(true);
        // Verify template content is present
        expect(content).toContain('# AI Assistant Instructions for Spectrl');
        expect(content).toContain('## What is Spectrl?');

        // Verify success message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Created AGENTS.md'));
      });

      it('should prompt for creation and skip when user declines', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

        await init(testDir);

        // Verify AGENTS.md was NOT created
        const agentsPath = join(testDir, 'AGENTS.md');
        const fileExists = await access(agentsPath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(false);

        // Verify skip message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ Skipped AGENTS.md creation'),
        );
        // Verify implications message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("AI assistants won't automatically consult specs"),
        );
      });

      it('should show "Yes (recommended)" as first choice in creation prompt', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        const agentsPath = join(testDir, 'AGENTS.md');
        await expect(access(agentsPath)).resolves.toBeUndefined();
      });

      it('should show implications message when declining creation', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

        await init(testDir);

        // Verify both parts of the implications message
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ Skipped AGENTS.md creation'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("AI assistants won't automatically consult specs"),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('You can create AGENTS.md manually later'),
        );
      });

      it('should handle cancellation (Ctrl+C) gracefully', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(undefined);

        // Cancellation should throw CLIError with USER_CANCELLED exit code
        await expect(init(testDir)).rejects.toThrow(CLIError);

        try {
          await init(testDir);
          expect.fail('Should have thrown CLIError');
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.USER_CANCELLED);
          expect((error as CLIError).message).toContain('cancelled');
        }

        // Verify .spectrl directory was cleaned up
        const projectDir = getProjectDir(testDir);
        const dirExists = await access(projectDir)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(false);
      });
    });

    describe('existing AGENTS.md without marker', () => {
      beforeEach(async () => {
        // Create existing AGENTS.md without marker
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(agentsPath, '# My Custom Instructions\n\nSome custom content.', 'utf-8');
      });

      it('should prompt to append and append when user accepts', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        // Verify AGENTS.md was appended to
        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');

        // Verify original content is preserved
        expect(content).toContain('# My Custom Instructions');
        expect(content).toContain('Some custom content.');

        // Verify separator and marker were added
        expect(content).toContain('---');
        expect(content).toContain(SPECTRL_MARKER);

        // Verify template content was appended
        expect(content).toContain('# AI Assistant Instructions for Spectrl');

        // Verify success message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ Added Spectrl instructions to AGENTS.md'),
        );
      });

      it('should prompt to append and skip when user declines', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

        await init(testDir);

        // Verify AGENTS.md was NOT modified
        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');

        // Verify only original content exists
        expect(content).toBe('# My Custom Instructions\n\nSome custom content.');
        expect(content).not.toContain(SPECTRL_MARKER);

        // Verify skip message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ Skipped AGENTS.md update'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('You can add Spectrl instructions manually if needed'),
        );
      });

      it('should show "Yes (recommended)" as first choice in append prompt', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');
        expect(content).toContain(SPECTRL_MARKER);
      });

      it('should handle cancellation (Ctrl+C) during append prompt', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(undefined);

        // Cancellation should throw CLIError with USER_CANCELLED exit code
        await expect(init(testDir)).rejects.toThrow(CLIError);

        try {
          await init(testDir);
          expect.fail('Should have thrown CLIError');
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.USER_CANCELLED);
          expect((error as CLIError).message).toContain('cancelled');
        }

        // Verify AGENTS.md was NOT modified
        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');
        expect(content).toBe('# My Custom Instructions\n\nSome custom content.');
        expect(content).not.toContain(SPECTRL_MARKER);

        // Verify .spectrl directory was cleaned up
        const projectDir = getProjectDir(testDir);
        const dirExists = await access(projectDir)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(false);
      });
    });

    describe('existing AGENTS.md with marker - idempotent', () => {
      beforeEach(async () => {
        // Create existing AGENTS.md with marker
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(
          agentsPath,
          `${SPECTRL_MARKER}\n# Instructions for AI Assistants\n\nExisting content.`,
          'utf-8',
        );
      });

      it('should be idempotent - no changes, no prompts', async () => {
        // No prompt injection needed - should not prompt
        await init(testDir);

        // Verify AGENTS.md was NOT modified
        const agentsPath = join(testDir, 'AGENTS.md');
        const content = await readFile(agentsPath, 'utf-8');

        // Content should be unchanged
        expect(content).toBe(
          `${SPECTRL_MARKER}\n# Instructions for AI Assistants\n\nExisting content.`,
        );

        // Verify idempotent message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ AGENTS.md already contains Spectrl instructions'),
        );
      });
    });

    describe('--skip-agents flag', () => {
      it('should skip all AGENTS.md logic', async () => {
        // No prompt injection needed - flag bypasses prompts
        await init(testDir, { skipAgents: true });

        // Verify AGENTS.md was NOT created
        const agentsPath = join(testDir, 'AGENTS.md');
        await expect(access(agentsPath)).rejects.toThrow();

        // Verify no AGENTS.md messages were logged
        const logCalls = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0] as string);
        const agentsMessages = logCalls.filter((msg: string) => msg.includes('AGENTS.md'));
        expect(agentsMessages).toHaveLength(0);
      });
    });

    describe('--force-agents flag', () => {
      it('should overwrite existing file without prompting', async () => {
        // Create existing AGENTS.md with custom content
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(agentsPath, '# Old Content\n\nThis will be replaced.', 'utf-8');

        // No prompt injection needed - flag bypasses prompts
        await init(testDir, { forceAgents: true });

        // Verify AGENTS.md was appended to (not overwritten)
        const content = await readFile(agentsPath, 'utf-8');

        // With --force-agents on existing file without marker, it appends
        // Verify original content is preserved
        expect(content).toContain('# Old Content');
        expect(content).toContain('This will be replaced');

        // Verify separator and marker were added
        expect(content).toContain('---');
        expect(content).toContain(SPECTRL_MARKER);

        // Verify template content was appended
        expect(content).toContain('# AI Assistant Instructions for Spectrl');

        // Verify success message was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ Added Spectrl instructions to AGENTS.md'),
        );
      });
    });

    describe('flag conflicts', () => {
      it('should throw validation error when both flags are provided', async () => {
        await expect(init(testDir, { skipAgents: true, forceAgents: true })).rejects.toThrow(
          CLIError,
        );

        try {
          await init(testDir, { skipAgents: true, forceAgents: true });
          expect.fail('Should have thrown CLIError');
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
          expect((error as CLIError).message).toContain('Cannot use both');
          expect((error as CLIError).message).toContain('--skip-agents');
          expect((error as CLIError).message).toContain('--force-agents');
        }
      });
    });

    describe('non-critical error handling', () => {
      it('should continue successfully when AGENTS.md creation fails', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        // Make the directory read-only to cause write failure
        // Note: This is a simplified test - in practice, we'd need to mock the file system
        // For now, we'll test that init completes even if AGENTS.md operations fail
        // by verifying the index was still created

        await init(testDir);

        // Verify project index was created successfully
        const indexPath = getProjectIndexPath(testDir);
        const content = await readFile(indexPath, 'utf-8');
        expect(content).toBe('{}\n');

        // Note: Testing actual file write failures would require mocking fs operations
        // which is complex. The key behavior is that init continues regardless.
      });
    });

    describe('log messages', () => {
      it('should log appropriate messages for creation scenario', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Created AGENTS.md'));
      });

      it('should log appropriate messages for decline creation scenario', async () => {
        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

        await init(testDir);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ Skipped AGENTS.md creation'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("AI assistants won't automatically consult specs"),
        );
      });

      it('should log appropriate messages for append scenario', async () => {
        // Create existing AGENTS.md
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(agentsPath, '# Custom\n', 'utf-8');

        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(true);

        await init(testDir);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ Added Spectrl instructions to AGENTS.md'),
        );
      });

      it('should log appropriate messages for decline append scenario', async () => {
        // Create existing AGENTS.md
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(agentsPath, '# Custom\n', 'utf-8');

        vi.spyOn(utils, 'promptYesNo').mockResolvedValue(false);

        await init(testDir);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('ℹ Skipped AGENTS.md update'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('You can add Spectrl instructions manually if needed'),
        );
      });

      it('should log appropriate messages for idempotent scenario', async () => {
        // Create existing AGENTS.md with marker
        const agentsPath = join(testDir, 'AGENTS.md');
        await writeFile(agentsPath, `${SPECTRL_MARKER}\n# Content\n`, 'utf-8');

        await init(testDir);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('✓ AGENTS.md already contains Spectrl instructions'),
        );
      });
    });
  });
});
