import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './index';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import * as fc from 'fast-check';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('search-specs Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SPECS_TABLE = 'test-table';
  });

  it('should return search results (happy path)', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'API spec',
          agentTags: ['api'],
          publishedAt: '2024-12-08T18:00:00.000Z',
          createdAt: '2024-12-08T18:00:00.000Z',
          hash: 'sha256:abc123',
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.count).toBe(1);
    expect(body.results[0].specId).toBe('user/spec1');
  });

  it('should handle empty search results (sad path)', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'nonexistent' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('should return nextToken when more results exist', async () => {
    const lastEvaluatedKey = { specId: 'user/spec1', version: '1.0.0' };

    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'API spec',
          tags: ['api'],
          createdAt: '2024-12-08T18:00:00.000Z',
        },
      ],
      LastEvaluatedKey: lastEvaluatedKey,
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api', limit: '1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextToken).toBeDefined();

    // Verify nextToken is valid base64
    expect(() => Buffer.from(body.nextToken, 'base64').toString('utf-8')).not.toThrow();
  });

  it('should use nextToken for pagination', async () => {
    const exclusiveStartKey = { specId: 'user/spec1', version: '1.0.0' };
    const nextToken = Buffer.from(JSON.stringify(exclusiveStartKey)).toString('base64');

    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          specId: 'user/spec2',
          specName: 'spec2',
          username: 'user',
          version: '1.0.0',
          description: 'Second spec',
          tags: ['api'],
          createdAt: '2024-12-08T17:00:00.000Z',
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api', nextToken },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].specId).toBe('user/spec2');

    // Verify the ScanCommand was called with ExclusiveStartKey
    const scanCalls = ddbMock.commandCalls(ScanCommand);
    expect(scanCalls.length).toBeGreaterThan(0);
    expect(scanCalls[0].args[0].input.ExclusiveStartKey).toEqual(exclusiveStartKey);
  });

  it('should handle invalid nextToken', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api', nextToken: 'invalid-token!!!' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Invalid nextToken');
  });

  it('should respect limit parameter', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'Spec 1',
          tags: ['api'],
          createdAt: '2024-12-08T18:00:00.000Z',
        },
        {
          specId: 'user/spec2',
          specName: 'spec2',
          username: 'user',
          version: '1.0.0',
          description: 'Spec 2',
          tags: ['api'],
          createdAt: '2024-12-08T17:00:00.000Z',
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api', limit: '1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('should deduplicate specs by specId', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '2.0.0',
          description: 'Spec v2',
          tags: ['api'],
          createdAt: '2024-12-08T18:00:00.000Z',
        },
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'Spec v1',
          tags: ['api'],
          createdAt: '2024-12-08T17:00:00.000Z',
        },
      ],
    });

    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { q: 'api' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].version).toBe('2.0.0'); // Should keep the latest version
  });
});

// ---------------------------------------------------------------------------
// Property 10: Search result type mapping correctness
// For any DynamoDB item with or without a `type` field, mapToSearchResult
// should produce a result where type equals the item's type if present,
// or "spec" if absent.
// ---------------------------------------------------------------------------
describe('Property 10: Search result type mapping correctness', () => {
  it('items with type "spec" map to type "spec"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specId: fc.string({ minLength: 1 }),
          specName: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          version: fc.constant('1.0.0'),
          description: fc.string(),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          ddbMock.on(ScanCommand).resolves({
            Items: [{ ...item, type: 'spec', tags: [] }],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: {},
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          if (body.results.length > 0) {
            expect(body.results[0].type).toBe('spec');
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('items with type "power" map to type "power"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specId: fc.string({ minLength: 1 }),
          specName: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          version: fc.constant('1.0.0'),
          description: fc.string(),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          ddbMock.on(ScanCommand).resolves({
            Items: [{ ...item, type: 'power', tags: [] }],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: {},
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          if (body.results.length > 0) {
            expect(body.results[0].type).toBe('power');
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('items without type field default to "spec"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          specId: fc.string({ minLength: 1 }),
          specName: fc.string({ minLength: 1 }),
          username: fc.string({ minLength: 1 }),
          version: fc.constant('1.0.0'),
          description: fc.string(),
          createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          // No type field on the DynamoDB item
          ddbMock.on(ScanCommand).resolves({
            Items: [{ ...item, tags: [] }],
          });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: {},
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          if (body.results.length > 0) {
            expect(body.results[0].type).toBe('spec');
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Search type filter correctness
// For any mix of spec/power items, filtering by type returns only matching
// items; omitting the filter returns all items.
// ---------------------------------------------------------------------------
describe('Property 11: Search type filter correctness', () => {
  it('type=spec filter returns only spec items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            specId: fc
              .uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 1 })
              .map((a) => a[0]),
            specName: fc.string({ minLength: 1 }),
            username: fc.constant('user'),
            version: fc.constant('1.0.0'),
            description: fc.string(),
            type: fc.constantFrom('spec', 'power'),
            tags: fc.constant([]),
            createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          // Ensure unique specIds to avoid deduplication collapsing results
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/spec-${i}` }));

          ddbMock.on(ScanCommand).resolves({ Items: uniqueItems });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: { type: 'spec' },
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          for (const r of body.results) {
            expect(r.type).toBe('spec');
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('type=power filter returns only power items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            specId: fc.string({ minLength: 1 }),
            specName: fc.string({ minLength: 1 }),
            username: fc.constant('user'),
            version: fc.constant('1.0.0'),
            description: fc.string(),
            type: fc.constantFrom('spec', 'power'),
            tags: fc.constant([]),
            createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/power-${i}` }));

          ddbMock.on(ScanCommand).resolves({ Items: uniqueItems });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: { type: 'power' },
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          for (const r of body.results) {
            expect(r.type).toBe('power');
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('no type filter returns all items regardless of type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            specId: fc.string({ minLength: 1 }),
            specName: fc.string({ minLength: 1 }),
            username: fc.constant('user'),
            version: fc.constant('1.0.0'),
            description: fc.string(),
            type: fc.constantFrom('spec', 'power'),
            tags: fc.constant([]),
            createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/item-${i}` }));

          ddbMock.on(ScanCommand).resolves({ Items: uniqueItems });

          const event: Partial<APIGatewayProxyEvent> = {
            queryStringParameters: {},
          };
          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // All returned types must be valid
          for (const r of body.results) {
            expect(['spec', 'power']).toContain(r.type);
          }

          // Total returned should equal unique items (up to default limit of 20)
          expect(body.results.length).toBe(Math.min(uniqueItems.length, 20));
        },
      ),
      { numRuns: 30 },
    );
  });

  it('invalid type value returns 400', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { type: 'invalid-type' },
    };
    const result = await handler(event as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
