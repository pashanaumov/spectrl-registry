import { TokenManager } from '../../auth/token-manager.js';
import chalk from 'chalk';
import { z } from 'zod';
import { formatCommand } from '../../errors.js';

const GitHubUserSchema = z.object({
  login: z.string(),
});

/**
 * Whoami command - Show current authenticated user
 */
export async function whoami(): Promise<void> {
  const tokenManager = new TokenManager();
  const token = await tokenManager.get();

  if (!token) {
    console.log(chalk.dim('Not logged in'));
    console.log(`Run: ${formatCommand('spectrl login')}`);
    return;
  }

  try {
    // Verify token with GitHub
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.log(chalk.yellow('Token invalid'));
      console.log(`Run: ${formatCommand('spectrl login')}`);
      return;
    }

    const data = await response.json();
    const parseResult = GitHubUserSchema.safeParse(data);

    if (!parseResult.success) {
      console.log(chalk.red('✗ Invalid response from GitHub API'));
      console.log(`Run: ${formatCommand('spectrl login')}`);
      return;
    }

    const user = parseResult.data;
    console.log(chalk.green(`Logged in as ${chalk.bold(user.login)}`));
  } catch (error) {
    console.log(chalk.red('✗ Failed to verify token'));
    console.log(`Run: ${formatCommand('spectrl login')}`);
  }
}
