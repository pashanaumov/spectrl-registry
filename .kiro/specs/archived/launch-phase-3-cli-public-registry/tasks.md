# Implementation Plan

- [x] 0. Enable GitHub Device Flow
  - Go to GitHub Settings → Developer settings → OAuth Apps
  - Select your Spectrl OAuth app
  - Enable "Device Flow" checkbox
  - Save changes
  - Test with curl to verify device flow is working
  - _Requirements: FR-2, AC-2_

- [x] 1. Implement auth-device-init Lambda
  - Create directory `api/auth-device-init/`
  - Create `api/auth-device-init/index.ts` with handler
  - Create `api/auth-device-init/schemas/` for Zod schemas
  - Reuse `api/shared/github.ts` and `api/auth-exchange/helpers/credentials.ts`
  - Call GitHub Device Flow API: POST https://github.com/login/device/code
  - Return device_code, user_code, verification_uri, expires_in, interval
  - Add error handling for GitHub API failures
  - _Requirements: FR-2, AC-2_

- [x] 1.1 Write unit tests for auth-device-init Lambda
  - Create `api/auth-device-init/index.test.ts`
  - Test successful device flow initiation
  - Test GitHub API error handling
  - Test Secrets Manager retrieval
  - Mock AWS SDK and GitHub API calls
  - _Requirements: FR-2, AC-2_

- [x] 2. Implement auth-device-poll Lambda
  - Create directory `api/auth-device-poll/`
  - Create `api/auth-device-poll/index.ts` with handler
  - Create `api/auth-device-poll/schemas/` for Zod schemas
  - Reuse existing helpers from auth-exchange
  - Accept device_code in request body
  - Call GitHub Device Flow API: POST https://github.com/login/oauth/access_token
  - Handle GitHub response codes (authorization_pending, expired_token, access_denied)
  - If authorized, fetch user info and store in DynamoDB
  - Return appropriate status codes (200, 202, 400)
  - _Requirements: FR-2, AC-2_

- [x] 2.1 Write unit tests for auth-device-poll Lambda
  - Create `api/auth-device-poll/index.test.ts`
  - Test authorization pending (202)
  - Test successful authorization (200)
  - Test expired device code (400)
  - Test denied authorization (400)
  - Test user storage in DynamoDB
  - Mock AWS SDK and GitHub API calls
  - _Requirements: FR-2, AC-2_

- [x] 3. Add Terraform infrastructure for device flow Lambdas
  - Update `infra/modules/lambda/main.tf`
  - Update `infra/modules/lambda/outputs.tf`
  - Update `infra/modules/api-gateway/main.tf`
  - Update `infra/modules/api-gateway/variables.tf`
  - Update `infra/environments/prod/main.tf`
  - _Requirements: FR-2, AC-2_

- [x] 3.1 Add auth-device-init Lambda to Terraform
  - Add IAM role: `aws_iam_role.auth_device_init`
  - Add IAM policy with Secrets Manager and CloudWatch permissions
  - Add archive file: `data.archive_file.auth_device_init`
  - Add Lambda function: `aws_lambda_function.auth_device_init`
  - Add CloudWatch log group: `aws_cloudwatch_log_group.auth_device_init`
  - Add outputs: function_name and invoke_arn
  - _Requirements: FR-2, AC-2_

- [x] 3.2 Add auth-device-poll Lambda to Terraform
  - Add IAM role: `aws_iam_role.auth_device_poll`
  - Add IAM policy with Secrets Manager, DynamoDB, and CloudWatch permissions
  - Add archive file: `data.archive_file.auth_device_poll`
  - Add Lambda function: `aws_lambda_function.auth_device_poll`
  - Add CloudWatch log group: `aws_cloudwatch_log_group.auth_device_poll`
  - Add outputs: function_name and invoke_arn
  - _Requirements: FR-2, AC-2_

- [x] 3.3 Add API Gateway routes for device flow
  - Add resource: `/auth/device`
  - Add resource: `/auth/device/init`
  - Add resource: `/auth/device/poll`
  - Add POST method and integration for /auth/device/init
  - Add POST method and integration for /auth/device/poll
  - Add CORS OPTIONS methods for both endpoints
  - Add Lambda permissions for API Gateway invocation
  - Update deployment triggers to include new integrations
  - _Requirements: FR-2, AC-2_

- [x] 3.4 Deploy and test infrastructure in LocalStack
  - Start LocalStack: `docker-compose up -d`
  - Run `pnpm build` in api/ directory to compile Lambdas
  - Deploy to LocalStack: `cd infra/environments/dev && tflocal apply`
  - Get API Gateway ID: `awslocal apigateway get-rest-apis`
  - Test POST /auth/device/init endpoint
  - Test POST /auth/device/poll endpoint
  - Update `infra/test-localstack.sh` to include device flow tests
  - Run full test suite: `./test-localstack.sh`
  - _Requirements: FR-2, AC-2_

- [x] 3.5 Deploy infrastructure to production
  - Verify LocalStack tests pass
  - Run `terraform plan` in infra/environments/prod/
  - Run `terraform apply` to deploy changes
  - Verify new endpoints are accessible
  - Test with curl or Postman
  - _Requirements: FR-2, AC-2_

- [x] 3.6 Integration test device flow end-to-end in production
  - Test POST /auth/device/init returns device code
  - Test POST /auth/device/poll with pending authorization (202)
  - Test complete device flow with real GitHub authorization
  - Verify token storage in DynamoDB
  - Test error cases (expired, denied)
  - Update `infra/test-prod.sh` to include device flow tests
  - Document test results
  - _Requirements: FR-2, AC-2_

- [x] 4. Set up token management infrastructure
  - Install keytar and node-machine-id dependencies
  - Create TokenManager class in `packages/cli/src/auth/token-manager.ts`
  - Implement secure token storage with OS keychain (keytar)
  - Implement encrypted file fallback for systems without keychain
  - Ensure tokens persist across CLI sessions
  - _Requirements: FR-1, NFR-1, AC-1_

- [x] 4.1 Write unit tests for TokenManager
  - Test token storage and retrieval
  - Test keychain fallback behavior
  - Test token persistence
  - _Requirements: FR-1, AC-1_

- [x] 5. Implement authentication commands
  - Create `packages/cli/src/commands/login.ts`
  - Create `packages/cli/src/commands/logout.ts`
  - Create `packages/cli/src/commands/whoami.ts`
  - Update CLI entry point to register new commands
  - _Requirements: FR-2, AC-2_

- [x] 5.1 Implement login command with GitHub Device Flow
  - Install dependencies: open, chalk
  - Call Lambda to initiate device flow
  - Display user code and verification URL with nice formatting
  - Open browser to GitHub verification page
  - Poll Lambda for authorization completion
  - Handle timeout and error cases
  - Store token using TokenManager on success
  - Display success message with username
  - _Requirements: FR-2, AC-2_

- [x] 5.2 Implement logout command
  - Delete stored token using TokenManager
  - Display confirmation message
  - _Requirements: FR-2, AC-2_

- [x] 5.3 Implement whoami command
  - Retrieve token from TokenManager
  - Verify token with GitHub API
  - Display username or "Not logged in" message
  - _Requirements: FR-2, AC-2_

- [x] 5.4 Write unit tests for authentication commands
  - Test login flow with mocked API
  - Test logout token deletion
  - Test whoami with valid and invalid tokens
  - _Requirements: FR-2, AC-2_

- [x] 6. Create API client utility
  - Create `packages/cli/src/utils/api-client.ts`
  - Implement initiateDeviceFlow function for POST /auth/device/init
  - Implement pollDeviceAuthorization function for POST /auth/device/poll
  - Implement publishSpec function for POST /publish
  - Implement searchSpecs function for GET /search
  - Implement getSpec function for GET /specs/{username}/{name}
  - Add error handling and retry logic
  - Support API URL configuration via environment variable
  - _Requirements: FR-3, FR-4, FR-5, NFR-2_

- [x] 6.1 Write unit tests for API client
  - Test each API function with mocked responses
  - Test error handling
  - Test retry logic
  - _Requirements: FR-3, FR-4, FR-5_

- [x] 7. Implement spec reference parser
  - Create `packages/cli/src/utils/spec-ref.ts`
  - Implement parseSpecRef function to handle all formats
  - Support local format: `my-spec` and `my-spec@1.0.0`
  - Support public format: `alice/my-spec` and `alice/my-spec@1.0.0`
  - Add validation and error handling
  - _Requirements: FR-4, NFR-3_

- [x] 7.1 Write unit tests for spec reference parser
  - Test all spec reference formats
  - Test validation logic
  - Test error cases
  - _Requirements: FR-4_

- [x] 8. Enhance publish command for public registry
  - Install inquirer dependency
  - Update `packages/cli/src/commands/publish.ts`
  - Add interactive prompt for local vs public destination
  - Implement public publish logic with authentication check
  - Auto-populate agent field if missing
  - Read and package all spec files
  - Call API to publish spec
  - Display success message with public URL
  - Maintain existing local publish functionality
  - _Requirements: FR-3, NFR-3, AC-3_

- [x] 8.1 Write unit tests for enhanced publish command
  - Test local publish path
  - Test public publish path
  - Test authentication requirement
  - Test agent field auto-population
  - _Requirements: FR-3, AC-3_

- [x] 9. Enhance install command for public registry
  - Update `packages/cli/src/commands/install.ts`
  - Use spec reference parser to detect public vs local specs
  - Implement installFromPublic function
  - Fetch spec metadata from API
  - Determine version (use latest if not specified)
  - Download manifest from CloudFront
  - Download all files from CloudFront
  - Save files to `.spectrl/specs/`
  - Update project index with public source
  - Maintain existing local install functionality
  - _Requirements: FR-4, NFR-3, AC-4_

- [x] 9.1 Write unit tests for enhanced install command
  - Test local install path
  - Test public install path
  - Test version resolution
  - Test file download and storage
  - _Requirements: FR-4, AC-4_

- [x] 10. Implement management commands
  - Create `packages/cli/src/commands/unpublish.ts`
  - Create `packages/cli/src/commands/update.ts`
  - Update CLI entry point to register new commands
  - _Requirements: FR-5, AC-5_

- [x] 10.1 Implement unpublish command
  - Install dependencies: chalk, inquirer (if not already installed)
  - Parse spec reference (require version)
  - Check authentication
  - Show destructive operation warning
  - Prompt for confirmation
  - Call DELETE /specs/{username}/{specName}/{version} endpoint
  - Display success or error message
  - _Requirements: FR-5, AC-5_

- [x] 10.2 Implement update command
  - Install dependencies: semver, cli-table3, chalk
  - Read project index to find public specs
  - For each public spec, fetch latest version from API
  - Compare versions using semver
  - Display table of available updates
  - Support updating single spec: `spectrl update <spec>`
  - Support updating all specs: `spectrl update --all`
  - Reuse install logic to update specs
  - _Requirements: FR-5, AC-5_

- [x] 10.3 Write unit tests for management commands
  - Test unpublish with authentication check
  - Test unpublish confirmation flow
  - Test update version comparison logic
  - Test update with no updates available
  - Test update --all flag
  - _Requirements: FR-5, AC-5_

- [x] 11. Implement discovery commands
  - Create `packages/cli/src/commands/search.ts`
  - Create `packages/cli/src/commands/info.ts`
  - Update `packages/cli/src/commands/list.ts`
  - Update CLI entry point to register new commands
  - _Requirements: FR-5, AC-5_

- [x] 11.1 Implement search command
  - Install dependencies: cli-table3, chalk
  - Call API with search query
  - Format results in beautiful table with cli-table3
  - Display spec ID, description, tags, and version
  - Use chalk for colors and styling
  - Handle empty results gracefully with helpful message
  - Add error handling
  - _Requirements: FR-5, AC-5_

- [x] 11.2 Implement info command
  - Install dependencies: cli-table3, chalk, date-fns
  - Parse spec reference
  - Fetch metadata from API
  - Display spec header with name, description, tags
  - Format versions in table with relative dates ("2 days ago")
  - Show install instructions
  - Handle non-existent specs with helpful error
  - Add error handling
  - _Requirements: FR-5, AC-5_

- [x] 11.3 Enhance list command
  - Install dependencies: cli-table3, chalk (if not already installed)
  - Read project index
  - Detect source (local vs public) from index
  - Format output in table with spec name, version, source
  - Use color coding: blue for public, green for local
  - Display count of installed specs
  - Handle empty state with helpful message
  - _Requirements: FR-5, AC-5_

- [x] 11.4 Write unit tests for discovery commands
  - Test search with various queries
  - Test info with valid and invalid specs
  - Test list with mixed local and public specs
  - _Requirements: FR-5, AC-5_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration testing
  - Test complete login flow end-to-end
  - Test publish to public registry
  - Test install from public registry
  - Test search functionality
  - Test info command
  - Test logout flow
  - Test on macOS (and Linux/Windows if available)
  - Document test results
  - _Requirements: AC-2, AC-3, AC-4, AC-5_

- [x] 14. Update CLI documentation
  - Update `packages/cli/README.md`
  - Document all new commands (login, logout, whoami, search, info, unpublish, update)
  - Add examples for public registry usage
  - Update troubleshooting section
  - Add FAQ for common issues
  - _Requirements: All_

- [x] 14.1 Create recipes documentation
  - Create `packages/cli/docs/RECIPES.md`
  - Add recipe: "Publishing your first spec"
  - Add recipe: "Finding and installing specs"
  - Add recipe: "Keeping specs up to date"
  - Add recipe: "Managing published specs"
  - Add recipe: "Working with local and public specs"
  - Add recipe: "Troubleshooting common issues"
  - Include code examples and expected output for each recipe
  - _Requirements: All_

- [x] 15. Manual end-to-end testing
  - Test all Phase 3 features as a real user
  - Provide UX feedback and identify bugs
  - Document findings and recommendations
  - _Requirements: AC-2, AC-3, AC-4, AC-5_

- [x] 15.1 Authentication flow testing
  - Test `spectrl login` with GitHub Device Flow
    - Verify user code is displayed clearly
    - Verify browser opens to GitHub verification page
    - Verify token is stored after authorization
    - Test with authorization denied
    - Test with expired device code
  - Test `spectrl logout` removes token
  - Test `spectrl whoami` shows username when logged in
  - Test `spectrl whoami` shows "Not logged in" when not authenticated
  - Document UX observations about the login flow
  - _Requirements: FR-2, AC-2_

- [x] 15.2 Publishing to public registry testing
  - Create a test spec with multiple files
  - Test `spectrl publish` with local destination
  - Test `spectrl publish` with public destination (requires login)
  - Verify spec appears on public registry
  - Test publishing with missing agent field (should auto-populate)
  - Test error handling when not logged in
  - Document UX observations about publish flow
  - _Requirements: FR-3, AC-3_

- [x] 15.3 Installing from public registry testing
  - Test `spectrl install username/spec` (latest version)
  - Test `spectrl install username/spec@version` (specific version)
  - Verify files are downloaded and saved correctly
  - Verify project index is updated
  - Test installing non-existent spec
  - Test installing with version not found
  - Test collision detection (local vs public spec with same name)
  - Document UX observations about install flow
  - _Requirements: FR-4, AC-4_

- [x] 15.4 Discovery commands testing
  - Test `spectrl search <query>` with various search terms
  - Verify search results are formatted nicely
  - Test `spectrl info username/spec` shows all versions
  - Verify version table displays correctly
  - Test `spectrl list` shows both local and public specs
  - Verify color coding (blue for public, green for local)
  - Test empty states (no specs, no search results)
  - Document UX observations about discovery commands
  - _Requirements: FR-5, AC-5_

- [x] 15.5 Management commands testing
  - Test `spectrl unpublish username/spec@version`
    - Verify destructive operation warning is clear
    - Verify confirmation prompt works
    - Verify spec is removed from registry
    - Test canceling unpublish
  - Test `spectrl update` shows available updates
  - Test `spectrl update username/spec` updates single spec
  - Test `spectrl update --all` updates all specs
  - Verify version comparison is correct
  - Document UX observations about management commands
  - _Requirements: FR-5, AC-5_

- [x] 15.6 Error handling and edge cases
  - Test network errors (simulate offline)
  - Test invalid spec references
  - Test authentication errors (expired token, invalid token)
  - Test API errors (500, 503)
  - Test file system errors (permission denied, disk full)
  - Test with very large specs
  - Test with special characters in spec names
  - Document any bugs or unexpected behavior
  - _Requirements: All_

- [x] 15.7 Cross-platform testing (if available)
  - Test on macOS (primary)
  - Test on Linux (if available)
  - Test on Windows (if available)
  - Verify keychain/credential storage works on each platform
  - Verify symlink creation works (or fallback to copy)
  - Document platform-specific issues
  - _Requirements: All_

- [x] 15.8 Compile UX feedback and bug report
  - Summarize UX observations and recommendations
  - List any bugs discovered with reproduction steps
  - Prioritize issues by severity
  - Suggest improvements for future iterations
  - Document what worked well
  - _Requirements: All_

- [ ] 16. Automated end-to-end CLI tests
  - Create automated e2e tests for all Phase 3 CLI commands
  - Test `spectrl login` flow (mock GitHub OAuth)
  - Test `spectrl logout` and `spectrl whoami`
  - Test `spectrl publish` to public registry
  - Test `spectrl install username/spec` from public registry
  - Test `spectrl search` and `spectrl info`
  - Test `spectrl unpublish` and `spectrl update`
  - Test `spectrl list` with mixed local/public specs
  - Use existing e2e test framework in `tests/e2e/`
  - Mock API responses for consistent testing
  - _Requirements: AC-2, AC-3, AC-4, AC-5_
