# Task 2: Implement Hasher Module for Deterministic Content Hashing

## What Was Implemented

Successfully implemented a complete hasher module for deterministic content hashing with comprehensive test coverage.

### Subtasks Completed

- **2.1**: Created Hasher class with computeHash static method
- **2.2**: Wrote comprehensive unit tests for hasher functionality

## Why These Decisions

**Node.js Crypto Module for npm Distribution**: Used Node.js `crypto` module for SHA-256 hashing to ensure the package can be distributed via npm and run in standard Node.js environments. This is essential since the compiled JavaScript needs to work in any Node.js runtime, not just Bun. The requirements specify SHA-256 hashing (Requirements 3.2), which is available in Node.js crypto.

**Static Class Design**: Followed the existing pattern in the codebase and the design document specification. The Hasher class contains only static methods as it's a utility class with no instance state, making it simple to use and test.

**Deterministic Processing Order**: Implemented lexicographic sorting of file paths and canonical JSON representation to ensure identical inputs always produce identical outputs, which is critical for Requirements 8.2-8.5 (deterministic behavior).

**Content Normalization**: Implemented line ending normalization (`\r\n` and `\r` → `\n`) to ensure cross-platform determinism, addressing the requirement that "THE CLI SHALL normalize line endings to `\n` before hashing" (Requirement 3.4).

**Hash Field Exclusion**: The canonicalization process excludes the existing `hash` field from the manifest to prevent circular dependencies. This is critical because:

1. When publishing, we compute a hash from the manifest + files
2. We then store that hash _in_ the manifest itself (as the `hash` field)
3. When verifying or recomputing the hash later, we need to exclude the stored hash field
4. Otherwise, we'd be hashing a manifest that contains its own hash, producing a different result

Example: A manifest `{ name: "spec", version: "1.0.0" }` produces hash `abc123`. We store it as `{ name: "spec", version: "1.0.0", hash: "abc123" }`. When recomputing, we exclude the hash field to get the same `abc123` result. This allows us to verify manifest integrity by comparing the recomputed hash with the stored hash value.

## Requirements Addressed

- **Requirement 3.2**: Compute content hash using SHA-256 algorithm via Node.js crypto module
- **Requirement 3.3**: Sort file paths lexicographically before hashing
- **Requirement 3.4**: Normalize file content to use `\n` newlines before hashing
- **Requirement 3.5**: Canonicalize manifest JSON with sorted keys and no whitespace
- **Requirement 8.2**: Produce identical content hashes given identical inputs
- **Requirement 8.3**: Sort all file operations lexicographically
- **Requirement 8.4**: Normalize line endings to `\n` before hashing
- **Requirement 8.5**: Canonicalize JSON with sorted keys before hashing

## Code Changes

### Core Implementation (`packages/core/src/hasher.ts`)

- **HasherOptions interface**: Defines input structure with manifest and file contents map
- **computeHash method**: Main hashing logic with deterministic processing using Node.js crypto
- **normalizeContent method**: Cross-platform line ending normalization
- **canonicalizeManifest method**: JSON canonicalization with sorted keys

### Comprehensive Test Suite (`packages/core/src/hasher.test.ts`)

- **Deterministic output testing**: Verifies identical inputs produce identical hashes
- **Line ending normalization**: Tests Windows, Mac, and Unix line endings produce same hash
- **Manifest canonicalization**: Verifies different key orders produce identical hashes
- **File path sorting**: Ensures lexicographic processing regardless of input order
- **Hash field exclusion**: Confirms existing hash fields don't affect new hash computation
- **Content variation testing**: Verifies different content produces different hashes
- **Edge case handling**: Tests empty file contents and complex dependency structures

## Challenges & Considerations

**npm Distribution Compatibility**: Used Node.js crypto module instead of Bun-specific APIs to ensure the compiled package can be distributed via npm and run in any Node.js environment. This is critical for library distribution since consumers may not be using Bun. Tests run with Vitest (Node.js-based) to match the target runtime environment.

**Determinism Requirements**: Carefully implemented sorting and normalization to ensure the same logical content always produces the same hash, regardless of:

- File path order in the input map
- Manifest key order in the JSON
- Line ending formats across operating systems
- Presence of existing hash fields

**Test Coverage**: Created comprehensive tests covering all the deterministic behavior requirements, including edge cases like empty file maps and complex dependency structures.

The implementation successfully provides the deterministic content hashing foundation required for the spec registry's reproducibility guarantees.
