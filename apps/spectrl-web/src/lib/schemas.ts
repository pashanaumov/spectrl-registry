import { z } from 'zod';

/**
 * Zod schemas for Spectrl API responses
 *
 * These schemas validate external API data to ensure type safety and catch
 * API contract changes early. Never trust external data - always validate!
 */

// Individual search result item
export const SearchResultSchema = z.object({
  specId: z.string(),
  version: z.string(),
  username: z.string(),
  specName: z.string(),
  description: z.string(),
  type: z.enum(['spec', 'power']).default('spec'),
  tags: z.array(z.string()),
  publishedAt: z.string(), // ISO 8601 date string
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Search API response with cursor-based pagination
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  count: z.number(),
  nextToken: z.string().optional(), // Base64-encoded cursor for next page
  hasMore: z.boolean().optional(), // Whether more results are available (can be computed from nextToken)
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// Individual spec version
export const SpecVersionSchema = z.object({
  version: z.string(),
  description: z.string(),
  type: z.enum(['spec', 'power']).default('spec'),
  tags: z.array(z.string()).optional(),
  publishedAt: z.string(), // ISO 8601 date string
  s3Path: z.string(),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Invalid hash format'),
  files: z.array(z.string().min(1)),
  downloads: z.number().optional(),
  deps: z.record(z.string(), z.string()).optional(),
});

export type SpecVersion = z.infer<typeof SpecVersionSchema>;

// Get Spec API response
export const GetSpecResponseSchema = z.object({
  specId: z.string(),
  username: z.string(),
  specName: z.string(),
  versions: z.array(SpecVersionSchema),
});

export type GetSpecResponse = z.infer<typeof GetSpecResponseSchema>;

// API Error response
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Network error class for fetch failures
export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
