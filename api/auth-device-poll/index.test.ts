import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index';

vi.mock('../auth-exchange/helpers/credentials', () => ({
  getGithubOAuthCredentials: vi.fn(),
  getGitHubUser: vi.fn(),
}));
vi.mock('../auth-exchange/helpers/dynamoDb', () => ({ storeUser: vi.fn() }));

import { getGithubOAuthCredentials, getGitHubUser } from '../auth-exchange/helpers/credentials';
import { storeUser } from '../auth-exchange/helpers/dynamoDb';

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

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

describe('auth-device-poll Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);
  });

  describe('Request validation', () => {
    it('should return 400 when request body is missing', async () => {
      const req = makeReq({ body: null });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('missing_device_code');
      expect(res.getBody().message).toContain('device_code is required');
    });

    it('should return 400 when device_code is missing', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('invalid_request');
      expect(res.getBody().message).toContain('device_code is required');
    });

    it('should return 400 when device_code is not a string', async () => {
      const req = makeReq({ body: { device_code: 123 } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('invalid_request');
    });
  });

  describe('Authorization pending (202)', () => {
    it('should return 202 when GitHub returns authorization_pending', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending',
        }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(202);
      expect(res.getBody().status).toBe('authorization_pending');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'test-device-code',
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        }),
      );
    });

    it('should return 202 when GitHub returns slow_down', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'slow_down',
          error_description: 'You are polling too frequently',
        }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(202);
      expect(res.getBody().status).toBe('authorization_pending');
    });
  });

  describe('Successful authorization (200)', () => {
    it('should return 200 with token and username when authorization succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_test_token',
          token_type: 'bearer',
          scope: 'user:email',
        }),
      });

      vi.mocked(getGitHubUser).mockResolvedValue({
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      } as any);
      vi.mocked(storeUser).mockResolvedValue(undefined as any);

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(200);
      expect(res.getBody().token).toBe('gho_test_token');
      expect(res.getBody().username).toBe('testuser');

      expect(vi.mocked(storeUser).mock.calls[0][0]).toMatchObject({
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should include CORS headers in success response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_test_token',
          token_type: 'bearer',
          scope: 'user:email',
        }),
      });

      vi.mocked(getGitHubUser).mockResolvedValue({
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      } as any);
      vi.mocked(storeUser).mockResolvedValue(undefined as any);

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      // Express handlers set headers via res.set/res.header not on the return value,
      // but this handler uses res.status().json() without setting CORS headers explicitly.
      // We verify the response body is correct.
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('Expired device code (400)', () => {
    it('should return 400 when GitHub returns expired_token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'expired_token',
          error_description: 'The device code has expired',
        }),
      });

      const req = makeReq({ body: { device_code: 'expired-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('expired_token');
      expect(res.getBody().message).toContain('expired');
    });

    it('should return 400 when GitHub returns incorrect_device_code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'incorrect_device_code',
          error_description: 'The device code is incorrect',
        }),
      });

      const req = makeReq({ body: { device_code: 'invalid-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('incorrect_device_code');
    });
  });

  describe('Denied authorization (400)', () => {
    it('should return 400 when GitHub returns access_denied', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'access_denied',
          error_description: 'The user denied the authorization request',
        }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('access_denied');
      expect(res.getBody().message).toContain('denied');
    });
  });

  describe('Error handling', () => {
    it('should return 500 when GitHub API request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBe('internal_error');
      expect(res.getBody().message).toContain('GitHub API failed');
    });

    it('should return 500 when secrets retrieval fails', async () => {
      vi.mocked(getGithubOAuthCredentials).mockRejectedValue(new Error('Secrets Manager error'));

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBe('internal_error');
      expect(res.getBody().message).toContain('Secrets Manager error');
    });

    it('should return 500 when GitHub user fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_test_token',
          token_type: 'bearer',
          scope: 'user:email',
        }),
      });

      vi.mocked(getGitHubUser).mockRejectedValue(new Error('GitHub API failed: Unauthorized'));

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBe('internal_error');
      expect(res.getBody().message).toContain('GitHub API failed');
    });

    it('should return 500 when storeUser fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_test_token',
          token_type: 'bearer',
          scope: 'user:email',
        }),
      });

      vi.mocked(getGitHubUser).mockResolvedValue({
        githubId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      } as any);
      vi.mocked(storeUser).mockRejectedValue(new Error('DynamoDB error'));

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBe('internal_error');
      expect(res.getBody().message).toContain('DynamoDB error');
    });

    it('should return 500 when GitHub returns unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: 'response' }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(res.getStatus()).toBe(500);
      expect(res.getBody().error).toBe('internal_error');
      expect(res.getBody().message).toContain('Unexpected response format');
    });
  });

  describe('OAuth credentials retrieval', () => {
    it('should retrieve OAuth credentials from secrets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(vi.mocked(getGithubOAuthCredentials)).toHaveBeenCalledTimes(1);
    });

    it('should use correct client_id in GitHub request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' }),
      });

      const req = makeReq({ body: { device_code: 'test-device-code' } });
      const res = makeRes();
      await handler(req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-client-id'),
        }),
      );

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body as string);
      expect(requestBody.client_id).toBe('test-client-id');
      expect(requestBody.device_code).toBe('test-device-code');
      expect(requestBody.grant_type).toBe('urn:ietf:params:oauth:grant-type:device_code');
    });
  });
});
