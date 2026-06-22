import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import * as fc from 'fast-check';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('get-spec Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SPECS_TABLE = 'test-table';
  });

  it('should return spec versions (happy path)', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'testuser/test-spec',
          specName: 'test-spec',
          username: 'testuser',
          version: '2.0.0',
          description: 'Version 2',
          agentTags: ['test'],
          publishedAt: '2024-12-08T19:00:00.000Z',
          createdAt: '2024-12-08T19:00:00.000Z',
          s3Path: 'specs/testuser/test-spec/2.0.0',
          hash: 'sha256:abc123',
          files: ['README.md'],
        },
        {
          specId: 'testuser/test-spec',
          specName: 'test-spec',
          username: 'testuser',
          version: '1.0.0',
          description: 'Version 1',
          agentTags: ['test'],
          publishedAt: '2024-12-08T18:00:00.000Z',
          createdAt: '2024-12-08T18:00:00.000Z',
          s3Path: 'specs/testuser/test-spec/1.0.0',
          hash: 'sha256:def456',
          files: ['README.md'],
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: {
        username: 'testuser',
        specName: 'test-spec',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.specId).toBe('testuser/test-spec');
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].version).toBe('2.0.0');
  });

  it('should return 404 for non-existent spec (sad path)', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: {
        username: 'testuser',
        specName: 'nonexistent',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Property 12: Get-spec version type mapping correctness
// For any set of DynamoDB version items with varying type values (including
// items with no type field), the transformed version response should include
// the correct type for each version, defaulting to "spec" when the source
// item lacks a type field.
// Validates: Requirements 11.1, 11.2, 11.3
// ---------------------------------------------------------------------------

describe('Property 12: Get-spec version type mapping correctness', () => {
  it('versions with type "spec" return type "spec"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specName: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          username: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          version: fc.constant('1.0.0'),
          description: fc.string({ minLength: 1 }),
        }),
        async (item) => {
          const specId = `${item.username}/${item.specName}`;

          ddbMock.on(QueryCommand).resolves({
            Items: [
              {
                specId,
                specName: item.specName,
                username: item.username,
                version: item.version,
                description: item.description,
                type: 'spec',
                tags: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                s3Path: `specs/${specId}/${item.version}`,
                hash: 'sha256:abc123',
                files: ['index.md'],
                downloads: 0,
              },
            ],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            pathParameters: { username: item.username, specName: item.specName },
          };

          const result = await handler(event as APIGatewayProxyEvent);
          expect(result.statusCode).toBe(200);

          const body = JSON.parse(result.body);
          expect(body.versions).toHaveLength(1);
          expect(body.versions[0].type).toBe('spec');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('versions with type "power" return type "power"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specName: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          username: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          version: fc.constant('1.0.0'),
          description: fc.string({ minLength: 1 }),
        }),
        async (item) => {
          const specId = `${item.username}/${item.specName}`;

          ddbMock.on(QueryCommand).resolves({
            Items: [
              {
                specId,
                specName: item.specName,
                username: item.username,
                version: item.version,
                description: item.description,
                type: 'power',
                tags: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                s3Path: `specs/${specId}/${item.version}`,
                hash: 'sha256:abc123',
                files: ['index.md'],
                downloads: 0,
              },
            ],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            pathParameters: { username: item.username, specName: item.specName },
          };

          const result = await handler(event as APIGatewayProxyEvent);
          expect(result.statusCode).toBe(200);

          const body = JSON.parse(result.body);
          expect(body.versions).toHaveLength(1);
          expect(body.versions[0].type).toBe('power');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('versions without type field default to "spec"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specName: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          username: fc.stringMatching(/^[a-z][a-z0-9-]{0,9}$/),
          version: fc.constant('1.0.0'),
          description: fc.string({ minLength: 1 }),
        }),
        async (item) => {
          const specId = `${item.username}/${item.specName}`;

          ddbMock.on(QueryCommand).resolves({
            Items: [
              {
                specId,
                specName: item.specName,
                username: item.username,
                version: item.version,
                description: item.description,
                // No type field — should default to "spec"
                tags: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                s3Path: `specs/${specId}/${item.version}`,
                hash: 'sha256:abc123',
                files: ['index.md'],
                downloads: 0,
              },
            ],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            pathParameters: { username: item.username, specName: item.specName },
          };

          const result = await handler(event as APIGatewayProxyEvent);
          expect(result.statusCode).toBe(200);

          const body = JSON.parse(result.body);
          expect(body.versions).toHaveLength(1);
          expect(body.versions[0].type).toBe('spec');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('mixed versions preserve individual type values', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'user/my-spec',
          specName: 'my-spec',
          username: 'user',
          version: '2.0.0',
          description: 'Version 2 as power',
          type: 'power',
          tags: [],
          createdAt: '2024-12-08T19:00:00.000Z',
          s3Path: 'specs/user/my-spec/2.0.0',
          hash: 'sha256:abc123',
          files: ['index.md'],
          downloads: 0,
        },
        {
          specId: 'user/my-spec',
          specName: 'my-spec',
          username: 'user',
          version: '1.0.0',
          description: 'Version 1 as spec',
          type: 'spec',
          tags: [],
          createdAt: '2024-12-08T18:00:00.000Z',
          s3Path: 'specs/user/my-spec/1.0.0',
          hash: 'sha256:def456',
          files: ['index.md'],
          downloads: 0,
        },
        {
          specId: 'user/my-spec',
          specName: 'my-spec',
          username: 'user',
          version: '0.1.0',
          description: 'Legacy version without type',
          // No type field
          tags: [],
          createdAt: '2024-12-08T17:00:00.000Z',
          s3Path: 'specs/user/my-spec/0.1.0',
          hash: 'sha256:ghi789',
          files: ['index.md'],
          downloads: 0,
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { username: 'user', specName: 'my-spec' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.versions).toHaveLength(3);
    expect(body.versions[0].type).toBe('power');
    expect(body.versions[1].type).toBe('spec');
    expect(body.versions[2].type).toBe('spec'); // defaulted from missing
  });
});

// ---------------------------------------------------------------------------
// Property 13: Get-spec deps field handling
// For any spec version with a deps field in DynamoDB, the API response should
// include the deps field. For versions without deps, the field should be
// absent or empty.
// Validates: Transitive dependency feature requirements
// ---------------------------------------------------------------------------

describe('Property 13: Get-spec deps field handling', () => {
  it('should include deps field when present in DynamoDB', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'testuser/api-spec',
          specName: 'api-spec',
          username: 'testuser',
          version: '1.0.0',
          description: 'API spec with dependencies',
          type: 'spec',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          s3Path: 'specs/testuser/api-spec/1.0.0',
          hash: 'sha256:abc123',
          files: ['index.md'],
          downloads: 0,
          deps: {
            'shared-errors': '1.0.0',
            'base-types': '2.0.0',
          },
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { username: 'testuser', specName: 'api-spec' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].deps).toEqual({
      'shared-errors': '1.0.0',
      'base-types': '2.0.0',
    });
  });

  it('should handle versions without deps field', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'testuser/simple-spec',
          specName: 'simple-spec',
          username: 'testuser',
          version: '1.0.0',
          description: 'Simple spec without dependencies',
          type: 'spec',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          s3Path: 'specs/testuser/simple-spec/1.0.0',
          hash: 'sha256:abc123',
          files: ['index.md'],
          downloads: 0,
          // No deps field
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { username: 'testuser', specName: 'simple-spec' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].deps).toBeUndefined();
  });

  it('should handle empty deps object', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'testuser/empty-deps-spec',
          specName: 'empty-deps-spec',
          username: 'testuser',
          version: '1.0.0',
          description: 'Spec with empty deps',
          type: 'spec',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          s3Path: 'specs/testuser/empty-deps-spec/1.0.0',
          hash: 'sha256:abc123',
          files: ['index.md'],
          downloads: 0,
          deps: {},
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { username: 'testuser', specName: 'empty-deps-spec' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].deps).toEqual({});
  });

  it('should handle mixed versions with and without deps', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          specId: 'user/evolving-spec',
          specName: 'evolving-spec',
          username: 'user',
          version: '2.0.0',
          description: 'Version with deps',
          type: 'spec',
          tags: [],
          createdAt: '2024-12-08T19:00:00.000Z',
          s3Path: 'specs/user/evolving-spec/2.0.0',
          hash: 'sha256:abc123',
          files: ['index.md'],
          downloads: 0,
          deps: {
            'shared-lib': '3.0.0',
          },
        },
        {
          specId: 'user/evolving-spec',
          specName: 'evolving-spec',
          username: 'user',
          version: '1.0.0',
          description: 'Legacy version without deps',
          type: 'spec',
          tags: [],
          createdAt: '2024-12-08T18:00:00.000Z',
          s3Path: 'specs/user/evolving-spec/1.0.0',
          hash: 'sha256:def456',
          files: ['index.md'],
          downloads: 0,
          // No deps field
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      pathParameters: { username: 'user', specName: 'evolving-spec' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].deps).toEqual({ 'shared-lib': '3.0.0' });
    expect(body.versions[1].deps).toBeUndefined();
  });
});
