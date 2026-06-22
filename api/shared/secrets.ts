import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function getGithubOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const projectId = process.env.GCP_PROJECT_ID;

  const [clientIdRes] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/github-oauth-client-id/versions/latest`,
  });
  const [clientSecretRes] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/github-oauth-client-secret/versions/latest`,
  });

  const clientId = clientIdRes.payload?.data?.toString();
  const clientSecret = clientSecretRes.payload?.data?.toString();

  if (!clientId || !clientSecret) {
    throw new Error('Could not retrieve Github OAuth Secrets');
  }

  return { clientId, clientSecret };
}
