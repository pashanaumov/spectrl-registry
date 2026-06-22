import { z } from 'zod/v4';

export const specMetadataSchema = z.object({
  specId: z.string(), // username/spec-name
  version: z.string(),
  username: z.string(),
  specName: z.string(),
  description: z.string(),
  type: z.enum(['spec', 'power']).default('spec'),
  downloads: z.number().default(0),
  createdAt: z.string(),
  s3Path: z.string(),
  hash: z.string(),
  tags: z.array(z.string()).optional(),
  files: z.array(z.string()),
  deps: z.record(z.string(), z.string()).optional(),
});

export type SpecMetadata = z.infer<typeof specMetadataSchema>;
