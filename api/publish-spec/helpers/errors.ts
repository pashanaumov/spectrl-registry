const CLIENT_ERROR_PREFIXES = [
  'FILE_TOO_LARGE',
  'TOTAL_SIZE_EXCEEDED',
  'FILE_COUNT_EXCEEDED',
  'INVALID_PATH',
  'MISSING_FILE',
  'UNLISTED_FILE',
  'INVALID_TOKEN',
] as const;

export function isClientError(errorMessage: string): boolean {
  return CLIENT_ERROR_PREFIXES.some((prefix) => errorMessage.startsWith(prefix));
}

export function getErrorStatusCode(errorMessage: string): number {
  if (errorMessage.startsWith('INVALID_TOKEN')) {
    return 401;
  }

  if (isClientError(errorMessage)) {
    return 400;
  }

  return 500;
}
