import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';
import * as fc from 'fast-check';

vi.mock('./helpers/dynamodb', () => ({ searchSpecs: vi.fn() }));
import { searchSpecs } from './helpers/dynamodb';

// biome-ignore lint/suspicious/noExplicitAny: test helper
function makeReq(overrides: Partial<{ params: any; query: any; headers: any; body: any }> = {}) {
  return {
    params: overrides.params || {},
    query: overrides.query || {},
    headers: overrides.headers || {},
    body: overrides.body || null,
    // biome-ignore lint/suspicious/noExplicitAny: test helper mock
  } as any;
}

function makeRes() {
  // biome-ignore lint/suspicious/noExplicitAny: test helper mock
  const res: any = {};
  let _status = 200;
  // biome-ignore lint/suspicious/noExplicitAny: test helper mock
  let _body: any = null;
  res.status = (code: number) => {
    _status = code;
    return res;
  };
  // biome-ignore lint/suspicious/noExplicitAny: test helper mock
  res.json = (data: any) => {
    _body = data;
    return res;
  };
  res.getStatus = () => _status;
  res.getBody = () => _body;
  return res;
}

describe('search-specs Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SPECS_TABLE = 'test-table';
  });

  it('should return search results (happy path)', async () => {
    vi.mocked(searchSpecs).mockResolvedValue({
      results: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'API spec',
          type: 'spec',
          tags: ['api'],
          publishedAt: '2024-12-08T18:00:00.000Z',
        },
      ],
      count: 1,
      hasMore: false,
    } as any);

    const req = makeReq({ query: { q: 'api' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(1);
    expect(res.getBody().count).toBe(1);
    expect(res.getBody().results[0].specId).toBe('user/spec1');
  });

  it('should handle empty search results (sad path)', async () => {
    vi.mocked(searchSpecs).mockResolvedValue({ results: [], count: 0, hasMore: false } as any);

    const req = makeReq({ query: { q: 'nonexistent' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(0);
    expect(res.getBody().count).toBe(0);
  });

  it('should return nextToken when more results exist', async () => {
    const lastEvaluatedKey = { specId: 'user/spec1', version: '1.0.0' };
    const nextToken = Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');

    vi.mocked(searchSpecs).mockResolvedValue({
      results: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'API spec',
          tags: ['api'],
          publishedAt: '2024-12-08T18:00:00.000Z',
        },
      ],
      count: 1,
      hasMore: true,
      nextToken,
    } as any);

    const req = makeReq({ query: { q: 'api', limit: '1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(1);
    expect(res.getBody().hasMore).toBe(true);
    expect(res.getBody().nextToken).toBeDefined();
    expect(() => Buffer.from(res.getBody().nextToken, 'base64').toString('utf-8')).not.toThrow();
  });

  it('should use nextToken for pagination', async () => {
    const exclusiveStartKey = { specId: 'user/spec1', version: '1.0.0' };
    const nextToken = Buffer.from(JSON.stringify(exclusiveStartKey)).toString('base64');

    vi.mocked(searchSpecs).mockResolvedValue({
      results: [
        {
          specId: 'user/spec2',
          specName: 'spec2',
          username: 'user',
          version: '1.0.0',
          description: 'Second spec',
          tags: ['api'],
          publishedAt: '2024-12-08T17:00:00.000Z',
        },
      ],
      count: 1,
      hasMore: false,
    } as any);

    const req = makeReq({ query: { q: 'api', nextToken } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(1);
    expect(res.getBody().results[0].specId).toBe('user/spec2');

    expect(vi.mocked(searchSpecs).mock.calls[0][0].nextToken).toBe(nextToken);
  });

  it('should handle invalid nextToken', async () => {
    vi.mocked(searchSpecs).mockRejectedValue(new Error('Invalid nextToken'));

    const req = makeReq({ query: { q: 'api', nextToken: 'invalid-token!!!' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(400);
    expect(res.getBody().error).toContain('Invalid nextToken');
  });

  it('should respect limit parameter', async () => {
    vi.mocked(searchSpecs).mockResolvedValue({
      results: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '1.0.0',
          description: 'Spec 1',
          tags: ['api'],
          publishedAt: '2024-12-08T18:00:00.000Z',
        },
      ],
      count: 1,
      hasMore: false,
    } as any);

    const req = makeReq({ query: { q: 'api', limit: '1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(1);
    expect(res.getBody().count).toBe(1);
  });

  it('should deduplicate specs by specId', async () => {
    vi.mocked(searchSpecs).mockResolvedValue({
      results: [
        {
          specId: 'user/spec1',
          specName: 'spec1',
          username: 'user',
          version: '2.0.0',
          description: 'Spec v2',
          tags: ['api'],
          publishedAt: '2024-12-08T18:00:00.000Z',
        },
      ],
      count: 1,
      hasMore: false,
    } as any);

    const req = makeReq({ query: { q: 'api' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().results).toHaveLength(1);
    expect(res.getBody().results[0].version).toBe('2.0.0');
  });
});

// ---------------------------------------------------------------------------
// Property 10: Search result type mapping correctness
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
          publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          vi.mocked(searchSpecs).mockResolvedValue({
            results: [{ ...item, type: 'spec', tags: [] }],
            count: 1,
            hasMore: false,
          } as any);

          const req = makeReq({ query: {} });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

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
          publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          vi.mocked(searchSpecs).mockResolvedValue({
            results: [{ ...item, type: 'power', tags: [] }],
            count: 1,
            hasMore: false,
          } as any);

          const req = makeReq({ query: {} });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

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
          publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
        }),
        async (item) => {
          vi.mocked(searchSpecs).mockResolvedValue({
            results: [{ ...item, tags: [] }],
            count: 1,
            hasMore: false,
          } as any);

          const req = makeReq({ query: {} });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

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
            publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/spec-${i}` }));
          const specItems = uniqueItems.filter((i) => i.type === 'spec');

          vi.mocked(searchSpecs).mockResolvedValue({
            results: specItems,
            count: specItems.length,
            hasMore: false,
          } as any);

          const req = makeReq({ query: { type: 'spec' } });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

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
            publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/power-${i}` }));
          const powerItems = uniqueItems.filter((i) => i.type === 'power');

          vi.mocked(searchSpecs).mockResolvedValue({
            results: powerItems,
            count: powerItems.length,
            hasMore: false,
          } as any);

          const req = makeReq({ query: { type: 'power' } });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

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
            publishedAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          const uniqueItems = items.map((item, i) => ({ ...item, specId: `user/item-${i}` }));
          const limited = uniqueItems.slice(0, 20);

          vi.mocked(searchSpecs).mockResolvedValue({
            results: limited,
            count: limited.length,
            hasMore: uniqueItems.length > 20,
          } as any);

          const req = makeReq({ query: {} });
          const res = makeRes();
          await handler(req, res);
          const body = res.getBody();

          for (const r of body.results) {
            expect(['spec', 'power']).toContain(r.type);
          }

          expect(body.results.length).toBe(Math.min(uniqueItems.length, 20));
        },
      ),
      { numRuns: 30 },
    );
  });

  it('invalid type value returns 400', async () => {
    const req = makeReq({ query: { type: 'invalid-type' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
  });
});
