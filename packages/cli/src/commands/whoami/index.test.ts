import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { whoami } from './index.js';
import { TokenManager } from '../../auth/token-manager.js';

// Store original fetch
const originalFetch = global.fetch;

describe('whoami command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let tokenManagerGetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Spy on TokenManager.prototype.get
    tokenManagerGetSpy = vi.spyOn(TokenManager.prototype, 'get').mockResolvedValue(null);

    // Mock global fetch with proper typing
    global.fetch = vi.fn<typeof fetch>();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    tokenManagerGetSpy.mockRestore();

    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('when logged in', () => {
    it('should show username when token is valid', async () => {
      // Mock token exists
      tokenManagerGetSpy.mockResolvedValueOnce('gho_test_token');

      // Mock GitHub API response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          login: 'testuser',
        }),
      } as Response);

      await whoami();

      // Verify GitHub API was called with token
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: { Authorization: 'Bearer gho_test_token' },
        }),
      );

      // Verify username was displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Logged in as'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('testuser'));
    });
  });

  describe('when not logged in', () => {
    it('should show "Not logged in" when no token exists', async () => {
      // Mock no token
      tokenManagerGetSpy.mockResolvedValueOnce(null);

      await whoami();

      // Verify GitHub API was not called
      expect(fetch).not.toHaveBeenCalled();

      // Verify "Not logged in" message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Not logged in'));
    });
  });

  describe('when token is invalid', () => {
    it('should show "Token invalid" when GitHub API returns error', async () => {
      // Mock token exists
      tokenManagerGetSpy.mockResolvedValueOnce('gho_invalid_token');

      // Mock GitHub API error response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await whoami();

      // Verify "Token invalid" message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token invalid'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('spectrl login'));
    });

    it('should handle network errors gracefully', async () => {
      // Mock token exists
      tokenManagerGetSpy.mockResolvedValueOnce('gho_test_token');

      // Mock fetch to throw network error
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await whoami();

      // Verify error message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('spectrl login'));
    });
  });
});
