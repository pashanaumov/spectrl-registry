import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { login } from './index.js';
import { TokenManager } from '../../auth/token-manager.js';

// Set API_URL before importing (required by api-client.ts)
process.env.API_URL = 'https://test-api.example.com/prod';

// Mock open
vi.mock('open', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// Store original fetch
const originalFetch = global.fetch;

describe('login command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let tokenManagerStoreSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Spy on TokenManager.prototype.store
    tokenManagerStoreSpy = vi.spyOn(TokenManager.prototype, 'store').mockResolvedValue(undefined);

    // Mock global fetch with proper typing
    global.fetch = vi.fn<typeof fetch>();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    tokenManagerStoreSpy.mockRestore();

    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('successful login flow', () => {
    it('should complete device flow and store token', async () => {
      // Use fake timers to control setTimeout
      vi.useFakeTimers();

      // Mock device flow init response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'test_device_code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      } as Response);

      // Mock device flow poll response (success on first poll)
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          token: 'gho_test_token',
          username: 'testuser',
        }),
      } as Response);

      // Start login (don't await yet)
      const loginPromise = login();

      // Fast-forward time to trigger the poll
      await vi.advanceTimersByTimeAsync(5000);

      // Wait for login to complete
      await loginPromise;

      // Verify token was stored
      expect(tokenManagerStoreSpy).toHaveBeenCalledWith('gho_test_token');

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Logged in as'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('testuser'));

      // Restore real timers
      vi.useRealTimers();
    });

    it('should poll multiple times before success', async () => {
      // Mock device flow init response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'test_device_code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 1, // Short interval for testing
        }),
      } as Response);

      // Mock device flow poll responses (pending, pending, success)
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 202,
          json: async () => ({ status: 'authorization_pending' }),
        } as Response)
        .mockResolvedValueOnce({
          status: 202,
          json: async () => ({ status: 'authorization_pending' }),
        } as Response)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            token: 'gho_test_token',
            username: 'testuser',
          }),
        } as Response);

      await login();

      // Verify token was stored
      expect(tokenManagerStoreSpy).toHaveBeenCalledWith('gho_test_token');

      // Verify fetch was called 4 times (1 init + 3 polls)
      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('error handling', () => {
    it('should throw error when device flow init fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(login()).rejects.toThrow('Device flow initialization failed');
    });

    it('should throw error when authorization is denied', async () => {
      // Use fake timers to control setTimeout
      vi.useFakeTimers();

      // Mock device flow init response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: 'test_device_code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      } as Response);

      // Mock device flow poll response (denied)
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 400,
        json: async () => ({
          error: 'access_denied',
          message: 'User denied authorization',
        }),
      } as Response);

      // Start login and catch the error
      const loginPromise = login().catch((error) => error);

      // Fast-forward time to trigger the poll
      await vi.advanceTimersByTimeAsync(5000);

      // Wait for the promise and check the error
      const error = await loginPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Authentication failed');

      // Restore real timers
      vi.useRealTimers();
    });
  });
});
