import chalk from 'chalk';
import Table from 'cli-table3';
import { formatDistanceToNow } from 'date-fns';
import { CLIError, ExitCode, formatCommand } from '../../errors.js';
import { ApiError, getSpec, type GetSpecResponse } from '../../utils/api-client.js';
import { parseSpecRef } from '../../utils/spec-ref.js';

/**
 * Format a number with thousand separators for readability
 *
 * @param num - The number to format
 * @returns Formatted string with commas (e.g., "1,234")
 */
function formatDownloadCount(num: number): string {
  return num.toLocaleString('en-GB');
}

/**
 * Display detailed information about a spec from the public registry
 *
 * Shows:
 * - Spec name and description
 * - Tags
 * - All available versions with publish dates and download counts
 * - Install instructions
 *
 * @param specRef - Spec reference in format username/spec (version is ignored)
 * @throws {CLIError} If the spec reference is invalid or spec is not found
 */
export async function info(specRef: string): Promise<void> {
  // Parse and validate spec reference
  let parsed: ReturnType<typeof parseSpecRef>;
  try {
    parsed = parseSpecRef(specRef);
  } catch (error) {
    if (error instanceof Error) {
      throw new CLIError(`Invalid spec reference: ${error.message}`, ExitCode.VALIDATION_ERROR);
    }
    throw new CLIError('Invalid spec reference format', ExitCode.VALIDATION_ERROR);
  }

  // Ensure it's a public spec (has username)
  if (!parsed.isPublic || !parsed.username) {
    throw new CLIError(
      'Info command requires a public spec reference (username/spec)',
      ExitCode.VALIDATION_ERROR,
    );
  }

  try {
    // Fetch spec metadata from API - getSpec already validates with Zod
    const spec: GetSpecResponse = await getSpec(parsed.username, parsed.name);

    // Display spec header
    console.log(chalk.bold.cyan(`\n${spec.specId}`));

    // Display description from latest version
    if (spec.versions.length > 0 && spec.versions[0].description) {
      console.log(spec.versions[0].description);
    }

    // Display tags from latest version
    if (spec.versions.length > 0 && spec.versions[0].tags && spec.versions[0].tags.length > 0) {
      console.log(chalk.dim(`\nTags: ${spec.versions[0].tags.join(', ')}`));
    }

    // Display versions table
    if (spec.versions.length === 0) {
      console.log(chalk.yellow('\nNo versions available'));
    } else {
      console.log(chalk.bold('\nVersions:'));

      const table = new Table({
        head: [chalk.cyan('Version'), chalk.cyan('Published'), chalk.cyan('Downloads')],
        colWidths: [12, 30, 15],
        style: {
          head: [],
          border: ['dim'],
        },
      });

      // Add each version to the table
      for (const version of spec.versions) {
        const publishedDate = new Date(version.publishedAt);
        const relativeTime = formatDistanceToNow(publishedDate, { addSuffix: true });
        const formattedDate = `${publishedDate.toISOString().split('T')[0]} (${relativeTime})`;

        // Format downloads with thousand separators, default to 0 if missing
        const downloadCount = version.downloads ?? 0;
        const formattedDownloads = formatDownloadCount(downloadCount);

        table.push([chalk.bold(version.version), formattedDate, formattedDownloads]);
      }

      console.log(table.toString());
    }

    // Display install instructions
    console.log(`\nInstall latest: ${formatCommand(`spectrl install ${spec.specId}`)}`);
    console.log(`Install specific: ${formatCommand(`spectrl install ${spec.specId}@<version>`)}\n`);
  } catch (error) {
    // Re-throw CLIError as-is (from api-client or validation)
    if (error instanceof CLIError) {
      throw error;
    }

    // Handle API errors - check for ApiError type with statusCode
    if (error instanceof ApiError) {
      if (error.statusCode === 404) {
        throw new CLIError(`Spec not found: ${parsed.username}/${parsed.name}`, ExitCode.IO_ERROR);
      }

      throw new CLIError(`Failed to get spec info: ${error.message}`, ExitCode.IO_ERROR);
    }

    // Handle other errors
    if (error instanceof Error) {
      throw new CLIError(`Failed to get spec info: ${error.message}`, ExitCode.IO_ERROR);
    }

    // Unknown error type
    throw new CLIError('Unknown error while fetching spec info', ExitCode.IO_ERROR);
  }
}
