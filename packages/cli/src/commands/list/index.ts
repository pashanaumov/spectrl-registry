import Table from 'cli-table3';
import chalk from 'chalk';
import { promises as fs } from 'node:fs';
import { getProjectIndexPath, fileExists } from '../../utils.js';
import { CLIError, ExitCode } from '../../errors.js';

/**
 * List all installed specs from the project index
 *
 * Displays a table showing:
 * - Spec name
 * - Version
 * - Source (local or public)
 *
 * Uses color coding:
 * - Blue for public specs
 * - Green for local specs
 *
 * @param options - Command options
 * @param options.cwd - Current working directory (default: process.cwd())
 * @throws {CLIError} If project is not initialized or index cannot be read
 */
export async function list(options: { cwd?: string } = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();

  try {
    // Check if project is initialized
    const projectIndexPath = getProjectIndexPath(cwd);
    if (!(await fileExists(projectIndexPath))) {
      throw new CLIError(
        'Project not initialized. Run "spectrl init" to set up dependency management.',
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Read project index
    const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
    const index = JSON.parse(indexContent) as Record<string, { source: string; hash: string }>;

    const entries = Object.entries(index);

    // Handle empty state
    if (entries.length === 0) {
      console.log(chalk.yellow('\nNo specs installed'));
      console.log(chalk.dim('Install a spec with: spectrl install <spec>'));
      console.log(chalk.dim('Example: spectrl install alice/api-spec\n'));
      return;
    }

    // Display header
    console.log(chalk.bold('\nInstalled specs:\n'));

    // Create table
    const table = new Table({
      head: [chalk.cyan('Spec'), chalk.cyan('Version'), chalk.cyan('Source')],
      colWidths: [35, 12, 12],
      style: {
        head: [],
        border: ['dim'],
      },
    });

    // Add rows
    for (const [key, data] of entries) {
      // Detect if source is public (starts with http:// or https://)
      const isPublic = data.source.startsWith('https://') || data.source.startsWith('http://');
      const sourceLabel = isPublic ? chalk.blue('public') : chalk.green('local');

      // Parse spec name and version from key
      // Key format: "name@version" or "username/name@version"
      const atIndex = key.lastIndexOf('@');
      let specName: string;
      let version: string;

      if (atIndex !== -1) {
        specName = key.substring(0, atIndex);
        version = key.substring(atIndex + 1);
      } else {
        specName = key;
        version = chalk.dim('unknown');
      }

      table.push([chalk.bold(specName), version, sourceLabel]);
    }

    // Display table
    console.log(table.toString());

    // Display count
    const count = entries.length;
    console.log(chalk.dim(`\n${count} spec${count === 1 ? '' : 's'} installed\n`));
  } catch (error) {
    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      throw new CLIError(
        'Project index is corrupted. Try running "spectrl init" to reinitialize.',
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Handle file system errors
    if (error instanceof Error) {
      throw new CLIError(`Failed to read project index: ${error.message}`, ExitCode.IO_ERROR);
    }

    // Unknown error type
    throw new CLIError('Unknown error while listing specs', ExitCode.IO_ERROR);
  }
}
