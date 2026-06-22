import { z } from 'zod/v4';

// Spec version metadata schema
export const specVersionSchema = z.object({
  specId: z.string(),
  version: z.string(),
  username: z.string(),
  specName: z.string(),
  description: z.string(),
  type: z.enum(['spec', 'power']).default('spec'),
  tags: z.array(z.string()).optional(),
  createdAt: z.string(),
  s3Path: z.string(),
  hash: z.string(),
  files: z.array(z.string()),
  downloads: z.number().optional(),
  deps: z.record(z.string(), z.string()).optional(),
});

export type SpecVersion = z.infer<typeof specVersionSchema>;

// Get spec response schema
export const getSpecResponseSchema = z.object({
  specId: z.string(),
  versions: z.array(specVersionSchema),
});

export type GetSpecResponse = z.infer<typeof getSpecResponseSchema>;

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
});
