import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';

vi.mock('./helpers/dynamodb', () => ({ incrementDownloadCount: vi.fn() }));
import { incrementDownloadCount } from './helpers/dynamodb';

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

describe('track-download Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SPECS_TABLE = 'test-table';
  });

  describe('Happy Path', () => {
    it('should track download successfully', async () => {
      vi.mocked(incrementDownloadCount).mockResolvedValue(42 as any);

      const req = makeReq({
        body: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(200);
      expect(res.getBody().success).toBe(true);
      expect(res.getBody().downloads).toBe(42);
    });

    it('should track download with different version numbers', async () => {
      vi.mocked(incrementDownloadCount).mockResolvedValue(145 as any);

      const req = makeReq({ body: { username: 'alice', specName: 'api-spec', version: '2.1.0' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(200);
      expect(res.getBody().success).toBe(true);
      expect(res.getBody().downloads).toBe(145);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 when request body is invalid JSON', async () => {
      const req = makeReq({ body: 'invalid json{' });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });

    it('should return 400 when username is missing', async () => {
      const req = makeReq({ body: { specName: 'test-spec', version: '1.0.0' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });

    it('should return 400 when specName is missing', async () => {
      const req = makeReq({ body: { username: 'testuser', version: '1.0.0' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });

    it('should return 400 when version is missing', async () => {
      const req = makeReq({ body: { username: 'testuser', specName: 'test-spec' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });

    it('should return 400 when version is not valid semver', async () => {
      const req = makeReq({
        body: { username: 'testuser', specName: 'test-spec', version: 'invalid' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });

    it('should return 400 when username contains invalid characters', async () => {
      const req = makeReq({
        body: { username: 'test_user!', specName: 'test-spec', version: '1.0.0' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toContain('Invalid request parameters');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when spec version does not exist', async () => {
      vi.mocked(incrementDownloadCount).mockRejectedValue(new Error('Spec version not found'));

      const req = makeReq({
        body: { username: 'testuser', specName: 'nonexistent', version: '1.0.0' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(404);
      expect(res.getBody().error).toContain('Spec version not found');
    });

    it('should return 503 when DynamoDB is unavailable', async () => {
      vi.mocked(incrementDownloadCount).mockRejectedValue(
        new Error('DynamoDB service unavailable'),
      );

      const req = makeReq({
        body: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(503);
      expect(res.getBody().error).toContain('DynamoDB service unavailable');
    });

    it('should return 500 for unexpected errors', async () => {
      vi.mocked(incrementDownloadCount).mockRejectedValue(new Error('Unexpected error'));

      const req = makeReq({
        body: { username: 'testuser', specName: 'test-spec', version: '1.0.0' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBeTruthy();
    });
  });
});
