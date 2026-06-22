import { z } from 'zod/v4';

// Success response schema
export const trackDownloadResponseSchema = z.object({
  success: z.literal(true),
  downloads: z.number().int().min(0),
});

export type TrackDownloadResponse = z.infer<typeof trackDownloadResponseSchema>;

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
