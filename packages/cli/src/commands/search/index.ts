import Table from 'cli-table3';
import chalk from 'chalk';
import { searchSpecs, type SearchResult } from '../../utils/api-client.js';
import { CLIError, ExitCode, formatCommand } from '../../errors.js';

/**
 * Search for specs in the public registry
 *
 * @param query - Search query string
 * @throws {CLIError} If the search fails or API returns invalid data
 */
export async function search(query: string): Promise<void> {
  // Validate query parameter
  if (!query || query.trim().length === 0) {
    throw new CLIError('Search query cannot be empty', ExitCode.VALIDATION_ERROR);
  }

  try {
    // Call API with search query - searchSpecs already validates response with Zod
    const response = await searchSpecs(query.trim());

    // Handle empty results
    if (response.results.length === 0) {
      console.log(chalk.yellow('\nNo specs found'));
      console.log(chalk.dim('Try a different search term or browse all specs'));
      console.log(`Example: ${formatCommand('spectrl search api')}\n`);
      return;
    }

    // Display results count
    const count = response.results.length;
    console.log(
      chalk.bold(`\nFound ${count} spec${count === 1 ? '' : 's'} matching "${query}":\n`),
    );

    // Create table with proper formatting
    const table = new Table({
      head: [
        chalk.cyan('Spec'),
        chalk.cyan('Description'),
        chalk.cyan('Tags'),
        chalk.cyan('Version'),
      ],
      colWidths: [35, 40, 18, 10],
      wordWrap: true,
      style: {
        head: [],
        border: ['dim'],
      },
    });

    // Add rows - response.results is already validated by Zod in searchSpecs()
    for (const spec of response.results) {
      // Format each field with proper fallbacks
      const specId = spec.specId || chalk.dim('unknown');
      const description = spec.description || chalk.dim('No description');
      const tags = spec.tags && spec.tags.length > 0 ? spec.tags.join(', ') : chalk.dim('none');
      const version = spec.version || chalk.dim('unknown');

      table.push([chalk.bold(specId), description, tags, version]);
    }

    // Display table
    console.log(table.toString());

    // Show install instructions
    console.log(`\nInstall with: ${formatCommand('spectrl install <spec>')}`);
    console.log(`Example: ${formatCommand('spectrl install alice/api-spec')}\n`);
  } catch (error) {
    // Re-throw CLIError as-is (from api-client or validation)
    if (error instanceof CLIError) {
      throw error;
    }

    // Handle API errors
    if (error instanceof Error) {
      throw new CLIError(`Search failed: ${error.message}`, ExitCode.IO_ERROR);
    }

    // Unknown error type
    throw new CLIError('Unknown error during search', ExitCode.IO_ERROR);
  }
}
