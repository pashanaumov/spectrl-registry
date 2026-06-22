import type { Request, Response } from 'express';
import { authExchangeLambdaResponseSchema, githubCodeResponseSchema } from './schemas/github';
import {
  getGithubOAuthCredentials,
  exchangeCodeForToken,
  getGitHubUser,
} from './helpers/credentials';
import { storeUser } from './helpers/dynamoDb';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received auth-exchange request');

  try {
    if (!req.body) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    const body = githubCodeResponseSchema.safeParse(req.body);

    if (body.error) {
      res.status(400).json({ error: 'Bad response from Github' });
      return;
    }

    const { data } = body;

    if (!data.code) {
      res.status(400).json({ error: 'Could not get code from Github' });
      return;
    }

    console.log('OAuth code received:', data.code);

    const { clientId, clientSecret } = await getGithubOAuthCredentials();
    const accessToken = await exchangeCodeForToken({ clientId, clientSecret, code: data.code });
    const user = await getGitHubUser(accessToken);

    await storeUser(user);

    res.status(200).json(
      authExchangeLambdaResponseSchema.parse({
        token: accessToken,
        username: user.username,
      }),
    );
  } catch (error) {
    console.error('Error exchanging auth: ', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
