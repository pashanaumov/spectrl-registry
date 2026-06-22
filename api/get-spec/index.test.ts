import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';
import * as fc from 'fast-check';

vi.mock('./helpers/dynamodb', () => ({ getSpecVersions: vi.fn() }));
import { getSpecVersions } from './helpers/dynamodb';

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

describe('get-spec Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return spec versions (happy path)', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
    ] as any);

    const req = makeReq({ params: { username: 'testuser', specName: 'test-spec' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    const body = res.getBody();
    expect(body.specId).toBe('testuser/test-spec');
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].version).toBe('2.0.0');
  });

  it('should return 404 for non-existent spec (sad path)', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([]);

    const req = makeReq({ params: { username: 'testuser', specName: 'nonexistent' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(404);
    expect(res.getBody().error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// Property 12: Get-spec version type mapping correctness
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
          vi.mocked(getSpecVersions).mockResolvedValue([
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
          ] as any);

          const req = makeReq({ params: { username: item.username, specName: item.specName } });
          const res = makeRes();
          await handler(req, res);
          expect(res.getStatus()).toBe(200);
          expect(res.getBody().versions[0].type).toBe('spec');
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
          vi.mocked(getSpecVersions).mockResolvedValue([
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
          ] as any);

          const req = makeReq({ params: { username: item.username, specName: item.specName } });
          const res = makeRes();
          await handler(req, res);
          expect(res.getStatus()).toBe(200);
          expect(res.getBody().versions[0].type).toBe('power');
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
          vi.mocked(getSpecVersions).mockResolvedValue([
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
          ] as any);

          const req = makeReq({ params: { username: item.username, specName: item.specName } });
          const res = makeRes();
          await handler(req, res);
          expect(res.getStatus()).toBe(200);
          expect(res.getBody().versions[0].type).toBe('spec');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('mixed versions preserve individual type values', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
    ] as any);

    const req = makeReq({ params: { username: 'user', specName: 'my-spec' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(200);

    const body = res.getBody();
    expect(body.versions).toHaveLength(3);
    expect(body.versions[0].type).toBe('power');
    expect(body.versions[1].type).toBe('spec');
    expect(body.versions[2].type).toBe('spec'); // defaulted from missing
  });
});

// ---------------------------------------------------------------------------
// Property 13: Get-spec deps field handling
// ---------------------------------------------------------------------------

describe('Property 13: Get-spec deps field handling', () => {
  it('should include deps field when present', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
        deps: { 'shared-errors': '1.0.0', 'base-types': '2.0.0' },
      },
    ] as any);

    const req = makeReq({ params: { username: 'testuser', specName: 'api-spec' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().versions[0].deps).toEqual({
      'shared-errors': '1.0.0',
      'base-types': '2.0.0',
    });
  });

  it('should handle versions without deps field', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
      },
    ] as any);

    const req = makeReq({ params: { username: 'testuser', specName: 'simple-spec' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().versions[0].deps).toBeUndefined();
  });

  it('should handle empty deps object', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
    ] as any);

    const req = makeReq({ params: { username: 'testuser', specName: 'empty-deps-spec' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().versions[0].deps).toEqual({});
  });

  it('should handle mixed versions with and without deps', async () => {
    vi.mocked(getSpecVersions).mockResolvedValue([
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
        deps: { 'shared-lib': '3.0.0' },
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
      },
    ] as any);

    const req = makeReq({ params: { username: 'user', specName: 'evolving-spec' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    const body = res.getBody();
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].deps).toEqual({ 'shared-lib': '3.0.0' });
    expect(body.versions[1].deps).toBeUndefined();
  });
});
