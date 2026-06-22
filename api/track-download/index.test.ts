import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('track-download Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
    process.env.SPECS_TABLE = 'test-table';
    process.env.AWS_REGION = 'eu-north-1';
  });

  describe('Happy Path', () => {
    it('should track download successfully', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { specId: 'testuser/test-spec', version: '1.0.0', downloads: 42 },
      });

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.downloads).toBe(42);
    });

    it('should track download with different version numbers', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { specId: 'alice/api-spec', version: '2.1.0', downloads: 145 },
      });

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'alice', specName: 'api-spec', version: '2.1.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.downloads).toBe(145);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 when request body is invalid JSON', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: 'invalid json{',
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid JSON');
    });

    it('should return 400 when username is missing', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request parameters');
    });

    it('should return 400 when specName is missing', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request parameters');
    });

    it('should return 400 when version is missing', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request parameters');
    });

    it('should return 400 when version is not valid semver', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec', version: 'invalid' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request parameters');
    });

    it('should return 400 when username contains invalid characters', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'test_user!', specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request parameters');
    });
  });

  describe('DynamoDB Error Handling', () => {
    it('should return 404 when spec version does not exist', async () => {
      ddbMock.on(UpdateCommand).rejects(
        new ConditionalCheckFailedException({
          message: 'The conditional request failed',
          $metadata: {},
        }),
      );

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'nonexistent', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(404);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Spec version not found');
    });

    it('should return 503 when DynamoDB is unavailable', async () => {
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB service unavailable'));

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(503);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('DynamoDB service unavailable');
    });

    it('should return 500 for unexpected errors', async () => {
      ddbMock.on(UpdateCommand).rejects(new Error('Unexpected error'));

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toBeTruthy();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { specId: 'testuser/test-spec', version: '1.0.0', downloads: 1 },
      });

      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: JSON.stringify({ username: 'testuser', specName: 'test-spec', version: '1.0.0' }),
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers in error response', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        headers: {},
        body: 'invalid json',
      };

      const result = await handler(event as APIGatewayProxyEvent);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });
});
