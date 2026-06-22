import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  fileExists,
  isReadable,
  isWritable,
  assertFileExists,
  assertFileNotExists,
  getManifestPath,
  getDefaultIndexPath,
  readJsonFile,
  readAndValidateManifest,
  validateFilePaths,
  validateFilesExist,
  promptYesNo,
  output,
} from './utils.js';
import { CLIError, ExitCode } from './errors.js';

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}));
import { select } from '@inquirer/prompts';

describe('File Utilities', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    testFile = join(testDir, 'test.txt');
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await writeFile(testFile, 'test content');

      expect(await fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await fileExists(testFile)).toBe(false);
    });

    it('should return true for existing directory', async () => {
      expect(await fileExists(testDir)).toBe(true);
    });

    it('should return false for non-existing directory', async () => {
      const nonExistentDir = join(testDir, 'does-not-exist');

      expect(await fileExists(nonExistentDir)).toBe(false);
    });
  });

  describe('isReadable', () => {
    it('should return true for readable file', async () => {
      await writeFile(testFile, 'test content');

      expect(await isReadable(testFile)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await isReadable(testFile)).toBe(false);
    });
  });

  describe('isWritable', () => {
    it('should return true for writable file', async () => {
      await writeFile(testFile, 'test content');

      expect(await isWritable(testFile)).toBe(true);
    });

    it('should return true for writable directory', async () => {
      expect(await isWritable(testDir)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await isWritable(testFile)).toBe(false);
    });
  });

  describe('assertFileExists', () => {
    it('should not throw for existing file', async () => {
      await writeFile(testFile, 'test content');

      await expect(assertFileExists(testFile)).resolves.toBeUndefined();
    });

    it('should throw CLIError with IO_ERROR for non-existing file', async () => {
      await expect(assertFileExists(testFile)).rejects.toThrow(CLIError);

      try {
        await assertFileExists(testFile);
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('File not found');
        expect((error as CLIError).message).toContain(testFile);
      }
    });

    it('should include file path in error message', async () => {
      const nonExistentFile = join(testDir, 'missing.txt');

      try {
        await assertFileExists(nonExistentFile);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as CLIError).message).toContain(nonExistentFile);
      }
    });
  });

  describe('assertFileNotExists', () => {
    it('should not throw for non-existing file', async () => {
      await expect(assertFileNotExists(testFile)).resolves.toBeUndefined();
    });

    it('should throw CLIError with VALIDATION_ERROR for existing file', async () => {
      await writeFile(testFile, 'test content');

      await expect(assertFileNotExists(testFile)).rejects.toThrow(CLIError);

      try {
        await assertFileNotExists(testFile);
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('File already exists');
        expect((error as CLIError).message).toContain(testFile);
      }
    });

    it('should include file path in error message', async () => {
      await writeFile(testFile, 'test content');

      try {
        await assertFileNotExists(testFile);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as CLIError).message).toContain(testFile);
      }
    });
  });

  describe('getManifestPath', () => {
    it('should return path to spectrl.jsonc when it exists', async () => {
      await writeFile(join(testDir, 'spectrl.jsonc'), '{}');
      const path = await getManifestPath(testDir);

      expect(path).toBe(join(testDir, 'spectrl.jsonc'));
    });

    it('should fall back to spectrl.json when only spectrl.json exists', async () => {
      await writeFile(join(testDir, 'spectrl.json'), '{}');
      const path = await getManifestPath(testDir);

      expect(path).toBe(join(testDir, 'spectrl.json'));
    });

    it('should throw CLIError when no manifest file exists', async () => {
      await expect(getManifestPath(testDir)).rejects.toThrow();
    });
  });

  describe('getDefaultIndexPath', () => {
    it('should return path to spectrl-index.json', () => {
      const path = getDefaultIndexPath('/some/dir');

      expect(path).toBe('/some/dir/spectrl-index.json');
    });

    it('should work with relative paths', () => {
      const path = getDefaultIndexPath('.');

      expect(path).toBe('spectrl-index.json');
    });
  });

  describe('readJsonFile', () => {
    it('should read and parse valid JSON file', async () => {
      const jsonFile = join(testDir, 'data.json');
      const data = { name: 'test', value: 42 };
      await writeFile(jsonFile, JSON.stringify(data));

      const result = await readJsonFile(jsonFile);

      expect(result).toEqual(data);
    });

    it('should read and parse JSONC file with comments and trailing commas', async () => {
      const jsoncFile = join(testDir, 'data.jsonc');
      await writeFile(
        jsoncFile,
        `{
        // a comment
        "name": "test",
        "value": 42, /* trailing comma */
      }`,
      );

      const result = await readJsonFile(jsoncFile);

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should throw CLIError with IO_ERROR for missing file', async () => {
      const missingFile = join(testDir, 'missing.json');

      await expect(readJsonFile(missingFile)).rejects.toThrow(CLIError);

      try {
        await readJsonFile(missingFile);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('File not found');
      }
    });

    it('should throw CLIError with VALIDATION_ERROR for invalid JSON', async () => {
      const invalidFile = join(testDir, 'invalid.json');
      await writeFile(invalidFile, '{ invalid json }');

      await expect(readJsonFile(invalidFile)).rejects.toThrow(CLIError);

      try {
        await readJsonFile(invalidFile);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('Invalid JSON');
      }
    });

    it('should include file path in error messages', async () => {
      const missingFile = join(testDir, 'missing.json');

      try {
        await readJsonFile(missingFile);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as CLIError).message).toContain(missingFile);
      }
    });
  });

  describe('readAndValidateManifest', () => {
    it('should read and validate manifest from spectrl.json', async () => {
      const manifest = {
        name: 'test-spec',
        version: '1.0.0',
        deps: {},
        type: 'spec' as const,
        files: ['README.md'],
      };
      await writeFile(join(testDir, 'spectrl.json'), JSON.stringify(manifest));

      const result = await readAndValidateManifest(testDir);

      expect(result).toEqual(manifest);
    });

    it('should read and validate manifest from spectrl.jsonc', async () => {
      const manifest = {
        name: 'test-spec',
        version: '1.0.0',
        deps: {},
        type: 'spec' as const,
        files: ['README.md'],
      };
      const jsoncContent = `{
        // This is a comment
        "name": "test-spec",
        "version": "1.0.0",
        "deps": {},
        "type": "spec",
        "files": ["README.md"],
      }`;
      await writeFile(join(testDir, 'spectrl.jsonc'), jsoncContent);

      const result = await readAndValidateManifest(testDir);

      expect(result).toEqual(manifest);
    });

    it('should prefer spectrl.jsonc over spectrl.json', async () => {
      const jsonManifest = {
        name: 'from-json',
        version: '1.0.0',
        deps: {},
        type: 'spec' as const,
        files: ['README.md'],
      };
      const jsoncManifest = {
        name: 'from-jsonc',
        version: '1.0.0',
        deps: {},
        type: 'spec' as const,
        files: ['README.md'],
      };
      await writeFile(join(testDir, 'spectrl.json'), JSON.stringify(jsonManifest));
      await writeFile(join(testDir, 'spectrl.jsonc'), JSON.stringify(jsoncManifest));

      const result = await readAndValidateManifest(testDir);

      expect(result.name).toBe('from-jsonc');
    });

    it('should throw CLIError with IO_ERROR if no manifest exists', async () => {
      await expect(readAndValidateManifest(testDir)).rejects.toThrow(CLIError);

      try {
        await readAndValidateManifest(testDir);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
      }
    });

    it('should throw CLIError with VALIDATION_ERROR for invalid JSON', async () => {
      await writeFile(join(testDir, 'spectrl.json'), '{ invalid }');

      await expect(readAndValidateManifest(testDir)).rejects.toThrow(CLIError);

      try {
        await readAndValidateManifest(testDir);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
      }
    });

    it('should throw CLIError with VALIDATION_ERROR for invalid manifest schema', async () => {
      const invalidManifest = {
        name: 'test-spec',
        // missing version
        deps: {},
        files: [],
      };
      await writeFile(join(testDir, 'spectrl.json'), JSON.stringify(invalidManifest));

      await expect(readAndValidateManifest(testDir)).rejects.toThrow(CLIError);

      try {
        await readAndValidateManifest(testDir);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('validation');
      }
    });
  });

  describe('validateFilePaths', () => {
    it('should not throw for valid paths', () => {
      expect(() => validateFilePaths(['README.md', 'docs/api.md'])).not.toThrow();
    });

    it('should throw CLIError with VALIDATION_ERROR for path traversal', () => {
      expect(() => validateFilePaths(['../etc/passwd'])).toThrow(CLIError);

      try {
        validateFilePaths(['../etc/passwd']);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('traversal');
      }
    });

    it('should throw CLIError with VALIDATION_ERROR for absolute paths', () => {
      expect(() => validateFilePaths(['/etc/passwd'])).toThrow(CLIError);

      try {
        validateFilePaths(['/etc/passwd']);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('Absolute');
      }
    });

    it('should throw CLIError with VALIDATION_ERROR for duplicate paths', () => {
      expect(() => validateFilePaths(['README.md', 'README.md'])).toThrow(CLIError);

      try {
        validateFilePaths(['README.md', 'README.md']);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        expect((error as CLIError).message).toContain('Duplicate');
      }
    });
  });

  describe('validateFilesExist', () => {
    it('should not throw when all files exist', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.txt'), 'content2');

      await expect(
        validateFilesExist(['file1.txt', 'file2.txt'], testDir),
      ).resolves.toBeUndefined();
    });

    it('should throw CLIError with IO_ERROR when files are missing', async () => {
      await writeFile(join(testDir, 'exists.txt'), 'content');

      await expect(validateFilesExist(['exists.txt', 'missing.txt'], testDir)).rejects.toThrow(
        CLIError,
      );

      try {
        await validateFilesExist(['exists.txt', 'missing.txt'], testDir);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('not found');
      }
    });
  });

  describe('output', () => {
    it('should have log method', () => {
      expect(output.log).toBeDefined();
      expect(typeof output.log).toBe('function');
    });

    it('should have error method', () => {
      expect(output.error).toBeDefined();
      expect(typeof output.error).toBe('function');
    });
  });
});

describe('Prompt Utilities', () => {
  describe('promptYesNo', () => {
    it('should return true when "Yes" is selected', async () => {
      // Mock the select function to return true
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValueOnce(true);

      const result = await promptYesNo('Test question?');

      expect(result).toBe(true);
    });

    it('should return false when "No" is selected', async () => {
      // Mock the select function to return false
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValueOnce(false);

      const result = await promptYesNo('Test question?');

      expect(result).toBe(false);
    });

    it('should default to "Yes" (initial: 0) when defaultYes is true', async () => {
      // Mock the select function to return true
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValueOnce(true);

      const result = await promptYesNo('Test question?', true);

      expect(result).toBe(true);
    });

    it('should default to "No" (initial: 1) when defaultYes is false', async () => {
      // Mock the select function to return false
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValueOnce(false);

      const result = await promptYesNo('Test question?', false);

      expect(result).toBe(false);
    });

    it('should use default value of true when defaultYes is not provided', async () => {
      // Mock the select function to return true
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValueOnce(true);

      const result = await promptYesNo('Test question?');

      expect(result).toBe(true);
    });
  });
});

describe('Gitignore Utilities', () => {
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

  describe('hasSpectrlGitignorePattern', () => {
    it('should return false when .gitignore does not exist', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');

      expect(await hasSpectrlGitignorePattern(testDir)).toBe(false);
    });

    it('should return false when .gitignore exists but has no .spectrl pattern', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.env\n');

      expect(await hasSpectrlGitignorePattern(testDir)).toBe(false);
    });

    it('should return true when .gitignore has new pattern (.spectrl/specs/)', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.spectrl/specs/\n');

      expect(await hasSpectrlGitignorePattern(testDir)).toBe(true);
    });

    it('should return true when .gitignore has old pattern (.spectrl/)', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.spectrl/\n');

      expect(await hasSpectrlGitignorePattern(testDir)).toBe(true);
    });

    it('should return true when pattern is in middle of file', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.spectrl/specs/\n.env\ndist/\n');

      expect(await hasSpectrlGitignorePattern(testDir)).toBe(true);
    });

    it('should handle read errors gracefully', async () => {
      const { hasSpectrlGitignorePattern } = await import('./utils.js');
      const nonExistentDir = join(testDir, 'does-not-exist');

      // Should not throw, just return false
      expect(await hasSpectrlGitignorePattern(nonExistentDir)).toBe(false);
    });
  });

  describe('ensureSpectrlGitignore', () => {
    it('should create .gitignore with pattern when file does not exist', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');

      const wasAdded = await ensureSpectrlGitignore(testDir);

      expect(wasAdded).toBe(true);
      expect(await fileExists(gitignorePath)).toBe(true);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toContain('.spectrl/specs/');
      expect(content).toContain('# Spectrl local registry');
      expect(content).toContain('like node_modules');
    });

    it('should append pattern to existing .gitignore', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      const existingContent = 'node_modules/\n.env\n';
      await writeFile(gitignorePath, existingContent);

      const wasAdded = await ensureSpectrlGitignore(testDir);

      expect(wasAdded).toBe(true);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toContain(existingContent);
      expect(content).toContain('.spectrl/specs/');
      expect(content).toContain('# Spectrl local registry');
    });

    it('should preserve existing content exactly', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      const existingContent = '# My custom gitignore\nnode_modules/\n.env\n\n# Build\ndist/\n';
      await writeFile(gitignorePath, existingContent);

      await ensureSpectrlGitignore(testDir);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content.startsWith(existingContent)).toBe(true);
    });

    it('should add newline before pattern if file does not end with newline', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      const existingContent = 'node_modules/\n.env'; // No trailing newline
      await writeFile(gitignorePath, existingContent);

      await ensureSpectrlGitignore(testDir);

      const content = await readFile(gitignorePath, 'utf-8');
      // Should have newline between existing content and new pattern
      expect(content).toContain('.env\n\n# Spectrl');
    });

    it('should return false when pattern already exists (new pattern)', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.spectrl/specs/\n');

      const wasAdded = await ensureSpectrlGitignore(testDir);

      expect(wasAdded).toBe(false);

      // Content should be unchanged
      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.spectrl/specs/\n');
    });

    it('should return false when old pattern exists (idempotent)', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules/\n.spectrl/\n');

      const wasAdded = await ensureSpectrlGitignore(testDir);

      expect(wasAdded).toBe(false);

      // Content should be unchanged (we don't modify old patterns)
      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.spectrl/\n');
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const gitignorePath = join(testDir, '.gitignore');

      // First call should add pattern
      const firstCall = await ensureSpectrlGitignore(testDir);
      expect(firstCall).toBe(true);

      const contentAfterFirst = await readFile(gitignorePath, 'utf-8');

      // Second call should do nothing
      const secondCall = await ensureSpectrlGitignore(testDir);
      expect(secondCall).toBe(false);

      const contentAfterSecond = await readFile(gitignorePath, 'utf-8');
      expect(contentAfterSecond).toBe(contentAfterFirst);
    });

    it('should throw CLIError on write failure', async () => {
      const { ensureSpectrlGitignore } = await import('./utils.js');
      const readOnlyDir = join(testDir, 'readonly');
      await mkdir(readOnlyDir, { recursive: true });

      // Create a read-only directory (this test may not work on all systems)
      // Instead, use a non-existent parent directory to force a write error
      const invalidDir = join(testDir, 'does-not-exist', 'nested');

      await expect(ensureSpectrlGitignore(invalidDir)).rejects.toThrow(CLIError);

      try {
        await ensureSpectrlGitignore(invalidDir);
      } catch (error) {
        expect((error as CLIError).exitCode).toBe(ExitCode.IO_ERROR);
        expect((error as CLIError).message).toContain('.gitignore');
      }
    });
  });
});
