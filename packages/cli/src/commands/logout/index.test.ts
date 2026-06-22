import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logout } from './index.js';
import { TokenManager } from '../../auth/token-manager.js';

describe('logout command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let tokenManagerDeleteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Spy on TokenManager.prototype.delete
    tokenManagerDeleteSpy = vi.spyOn(TokenManager.prototype, 'delete').mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    tokenManagerDeleteSpy.mockRestore();
  });

  describe('successful logout', () => {
    it('should delete token and show success message', async () => {
      await logout();

      // Verify token was deleted
      expect(tokenManagerDeleteSpy).toHaveBeenCalledOnce();

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Logged out'));
    });

    it('should work even if no token exists', async () => {
      // TokenManager.delete() should not throw even if no token exists
      await logout();

      expect(tokenManagerDeleteSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Logged out'));
    });
  });

  describe('error handling', () => {
    it('should handle TokenManager errors gracefully', async () => {
      // Mock TokenManager.delete to throw error
      tokenManagerDeleteSpy.mockRejectedValueOnce(new Error('Keychain error'));

      // Should propagate the error
      await expect(logout()).rejects.toThrow('Keychain error');
    });
  });
});
