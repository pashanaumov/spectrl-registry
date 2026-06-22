import { z } from 'zod/v4';

export const githubCodeResponseSchema = z.object({
  code: z.string(),
});

export const exchangeCodeForTokenRequestSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  code: z.string(),
});

export const exchangeCodeForTokenResponseSchema = z.object({
  access_token: z.string(),
});

export const gitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().nullable(),
});

export type GitHubUserResponse = Omit<z.infer<typeof gitHubUserSchema>, 'id'> & {
  githubId: number;
};

export const authExchangeLambdaResponseSchema = z.object({
  token: z.string(),
  username: z.string(),
});
