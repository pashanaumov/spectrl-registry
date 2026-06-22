import { z } from 'zod/v4';

// Request body schema
export const trackDownloadRequestSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(39) // GitHub username max length
    .regex(/^[a-zA-Z0-9-]+$/, 'Username must contain only alphanumeric characters and hyphens'),
  specName: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Spec name must contain only alphanumeric characters, hyphens, and underscores',
    ),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
      'Version must be valid semver format',
    ),
});

export type TrackDownloadRequest = z.infer<typeof trackDownloadRequestSchema>;
