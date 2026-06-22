import type { Request, Response } from 'express';
import { searchSpecs } from './helpers/dynamodb';
import { getErrorStatusCode } from './helpers/errors';
import { searchQuerySchema } from './schemas/request';
import { searchResponseSchema, errorResponseSchema } from './schemas/response';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received search request:', JSON.stringify(req.query, null, 2));

  try {
    const queryParams = searchQuerySchema.safeParse(req.query);

    if (!queryParams.success) {
      const errorResponse = errorResponseSchema.parse({ error: 'Invalid query parameters' });
      res.status(400).json(errorResponse);
      return;
    }

    const query = queryParams.data.q || '';
    const limit = queryParams.data.limit;
    const nextToken = queryParams.data.nextToken;
    const type = queryParams.data.type;
    console.log(
      `Search query: "${query}", limit: ${limit}, nextToken: ${nextToken || 'none'}, type: ${type || 'all'}`,
    );

    try {
      const searchResult = await searchSpecs({ query, limit, nextToken, type });

      const response = searchResponseSchema.parse({
        results: searchResult.results,
        count: searchResult.count,
        nextToken: searchResult.nextToken,
        hasMore: searchResult.hasMore,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid nextToken')) {
        console.error('Invalid nextToken provided:', error.message);
        res.status(400).json(errorResponseSchema.parse({ error: error.message }));
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error searching specs:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);

    res.status(statusCode).json(errorResponseSchema.parse({ error: errorMessage }));
  }
}
