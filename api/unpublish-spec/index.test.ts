import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';

vi.mock('./helpers/dynamodb', () => ({
  checkSpecExists: vi.fn(),
  deleteSpecMetadata: vi.fn(),
}));
vi.mock('./helpers/s3', () => ({ deleteSpecFromS3: vi.fn(), deleteSpecFromStorage: vi.fn() }));

import { checkSpecExists, deleteSpecMetadata } from './helpers/dynamodb';
import { deleteSpecFromStorage } from './helpers/s3';

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

describe('unpublish-spec Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.TABLE_NAME = 'test-table';
  });

  it('should unpublish spec successfully (happy path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, email: 'test@example.com' }),
    });
    vi.mocked(checkSpecExists).mockResolvedValue(true as any);
    vi.mocked(deleteSpecMetadata).mockResolvedValue(undefined as any);
    vi.mocked(deleteSpecFromStorage).mockResolvedValue(undefined as any);

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      params: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toContain('Unpublished');
  });

  it('should reject unauthorized request (sad path)', async () => {
    const req = makeReq({
      headers: {},
      params: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toContain('Authorization');
  });

  it('should reject ownership violation (sad path)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'otheruser', id: 456, email: 'other@example.com' }),
    });

    const req = makeReq({
      headers: { authorization: 'Bearer fake-token' },
      params: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(403);
    expect(res.getBody().error).toContain('Ownership');
  });
});
