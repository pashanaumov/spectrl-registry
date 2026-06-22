/**
 * Map error messages to HTTP status codes
 */
export function getErrorStatusCode(errorMessage: string): number {
  // Validation errors
  if (errorMessage.includes('Invalid') || errorMessage.includes('must contain')) {
    return 400;
  }

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
