import { z } from 'zod/v4';

const gitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().nullable(),
});

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
