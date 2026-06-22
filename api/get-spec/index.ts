import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { pathParametersSchema } from './schemas/request';
import { getSpecResponseSchema, errorResponseSchema } from './schemas/response';
import { getSpecVersions } from './helpers/dynamodb';
import { getErrorStatusCode } from './helpers/errors';

/**
 * Lambda handler for retrieving spec metadata
 *
 * Flow:
 * 1. Parse and validate path parameters (username, specName)
 * 2. Construct specId from username/specName
 * 3. Query DynamoDB for all versions of the spec
 * 4. Sort versions by newest first
 * 5. Return spec metadata with all versions
 *
 * Path parameters:
 * - username: GitHub username (alphanumeric + hyphens)
 * - specName: Spec name (alphanumeric + hyphens + underscores)
 *
 * Response format:
 * {
 *   specId: "username/spec-name",
 *   versions: [
 *     {
 *       version: "1.0.0",
 *       description: "...",
 *       tags: ["tag1"],
 *       createdAt: "2024-01-01T00:00:00Z",
 *       s3Path: "specs/username/spec-name/1.0.0",
 *       hash: "sha256...",
 *       files: ["file1.md", "file2.md"],
 *       downloads: 42
 *     }
 *   ]
 * }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received get-spec request:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse and validate path parameters
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

    const { username, specName } = pathParams.data;
    const specId = `${username}/${specName}`;
    console.log(`Fetching spec: ${specId}`);

    // 2. Query DynamoDB for all versions
    const versions = await getSpecVersions(specId);

    // 3. Handle non-existent spec
    if (versions.length === 0) {
      const errorResponse = errorResponseSchema.parse({
        error: `Spec not found: ${specId}`,
      });

      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    // 4. Transform versions to match CLI expectations
    // Keep field names simple and consistent
    const transformedVersions = versions.map((v) => ({
      version: v.version,
      description: v.description,
      type: v.type,
      tags: v.tags,
      publishedAt: v.createdAt,
      s3Path: v.s3Path,
      hash: v.hash,
      files: v.files,
      downloads: v.downloads,
      deps: v.deps,
    }));

    // 5. Return response with top-level username and specName
    const response = {
      specId,
      username,
      specName,
      versions: transformedVersions,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting spec:', error);

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
