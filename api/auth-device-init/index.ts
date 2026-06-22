import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getGithubOAuthCredentials } from '../auth-exchange/helpers/credentials';
import {
  deviceFlowInitRequestSchema,
  deviceFlowInitResponseSchema,
  authDeviceInitLambdaResponseSchema,
} from './schemas/github';

/**
 * Lambda handler for initiating GitHub Device Flow
 *
 * This Lambda:
 * 1. Retrieves GitHub OAuth credentials from Secrets Manager
 * 2. Calls GitHub Device Flow API to initiate the flow
 * 3. Returns device_code, user_code, verification_uri, expires_in, interval
 *
 * The CLI will use this information to:
 * - Display the user_code to the user
 * - Open the verification_uri in a browser
 * - Poll with the device_code until authorization completes
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received device flow init request:', JSON.stringify(event, null, 2));

  try {
    // 1. Get OAuth credentials from Secrets Manager
    console.log('Fetching OAuth credentials from Secrets Manager...');
    const { clientId } = await getGithubOAuthCredentials();
    console.log('OAuth credentials retrieved');

    // 2. Validate request body for GitHub API
    const requestBody = deviceFlowInitRequestSchema.parse({
      client_id: clientId,
      scope: 'user:email',
    });

    console.log('Initiating GitHub Device Flow...');

    // 3. Call GitHub Device Flow API
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('GitHub Device Flow API failed:', response.statusText);
      throw new Error(`GitHub Device Flow API failed: ${response.statusText}`);
    }

    // 4. Parse and validate GitHub's response
    const data = await response.json();
    console.log('GitHub Device Flow response received');

    // Strong schema validation - ensure GitHub's response matches expected shape
    const validatedData = deviceFlowInitResponseSchema.parse(data);
    console.log('GitHub response validated successfully');

    // 5. Validate our Lambda response before returning
    const lambdaResponse = authDeviceInitLambdaResponseSchema.parse(validatedData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: JSON.stringify(lambdaResponse),
    };
  } catch (error) {
    console.error('Error initiating device flow:', error);

    // Distinguish between validation errors and other errors
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        console.error('Schema validation failed:', error.message);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid response from GitHub',
            message: 'The response from GitHub did not match the expected format',
          }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to initiate device flow',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
