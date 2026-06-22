import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const secretsMock = mockClient(SecretsManagerClient);

describe('auth-device-init Lambda', () => {
  beforeEach(() => {
    secretsMock.reset();
    vi.clearAllMocks();

    process.env.SECRETS_ARN = 'arn:aws:secretsmanager:test';
    process.env.AWS_REGION = 'eu-north-1';
  });

  it('should successfully initiate device flow (happy path)', async () => {
    // Mock Secrets Manager
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub Device Flow API response
    const mockGitHubResponse = {
      device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGitHubResponse,
    });

    // No request body needed for device flow initiation
    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.device_code).toBe(mockGitHubResponse.device_code);
    expect(body.user_code).toBe(mockGitHubResponse.user_code);
    expect(body.verification_uri).toBe(mockGitHubResponse.verification_uri);
    expect(body.expires_in).toBe(mockGitHubResponse.expires_in);
    expect(body.interval).toBe(mockGitHubResponse.interval);

    // Verify CORS headers
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');

    // Verify GitHub API was called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/login/device/code',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('test-client-id'),
      }),
    );
  });

  it('should handle Secrets Manager failure (sad path)', async () => {
    // Mock Secrets Manager failure
    secretsMock.on(GetSecretValueCommand).rejects(new Error('Secrets Manager unavailable'));

    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Failed to initiate device flow');
    expect(body.message).toContain('Secrets Manager unavailable');
  });

  it('should handle GitHub API failure (sad path)', async () => {
    // Mock Secrets Manager success
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub API failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
    });

    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Failed to initiate device flow');
    expect(body.message).toContain('GitHub Device Flow API failed');
  });

  it('should handle invalid GitHub response schema (sad path)', async () => {
    // Mock Secrets Manager success
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub API with invalid response (missing required fields)
    const invalidResponse = {
      device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
      // Missing user_code, verification_uri, expires_in, interval
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => invalidResponse,
    });

    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Invalid response from GitHub');
    expect(body.message).toContain('did not match the expected format');
  });

  it('should validate all response fields have correct types (schema validation)', async () => {
    // Mock Secrets Manager
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub response with wrong types
    const invalidTypesResponse = {
      device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
      user_code: 'WDJB-MJHT',
      verification_uri: 'not-a-valid-url', // Invalid URL
      expires_in: '900', // Should be number, not string
      interval: 5,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => invalidTypesResponse,
    });

    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Invalid response from GitHub');
  });

  it('should handle network errors gracefully (sad path)', async () => {
    // Mock Secrets Manager success
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const event: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).toBe('Failed to initiate device flow');
    expect(body.message).toContain('Network error');
  });

  it('should include correct scope in GitHub request', async () => {
    // Mock Secrets Manager
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    });

    // Mock GitHub response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'test-device-code',
        user_code: 'TEST-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    });

    const event: Partial<APIGatewayProxyEvent> = {};

    await handler(event as APIGatewayProxyEvent);

    // Verify the request body includes the correct scope
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body as string);

    expect(requestBody.scope).toBe('user:email');
    expect(requestBody.client_id).toBe('test-client-id');
  });
});
