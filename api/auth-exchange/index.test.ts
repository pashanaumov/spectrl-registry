import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const secretsMock = mockClient(SecretsManagerClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('auth-exchange Lambda', () => {
  beforeEach(() => {
    secretsMock.reset();
    ddbMock.reset();
    vi.clearAllMocks();

    process.env.SECRETS_ARN = 'arn:aws:secretsmanager:test';
    process.env.USERS_TABLE = 'test-users-table';
  });

  it('should exchange code for token (happy path)', async () => {
    // Mock Secrets Manager
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub OAuth exchange
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gho_test_token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
      });

    // Mock DynamoDB
    ddbMock.on(PutCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({ code: 'test-oauth-code' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.token).toBe('gho_test_token');
    expect(body.username).toBe('testuser');
  });

  it('should reject missing code (sad path)', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({}),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

  it('should handle GitHub API failure (sad path)', async () => {
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub OAuth failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
    });

    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({ code: 'invalid-code' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);
  });
});
