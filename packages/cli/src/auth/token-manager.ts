import keytar from 'keytar';
import machineId from 'node-machine-id';
import { z } from 'zod';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SERVICE_NAME = 'spectrl';
const ACCOUNT_NAME = 'github-token';
const AUTH_DIR = join(homedir(), '.spectrl');
const AUTH_FILE = join(AUTH_DIR, '.auth');

/**
 * Schema for encrypted token file structure.
 * Validates that the file contains the required fields with correct types.
 */
const EncryptedTokenSchema = z.object({
  salt: z.string().length(64), // 32 bytes as hex = 64 characters
  iv: z.string().length(32), // 16 bytes as hex = 32 characters
  encrypted: z.string().min(1), // Encrypted token (variable length)
});

/**
 * TokenManager handles secure storage and retrieval of GitHub access tokens.
 *
 * Primary storage: OS keychain via keytar (macOS Keychain, Windows Credential Vault, Linux Secret Service)
 * Fallback storage: Encrypted file at ~/.spectrl/.auth (when keychain unavailable)
 *
 * The fallback uses AES-256-CBC encryption with a key derived from the machine ID using PBKDF2.
 * This provides cryptographically strong key derivation with 100,000 iterations.
 */
export class TokenManager {
  /**
   * Store a token securely.
   * Attempts to use OS keychain first, falls back to encrypted file if keychain fails.
   */
  async store(token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    } catch (error) {
      // Keychain not available, use encrypted file fallback
      this.storeEncrypted(token);
    }
  }

  /**
   * Retrieve a stored token.
   * Attempts to read from OS keychain first, falls back to encrypted file if keychain fails.
   */
  async get(): Promise<string | null> {
    try {
      const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      return token;
    } catch (error) {
      // Keychain not available, try encrypted file fallback
      return this.getEncrypted();
    }
  }

  /**
   * Delete a stored token.
   * Removes from both OS keychain and encrypted file (if present).
   */
  async delete(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch (error) {
      // Keychain not available, ignore error
    }

    // Also delete encrypted file if it exists
    this.deleteEncrypted();
  }

  /**
   * Store token in encrypted file as fallback.
   * Uses AES-256-CBC with PBKDF2-derived key from machine ID.
   */
  private storeEncrypted(token: string): void {
    try {
      // Ensure directory exists
      if (!existsSync(AUTH_DIR)) {
        mkdirSync(AUTH_DIR, { recursive: true });
      }

      // Generate random salt and IV
      const salt = randomBytes(32);
      const iv = randomBytes(16);

      // Derive encryption key from machine ID using PBKDF2
      // 100,000 iterations provides strong key derivation
      const id = machineId.machineIdSync();
      const key = pbkdf2Sync(id, salt, 100000, 32, 'sha256');

      // Encrypt token
      const cipher = createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Store salt + IV + encrypted data
      const data = JSON.stringify({
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        encrypted,
      });

      writeFileSync(AUTH_FILE, data, { encoding: 'utf8' });

      // Set file permissions to 0600 (owner read/write only)
      chmodSync(AUTH_FILE, 0o600);
    } catch (error) {
      throw new Error(
        `Failed to store token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieve token from encrypted file.
   */
  private getEncrypted(): string | null {
    try {
      if (!existsSync(AUTH_FILE)) {
        return null;
      }

      // Read and parse encrypted data
      const fileContent = readFileSync(AUTH_FILE, 'utf8');
      const parsedData = JSON.parse(fileContent);

      // Validate structure with Zod schema
      const validationResult = EncryptedTokenSchema.safeParse(parsedData);
      if (!validationResult.success) {
        // Invalid file structure - could be corrupted or tampered with
        return null;
      }

      const { salt, iv, encrypted } = validationResult.data;

      // Derive decryption key from machine ID using PBKDF2
      const id = machineId.machineIdSync();
      const key = pbkdf2Sync(id, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');

      // Decrypt token
      const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // File doesn't exist, parsing failed, or decryption failed
      return null;
    }
  }

  /**
   * Delete encrypted file if it exists.
   */
  private deleteEncrypted(): void {
    try {
      if (existsSync(AUTH_FILE)) {
        unlinkSync(AUTH_FILE);
      }
    } catch (error) {
      // Ignore errors when deleting
    }
  }
}
