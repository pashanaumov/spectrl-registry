import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from './index';

vi.mock('./helpers/credentials', () => ({
  getGithubOAuthCredentials: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getGitHubUser: vi.fn(),
}));
vi.mock('./helpers/dynamoDb', () => ({ storeUser: vi.fn() }));

import {
  getGithubOAuthCredentials,
  exchangeCodeForToken,
  getGitHubUser,
} from './helpers/credentials';
import { storeUser } from './helpers/dynamoDb';

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

describe('auth-exchange Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exchange code for token (happy path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);
    vi.mocked(exchangeCodeForToken).mockResolvedValue('gho_test_token' as any);
    vi.mocked(getGitHubUser).mockResolvedValue({
      githubId: 123,
      username: 'testuser',
      email: 'test@example.com',
    } as any);
    vi.mocked(storeUser).mockResolvedValue(undefined as any);

    const req = makeReq({ body: { code: 'test-oauth-code' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().token).toBe('gho_test_token');
    expect(res.getBody().username).toBe('testuser');
  });

  it('should reject missing code (sad path)', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(400);
    expect(res.getBody().error).toBeDefined();
  });

  it('should handle GitHub API failure (sad path)', async () => {
    vi.mocked(getGithubOAuthCredentials).mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    } as any);
    vi.mocked(exchangeCodeForToken).mockRejectedValue(
      new Error('GitHub OAuth failed: Bad Request'),
    );

    const req = makeReq({ body: { code: 'invalid-code' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(500);
  });
});
