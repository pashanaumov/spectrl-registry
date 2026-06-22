/**
 * Map error messages to HTTP status codes
 */
export function getErrorStatusCode(errorMessage: string): number {
  // Authentication errors
  if (errorMessage.includes('Authorization header') || errorMessage.includes('GitHub API failed')) {
    return 401;
  }

  // Ownership/permission errors
  if (errorMessage.includes('Ownership validation failed')) {
    return 403;
  }

  // Not found errors
  if (errorMessage.includes('not found') || errorMessage.includes('Spec not found')) {
    return 404;
  }

  // Validation errors
  if (
    errorMessage.includes('Invalid') ||
    errorMessage.includes('must contain') ||
    errorMessage.includes('is required') ||
    errorMessage.includes('must be')
  ) {
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
