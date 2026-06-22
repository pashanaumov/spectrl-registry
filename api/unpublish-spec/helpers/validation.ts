/**
 * Validation helpers for unpublish operation
 */

/**
 * Validate ownership of a spec
 * Ensures the authenticated user owns the spec they're trying to unpublish
 *
 * @param authenticatedUsername - Username from GitHub token
 * @param specUsername - Username from path parameter
 * @throws Error if ownership validation fails
 */
export function validateOwnership(authenticatedUsername: string, specUsername: string): void {
  if (authenticatedUsername !== specUsername) {
    throw new Error(
      `Ownership validation failed: You (${authenticatedUsername}) do not own specs under ${specUsername}`,
    );
  }
}

/**
 * Validate that spec exists in DynamoDB before attempting deletion
 *
 * @param specExists - Whether the spec was found in DynamoDB
 * @param specId - The spec identifier
 * @param version - The version being unpublished
 * @throws Error if spec doesn't exist
 */
export function validateSpecExists(specExists: boolean, specId: string, version: string): void {
  if (!specExists) {
    throw new Error(`Spec not found: ${specId}@${version}`);
  }
}
