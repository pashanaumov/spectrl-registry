import type { Request, Response } from 'express';
import { getGithubOAuthCredentials, getGitHubUser } from '../auth-exchange/helpers/credentials';
import { storeUser } from '../auth-exchange/helpers/dynamoDb';
import {
  devicePollRequestSchema,
  deviceFlowTokenRequestSchema,
  deviceFlowTokenSuccessResponseSchema,
  deviceFlowTokenErrorResponseSchema,
  authDevicePollPendingResponseSchema,
  authDevicePollSuccessResponseSchema,
  authDevicePollErrorResponseSchema,
} from './schemas/github';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received device poll request');

  try {
    if (!req.body) {
      res.status(400).json(
        authDevicePollErrorResponseSchema.parse({
          error: 'missing_device_code',
          message: 'device_code is required in request body',
        }),
      );
      return;
    }

    const validatedRequest = devicePollRequestSchema.safeParse(req.body);

    if (!validatedRequest.success) {
      res.status(400).json(
        authDevicePollErrorResponseSchema.parse({
          error: 'invalid_request',
          message: 'device_code is required',
        }),
      );
      return;
    }

    const { device_code } = validatedRequest.data;
    console.log('Device code received, polling GitHub...');

    const { clientId } = await getGithubOAuthCredentials();

    const githubRequest = deviceFlowTokenRequestSchema.parse({
      client_id: clientId,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(githubRequest),
    });

    if (!response.ok) {
      throw new Error(`GitHub API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const errorResult = deviceFlowTokenErrorResponseSchema.safeParse(data);

    if (errorResult.success) {
      const { error, error_description } = errorResult.data;
      console.log('GitHub returned error:', error);

      if (error === 'authorization_pending' || error === 'slow_down') {
        res
          .status(202)
          .json(authDevicePollPendingResponseSchema.parse({ status: 'authorization_pending' }));
        return;
      }

      res.status(400).json(
        authDevicePollErrorResponseSchema.parse({
          error,
          message: error_description || `Authorization failed: ${error}`,
        }),
      );
      return;
    }

    const successResult = deviceFlowTokenSuccessResponseSchema.safeParse(data);

    if (!successResult.success) {
      throw new Error('Unexpected response format from GitHub');
    }

    const { access_token } = successResult.data;
    const user = await getGitHubUser(access_token);
    console.log('User info retrieved:', user.username);

    await storeUser(user);

    res.status(200).json(
      authDevicePollSuccessResponseSchema.parse({
        token: access_token,
        username: user.username,
      }),
    );
  } catch (error) {
    console.error('Error polling device authorization:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      res.status(500).json(
        authDevicePollErrorResponseSchema.parse({
          error: 'validation_error',
          message: 'Invalid response format from GitHub',
        }),
      );
      return;
    }

    res.status(500).json(
      authDevicePollErrorResponseSchema.parse({
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    );
  }
}
