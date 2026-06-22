import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { secretsManagerGithubOAuthCredentialsResponseSchema } from '../schemas/aws';
import {
  exchangeCodeForTokenRequestSchema,
  exchangeCodeForTokenResponseSchema,
  gitHubUserSchema,
} from '../schemas/github';

export const defaultAWSRegion = 'eu-north-1';

export async function getGithubOAuthCredentials() {
  const secretsManager = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });

  const command = new GetSecretValueCommand({
    SecretId: process.env.SECRETS_ARN,
  });

  const response = await secretsManager.send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret = JSON.parse(response.SecretString);

  const parsedSecret = secretsManagerGithubOAuthCredentialsResponseSchema.safeParse(secret);

  if (!parsedSecret.success) {
    throw new Error('Could not parse Github OAuth Secret');
  }

  if (!parsedSecret.data.clientId || !parsedSecret.data.clientSecret) {
    throw new Error('Could not retrieve Github OAuth Secrets');
  }

  return {
    clientId: parsedSecret.data.clientId,
    clientSecret: parsedSecret.data.clientSecret,
  };
}

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
