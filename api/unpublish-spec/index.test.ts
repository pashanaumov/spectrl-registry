import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

describe('unpublish-spec Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    process.env.BUCKET_NAME = 'test-bucket';
    process.env.TABLE_NAME = 'test-table';
  });

  it('should unpublish spec successfully (happy path)', async () => {
    // Mock GitHub API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    // Mock DynamoDB - spec exists
    ddbMock.on(GetCommand).resolves({
      Item: {
        specId: 'testuser/test-spec',
        version: '1.0.0',
      },
    });
    ddbMock.on(DeleteCommand).resolves({});

    // Mock S3 - list and delete files
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: 'specs/testuser/test-spec/1.0.0/spectrl.json' },
        { Key: 'specs/testuser/test-spec/1.0.0/files/README.md' },
      ],
    });
    s3Mock.on(DeleteObjectCommand).resolves({});

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      pathParameters: {
        username: 'testuser',
        specName: 'test-spec',
        version: '1.0.0',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Unpublished');
  });

  it('should reject unauthorized request (sad path)', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {},
      pathParameters: {
        username: 'testuser',
        specName: 'test-spec',
        version: '1.0.0',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Authorization');
  });

  it('should reject ownership violation (sad path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'otheruser', id: 456, email: 'other@example.com' }),
    });

    ddbMock.on(GetCommand).resolves({
      Item: {
        specId: 'testuser/test-spec',
        version: '1.0.0',
      },
    });

    const event: Partial<APIGatewayProxyEvent> = {
      headers: { Authorization: 'Bearer fake-token' },
      pathParameters: {
        username: 'testuser',
        specName: 'test-spec',
        version: '1.0.0',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Ownership');
  });
});
