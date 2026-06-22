import type { Request, Response } from 'express';
import { getGithubOAuthCredentials } from '../auth-exchange/helpers/credentials';
import {
  deviceFlowInitRequestSchema,
  deviceFlowInitResponseSchema,
  authDeviceInitLambdaResponseSchema,
} from './schemas/github';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received device flow init request');

  try {
    console.log('Fetching OAuth credentials from Secrets Manager...');
    const { clientId } = await getGithubOAuthCredentials();
    console.log('OAuth credentials retrieved');

    const requestBody = deviceFlowInitRequestSchema.parse({
      client_id: clientId,
      scope: 'user:email',
    });

    console.log('Initiating GitHub Device Flow...');

    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`GitHub Device Flow API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const validatedData = deviceFlowInitResponseSchema.parse(data);
    const lambdaResponse = authDeviceInitLambdaResponseSchema.parse(validatedData);

    res.status(200).json(lambdaResponse);
  } catch (error) {
    console.error('Error initiating device flow:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      res.status(500).json({
        error: 'Invalid response from GitHub',
        message: 'The response from GitHub did not match the expected format',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to initiate device flow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

import * as ff from '@google-cloud/functions-framework';
ff.http('handler', handler);
