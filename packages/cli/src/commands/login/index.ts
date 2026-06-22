import { TokenManager } from '../../auth/token-manager.js';
import { output } from '../../utils.js';
import { getApiUrl } from '../../utils/api-client.js';
import chalk from 'chalk';
import open from 'open';
import { z } from 'zod';
import { formatInfo } from '../../errors.js';

const DeviceFlowInitResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});

const DeviceFlowPollSuccessSchema = z.object({
  token: z.string(),
  username: z.string(),
});

const DeviceFlowPollErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  status: z.string().optional(),
});

/**
 * Login command - Authenticate with GitHub using Device Flow
 */
export async function login(): Promise<void> {
  const tokenManager = new TokenManager();

  output.log(formatInfo(formatInfo('Initiating GitHub authentication...\n')));

  try {
    // Step 1: Initiate device flow via Lambda
    const initResponse = await fetch(`${getApiUrl()}/auth/device/init`, {
      method: 'POST',
    });

    if (!initResponse.ok) {
      output.error('Failed to initiate authentication');
      throw new Error('Device flow initialization failed');
    }

    const initData = await initResponse.json();
    const initParseResult = DeviceFlowInitResponseSchema.safeParse(initData);

    if (!initParseResult.success) {
      output.error('Invalid response from authentication server');
      console.error(chalk.dim('Validation error:'), initParseResult.error.message);
      throw new Error('Device flow initialization failed');
    }

    const { device_code, user_code, verification_uri, expires_in, interval } = initParseResult.data;

    // Step 2: Display code and open browser
    console.log(chalk.bold(`Please visit: ${chalk.cyan(verification_uri)}`));
    console.log(chalk.bold(`\nEnter code: ${chalk.green(user_code)}\n`));
    output.log(formatInfo('Opening browser...\n'));

    await open(verification_uri);

    // Step 3: Poll for authorization
    const startTime = Date.now();
    const expiresAt = startTime + expires_in * 1000;

    output.log(formatInfo('Waiting for authorization...'));

    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));

      const pollResponse = await fetch(`${getApiUrl()}/auth/device/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code }),
      });

      if (pollResponse.status === 200) {
        // Success!
        const pollData = await pollResponse.json();
        const pollParseResult = DeviceFlowPollSuccessSchema.safeParse(pollData);

        if (!pollParseResult.success) {
          output.error('Invalid response from server');
          console.error(chalk.dim('Validation error:'), pollParseResult.error.message);
          throw new Error('Missing token or username in response');
        }

        const { token, username } = pollParseResult.data;

        // Store token
        await tokenManager.store(token);

        output.log(formatInfo(chalk.green(`\n✓ Logged in as ${chalk.bold(username)}`)));
        return;
      }

      if (pollResponse.status === 202) {
        // Still waiting (authorization_pending)
        continue;
      }

      if (pollResponse.status === 400) {
        // Expired or denied
        const errorData = await pollResponse.json();
        const errorParseResult = DeviceFlowPollErrorSchema.safeParse(errorData);

        const errorMessage = errorParseResult.success
          ? errorParseResult.data.message || errorParseResult.data.error || 'Unknown error'
          : 'Unknown error';

        output.error(`Authentication failed: ${errorMessage}`);
        throw new Error('Authentication failed');
      }
    }

    output.error('Authentication timed out');
    throw new Error('Authentication timed out');
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Authentication failed');
  }
}
