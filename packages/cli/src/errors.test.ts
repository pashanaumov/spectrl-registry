import { describe, it, expect } from 'vitest';
import {
  CLIError,
  ExitCode,
  formatError,
  formatWarning,
  formatInfo,
  formatSuccess,
  formatHighlight,
  getExitCode,
} from './errors.js';

describe('ExitCode', () => {
  it('should define all required exit codes', () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.VALIDATION_ERROR).toBe(1);
    expect(ExitCode.IO_ERROR).toBe(2);
    expect(ExitCode.DEPENDENCY_ERROR).toBe(3);
  });
});

describe('CLIError', () => {
  it('should create error with message and exit code', () => {
    const error = new CLIError('Test error', ExitCode.VALIDATION_ERROR);

    expect(error.message).toBe('Test error');
    expect(error.exitCode).toBe(ExitCode.VALIDATION_ERROR);
    expect(error.name).toBe('CLIError');
  });

  it('should be instanceof Error', () => {
    const error = new CLIError('Test error', ExitCode.IO_ERROR);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CLIError);
  });

  it('should have stack trace', () => {
    const error = new CLIError('Test error', ExitCode.DEPENDENCY_ERROR);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('CLIError');
  });
});

describe('formatError', () => {
  it('should format error without operation', () => {
    const error = new Error('Something went wrong');
    const formatted = formatError(error);

    expect(formatted).toContain('Error:');
    expect(formatted).toContain('Something went wrong');
  });

  it('should format error with operation', () => {
    const error = new CLIError('Invalid manifest', ExitCode.VALIDATION_ERROR);
    const formatted = formatError(error, 'publish');

    expect(formatted).toContain('Error:');
    expect(formatted).toContain('publish');
    expect(formatted).toContain('failed:');
    expect(formatted).toContain('Invalid manifest');
  });

  it('should handle CLIError same as Error', () => {
    const error = new CLIError('File not found', ExitCode.IO_ERROR);
    const formatted = formatError(error);

    expect(formatted).toContain('Error:');
    expect(formatted).toContain('File not found');
  });
});

describe('formatWarning', () => {
  it('should format warning message', () => {
    const formatted = formatWarning('This is a warning');

    expect(formatted).toContain('Warning:');
    expect(formatted).toContain('This is a warning');
  });
});

describe('formatInfo', () => {
  it('should format info message', () => {
    const formatted = formatInfo('This is info');

    expect(formatted).toContain('This is info');
  });
});

describe('formatSuccess', () => {
  it('should format success message', () => {
    const formatted = formatSuccess('Operation completed');

    expect(formatted).toContain('Operation completed');
  });
});

describe('formatHighlight', () => {
  it('should format highlighted text', () => {
    const formatted = formatHighlight('example-spec@1.0.0');

    expect(formatted).toContain('example-spec@1.0.0');
  });
});

describe('getExitCode', () => {
  it('should return exit code from CLIError', () => {
    const error = new CLIError('Test', ExitCode.DEPENDENCY_ERROR);

    expect(getExitCode(error)).toBe(ExitCode.DEPENDENCY_ERROR);
  });

  it('should return VALIDATION_ERROR for regular Error', () => {
    const error = new Error('Test');

    expect(getExitCode(error)).toBe(ExitCode.VALIDATION_ERROR);
  });

  it('should return VALIDATION_ERROR for unknown error types', () => {
    expect(getExitCode('string error')).toBe(ExitCode.VALIDATION_ERROR);
    expect(getExitCode(null)).toBe(ExitCode.VALIDATION_ERROR);
    expect(getExitCode(undefined)).toBe(ExitCode.VALIDATION_ERROR);
    expect(getExitCode(42)).toBe(ExitCode.VALIDATION_ERROR);
  });

  it('should handle all exit code types', () => {
    expect(getExitCode(new CLIError('', ExitCode.SUCCESS))).toBe(ExitCode.SUCCESS);
    expect(getExitCode(new CLIError('', ExitCode.VALIDATION_ERROR))).toBe(
      ExitCode.VALIDATION_ERROR,
    );
    expect(getExitCode(new CLIError('', ExitCode.IO_ERROR))).toBe(ExitCode.IO_ERROR);
    expect(getExitCode(new CLIError('', ExitCode.DEPENDENCY_ERROR))).toBe(
      ExitCode.DEPENDENCY_ERROR,
    );
  });
});
