import { z } from 'zod/v4';

// Auth header schema
export const authHeaderSchema = z
  .string()
  .regex(/^Bearer .+$/, 'Invalid Authorization header format');

export function extractToken(authHeader: string): string {
  const parsed = authHeaderSchema.parse(authHeader);
  return parsed.substring(7); // Remove 'Bearer ' prefix
}

// Request body schema
export const publishRequestSchema = z.object({
  manifest: z.object({
    name: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/), // semver format
    description: z.string().max(500),
    type: z.enum(['spec', 'power']).default('spec'),
    files: z.array(z.string()).max(100), // Array of file paths
    deps: z.record(z.string(), z.string()).optional(),
    agent: z
      .object({
        purpose: z.string(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  files: z.record(z.string(), z.string()), // Object: filename -> content mapping
});

export type PublishRequest = z.infer<typeof publishRequestSchema>;

// Response schema
export const publishResponseSchema = z.object({
  message: z.string(),
  url: z.string(),
});

export type PublishResponse = z.infer<typeof publishResponseSchema>;

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
