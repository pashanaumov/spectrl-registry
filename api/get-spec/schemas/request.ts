import { z } from 'zod/v4';

// Path parameters schema
// Validates username and specName from API Gateway path
export const pathParametersSchema = z.object({
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
});

export type PathParameters = z.infer<typeof pathParametersSchema>;
