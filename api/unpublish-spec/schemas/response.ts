import { z } from 'zod/v4';

// Success response schema
export const unpublishResponseSchema = z.object({
  message: z.string(),
  specId: z.string(),
  version: z.string(),
});

export type UnpublishResponse = z.infer<typeof unpublishResponseSchema>;

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
