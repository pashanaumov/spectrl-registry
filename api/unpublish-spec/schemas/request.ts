import { z } from 'zod/v4';

// Authorization header schema
export const authHeaderSchema = z
  .string()
  .min(1, 'Authorization header is required')
  .regex(/^Bearer .+$/, 'Authorization header must be in format: Bearer <token>');

/**
 * Extract token from Authorization header
 * Validates format and extracts the token part
 */
export function extractToken(authHeader: string): string {
  const parsed = authHeaderSchema.parse(authHeader);
  return parsed.substring(7); // Remove 'Bearer ' prefix
}

// Path parameters schema
export const pathParametersSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(39, 'Username must be at most 39 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'Username must contain only alphanumeric characters and hyphens'),
  specName: z
    .string()
    .min(1, 'Spec name is required')
    .max(100, 'Spec name must be at most 100 characters')
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Spec name must contain only alphanumeric characters, hyphens, and underscores',
    ),
  version: z
    .string()
    .min(1, 'Version is required')
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
});

export type PathParameters = z.infer<typeof pathParametersSchema>;
