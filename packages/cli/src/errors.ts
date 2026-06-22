import chalk from 'chalk';

/**
 * Exit codes for CLI operations
 */
export const ExitCode = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  IO_ERROR: 2,
  DEPENDENCY_ERROR: 3,
  AUTHENTICATION_ERROR: 4,
  USER_CANCELLED: 130, // Standard exit code for Ctrl+C (128 + SIGINT signal 2)
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Custom error class for CLI operations with exit codes
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode,
  ) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace(this, CLIError);
  }
}

/**
 * Format error message for stderr output with color
 */
export function formatError(error: Error | CLIError, operation?: string): string {
  const prefix = chalk.red('Error:');
  const operationText = operation ? ` ${chalk.yellow(operation)} failed:` : '';
  return `${prefix}${operationText} ${error.message}`;
}

/**
 * Format warning message with color
 */
export function formatWarning(message: string): string {
  return `${chalk.yellow('Warning:')} ${message}`;
}

/**
 * Format info message with dimmed color
 */
export function formatInfo(message: string): string {
  return chalk.dim(message);
}

/**
 * Format success message with green color
 */
export function formatSuccess(message: string): string {
  return chalk.green(message);
}

/**
 * Format highlight text with cyan color (for names, versions, etc.)
 */
export function formatHighlight(text: string): string {
  return chalk.cyan(text);
}

/**
 * Format a command suggestion with color highlighting
 *
 * @param command - The command to format (e.g., "spectrl login")
 * @returns Formatted command with color
 *
 * @example
 * formatCommand("spectrl login") // Returns colored "spectrl login"
 */
export function formatCommand(command: string): string {
  return chalk.cyan.bold(command);
}

/**
 * Get exit code from error
 */
export function getExitCode(error: unknown): ExitCode {
  if (error instanceof CLIError) {
    return error.exitCode;
  }
  // Default to validation error for unknown errors
  return ExitCode.VALIDATION_ERROR;
}
