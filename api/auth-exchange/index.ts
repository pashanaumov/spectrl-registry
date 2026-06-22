import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authExchangeLambdaResponseSchema, githubCodeResponseSchema } from './schemas/github';
import {
  getGithubOAuthCredentials,
  exchangeCodeForToken,
  getGitHubUser,
} from './helpers/credentials';
import { storeUser } from './helpers/dynamoDb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Parse the request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body = githubCodeResponseSchema.safeParse(JSON.parse(event.body));

    if (body.error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Bad response from Github' }),
      };
    }

    const { data } = body;

    if (!data.code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not get code from Github' }),
      };
    }

    console.log('OAuth code received:', data.code);

    // 1. Get OAuth credentials from Secrets Manager
    console.log('Fetching OAuth credentials from Secrets Manager...');
    const { clientId, clientSecret } = await getGithubOAuthCredentials();
    console.log('OAuth credentials retrieved');

    // 2. Exchange code for token with GitHub
    const accessToken = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code: data.code,
    });
    console.log('Access token received from GitHub');
    // 3. Get user info from GitHub
    console.log('Fetching user data from Github');
    const user = await getGitHubUser(accessToken);
    console.log('Accessed user token');

    // 4. Store user in DynamoDB
    await storeUser(user);

    const parsedResonse = authExchangeLambdaResponseSchema.parse({
      token: accessToken,
      username: user.username,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedResonse),
    };
  } catch (error) {
    console.error('Error exchanging auth: ', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
