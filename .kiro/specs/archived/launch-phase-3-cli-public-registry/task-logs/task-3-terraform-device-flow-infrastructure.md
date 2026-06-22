# Task 3: Add Terraform Infrastructure for Device Flow Lambdas

## What Was Implemented

Successfully added complete Terraform infrastructure for the two new GitHub Device Flow authentication Lambdas:

### Subtask 3.1: auth-device-init Lambda

- Created IAM role `aws_iam_role.auth_device_init` with Lambda execution permissions
- Created IAM policy with:
  - CloudWatch Logs permissions (CreateLogGroup, CreateLogStream, PutLogEvents)
  - Secrets Manager GetSecretValue permission for GitHub OAuth credentials
- Added archive file data source to package the Lambda code
- Created Lambda function resource with:
  - Runtime: nodejs20.x
  - Timeout: 30 seconds
  - Memory: 256 MB
  - Environment variable: SECRETS_ARN
- Created CloudWatch log group with 7-day retention
- Added outputs: function_name, function_arn, invoke_arn

### Subtask 3.2: auth-device-poll Lambda

- Created IAM role `aws_iam_role.auth_device_poll` with Lambda execution permissions
- Created IAM policy with:
  - CloudWatch Logs permissions (CreateLogGroup, CreateLogStream, PutLogEvents)
  - Secrets Manager GetSecretValue permission for GitHub OAuth credentials
  - DynamoDB PutItem permission for storing user data
- Added archive file data source to package the Lambda code
- Created Lambda function resource with:
  - Runtime: nodejs20.x
  - Timeout: 30 seconds
  - Memory: 256 MB
  - Environment variables: SECRETS_ARN, USERS_TABLE
- Created CloudWatch log group with 7-day retention
- Added outputs: function_name, function_arn, invoke_arn

### Subtask 3.3: API Gateway Routes

- Added `/auth/device` parent resource under `/auth`
- Added `/auth/device/init` resource with:
  - POST method integration to auth-device-init Lambda
  - OPTIONS method for CORS preflight
  - Lambda permission for API Gateway invocation
  - CORS headers: Content-Type, Authorization
- Added `/auth/device/poll` resource with:
  - POST method integration to auth-device-poll Lambda
  - OPTIONS method for CORS preflight
  - Lambda permission for API Gateway invocation
  - CORS headers: Content-Type, Authorization
- Updated API Gateway deployment triggers to include new integrations
- Updated `infra/modules/api-gateway/variables.tf` with new Lambda variables
- Updated `infra/environments/prod/main.tf` to pass new Lambda outputs to API Gateway module

## Why These Decisions

### IAM Permissions Design

The IAM policies follow the principle of least privilege. The auth-device-init Lambda only needs Secrets Manager access to retrieve GitHub OAuth credentials, while auth-device-poll needs additional DynamoDB access to store user information after successful authentication. Both need CloudWatch Logs for observability.

### Lambda Configuration

The 30-second timeout and 256 MB memory allocation match the existing auth-exchange Lambda configuration, which is appropriate for these lightweight API operations that primarily make external HTTP calls to GitHub's API.

### API Gateway Structure

The `/auth/device` parent resource provides a logical grouping for device flow endpoints, keeping them organized under the existing `/auth` namespace. This maintains consistency with the existing `/auth/exchange` endpoint structure.

### CORS Configuration

CORS is enabled on both endpoints to allow browser-based CLI tools or web applications to call these endpoints. The configuration allows POST methods and standard headers (Content-Type, Authorization), matching the pattern used for other endpoints.

### Deployment Triggers

Adding the new integrations to the deployment triggers ensures that any changes to the device flow endpoints will trigger a redeployment of the API Gateway, keeping the infrastructure in sync.

## Requirements Addressed

- **FR-2**: Authentication Commands - Infrastructure foundation for GitHub Device Flow authentication
- **AC-2**: Authentication Commands acceptance criteria - Backend endpoints for login flow

## Code Changes

### Lambda Module

- `infra/modules/lambda/main.tf` - Added auth-device-init and auth-device-poll Lambda resources
- `infra/modules/lambda/outputs.tf` - Added outputs for both new Lambdas

### API Gateway Module

- `infra/modules/api-gateway/main.tf` - Added device flow routes, methods, integrations, and CORS
- `infra/modules/api-gateway/variables.tf` - Added variables for new Lambda functions

### Production Environment

- `infra/environments/prod/main.tf` - Connected new Lambda outputs to API Gateway module

## Challenges & Considerations

### Consistent Patterns

Followed the exact same patterns used for existing Lambdas (auth-exchange, publish-spec, etc.) to maintain consistency across the infrastructure. This makes the codebase easier to understand and maintain.

### Resource Ordering

Placed the new device flow Lambdas at the beginning of the Lambda module file, before auth-exchange, to group authentication-related Lambdas together logically.

### Environment Variables

Each Lambda receives only the environment variables it needs - auth-device-init gets SECRETS_ARN, while auth-device-poll gets both SECRETS_ARN and USERS_TABLE.

## Test Script Updates

Added comprehensive device flow tests to both LocalStack and production test scripts:

### LocalStack Tests (`infra/test-localstack.sh`)

- Test 11: Device flow init - Verifies `/auth/device/init` endpoint returns device_code and user_code
- Test 12: Device flow poll (pending) - Verifies `/auth/device/poll` returns 202 when authorization is pending
- Test 13: Device flow poll with invalid code - Verifies error handling for invalid device codes
- Test 14: Device flow CORS - Verifies CORS preflight works for both device flow endpoints

### Production Tests (`infra/test-prod.sh`)

- Test 12: Device flow init - Verifies endpoint and displays user code and verification URI
- Test 13: Device flow poll (pending) - Verifies 202 response for pending authorization
- Test 14: Device flow poll with invalid code - Verifies 400 error for invalid codes
- Test 15: Device flow poll without device_code - Verifies 400 error for missing parameter
- Test 16: Device flow CORS - Verifies CORS configuration
- Test 17: Complete device flow (manual) - Polls for 30 seconds to allow manual GitHub authorization testing

## Deployment Status

The user has confirmed that infrastructure has been deployed to both LocalStack (dev) and AWS production environments.

## Next Steps

The infrastructure is now ready for CLI implementation. The next tasks will involve:

1. Implementing token management (task 4)
2. Implementing authentication commands (task 5)
3. Creating API client utilities (task 6)
4. Enhancing existing commands for public registry support (tasks 7-11)
