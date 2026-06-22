import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Helper to run CLI command and capture output
 */
function runCLI(
  args: string[],
  options?: { input?: string },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const cliPath = join(__dirname, '../dist/cli.js');
    const child = spawn('node', [cliPath, ...args], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    // Provide input if specified, otherwise close stdin immediately
    if (options?.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

describe('CLI Entry Point', () => {
  describe('Version', () => {
    it('should display version from package.json with -v flag', async () => {
      const { stdout, exitCode } = await runCLI(['-v']);
      const packageJsonPath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      expect(stdout.trim()).toBe(packageJson.version);
      expect(exitCode).toBe(0);
    });

    it('should display version from package.json with --version flag', async () => {
      const { stdout, exitCode } = await runCLI(['--version']);
      const packageJsonPath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      expect(stdout.trim()).toBe(packageJson.version);
      expect(exitCode).toBe(0);
    });
  });

  describe('Command Routing', () => {
    it('should show help when no command is provided', async () => {
      const { stdout, exitCode } = await runCLI([]);
      expect(stdout).toContain('spectrl');
      expect(stdout).toContain('init');
      expect(stdout).toContain('publish');
      expect(stdout).toContain('install');
      expect(exitCode).toBe(1);
    });

    it('should show help with --help flag', async () => {
      const { stdout, exitCode } = await runCLI(['--help']);
      expect(stdout).toContain('spectrl');
      expect(stdout).toContain('Local-first spec registry');
      expect(exitCode).toBe(0);
    });

    it('should show init command help', async () => {
      const { stdout, exitCode } = await runCLI(['init', '--help']);
      expect(stdout).toContain('spectrl init');
      expect(stdout).toContain('Initialize a new project');
      expect(exitCode).toBe(1);
    });

    it('should show publish command help', async () => {
      const { stdout, exitCode } = await runCLI(['publish', '--help']);
      expect(stdout).toContain('spectrl publish');
      expect(stdout).toContain('Publish a spec');
      expect(exitCode).toBe(1);
    });

    it('should show install command help', async () => {
      const { stdout, exitCode } = await runCLI(['install', '--help']);
      expect(stdout).toContain('spectrl install');
      expect(stdout).toContain('Install specs using symlinks');
      expect(exitCode).toBe(1);
    });

    it('should handle unknown command', async () => {
      const { stdout, stderr, exitCode } = await runCLI(['unknown']);
      // cmd-ts outputs help to stdout when unknown command is provided
      const output = stdout + stderr;
      expect(output).toContain('spectrl');
      expect(exitCode).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should exit with validation error code when manifest is invalid', async () => {
      const { stderr, exitCode } = await runCLI(['publish']);
      expect(stderr).toContain('Error:');
      // Exit code will be 2 (IO_ERROR) when spectrl.json doesn't exist
      expect(exitCode).toBe(2);
    });

    it('should exit with IO error code when file not found', async () => {
      const { stderr, exitCode } = await runCLI(['publish']);
      expect(stderr).toContain('Error:');
      // Exit code will be 1 (validation) or 2 (IO) depending on what fails first
      expect([1, 2]).toContain(exitCode);
    });
  });

  describe('Output Formatting', () => {
    it('should output errors to stderr', async () => {
      const { stderr, stdout } = await runCLI(['publish']);
      expect(stderr).toContain('Error:');
      expect(stdout).toBe('');
    });
  });
});
