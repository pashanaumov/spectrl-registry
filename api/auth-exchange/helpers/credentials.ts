import { getGithubOAuthCredentials } from '../../shared/secrets';
import {
  exchangeCodeForTokenRequestSchema,
  exchangeCodeForTokenResponseSchema,
  gitHubUserSchema,
} from '../schemas/github';

export { getGithubOAuthCredentials };

export async function exchangeCodeForToken({
  code,
  clientId,
  clientSecret,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
}) {
  console.log('Exchanging code for GitHub access token...');

  const parsedBody = exchangeCodeForTokenRequestSchema.parse({
    clientId: clientId,
    clientSecret: clientSecret,
    code: code,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(parsedBody),
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth failed: ${response.statusText}`);
  }

  try {
    const data = await response.json();

    const parsedResponse = exchangeCodeForTokenResponseSchema.parse(data);

    return parsedResponse.access_token;
  } catch (error) {
    console.error('Could not exchange OAuth token');
    throw error;
  }
}

export async function getGitHubUser(accessToken: string) {
  console.log('Fetching user info from GitHub...');

  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Spectrl',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.statusText}`);
  }

  const data = await response.json();
  const user = gitHubUserSchema.parse(data);

  return {
    githubId: user.id,
    username: user.login,
    email: user.email ?? '',
  };
}
