import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { searchSpecs } from './helpers/dynamodb';
import { getErrorStatusCode } from './helpers/errors';
import { searchQuerySchema } from './schemas/request';
import { searchResponseSchema, errorResponseSchema } from './schemas/response';

/**
 * Lambda handler for searching specs in the public registry
 *
 * Flow:
 * 1. Parse and validate query parameters (q, limit, nextToken) from query string
 * 2. Scan DynamoDB specs table with filter expression
 * 3. Match against specName, description, and agentTags
 * 4. Apply cursor-based pagination using DynamoDB's native LastEvaluatedKey
 * 5. Validate and return formatted search results with pagination metadata
 *
 * Query parameters:
 * - q: search query (optional, max 200 chars, if empty returns all specs)
 * - limit: results per page (optional, default: 20, min: 1, max: 100)
 * - nextToken: base64-encoded cursor for pagination (optional)
 *
 * Response format:
 * {
 *   results: [
 *     {
 *       specId: "username/spec-name",
 *       version: "1.0.0",
 *       username: "username",
 *       specName: "spec-name",
 *       description: "...",
 *       tags: ["tag1", "tag2"],
 *       publishedAt: "2024-01-01T00:00:00Z"
 *     }
 *   ],
 *   count: 5,
 *   nextToken: "base64-encoded-cursor",
 *   hasMore: true
 * }
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received search request:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse and validate query parameters
    const queryParams = searchQuerySchema.safeParse(event.queryStringParameters || {});

    if (!queryParams.success) {
      const errorResponse = errorResponseSchema.parse({
        error: 'Invalid query parameters',
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

    const query = queryParams.data.q || '';
    const limit = queryParams.data.limit;
    const nextToken = queryParams.data.nextToken;
    const type = queryParams.data.type;
    console.log(
      `Search query: "${query}", limit: ${limit}, nextToken: ${nextToken || 'none'}, type: ${type || 'all'}`,
    );

    // 2. Search specs in DynamoDB with pagination
    try {
      const searchResult = await searchSpecs({ query, limit, nextToken, type });

      // 3. Validate and return results with pagination metadata
      const response = searchResponseSchema.parse({
        results: searchResult.results,
        count: searchResult.count,
        nextToken: searchResult.nextToken,
        hasMore: searchResult.hasMore,
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
      // Handle invalid nextToken errors specifically
      if (error instanceof Error && error.message.includes('Invalid nextToken')) {
        console.error('Invalid nextToken provided:', error.message);

        const errorResponse = errorResponseSchema.parse({
          error: error.message,
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

      // Re-throw other errors to be handled by outer catch
      throw error;
    }
  } catch (error) {
    console.error('Error searching specs:', error);

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
