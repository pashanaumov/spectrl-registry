/**
 * Map error messages to HTTP status codes
 *
 * Provides consistent error code mapping across the Lambda function.
 * Used for both DynamoDB errors and validation errors.
 */
export function getErrorStatusCode(errorMessage: string): number {
  // Spec not found
  if (errorMessage.includes('Spec version not found') || errorMessage.includes('not found')) {
    return 404;
  }

  // Validation errors
  if (
    errorMessage.includes('Invalid') ||
    errorMessage.includes('must contain') ||
    errorMessage.includes('ValidationException')
  ) {
    return 400;
  }

  // Authentication errors
  if (
    errorMessage.includes('Authorization') ||
    errorMessage.includes('token') ||
    errorMessage.includes('Unauthorized')
  ) {
    return 401;
  }

  // Service unavailable (DynamoDB down, etc.)
  if (
    errorMessage.includes('DynamoDB') ||
    errorMessage.includes('service') ||
    errorMessage.includes('ServiceUnavailable') ||
    errorMessage.includes('ThrottlingException')
  ) {
    return 503;
  }

  // Default to 500 for unknown errors
  return 500;
}
