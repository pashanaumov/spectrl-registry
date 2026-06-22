# Task 6: Create API Client Utility

## What Was Implemented

Created a centralized API client utility (`packages/cli/src/utils/api-client.ts`) that provides typed functions for all Spectrl public registry API endpoints. The implementation includes comprehensive error handling, automatic retry logic with exponential backoff, and Zod-based request/response validation.

### Subtasks Completed

- **6.1**: Comprehensive unit tests with 23 test cases covering all API functions, error scenarios, and retry logic

## Implementation Details

### Core API Functions

1. **initiateDeviceFlow()** - POST /auth/device/init
   - Initiates GitHub Device Flow authentication
   - Returns device code, user code, verification URI, and polling parameters
   - Used by the login command

2. **pollDeviceAuthorization(deviceCode)** - POST /auth/device/poll
   - Polls for device authorization completion
   - Returns different status codes: 200 (success), 202 (pending), 400 (error)
   - Does not retry (meant to be called repeatedly by caller)

3. **publishSpec(token, manifest, files)** - POST /publish
   - Publishes a spec to the public registry
   - Requires authentication token
   - Validates request data before sending
   - Returns publish confirmation with URL

4. **searchSpecs(query)** - GET /search
   - Searches for specs in the public registry
   - Properly encodes query parameters
   - Returns array of search results with metadata

5. **getSpec(username, name)** - GET /specs/{username}/{name}
   - Fetches spec metadata including all versions
   - Returns version history with S3 paths and hashes
   - Used by info and install commands

### Key Features

**Zod Schema Validation**

- All API responses are validated using Zod schemas
- Type-safe responses with TypeScript inference
- Clear error messages when API returns unexpected data
- Schemas exported for reuse in other modules

**Retry Logic with Exponential Backoff**

- Automatic retry on network failures (up to 3 attempts)
- Exponential backoff: 1s → 2s → 4s (max 10s)
- Does not retry on client errors (4xx status codes)
- Configurable retry parameters

**Error Handling**

- Custom `ApiError` class with status code and response data
- Structured error messages for debugging
- Proper error propagation to calling code

**Environment Configuration**

- Supports `API_URL` environment variable
- Defaults to production API Gateway URL
- Easy to override for LocalStack testing

## Why These Decisions

### Centralized API Client Pattern

The decision to create a centralized API client utility follows industry best practices and provides several benefits:

1. **Single Source of Truth**: All API endpoints are defined in one place, making it easy to update URLs or add new endpoints
2. **Consistent Error Handling**: All API calls use the same error handling and retry logic
3. **Type Safety**: Zod schemas ensure runtime validation matches TypeScript types
4. **Testability**: Easy to mock the entire API client in tests
5. **Maintainability**: Changes to API contracts only require updates in one file

This pattern is used by major projects like Next.js, Vercel CLI, and AWS SDK.

### Retry Logic Design

The exponential backoff retry strategy was chosen because:

1. **Network Resilience**: Handles transient network failures gracefully
2. **Server Protection**: Exponential backoff prevents overwhelming the server
3. **Smart Retry**: Only retries on 5xx errors and network failures, not client errors
4. **Industry Standard**: Used by AWS SDK, Google Cloud SDK, and other major APIs

The specific parameters (3 attempts, 1s initial delay, 2x multiplier) balance user experience with server protection.

### Zod for Validation

Zod was selected for runtime validation because:

1. **Already in Use**: The project already uses Zod extensively (see `token-manager.ts`, `login.ts`)
2. **Type Inference**: Automatically generates TypeScript types from schemas
3. **Runtime Safety**: Catches API contract violations at runtime
4. **Developer Experience**: Clear error messages help debug API issues
5. **Zero Dependencies**: Zod is already a project dependency

This ensures that if the API returns unexpected data, we catch it immediately with a clear error message rather than failing mysteriously later.

### No Retry for pollDeviceAuthorization

The `pollDeviceAuthorization` function intentionally does not use retry logic because:

1. **Polling Pattern**: The function is meant to be called repeatedly by the caller
2. **Status Codes Matter**: 202 (pending) is not an error, it's expected behavior
3. **Caller Control**: The login command controls the polling interval and timeout
4. **Immediate Feedback**: User should see authorization status immediately

This design gives the calling code full control over the polling behavior.

## Requirements Addressed

- **FR-3**: Publishing to Public Registry - `publishSpec()` function ready for publish command
- **FR-4**: Installing from Public Registry - `getSpec()` function ready for install command
- **FR-5**: Discovery and Management - `searchSpecs()` and `getSpec()` functions ready for search/info commands
- **NFR-2**: User Experience - Retry logic ensures fast, reliable operations

## Code Changes

### New Files Created

- `packages/cli/src/utils/api-client.ts` - Main API client implementation (450+ lines)
- `packages/cli/src/utils/api-client.test.ts` - Comprehensive unit tests (470+ lines)

### Key Exports

```typescript
// API Functions
export async function initiateDeviceFlow(): Promise<DeviceFlowInitResponse>
export async function pollDeviceAuthorization(deviceCode: string): Promise<{...}>
export async function publishSpec(token: string, manifest: Record<string, unknown>, files: Array<{...}>): Promise<PublishSpecResponse>
export async function searchSpecs(query: string): Promise<SearchSpecsResponse>
export async function getSpec(username: string, name: string): Promise<GetSpecResponse>

// Error Class
export class ApiError extends Error

// Zod Schemas (for reuse)
export const DeviceFlowInitResponseSchema
export const DeviceFlowPollSuccessSchema
export const PublishSpecResponseSchema
export const SearchSpecsResponseSchema
export const GetSpecResponseSchema
```

## Testing

### Test Coverage

Created 23 comprehensive unit tests covering:

1. **Success Cases**: All API functions with valid responses
2. **Error Handling**: HTTP errors, invalid responses, network failures
3. **Retry Logic**: Exponential backoff, retry exhaustion, no retry on 4xx
4. **Edge Cases**: Empty results, special characters in queries, multiple status codes
5. **Validation**: Zod schema validation for all responses

### Test Results

```
✓ API Client (23 tests)
  ✓ initiateDeviceFlow (5 tests)
  ✓ pollDeviceAuthorization (4 tests)
  ✓ publishSpec (4 tests)
  ✓ searchSpecs (4 tests)
  ✓ getSpec (4 tests)
  ✓ Error handling (2 tests)

All tests passed in 14.15s
```

### Testing Approach

- Used Vitest with mocked `fetch` API
- Tested both success and failure paths
- Verified retry behavior with multiple mock responses
- Validated Zod schema enforcement
- Ensured proper error propagation

## Challenges & Considerations

### Zod v4 Compatibility

Initially encountered an issue with `z.record(z.unknown())` in Zod v4. The schema needed to be updated to `z.record(z.string(), z.unknown())` to specify the key type explicitly. This is a breaking change in Zod v4 that requires explicit key types for record schemas.

### Test Mock Behavior

Had to adjust test mocks to use `mockResolvedValue()` instead of `mockResolvedValueOnce()` for tests that call the function multiple times (e.g., in `expect().rejects.toThrow()` assertions). This ensures the mock is available for all invocations.

### Retry Timing in Tests

The retry logic uses real timeouts, which makes tests slower (3+ seconds per retry test). This is acceptable for unit tests but could be optimized in the future by:

- Using fake timers in tests
- Making retry delays configurable
- Reducing retry delays in test environment

However, the current approach ensures we're testing the actual retry behavior that will run in production.

## Next Steps

The API client is now ready to be used by:

1. **Task 7**: Spec reference parser (will use `getSpec()`)
2. **Task 8**: Enhanced publish command (will use `publishSpec()`)
3. **Task 9**: Enhanced install command (will use `getSpec()`)
4. **Task 10**: Management commands (will use `getSpec()`)
5. **Task 11**: Discovery commands (will use `searchSpecs()` and `getSpec()`)

The existing `login.ts` command could optionally be refactored to use the new `initiateDeviceFlow()` and `pollDeviceAuthorization()` functions, but this is not required since the current implementation works correctly.

## Post-Implementation Update: Environment Variable Requirement

After initial implementation, the hardcoded API URL fallback was removed based on user feedback. The API_URL environment variable is now **required** and the code will throw a clear error if it's not set.

### Changes Made

1. **Removed hardcoded fallback**: No default URL is provided
2. **Lazy validation**: API URL is validated when functions are called, not at module import time
3. **Clear error messages**: Provides instructions on how to get and set the API_URL
4. **DRY refactoring**: Exported `getApiUrl()` from `api-client.ts` and imported in `login.ts` to avoid duplication

### How to Set API_URL

Users must set the API_URL environment variable before using the CLI:

```bash
# Get the API endpoint from Terraform
cd infra/environments/prod
terraform output -raw api_endpoint

# Export it
export API_URL=https://xxx.execute-api.region.amazonaws.com/prod

# Or add to your shell profile
echo 'export API_URL=https://xxx.execute-api.region.amazonaws.com/prod' >> ~/.zshrc
```

For LocalStack testing:

```bash
export API_URL=http://localhost:4566/restapis/{api_id}/dev/_user_request_
```

### Rationale

- **No hardcoded values**: Prevents accidentally using wrong environment
- **Explicit configuration**: Users must consciously configure their environment
- **Better error messages**: Clear instructions when misconfigured
- **Terraform integration**: API URL comes from infrastructure output

## Validation

- ✅ All 24 unit tests passing (added test for missing API_URL)
- ✅ Comprehensive error handling tested
- ✅ Retry logic validated with multiple scenarios
- ✅ Zod schemas validate all API responses
- ✅ TypeScript types properly inferred from schemas
- ✅ Code follows existing project patterns and style
- ✅ No new dependencies added (uses existing Zod)
- ✅ API_URL validation works correctly
