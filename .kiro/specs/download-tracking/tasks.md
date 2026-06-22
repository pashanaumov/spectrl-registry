# Implementation Plan: Download Tracking

## Overview

This plan implements download tracking for the Spectrl public registry. The feature tracks when users install specs from the public registry and increments download counters in DynamoDB. The implementation follows a fire-and-forget pattern where the CLI reports download events asynchronously without blocking installation.

## Tasks

- [x] 1. Add infrastructure configuration
  - [x] 1.1 Create Terraform configuration for track-download Lambda
    - Add Lambda function resource in `infra/modules/lambda/` or appropriate location
    - Configure IAM role with DynamoDB UpdateItem permissions on specs table
    - Set environment variables (TABLE_NAME, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
    - Configure CloudWatch log group
    - _Requirements: 5.1, 7.2_

  - [x] 1.2 Add API Gateway route for /track-download
    - Add POST route to API Gateway configuration in `infra/modules/api-gateway/`
    - Configure Lambda integration
    - Set up rate limiting (100 requests/minute per IP)
    - Configure timeout (29 seconds)
    - Add CORS configuration
    - _Requirements: 5.2, 8.3_

  - [x] 1.3 Test infrastructure deployment
    - Deploy to development environment using tflocal
    - Verify Lambda function is created
    - Verify API Gateway route is accessible
    - Test rate limiting configuration
    - Verify CloudWatch logs are being written
    - _Requirements: 5.1, 5.2, 8.3_

- [x] 2. Create backend Lambda function for download tracking
  - [x] 2.1 Set up Lambda function structure and schemas
    - Create `api/track-download/` directory
    - Create request schema in `api/track-download/schemas/request.ts` with Zod validation for username, specName, and version
    - Create response schema in `api/track-download/schemas/response.ts` for success and error responses
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 2.2 Implement main Lambda handler
    - Create `api/track-download/index.ts` with handler function
    - Extract and validate Authorization header (Bearer token)
    - Verify token with GitHub API using shared `../shared/github.ts`
    - Parse and validate request body using Zod schemas
    - _Requirements: 5.1, 5.2, 5.7_

  - [x] 2.3 Implement DynamoDB atomic increment logic
    - Create `api/track-download/helpers/dynamodb.ts`
    - Implement function to increment downloads field using UpdateItem with ADD operation
    - Handle case where spec version doesn't exist (return 404)
    - Use existing DynamoDB table structure (specId partition key, version sort key)
    - _Requirements: 3.3, 5.6, 6.1, 6.2, 6.3_

  - [x] 2.4 Add error handling and logging
    - Implement error response formatting
    - Add CloudWatch logging for failures
    - Return appropriate HTTP status codes (200, 404, 503)
    - Return descriptive error messages in response body
    - _Requirements: 5.5, 7.1, 7.4, 7.5_

  - [x] 2.5 Write unit tests for Lambda function
    - Test successful download tracking with valid token and parameters
    - Test authentication failure scenarios
    - Test validation errors for invalid parameters
    - Test DynamoDB error handling (spec not found, service unavailable)
    - Use MSW for mocking GitHub API calls
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 3. Integrate download tracking into CLI install command
  - [x] 3.1 Add download tracking helper to API client
    - Add `TrackDownloadRequestSchema` and `TrackDownloadResponseSchema` to `packages/cli/src/utils/api-client.ts`
    - Implement `trackDownload()` function with fire-and-forget pattern
    - Set 3-second timeout for tracking requests
    - Silent failure handling (log in debug mode only)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Integrate tracking into installFromPublic function
    - Add Set to track downloaded specs in current session (prevent duplicates)
    - Call `trackDownload()` after successful file download from CloudFront
    - Only track when files are actually fetched (not from cache)
    - Pass authentication token from user's stored credentials
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.4, 3.5_

  - [x] 3.3 Write unit tests for CLI integration
    - Test that tracking is called for public registry installs
    - Test that tracking is NOT called for local installs
    - Test that tracking is NOT called for cached specs
    - Test that duplicate tracking is prevented in same session
    - Test that installation succeeds even when tracking fails
    - Use MSW for mocking API calls
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 3.1, 3.4_

- [-] 4. Update DynamoDB schema and initialization
  - [x] 4.1 Add downloads field to publish-spec Lambda
    - Modify `api/publish-spec/helpers/dynamodb.ts` to initialize downloads field to 0
    - Ensure field is set when new spec versions are published
    - _Requirements: 6.2_

  - [x] 4.2 Update GetSpecResponse schema to include downloads
    - Modify `SpecVersionSchema` in `packages/cli/src/utils/api-client.ts` to include optional downloads field
    - Ensure get-spec Lambda returns downloads field in response
    - _Requirements: 4.1, 6.1_

  - [x] 4.3 Write migration script for existing specs
    - Create script to add downloads field (default 0) to existing DynamoDB items
    - Test script on development environment
    - Document migration process
    - _Requirements: 6.2, 6.5_

- [x] 5. Update CLI info command to display download counts
  - [x] 5.1 Modify info command to display downloads
    - Update `packages/cli/src/commands/info/index.ts` to show download count per version
    - Format download counts with thousand separators (e.g., "1,234 downloads")
    - Display "0 downloads" for specs with zero downloads
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Write unit tests for info command display
    - Test download count formatting with various numbers
    - Test display with zero downloads
    - Test display with missing downloads field (backwards compatibility)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Remove authentication requirement and verify rate limiting
  - [x] 6.1 Remove authentication from track-download Lambda
    - Remove Authorization header validation from Lambda handler
    - Remove GitHub token verification
    - Update Lambda to work without authentication
    - Update tests to remove authentication scenarios
    - _Requirements: 2.1, 2.2, 8.3_

  - [x] 6.2 Verify API Gateway rate limiting configuration
    - Confirm rate limiting is set to 100 requests/minute
    - Verify throttling applies per-IP address (not global)
    - Test rate limiting behavior in development environment
    - Document rate limiting configuration
    - _Requirements: 8.3_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Run all unit tests for Lambda function and CLI integration
  - Verify infrastructure can be deployed successfully
  - Test end-to-end flow in development environment
  - Ensure all tests pass, ask the user if questions arise

- [ ] 9. Final checkpoint - Integration testing
  - Test complete flow: install spec from public registry → download tracked → count visible in info command
  - Verify duplicate prevention works correctly
  - Verify installation succeeds when tracking fails
  - Verify rate limiting works as expected
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation follows existing patterns from other Lambda functions (publish-spec, get-spec)
- All API responses must be validated with Zod schemas (per api-validation.md guidelines)
- Use MSW for HTTP mocking in tests (never override global.fetch)
- Fire-and-forget pattern ensures installation never blocks on tracking
- Authentication is required but failures are handled gracefully
