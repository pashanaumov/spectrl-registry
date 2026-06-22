import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { searchSpecs } from './dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('searchSpecs', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SPECS_TABLE = 'test-table';
  });

  describe('nextToken encoding/decoding', () => {
    it('should encode and decode nextToken correctly', async () => {
      const lastEvaluatedKey = { specId: 'user/spec1', version: '1.0.0' };

      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Test spec',
            tags: ['test'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
        ],
        LastEvaluatedKey: lastEvaluatedKey,
      });

      const result = await searchSpecs({ query: 'test', limit: 1 });

      expect(result.nextToken).toBeDefined();
      expect(result.hasMore).toBe(true);

      // Decode the token and verify it matches the original key
      if (result.nextToken) {
        const decoded = JSON.parse(Buffer.from(result.nextToken, 'base64').toString('utf-8'));
        expect(decoded).toEqual(lastEvaluatedKey);

        // ROUND-TRIP TEST: Use the token to fetch next page
        // This should work if encoding/decoding is correct
        ddbMock.on(ScanCommand).resolves({
          Items: [
            {
              specId: 'user/spec2',
              specName: 'spec2',
              username: 'user',
              version: '1.0.0',
              description: 'Second spec',
              tags: ['test'],
              createdAt: '2024-12-08T17:00:00.000Z',
            },
          ],
        });

        // This should NOT throw if token is valid
        await expect(
          searchSpecs({ query: 'test', nextToken: result.nextToken }),
        ).resolves.toBeDefined();
      }
    });

    it('should throw error for invalid nextToken', async () => {
      await expect(searchSpecs({ query: 'test', nextToken: 'invalid-base64!!!' })).rejects.toThrow(
        'Invalid nextToken',
      );
    });

    it('should throw error for corrupted nextToken JSON', async () => {
      const invalidJson = Buffer.from('not valid json', 'utf-8').toString('base64');

      await expect(searchSpecs({ query: 'test', nextToken: invalidJson })).rejects.toThrow(
        'Invalid nextToken',
      );
    });

    it('should handle empty nextToken', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [],
      });

      const result = await searchSpecs({ query: 'test', nextToken: '' });

      expect(result.results).toHaveLength(0);
      // Should not throw error
    });
  });

  describe('pagination logic', () => {
    it('should use ExclusiveStartKey when nextToken is provided', async () => {
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
            tags: ['test'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
      });

      await searchSpecs({ query: 'test', nextToken });

      const scanCalls = ddbMock.commandCalls(ScanCommand);
      expect(scanCalls.length).toBeGreaterThan(0);
      expect(scanCalls[0].args[0].input.ExclusiveStartKey).toEqual(exclusiveStartKey);
    });

    it('should set hasMore to false when no LastEvaluatedKey', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Test spec',
            tags: ['test'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
        ],
        // No LastEvaluatedKey
      });

      const result = await searchSpecs({ query: 'test', limit: 20 });

      expect(result.hasMore).toBe(false);
      expect(result.nextToken).toBeUndefined();
    });

    it('should set hasMore to true when more deduped items than limit', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Spec 1',
            tags: ['test'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/spec2',
            specName: 'spec2',
            username: 'user',
            version: '1.0.0',
            description: 'Spec 2',
            tags: ['test'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
        // No LastEvaluatedKey, but we have more items than limit
      });

      const result = await searchSpecs({ query: 'test', limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate by specId and keep latest version', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '2.0.0',
            description: 'Version 2',
            tags: ['test'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Version 1',
            tags: ['test'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
          {
            specId: 'user/spec2',
            specName: 'spec2',
            username: 'user',
            version: '1.0.0',
            description: 'Different spec',
            tags: ['test'],
            createdAt: '2024-12-08T16:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: 'test', limit: 10 });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].specId).toBe('user/spec1');
      expect(result.results[0].version).toBe('2.0.0'); // Latest version
      expect(result.results[1].specId).toBe('user/spec2');
    });
  });

  describe('search filtering', () => {
    it('should filter by specName', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/api-spec',
            specName: 'api-spec',
            username: 'user',
            version: '1.0.0',
            description: 'Some description',
            tags: ['other'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/other-spec',
            specName: 'other-spec',
            username: 'user',
            version: '1.0.0',
            description: 'Different spec',
            tags: ['test'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: 'api', limit: 10 });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].specName).toBe('api-spec');
    });

    it('should filter by description', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'REST API documentation',
            tags: ['other'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/spec2',
            specName: 'spec2',
            username: 'user',
            version: '1.0.0',
            description: 'Different content',
            tags: ['test'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: 'api', limit: 10 });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].specId).toBe('user/spec1');
    });

    it('should filter by tags', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Some spec',
            tags: ['api', 'rest'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/spec2',
            specName: 'spec2',
            username: 'user',
            version: '1.0.0',
            description: 'Different spec',
            tags: ['graphql'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: 'api', limit: 10 });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].tags).toContain('api');
    });

    it('should return all specs when query is empty', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'spec1',
            username: 'user',
            version: '1.0.0',
            description: 'Spec 1',
            tags: ['tag1'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
          {
            specId: 'user/spec2',
            specName: 'spec2',
            username: 'user',
            version: '1.0.0',
            description: 'Spec 2',
            tags: ['tag2'],
            createdAt: '2024-12-08T17:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: '', limit: 10 });

      expect(result.results).toHaveLength(2);
    });

    it('should be case-insensitive', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          {
            specId: 'user/spec1',
            specName: 'API-Spec',
            username: 'user',
            version: '1.0.0',
            description: 'REST API',
            tags: ['API'],
            createdAt: '2024-12-08T18:00:00.000Z',
          },
        ],
      });

      const result = await searchSpecs({ query: 'api', limit: 10 });

      expect(result.results).toHaveLength(1);
    });
  });

  describe('limit handling', () => {
    it('should respect limit parameter', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: Array.from({ length: 10 }, (_, i) => ({
          specId: `user/spec${i}`,
          specName: `spec${i}`,
          username: 'user',
          version: '1.0.0',
          description: `Spec ${i}`,
          tags: ['test'],
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
      });

      const result = await searchSpecs({ query: 'test', limit: 5 });

      expect(result.results).toHaveLength(5);
    });

    it('should use default limit of 20', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: Array.from({ length: 30 }, (_, i) => ({
          specId: `user/spec${i}`,
          specName: `spec${i}`,
          username: 'user',
          version: '1.0.0',
          description: `Spec ${i}`,
          tags: ['test'],
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
      });

      const result = await searchSpecs({ query: 'test' });

      expect(result.results).toHaveLength(20);
    });
  });
});
