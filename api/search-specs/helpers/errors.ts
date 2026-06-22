/**
 * Map error messages to HTTP status codes
 */
export function getErrorStatusCode(errorMessage: string): number {
  // DynamoDB errors
  if (errorMessage.includes('ResourceNotFoundException')) {
    return 404;
  }

  if (errorMessage.includes('ValidationException')) {
    return 400;
  }

  // Default to 500 for unknown errors
  return 500;
}
