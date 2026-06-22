import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';

vi.mock('../auth-exchange/helpers/credentials', () => ({
  getGithubOAuthCredentials: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getGitHubUser: vi.fn(),
}));
import { getGithubOAuthCredentials } from '../auth-exchange/helpers/credentials';

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

describe('auth-device-init Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully initiate device flow (happy path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    const mockGitHubResponse = {
      device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGitHubResponse,
    });

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    const body = res.getBody();
    expect(body.device_code).toBe(mockGitHubResponse.device_code);
    expect(body.user_code).toBe(mockGitHubResponse.user_code);
    expect(body.verification_uri).toBe(mockGitHubResponse.verification_uri);
    expect(body.expires_in).toBe(mockGitHubResponse.expires_in);
    expect(body.interval).toBe(mockGitHubResponse.interval);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/login/device/code',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('test-client-id'),
      }),
    );
  });

  it('should handle secrets failure (sad path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockRejectedValue(
      new Error('Secrets Manager unavailable'),
    );

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
    expect(res.getBody().error).toBe('Failed to initiate device flow');
    expect(res.getBody().message).toContain('Secrets Manager unavailable');
  });

  it('should handle GitHub API failure (sad path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
    });

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
    expect(res.getBody().error).toBe('Failed to initiate device flow');
    expect(res.getBody().message).toContain('GitHub Device Flow API failed');
  });

  it('should handle invalid GitHub response schema (sad path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
        // Missing user_code, verification_uri, expires_in, interval
      }),
    });

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
    expect(res.getBody().error).toBe('Invalid response from GitHub');
    expect(res.getBody().message).toContain('did not match the expected format');
  });

  it('should validate all response fields have correct types (schema validation)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5',
        user_code: 'WDJB-MJHT',
        verification_uri: 'not-a-valid-url',
        expires_in: '900', // Should be number, not string
        interval: 5,
      }),
    });

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
    expect(res.getBody().error).toBe('Invalid response from GitHub');
  });

  it('should handle network errors gracefully (sad path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
    expect(res.getBody().error).toBe('Failed to initiate device flow');
    expect(res.getBody().message).toContain('Network error');
  });

  it('should include correct scope in GitHub request', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'test-device-code',
        user_code: 'TEST-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    });

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body as string);

    expect(requestBody.scope).toBe('user:email');
    expect(requestBody.client_id).toBe('test-client-id');
  });
});
