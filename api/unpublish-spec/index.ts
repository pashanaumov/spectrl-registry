import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { pathParametersSchema, extractToken } from './schemas/request';
import { unpublishResponseSchema, errorResponseSchema } from './schemas/response';
import { getGitHubUser } from '../shared/github';
import { validateOwnership, validateSpecExists } from './helpers/validation';
import { checkSpecExists, deleteSpecMetadata } from './helpers/dynamodb';
import { deleteSpecFromS3 } from './helpers/s3';
import { getErrorStatusCode } from './helpers/errors';

/**
 * Lambda handler for unpublishing specs from the public registry
 *
 * Flow:
 * 1. Extract and validate Authorization header (Bearer token)
 * 2. Verify token with GitHub API and get authenticated username
 * 3. Parse and validate path parameters (username, specName, version)
 * 4. Check ownership: authenticated username must match spec username
 * 5. Check if spec version exists in DynamoDB
 * 6. Delete metadata from DynamoDB
 * 7. Delete manifest and files from S3
 * 8. Return success response
 *
 * Path parameters:
 * - username: GitHub username (alphanumeric + hyphens)
 * - specName: Spec name (alphanumeric + hyphens + underscores)
 * - version: Semver version (e.g., 1.0.0)
 *
 * Security:
 * - Requires valid GitHub token
 * - Validates ownership before deletion
 * - All inputs validated with Zod schemas
 *
 * Response format:
 * {
 *   message: "Unpublished username/spec-name@1.0.0",
 *   specId: "username/spec-name",
 *   version: "1.0.0"
 * }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received unpublish request:', JSON.stringify(event, null, 2));

  try {
    // 1. Extract and validate Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      const errorResponse = errorResponseSchema.parse({
        error: 'Authorization header is required',
      });

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    const token = extractToken(authHeader);

    // 2. Verify token with GitHub and get authenticated username
    const { username: authenticatedUsername } = await getGitHubUser(token);
    console.log(`Authenticated user: ${authenticatedUsername}`);

    // 3. Parse and validate path parameters
    const pathParams = pathParametersSchema.safeParse(event.pathParameters || {});

    if (!pathParams.success) {
      const errorResponse = errorResponseSchema.parse({
        error: `Invalid path parameters: ${pathParams.error.issues[0].message}`,
      });

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    const { username, specName, version } = pathParams.data;
    const specId = `${username}/${specName}`;
    console.log(`Unpublishing spec: ${specId}@${version}`);

    // 4. Validate ownership
    validateOwnership(authenticatedUsername, username);
    console.log('Ownership validated');

    // 5. Check if spec exists
    const specExists = await checkSpecExists(specId, version);
    validateSpecExists(specExists, specId, version);

    // 6. Delete from DynamoDB first
    await deleteSpecMetadata(specId, version);

    // 7. Delete from S3
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable not set');
    }

    await deleteSpecFromS3(bucketName, username, specName, version);

    // 8. Return success response
    const response = unpublishResponseSchema.parse({
      message: `Unpublished ${specId}@${version}`,
      specId,
      version,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error unpublishing spec:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);

    const errorResponse = errorResponseSchema.parse({
      error: errorMessage,
    });

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(errorResponse),
    };
  }
}
