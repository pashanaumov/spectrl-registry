import { z } from 'zod/v4-mini';

export const secretsManagerGithubOAuthCredentialsResponseSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
});
