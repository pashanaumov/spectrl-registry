import { z } from 'zod/v4';

export const searchResultSchema = z.object({
  specId: z.string(),
  version: z.string(),
  username: z.string(),
  specName: z.string(),
  description: z.string(),
  type: z.enum(['spec', 'power']).default('spec'),
  tags: z.array(z.string()),
  publishedAt: z.string(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// Search response schema with cursor-based pagination support
export const searchResponseSchema = z.object({
  // Array of search results
  results: z.array(searchResultSchema),

  // Number of results in current page
  count: z.number(),

  // Base64-encoded cursor for next page (if more results exist)
  nextToken: z.string().optional(),

  // Whether there are more results available
  hasMore: z.boolean(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
});
