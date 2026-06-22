import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { TokenManager } from '../../auth/token-manager.js';
import { parseSpecRef } from '../../utils/spec-ref.js';
import { unpublishSpec, ApiError } from '../../utils/api-client.js';
import { CLIError, ExitCode, formatHighlight, formatCommand } from '../../errors.js';
import { output, formatPublicSpecKey } from '../../utils.js';

/**
 * Unpublish a spec version from the public registry
 *
 * This is a destructive operation that permanently removes a spec version.
 * Requires authentication and user confirmation.
 *
 * @param specRef - Spec reference in format username/spec@version
 * @throws {CLIError} If not authenticated, version not specified, or unpublish fails
 */
export async function unpublish(specRef: string): Promise<void> {
  try {
    // Parse spec reference
    let parsed: ReturnType<typeof parseSpecRef>;
    try {
      parsed = parseSpecRef(specRef);
    } catch (error) {
      throw new CLIError(
        `Invalid spec reference: ${error instanceof Error ? error.message : String(error)}`,
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Validate it's a public spec
    if (!parsed.isPublic || !parsed.username) {
      throw new CLIError(
        'Unpublish only works with public specs. Use format: username/spec@version',
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Require version
    if (!parsed.version) {
      throw new CLIError(
        [
          'Version is required for unpublish',
          '',
          `Usage: spectrl unpublish ${formatHighlight(`${parsed.username}/${parsed.name}@<version>`)}`,
          '',
          'Example: spectrl unpublish alice/api-spec@1.0.0',
        ].join('\n'),
        ExitCode.VALIDATION_ERROR,
      );
    }

    const { username, name, version } = parsed;
    const fullSpecRef = formatPublicSpecKey(username, name, version);

    // Check authentication
    const tokenManager = new TokenManager();
    const token = await tokenManager.get();

    if (!token) {
      throw new CLIError(
        `You need to login first to unpublish specs\n\nRun: ${formatCommand('spectrl login')}`,
        ExitCode.AUTHENTICATION_ERROR,
      );
    }

    // Show destructive operation warning and prompt for confirmation
    output.log('');
    output.log(
      chalk.yellow(
        `⚠️  This will permanently delete ${formatHighlight(fullSpecRef)} from the public registry.`,
      ),
    );
    output.log('');

    const confirmed = await select<boolean>({
      message: 'Are you sure you want to continue?',
      choices: [
        {
          name: 'No, cancel',
          value: false,
          description: 'Keep the spec and abort',
        },
        {
          name: `Yes, delete ${fullSpecRef}`,
          value: true,
          description: 'Permanently remove this version from the registry',
        },
      ],
      default: false,
    });

    if (!confirmed) {
      output.log(chalk.dim('Cancelled'));
      return;
    }

    // Call API to unpublish
    output.log('');
    output.log(chalk.dim(`Unpublishing ${formatHighlight(fullSpecRef)}...`));

    try {
      const result = await unpublishSpec(token, username, name, version);
      output.log('');
      output.log(chalk.green(`✓ ${result.message}`));
      output.log('');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw new CLIError(
            [
              'Authentication failed',
              '',
              'Your token may have expired or you may not have permission to unpublish this spec.',
              '',
              'Try logging in again: spectrl login',
            ].join('\n'),
            ExitCode.AUTHENTICATION_ERROR,
          );
        }

        if (error.statusCode === 404) {
          throw new CLIError(
            `Spec version ${formatHighlight(fullSpecRef)} not found in the registry`,
            ExitCode.DEPENDENCY_ERROR,
          );
        }

        throw new CLIError(`Failed to unpublish: ${error.message}`, ExitCode.IO_ERROR);
      }

      throw error;
    }
  } catch (error) {
    // Re-throw CLIError as-is
    if (error instanceof CLIError) {
      throw error;
    }

    // Wrap other errors
    throw new CLIError(
      `Unpublish failed: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.IO_ERROR,
    );
  }
}
