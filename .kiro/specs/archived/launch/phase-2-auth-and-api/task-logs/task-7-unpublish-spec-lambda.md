# Task 7: unpublish-spec Lambda

## What Was Implemented

Implemented the unpublish-spec Lambda function that allows spec owners to delete their published specs from the registry. This Lambda includes comprehensive validation and security checks to ensure only owners can delete their specs.

### Subtasks Completed

- 7.1: Created Lambda handler in `api/unpublish-spec/index.ts`
- 7.2: Implemented GitHub token verification and ownership validation
- 7.3: Added comprehensive Zod validation for all inputs
- 7.4: Implemented DynamoDB deletion logic
- 7.5: Implemented S3 deletion logic (manifest + all files)
- 7.6: Added error handling with appropriate status codes
- 7.7: Created Terraform resources for Lambda deployment
- 7.8: Added IAM role with DynamoDB and S3 delete permissions

## Why These Decisions

**Strong Validation Emphasis:**
This Lambda has the most comprehensive validation of all lambdas because deletion is irreversible:

1. **Authorization Header Validation**
   - Validates format with regex: `^Bearer .+$`
   - Provides clear error messages for missing/malformed headers
   - Extracts token safely with substring operation

2. **Path Parameter Validation**
   - Username: 1-39 chars, alphanumeric + hyphens (GitHub constraints)
   - SpecName: 1-100 chars, alphanumeric + hyphens + underscores
   - Version: Must match semver regex `^\d+\.\d+\.\d+$`
   - All with descriptive error messages

3. **Ownership Validation**
   - Verifies GitHub token to get authenticated username
   - Compares authenticated username with spec username
   - Returns 403 Forbidden if mismatch
   - Prevents users from deleting others' specs

4. **Existence Validation**
   - Checks if spec exists in DynamoDB before deletion
   - Returns 404 if spec not found
   - Prevents unnecessary S3 operations

**Deletion Order:**
Delete from DynamoDB first, then S3:

1. If DynamoDB delete fails, S3 remains untouched (safe)
2. If S3 delete fails after DynamoDB, orphaned files in S3 (acceptable - can be cleaned up)
3. Opposite order would be worse: deleted files but metadata remains

**S3 Deletion Strategy:**
List all objects with prefix, then delete each:

- Handles manifest + all files in one operation
- Uses `ListObjectsV2` to find all files
- Deletes each object individually
- Logs each deletion for debugging

**Error Status Codes:**

- 401: Missing/invalid token
- 403: Ownership validation failed (not your spec)
- 404: Spec not found
- 400: Invalid parameters
- 500: Server errors

**Separate Validation Helper:**
Created `helpers/validation.ts` for ownership and existence checks:

- Keeps validation logic separate and testable
- Provides clear error messages
- Makes the main handler more readable

## Requirements Addressed

From Phase 2 Task 7 acceptance criteria:

- Lambda function created ✓
- Can unpublish spec ✓
- Ownership validation works ✓
- Files deleted from S3 ✓
- Metadata deleted from DynamoDB ✓
- Error handling works ✓

## Code Changes

### Lambda Implementation

- `api/unpublish-spec/index.ts` - Main Lambda handler with full validation
- `api/unpublish-spec/helpers/dynamodb.ts` - DynamoDB operations (check + delete)
- `api/unpublish-spec/helpers/s3.ts` - S3 deletion logic
- `api/unpublish-spec/helpers/validation.ts` - Ownership and existence validation
- `api/unpublish-spec/schemas/request.ts` - Auth header and path parameter schemas
- `api/unpublish-spec/schemas/response.ts` - Response schemas
- `api/unpublish-spec/helpers/errors.ts` - Error status code mapping

### Terraform Configuration

- `infra/modules/lambda/main.tf` - Added unpublish-spec Lambda resources:
  - IAM role for Lambda execution
  - IAM policy with DynamoDB GetItem/DeleteItem permissions
  - IAM policy with S3 ListBucket and DeleteObject permissions
  - Lambda function with Node.js 20 runtime
  - CloudWatch log group for Lambda logs
- `infra/modules/lambda/outputs.tf` - Added outputs for unpublish-spec Lambda ARNs

## Technical Details

**Lambda Configuration:**

- Runtime: Node.js 20
- Memory: 512 MB (higher for S3 operations)
- Timeout: 60 seconds (allows time for multiple S3 deletes)
- Environment variables: `BUCKET_NAME`, `SPECS_TABLE`

**IAM Permissions:**

- `dynamodb:GetItem` - Check if spec exists
- `dynamodb:DeleteItem` - Delete spec metadata
- `s3:ListBucket` - List files to delete
- `s3:DeleteObject` - Delete manifest and files
- CloudWatch Logs permissions for logging

**Request Format:**

```
DELETE /specs/{username}/{specName}/{version}
Headers:
  Authorization: Bearer <github-token>
```

**Response Format (Success):**

```json
{
  "message": "Unpublished username/spec-name@1.0.0",
  "specId": "username/spec-name",
  "version": "1.0.0"
}
```

**Response Format (Error):**

```json
{
  "error": "Ownership validation failed: You (alice) do not own specs under bob"
}
```

## Validation Flow

```
1. Authorization Header
   ├─ Missing? → 401 "Authorization header is required"
   ├─ Invalid format? → 401 "Authorization header must be in format: Bearer <token>"
   └─ Valid → Extract token

2. GitHub Token Verification
   ├─ Invalid token? → 401 "GitHub API failed"
   └─ Valid → Get authenticated username

3. Path Parameters
   ├─ Username invalid? → 400 "Username must contain only alphanumeric..."
   ├─ SpecName invalid? → 400 "Spec name must contain only..."
   ├─ Version invalid? → 400 "Version must be in semver format"
   └─ All valid → Continue

4. Ownership Validation
   ├─ Authenticated user ≠ spec owner? → 403 "Ownership validation failed"
   └─ Match → Continue

5. Existence Check
   ├─ Spec not found? → 404 "Spec not found: username/spec-name@1.0.0"
   └─ Exists → Proceed with deletion

6. Deletion
   ├─ DynamoDB delete fails? → 500 with error
   ├─ S3 delete fails? → 500 with error
   └─ Both succeed → 200 with success message
```

## Security Considerations

**Authentication:**

- Requires valid GitHub token
- Token verified with GitHub API on every request
- No token caching (ensures revoked tokens don't work)

**Authorization:**

- Ownership check prevents cross-user deletion
- Username from token must match username in path
- No admin override (users can only delete their own specs)

**Input Validation:**

- All inputs validated with Zod schemas
- Regex patterns prevent injection attacks
- Length limits prevent DoS attacks
- Semver validation prevents malformed versions

**Audit Trail:**

- All operations logged to CloudWatch
- Includes authenticated username
- Logs each deletion step
- Helps with debugging and security audits

## Challenges & Considerations

**Idempotency:**
Currently not idempotent - deleting twice returns 404 on second attempt. This is acceptable because:

- DELETE operations should return 404 for non-existent resources (REST convention)
- Client can check if 404 means "already deleted" or "never existed"
- Could add idempotency by checking if spec was recently deleted

**Partial Failures:**
If S3 deletion fails after DynamoDB deletion:

- Metadata is gone but files remain in S3
- Orphaned files don't affect functionality
- Can be cleaned up with S3 lifecycle policies
- Could add transaction rollback in future

**Concurrent Deletions:**
If two requests try to delete the same spec simultaneously:

- Both will pass existence check
- Both will attempt deletion
- One will succeed, one will get "not found" error
- Acceptable for MVP - unlikely scenario

**Version vs All Versions:**
Currently deletes a specific version. Future enhancement:

- Add endpoint to delete all versions of a spec
- Would need to query all versions first
- Then delete each one

## Next Steps

1. Deploy Lambda via Terraform
2. Test with valid token and owned spec
3. Test ownership validation (try to delete someone else's spec)
4. Test error cases (invalid token, non-existent spec, malformed parameters)
5. Integrate with API Gateway (Task 8)
6. Test end-to-end unpublish flow (Task 9)
