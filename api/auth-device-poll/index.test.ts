import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

const secretsMock = mockClient(SecretsManagerClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

describe('auth-device-poll Lambda', () => {
  const mockEvent = (body: Record<string, unknown>): APIGatewayProxyEvent =>
    ({
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/auth/device/poll',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: '',
    }) as APIGatewayProxyEvent;

  beforeEach(() => {
    secretsMock.reset();
    ddbMock.reset();
    vi.clearAllMocks();

    process.env.SECRETS_ARN = 'arn:aws:secretsmanager:test';
    process.env.USERS_TABLE = 'test-users-table';
    process.env.AWS_REGION = 'eu-north-1';

    // Default mock for Secrets Manager
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });
  });

  describe('Request validation', () => {
    it('should return 400 when request body is missing', async () => {
      const event = {
        ...mockEvent({}),
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('missing_device_code');
      expect(body.message).toContain('device_code is required');
    });

    it('should return 400 when device_code is missing', async () => {
      const event = mockEvent({});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('invalid_request');
      expect(body.message).toContain('device_code is required');
    });

    it('should return 400 when device_code is not a string', async () => {
      const event = mockEvent({ device_code: 123 });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('invalid_request');
    });
  });

  describe('Authorization pending (202)', () => {
    it('should return 202 when GitHub returns authorization_pending', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('authorization_pending');

      // Verify GitHub API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'test-device-code',
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        }),
      );
    });

    it('should return 202 when GitHub returns slow_down', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'slow_down',
          error_description: 'You are polling too frequently',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('authorization_pending');
    });
  });

  describe('Successful authorization (200)', () => {
    it('should return 200 with token and username when authorization succeeds', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      // Mock GitHub token response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'gho_test_token',
            token_type: 'bearer',
            scope: 'user:email',
          }),
        })
        // Mock GitHub user info response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 12345,
            login: 'testuser',
            email: 'test@example.com',
          }),
        });

      // Mock DynamoDB
      ddbMock.on(PutCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.token).toBe('gho_test_token');
      expect(body.username).toBe('testuser');

      // Verify DynamoDB was called to store user
      expect(ddbMock.commandCalls(PutCommand).length).toBe(1);
      const putCall = ddbMock.commandCalls(PutCommand)[0];
      expect(putCall.args[0].input.TableName).toBe('test-users-table');
      expect(putCall.args[0].input.Item).toMatchObject({
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should include CORS headers in success response', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'gho_test_token',
            token_type: 'bearer',
            scope: 'user:email',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 12345,
            login: 'testuser',
            email: 'test@example.com',
          }),
        });

      ddbMock.on(PutCommand).resolves({});

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      });
    });
  });

  describe('Expired device code (400)', () => {
    it('should return 400 when GitHub returns expired_token', async () => {
      const event = mockEvent({ device_code: 'expired-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'expired_token',
          error_description: 'The device code has expired',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('expired_token');
      expect(body.message).toContain('expired');
    });

    it('should return 400 when GitHub returns incorrect_device_code', async () => {
      const event = mockEvent({ device_code: 'invalid-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'incorrect_device_code',
          error_description: 'The device code is incorrect',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('incorrect_device_code');
    });
  });

  describe('Denied authorization (400)', () => {
    it('should return 400 when GitHub returns access_denied', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'access_denied',
          error_description: 'The user denied the authorization request',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('access_denied');
      expect(body.message).toContain('denied');
    });
  });

  describe('Error handling', () => {
    it('should return 500 when GitHub API request fails', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
      expect(body.message).toContain('GitHub API failed');
    });

    it('should return 500 when Secrets Manager fails', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      // Override the default mock to simulate failure
      secretsMock.reset();
      secretsMock.on(GetSecretValueCommand).rejects(new Error('Secrets Manager error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
      expect(body.message).toContain('Secrets Manager error');
    });

    it('should return 500 when GitHub user fetch fails', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'gho_test_token',
            token_type: 'bearer',
            scope: 'user:email',
          }),
        })
        // Mock GitHub user API failure
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Unauthorized',
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
      expect(body.message).toContain('GitHub API failed');
    });

    it('should return 500 when DynamoDB fails', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'gho_test_token',
            token_type: 'bearer',
            scope: 'user:email',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 12345,
            login: 'testuser',
            email: 'test@example.com',
          }),
        });

      // Mock DynamoDB failure
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
      expect(body.message).toContain('DynamoDB error');
    });

    it('should return 500 when GitHub returns unexpected response format', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          unexpected: 'response',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('internal_error');
      expect(body.message).toContain('Unexpected response format');
    });
  });

  describe('OAuth credentials retrieval', () => {
    it('should retrieve OAuth credentials from Secrets Manager', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'authorization_pending',
        }),
      });

      await handler(event);

      // Verify Secrets Manager was called
      expect(secretsMock.commandCalls(GetSecretValueCommand).length).toBe(1);
      const secretCall = secretsMock.commandCalls(GetSecretValueCommand)[0];
      expect(secretCall.args[0].input.SecretId).toBe('arn:aws:secretsmanager:test');
    });

    it('should use correct client_id in GitHub request', async () => {
      const event = mockEvent({ device_code: 'test-device-code' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'authorization_pending',
        }),
      });

      await handler(event);

      // Verify GitHub API was called with correct client_id
      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-client-id'),
        }),
      );

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body as string);
      expect(requestBody.client_id).toBe('test-client-id');
      expect(requestBody.device_code).toBe('test-device-code');
      expect(requestBody.grant_type).toBe('urn:ietf:params:oauth:grant-type:device_code');
    });
  });
});
