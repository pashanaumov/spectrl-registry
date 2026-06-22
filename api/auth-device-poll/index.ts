import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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

/**
 * Lambda handler for polling GitHub Device Flow authorization status
 *
 * This Lambda:
 * 1. Accepts device_code from the CLI
 * 2. Polls GitHub to check if the user has authorized the device
 * 3. Returns different status codes based on GitHub's response:
 *    - 202: Authorization pending (user hasn't authorized yet)
 *    - 200: Success (user authorized, return token and username)
 *    - 400: Error (expired, denied, or invalid device code)
 *
 * The CLI will repeatedly call this endpoint until it gets 200 or 400.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received device poll request:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse and validate request body
    if (!event.body) {
      console.error('Missing request body');
      const errorResponse = authDevicePollErrorResponseSchema.parse({
        error: 'missing_device_code',
        message: 'device_code is required in request body',
      });

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    const parsedBody = JSON.parse(event.body);
    const validatedRequest = devicePollRequestSchema.safeParse(parsedBody);

    if (!validatedRequest.success) {
      console.error('Invalid request body:', validatedRequest.error);
      const errorResponse = authDevicePollErrorResponseSchema.parse({
        error: 'invalid_request',
        message: 'device_code is required',
      });

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    const { device_code } = validatedRequest.data;
    console.log('Device code received, polling GitHub...');

    // 2. Get OAuth credentials from Secrets Manager
    const { clientId } = await getGithubOAuthCredentials();

    // 3. Prepare request to GitHub Device Flow token endpoint
    const githubRequest = deviceFlowTokenRequestSchema.parse({
      client_id: clientId,
      device_code: device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    // 4. Call GitHub Device Flow token endpoint
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(githubRequest),
    });

    if (!response.ok) {
      console.error('GitHub API request failed:', response.statusText);
      throw new Error(`GitHub API failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('GitHub response received');

    // 5. Try to parse as error response first (GitHub returns 200 even for errors)
    const errorResult = deviceFlowTokenErrorResponseSchema.safeParse(data);

    if (errorResult.success) {
      const { error, error_description } = errorResult.data;
      console.log('GitHub returned error:', error);

      // Handle authorization_pending and slow_down (202 - keep polling)
      if (error === 'authorization_pending' || error === 'slow_down') {
        const pendingResponse = authDevicePollPendingResponseSchema.parse({
          status: 'authorization_pending',
        });

        return {
          statusCode: 202,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          },
          body: JSON.stringify(pendingResponse),
        };
      }

      // Handle expired_token, access_denied, and other errors (400 - stop polling)
      const errorResponse = authDevicePollErrorResponseSchema.parse({
        error: error,
        message: error_description || `Authorization failed: ${error}`,
      });

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: JSON.stringify(errorResponse),
      };
    }

    // 6. Parse as success response
    const successResult = deviceFlowTokenSuccessResponseSchema.safeParse(data);

    if (!successResult.success) {
      console.error('Unexpected GitHub response format:', data);
      throw new Error('Unexpected response format from GitHub');
    }

    const { access_token } = successResult.data;
    console.log('Access token received, fetching user info...');

    // 7. Get user info from GitHub
    const user = await getGitHubUser(access_token);
    console.log('User info retrieved:', user.username);

    // 8. Store user in DynamoDB
    await storeUser(user);
    console.log('User stored in DynamoDB');

    // 9. Return success response
    const successResponse = authDevicePollSuccessResponseSchema.parse({
      token: access_token,
      username: user.username,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: JSON.stringify(successResponse),
    };
  } catch (error) {
    console.error('Error polling device authorization:', error);

    // Distinguish between validation errors and other errors
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        console.error('Schema validation failed:', error.message);
        const errorResponse = authDevicePollErrorResponseSchema.parse({
          error: 'validation_error',
          message: 'Invalid response format from GitHub',
        });

        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(errorResponse),
        };
      }
    }

    const errorResponse = authDevicePollErrorResponseSchema.parse({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(errorResponse),
    };
  }
}
