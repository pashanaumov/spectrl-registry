import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

describe('publish-spec Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.TABLE_NAME = 'test-table';
  });

  it('should publish spec successfully (happy path)', async () => {
    // Mock GitHub API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    // Mock AWS
    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'Test spec',
          agentTags: ['test'],
          files: ['README.md'],
          dependencies: {},
        },
        files: {
          'README.md': '# Test\n\nContent',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Published');
    expect(body.url).toContain('testuser/test-spec');
  });

  it('should reject request without authorization (sad path)', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {},
      body: JSON.stringify({
        manifest: { name: 'test/spec', version: '1.0.0' },
        files: {},
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Authorization');
  });

  it('should reject invalid manifest (sad path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: { name: 'invalid' }, // Missing required fields
        files: {},
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    // Zod validation errors return 400
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

  it('should store type "power" in DynamoDB when publishing a power', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/test-power',
          version: '1.0.0',
          description: 'A test power',
          type: 'power',
          files: ['index.md'],
          dependencies: {},
        },
        files: {
          'index.md': '# Test Power\n\nInstructions here.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    // Verify the DynamoDB PutCommand received type: "power"
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.Item?.type).toBe('power');
  });

  it('should default type to "spec" in DynamoDB when type is omitted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'A test spec without explicit type',
          files: ['index.md'],
          dependencies: {},
        },
        files: {
          'index.md': '# Test Spec\n\nContent here.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    // Verify the DynamoDB PutCommand received the default type: "spec"
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.Item?.type).toBe('spec');
  });

  it('should return 400 when type is an invalid value', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'A test spec',
          type: 'invalid-type',
          files: ['index.md'],
          dependencies: {},
        },
        files: {
          'index.md': '# Test\n\nContent.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

  it('should store deps field in DynamoDB when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/api-spec',
          version: '1.0.0',
          description: 'API spec with dependencies',
          type: 'spec',
          files: ['index.md'],
          deps: {
            'shared-errors': '1.0.0',
            'base-types': '2.0.0',
          },
        },
        files: {
          'index.md': '# API Spec\n\nContent here.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    // Verify the DynamoDB PutCommand received the deps field
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.Item?.deps).toEqual({
      'shared-errors': '1.0.0',
      'base-types': '2.0.0',
    });
  });

  it('should handle specs without deps field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/simple-spec',
          version: '1.0.0',
          description: 'Simple spec without dependencies',
          type: 'spec',
          files: ['index.md'],
          // No deps field
        },
        files: {
          'index.md': '# Simple Spec\n\nContent here.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    // Verify the DynamoDB PutCommand - deps should be undefined
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.Item?.deps).toBeUndefined();
  });

  it('should handle empty deps object', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    ddbMock.on(PutCommand).resolves({});
    s3Mock.on(PutObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        manifest: {
          name: 'testuser/empty-deps-spec',
          version: '1.0.0',
          description: 'Spec with empty deps',
          type: 'spec',
          files: ['index.md'],
          deps: {},
        },
        files: {
          'index.md': '# Empty Deps Spec\n\nContent here.',
        },
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);

    // Verify the DynamoDB PutCommand received empty deps object
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input.Item?.deps).toEqual({});
  });
});
