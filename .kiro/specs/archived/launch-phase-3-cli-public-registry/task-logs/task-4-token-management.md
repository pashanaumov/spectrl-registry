# Task 4: Set up Token Management Infrastructure

## What Was Implemented

Created a secure token management system for storing GitHub access tokens with OS keychain integration and encrypted file fallback.

### Subtasks Completed

- 4. Set up token management infrastructure
  - Installed keytar and node-machine-id dependencies
  - Created TokenManager class in `packages/cli/src/auth/token-manager.ts`
  - Implemented secure token storage with OS keychain (keytar)
  - Implemented encrypted file fallback for systems without keychain
  - Ensured tokens persist across CLI sessions

- 4.1 Write unit tests for TokenManager
  - Created comprehensive test suite with 14 test cases
  - Tested token storage and retrieval
  - Tested keychain fallback behavior
  - Tested token persistence across instances
  - All tests passing

## Why These Decisions

### Keytar for OS Keychain Integration

Keytar was chosen because it provides native access to platform-specific secure credential storage:

- **macOS**: Keychain
- **Linux**: Secret Service API/libsecret
- **Windows**: Credential Vault

This ensures tokens are stored using the most secure mechanism available on each platform, following OS-level security best practices. The native integration means tokens are protected by the same security mechanisms that protect system passwords and other sensitive credentials.

### Encrypted File Fallback

The encrypted file fallback was implemented for edge cases where:

- The system doesn't have the native keychain service installed/configured
- Running in containerized or restricted environments
- Keytar installation fails due to native module compilation issues

The fallback uses AES-256-CBC encryption with a cryptographically strong key derived using PBKDF2:

- **Key Derivation**: PBKDF2 with 100,000 iterations and SHA-256
- **Salt**: Random 32-byte salt generated per encryption
- **IV**: Random 16-byte initialization vector per encryption
- **Base Material**: Machine ID (ensures tokens are machine-specific)

This provides strong cryptographic security while ensuring the CLI remains functional even when keychain access is unavailable. The machine ID ensures the encrypted file is tied to the specific machine, preventing simple file copying attacks. PBKDF2 with 100,000 iterations makes brute-force attacks computationally infeasible.

### File Permissions and Security

The encrypted file is stored at `~/.spectrl/.auth` with permissions set to 0600 (owner read/write only). This follows Unix security best practices and prevents other users on the system from accessing the token file.

### Try-Catch Pattern for Graceful Fallback

The implementation uses try-catch blocks to gracefully fall back from keychain to file storage. This ensures the CLI remains functional regardless of the environment, while always preferring the most secure option available. The pattern is:

1. Try keychain first (most secure)
2. If keychain fails, fall back to encrypted file
3. Never throw errors that would break the user experience

### Token Persistence Design

Tokens persist across CLI sessions by design. This matches user expectations from other CLI tools (GitHub CLI, AWS CLI, etc.) where authentication is a one-time setup rather than per-session. The TokenManager class is stateless, allowing multiple instances to access the same stored token, which is important for the CLI's command-based architecture.

## Requirements Addressed

- **FR-1**: Token Management - Securely store GitHub access tokens on user's machine
- **NFR-1**: Security - Tokens stored securely (OS keychain or encrypted)
- **AC-1**: Token Management acceptance criteria
  - Keytar installed and working ✓
  - Can store token in OS keychain ✓
  - Can retrieve token from keychain ✓
  - Fallback to encrypted file works ✓
  - Token persists across sessions ✓

## Code Changes

### New Files Created

1. **`packages/cli/src/auth/token-manager.ts`** - TokenManager class implementation
   - `store(token: string)`: Store token with keychain fallback
   - `get()`: Retrieve token with keychain fallback
   - `delete()`: Remove token from both storage mechanisms
   - Private methods for encrypted file operations

2. **`packages/cli/src/auth/token-manager.test.ts`** - Comprehensive test suite
   - 14 test cases covering all functionality
   - Mocked keytar to test both success and failure paths
   - Tests for token persistence, special characters, and long tokens
   - Tests for keychain fallback behavior

### Dependencies Added

- `keytar@^7.9.0` - OS keychain access
- `node-machine-id@^1.1.12` - Machine-specific encryption key

### Package.json Updates

Updated `packages/cli/package.json` to include new dependencies.

## Challenges & Considerations

### Native Module Compilation

Keytar is a native Node.js module that requires compilation during installation. This worked successfully on macOS, but may require additional setup on some systems (build tools, Python, etc.). The encrypted file fallback ensures the CLI remains functional even if keytar installation fails.

### Cross-Platform Compatibility

The implementation was designed to work across macOS, Linux, and Windows. The use of Node.js built-in modules (`node:crypto`, `node:fs`, `node:os`, `node:path`) ensures consistent behavior across platforms. File path handling uses `path.join()` to ensure correct path separators on all platforms.

### Security Trade-offs

The encrypted file fallback is less secure than OS keychain storage, but provides a reasonable balance between security and functionality. The use of machine ID as the encryption key means:

- Tokens are tied to the specific machine
- Simple file copying won't work on other machines
- However, an attacker with access to the machine could potentially decrypt the token

This trade-off was deemed acceptable because:

1. The keychain is always preferred when available
2. The fallback is only used when keychain is unavailable
3. The alternative (no fallback) would make the CLI unusable in some environments

### Testing Strategy

The test suite uses mocked keytar to test both success and failure paths without requiring actual keychain access during tests. This ensures tests are:

- Fast (no actual keychain operations)
- Reliable (no dependency on system keychain state)
- Comprehensive (can test both keychain and fallback paths)

The tests verify:

- Basic storage and retrieval
- Keychain fallback behavior
- Token persistence across instances
- Special characters and long tokens
- Proper cleanup on delete

## Next Steps

The TokenManager is now ready to be integrated into the authentication commands:

- Task 5.1: Login command will use `store()` to save tokens
- Task 5.2: Logout command will use `delete()` to remove tokens
- Task 5.3: Whoami command will use `get()` to retrieve tokens
- Task 8: Publish command will use `get()` to authenticate API requests

## Security Improvements

### 1. PBKDF2 Key Derivation (Post-Implementation)

After initial implementation, the encryption key derivation was improved based on security review:

**Original approach**: Direct use of machine ID as encryption key

- Machine IDs are typically 32-character hex strings
- Converting to UTF-8 and padding provided only ~128 bits of entropy
- Vulnerable to brute-force attacks

**Improved approach**: PBKDF2 key derivation

- Uses PBKDF2 with 100,000 iterations and SHA-256
- Random 32-byte salt per encryption
- Computationally expensive to brute-force (100,000 iterations per attempt)
- Industry-standard key derivation function

This change maintains backward compatibility concerns (new encryptions use the improved method) while significantly strengthening the cryptographic security of the fallback storage mechanism. The performance impact is acceptable (tests run ~100ms slower) because:

1. Token storage/retrieval is infrequent (once per login/logout)
2. The computational cost is intentional security feature
3. Keychain is still preferred when available (no PBKDF2 overhead)

### 2. Zod Schema Validation (Post-Implementation)

After PBKDF2 implementation, input validation was added based on security review:

**Security Risk**: Parsing JSON from user-writable files without validation could allow:

- File structure tampering
- Injection of unexpected data types
- Malformed data causing crashes

**Solution**: Zod schema validation

- Validates file structure before use
- Ensures correct field types (all strings)
- Validates hex string lengths (salt: 64 chars, iv: 32 chars)
- Returns null for any invalid structure (graceful failure)

**Schema Definition**:

```typescript
const EncryptedTokenSchema = z.object({
  salt: z.string().length(64), // 32 bytes as hex
  iv: z.string().length(32), // 16 bytes as hex
  encrypted: z.string().min(1), // Variable length
});
```

**Test Coverage**: Added 5 new tests validating:

- Corrupted file with invalid structure
- Missing required fields
- Invalid field types
- Invalid hex lengths
- Malformed JSON

This ensures the TokenManager is resilient against file tampering and corruption, returning null gracefully rather than crashing or exposing security vulnerabilities.
