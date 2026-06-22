import { TokenManager } from '../../auth/token-manager.js';
import { output } from '../../utils.js';
import chalk from 'chalk';

/**
 * Logout command - Remove stored GitHub token
 */
export async function logout(): Promise<void> {
  const tokenManager = new TokenManager();
  await tokenManager.delete();
  output.log(chalk.green('✓ Logged out'));
}
