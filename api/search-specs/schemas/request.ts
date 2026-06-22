import { z } from 'zod/v4';

// Query string parameters schema for search endpoint
// Supports cursor-based pagination using DynamoDB's native LastEvaluatedKey
export const searchQuerySchema = z.object({
  // Search query string (optional)
  q: z.string().max(200).optional(),

  // Number of results per page (default: 20, max: 100)
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),

  // Base64-encoded cursor for pagination (DynamoDB ExclusiveStartKey)
  nextToken: z.string().optional(),

  // Optional type filter — returns only 'spec' or 'power' items when provided
  type: z.enum(['spec', 'power']).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
