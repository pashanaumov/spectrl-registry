# API Testing

Smoke tests for all Lambda functions covering happy paths and common failure scenarios.

## Running Tests

```bash
cd api
pnpm test          # Run all tests
pnpm test:watch    # Run in watch mode
```

## Test Coverage

### auth-exchange Lambda (3 tests)

- ✅ Happy path: Exchange OAuth code for token
- ❌ Sad path: Missing code
- ❌ Sad path: GitHub API failure

### publish-spec Lambda (3 tests)

- ✅ Happy path: Publish spec successfully
- ❌ Sad path: Missing authorization
- ❌ Sad path: Invalid manifest

### search-specs Lambda (2 tests)

- ✅ Happy path: Return search results
- ✅ Sad path: Empty results

### get-spec Lambda (2 tests)

- ✅ Happy path: Return spec versions
- ❌ Sad path: Non-existent spec (404)

### unpublish-spec Lambda (3 tests)

- ✅ Happy path: Unpublish spec successfully
- ❌ Sad path: Missing authorization
- ❌ Sad path: Ownership violation

## Test Strategy

These are **smoke tests** - they verify core functionality works without exhaustive edge case coverage:

- **Mocked AWS SDK**: Uses `aws-sdk-client-mock` for DynamoDB, S3, Secrets Manager
- **Mocked GitHub API**: Uses `vi.fn()` to mock fetch calls
- **Fast**: All tests run in <1 second
- **No infrastructure needed**: Tests run without LocalStack or AWS

## What's NOT Tested

- Helper function edge cases (file validation, path sanitization, etc.)
- AWS-specific errors (throttling, eventual consistency)
- IAM permission issues
- Network failures
- Complex error scenarios

For comprehensive testing, use the E2E test scripts:

- `infra/test-localstack.sh` - Tests against LocalStack
- `infra/test-prod.sh` - Tests against production AWS
