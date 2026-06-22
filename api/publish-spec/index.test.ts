import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';

vi.mock('./helpers/dynamodb', () => ({ storeSpecMetadata: vi.fn() }));
vi.mock('./helpers/s3', () => ({ uploadToS3: vi.fn(), uploadToStorage: vi.fn() }));

import { storeSpecMetadata } from './helpers/dynamodb';
import { uploadToStorage } from './helpers/s3';

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

describe('publish-spec Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.TABLE_NAME = 'test-table';
  });

  it('should publish spec successfully (happy path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'Test spec',
          agentTags: ['test'],
          files: ['README.md'],
          dependencies: {},
        },
        files: { 'README.md': '# Test\n\nContent' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toContain('Published');
    expect(res.getBody().url).toContain('testuser/test-spec');
  });

  it('should reject request without authorization (sad path)', async () => {
    const req = makeReq({
      headers: {},
      body: { manifest: { name: 'test/spec', version: '1.0.0' }, files: {} },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toContain('Authorization');
  });

  it('should reject invalid manifest (sad path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: { manifest: { name: 'invalid' }, files: {} },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(400);
    expect(res.getBody().error).toBeDefined();
  });

  it('should store type "power" when publishing a power', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/test-power',
          version: '1.0.0',
          description: 'A test power',
          type: 'power',
          files: ['index.md'],
          dependencies: {},
        },
        files: { 'index.md': '# Test Power\n\nInstructions here.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(vi.mocked(storeSpecMetadata).mock.calls[0][0].type).toBe('power');
  });

  it('should default type to "spec" when type is omitted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'A test spec without explicit type',
          files: ['index.md'],
          dependencies: {},
        },
        files: { 'index.md': '# Test Spec\n\nContent here.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(vi.mocked(storeSpecMetadata).mock.calls[0][0].type).toBe('spec');
  });

  it('should return 400 when type is an invalid value', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/test-spec',
          version: '1.0.0',
          description: 'A test spec',
          type: 'invalid-type',
          files: ['index.md'],
          dependencies: {},
        },
        files: { 'index.md': '# Test\n\nContent.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(400);
    expect(res.getBody().error).toBeDefined();
  });

  it('should store deps field when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/api-spec',
          version: '1.0.0',
          description: 'API spec with dependencies',
          type: 'spec',
          files: ['index.md'],
          deps: { 'shared-errors': '1.0.0', 'base-types': '2.0.0' },
        },
        files: { 'index.md': '# API Spec\n\nContent here.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(vi.mocked(storeSpecMetadata).mock.calls[0][0].deps).toEqual({
      'shared-errors': '1.0.0',
      'base-types': '2.0.0',
    });
  });

  it('should handle specs without deps field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/simple-spec',
          version: '1.0.0',
          description: 'Simple spec without dependencies',
          type: 'spec',
          files: ['index.md'],
        },
        files: { 'index.md': '# Simple Spec\n\nContent here.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(vi.mocked(storeSpecMetadata).mock.calls[0][0].deps).toBeUndefined();
  });

  it('should handle empty deps object', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(storeSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(uploadToStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      body: {
        manifest: {
          name: 'testuser/empty-deps-spec',
          version: '1.0.0',
          description: 'Spec with empty deps',
          type: 'spec',
          files: ['index.md'],
          deps: {},
        },
        files: { 'index.md': '# Empty Deps Spec\n\nContent here.' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(vi.mocked(storeSpecMetadata).mock.calls[0][0].deps).toEqual({});
  });
});
