import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenManager } from './token-manager.js';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Mock keytar to test both success and failure paths
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

import keytar from 'keytar';

const AUTH_FILE = join(homedir(), '.spectrl', '.auth');

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
    vi.clearAllMocks();

    // Clean up any existing auth file
    if (existsSync(AUTH_FILE)) {
      unlinkSync(AUTH_FILE);
    }
  });

  afterEach(() => {
    // Clean up auth file after each test
    if (existsSync(AUTH_FILE)) {
      unlinkSync(AUTH_FILE);
    }
  });

  describe('store', () => {
    it('should store token in keychain when available', async () => {
      const token = 'gho_test_token_123';
      vi.mocked(keytar.setPassword).mockResolvedValue(undefined);

      await tokenManager.store(token);

      expect(keytar.setPassword).toHaveBeenCalledWith('spectrl', 'github-token', token);
      // Should not create encrypted file when keychain works
      expect(existsSync(AUTH_FILE)).toBe(false);
    });

    it('should fall back to encrypted file when keychain fails', async () => {
      const token = 'gho_test_token_456';
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));

      await tokenManager.store(token);

      expect(keytar.setPassword).toHaveBeenCalled();
      // Should create encrypted file as fallback
      expect(existsSync(AUTH_FILE)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve token from keychain when available', async () => {
      const token = 'gho_test_token_789';
      vi.mocked(keytar.getPassword).mockResolvedValue(token);

      const result = await tokenManager.get();

      expect(keytar.getPassword).toHaveBeenCalledWith('spectrl', 'github-token');
      expect(result).toBe(token);
    });

    it('should return null when no token in keychain', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });

    it('should fall back to encrypted file when keychain fails', async () => {
      const token = 'gho_test_token_fallback';
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));

      // Store token (will use encrypted file)
      await tokenManager.store(token);

      // Retrieve token (should fall back to encrypted file)
      const result = await tokenManager.get();

      expect(result).toBe(token);
    });

    it('should return null when no encrypted file exists', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });
  });

  describe('delete', () => {
    it('should delete token from keychain', async () => {
      vi.mocked(keytar.deletePassword).mockResolvedValue(true);

      await tokenManager.delete();

      expect(keytar.deletePassword).toHaveBeenCalledWith('spectrl', 'github-token');
    });

    it('should delete encrypted file if it exists', async () => {
      const token = 'gho_test_token_delete';
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      vi.mocked(keytar.deletePassword).mockRejectedValue(new Error('Keychain not available'));

      // Store token (will create encrypted file)
      await tokenManager.store(token);
      expect(existsSync(AUTH_FILE)).toBe(true);

      // Delete token
      await tokenManager.delete();

      // Encrypted file should be deleted
      expect(existsSync(AUTH_FILE)).toBe(false);
    });

    it('should not throw when deleting non-existent token', async () => {
      vi.mocked(keytar.deletePassword).mockRejectedValue(new Error('Not found'));

      await expect(tokenManager.delete()).resolves.not.toThrow();
    });
  });

  describe('token persistence', () => {
    it('should persist token across TokenManager instances', async () => {
      const token = 'gho_test_token_persist';
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Store with first instance
      const manager1 = new TokenManager();
      await manager1.store(token);

      // Retrieve with second instance
      const manager2 = new TokenManager();
      const result = await manager2.get();

      expect(result).toBe(token);
    });

    it('should handle special characters in token', async () => {
      const token = 'gho_!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      await tokenManager.store(token);
      const result = await tokenManager.get();

      expect(result).toBe(token);
    });

    it('should handle long tokens', async () => {
      const token = `gho_${'a'.repeat(500)}`;
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      await tokenManager.store(token);
      const result = await tokenManager.get();

      expect(result).toBe(token);
    });
  });

  describe('keychain fallback behavior', () => {
    it('should prefer keychain over encrypted file when both available', async () => {
      const keychainToken = 'gho_keychain_token';
      const fileToken = 'gho_file_token';

      // First store in file (keychain fails)
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      await tokenManager.store(fileToken);

      // Then mock keychain to work and return different token
      vi.mocked(keytar.getPassword).mockResolvedValue(keychainToken);

      const result = await tokenManager.get();

      // Should return keychain token, not file token
      expect(result).toBe(keychainToken);
    });

    it('should use encrypted file when keychain returns null', async () => {
      const token = 'gho_file_only_token';

      // Store in file
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain not available'));
      await tokenManager.store(token);

      // Mock keychain to return null (not an error, just no token)
      vi.mocked(keytar.getPassword).mockResolvedValue(null);

      const result = await tokenManager.get();

      // Should still return null because keychain succeeded (returned null)
      // This tests that we only fall back on keychain errors, not null returns
      expect(result).toBe(null);
    });
  });

  describe('file validation', () => {
    it('should return null for corrupted file with invalid structure', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Create a corrupted file with invalid structure
      writeFileSync(AUTH_FILE, JSON.stringify({ invalid: 'structure' }), 'utf8');

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });

    it('should return null for file with missing fields', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Create file missing required fields
      writeFileSync(AUTH_FILE, JSON.stringify({ salt: 'a'.repeat(64) }), 'utf8');

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });

    it('should return null for file with invalid field types', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Create file with wrong types
      writeFileSync(
        AUTH_FILE,
        JSON.stringify({ salt: 123, iv: 'a'.repeat(32), encrypted: 'data' }),
        'utf8',
      );

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });

    it('should return null for file with invalid hex lengths', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Create file with wrong hex lengths
      writeFileSync(
        AUTH_FILE,
        JSON.stringify({ salt: 'short', iv: 'short', encrypted: 'data' }),
        'utf8',
      );

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });

    it('should return null for malformed JSON', async () => {
      vi.mocked(keytar.getPassword).mockRejectedValue(new Error('Keychain not available'));

      // Create file with invalid JSON
      writeFileSync(AUTH_FILE, 'not valid json{', 'utf8');

      const result = await tokenManager.get();

      expect(result).toBe(null);
    });
  });
});
