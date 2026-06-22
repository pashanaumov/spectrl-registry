import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { trackDownloadRequestSchema } from './schemas/request';
import { trackDownloadResponseSchema, errorResponseSchema } from './schemas/response';
import { incrementDownloadCount } from './helpers/dynamodb';

/**
 * Lambda handler for tracking spec downloads
 *
 * Flow:
 * 1. Parse and validate request body (username, specName, version)
 * 2. Atomically increment downloads counter in DynamoDB
 * 3. Return success response with updated download count
 *
 * Request body:
 * {
 *   username: string,    // GitHub username
 *   specName: string,    // Spec name
 *   version: string      // Semver version
 * }
 *
 * Response format:
 * {
 *   success: true,
 *   downloads: number    // Updated download count
 * }
 *
 * Error responses:
 * - 400: Invalid request parameters
 * - 404: Spec version not found
 * - 503: DynamoDB service unavailable
 * - 500: Internal server error
 *
 * Note: No authentication required. Rate limiting is handled by API Gateway (100 req/min per IP).
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received track-download request:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse and validate request body
    let requestBody: Record<string, unknown>;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      const errorResponse = errorResponseSchema.parse({
        error: 'Invalid JSON in request body',
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

    const bodyValidation = trackDownloadRequestSchema.safeParse(requestBody);

    if (!bodyValidation.success) {
      const errorResponse = errorResponseSchema.parse({
        error: `Invalid request parameters: ${bodyValidation.error.issues[0].message}`,
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

    const { username, specName, version } = bodyValidation.data;
    const specId = `${username}/${specName}`;

    console.log(`Tracking download for ${specId}@${version}`);

    // 2. Atomically increment downloads counter
    const downloads = await incrementDownloadCount(specId, version);

    // 3. Return success response
    const response = trackDownloadResponseSchema.parse({
      success: true,
      downloads,
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
    console.error('Error tracking download:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Handle specific error cases
    let statusCode = 500;

    if (errorMessage.includes('Spec version not found')) {
      statusCode = 404;
    } else if (errorMessage.includes('DynamoDB') || errorMessage.includes('service')) {
      statusCode = 503;
    }

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
