# Spectrl Public Registry API

Complete API documentation for the Spectrl public registry backend.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [POST /auth/exchange](#post-authexchange)
  - [POST /publish](#post-publish)
  - [GET /search](#get-search)
  - [GET /specs/{username}/{specName}](#get-specsusernamespectname)
  - [DELETE /specs/{username}/{specName}/{version}](#delete-specsusernamespecnameversion)
- [Lambda Functions](#lambda-functions)
- [Error Codes](#error-codes)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Spectrl API provides a public registry for publishing, discovering, and managing structured specs. It uses GitHub OAuth for authentication and stores specs in S3 with metadata in DynamoDB.

**Architecture:**

- **API Gateway**: REST API with CORS enabled
- **Lambda Functions**: Serverless compute for each endpoint
- **DynamoDB**: Metadata storage (specs and users tables)
- **S3**: File storage for spec manifests and content
- **Secrets Manager**: GitHub OAuth credentials
- **CloudFront**: CDN for S3 content delivery

---

## Base URL

**Production:**

```
https://bpleokxqv5.execute-api.eu-north-1.amazonaws.com/prod
```

**LocalStack (Development):**

```
http://localhost:4566/restapis/{api_id}/prod/_user_request_
```

---

## Authentication

Most endpoints require a GitHub personal access token or OAuth token.

**Header Format:**

```
Authorization: Bearer <github_token>
```

**Token Types:**

1. **OAuth Token**: Obtained via `/auth/exchange` endpoint (for CLI users)
2. **Personal Access Token**: From GitHub settings (for testing/scripts)

**Required Scopes:**

- `read:user` - Read user profile information

---

## Endpoints

### POST /auth/exchange

Exchange a GitHub OAuth code for an access token.

**Purpose:** Complete the OAuth flow by exchanging a temporary code for a long-lived access token.

**Request:**

```bash
curl -X POST https://api.spectrl.dev/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "code": "github_oauth_code_here"
  }'
```

**Request Body:**

```json
{
  "code": "string" // GitHub OAuth code from device flow
}
```

**Response (200):**

```json
{
  "token": "gho_xxxxxxxxxxxx",
  "username": "octocat"
}
```

**Errors:**

- `400` - Missing or invalid code
- `500` - GitHub API error or internal error

**Example:**

```bash
# Step 1: Get device code from GitHub
curl -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -d "client_id=YOUR_CLIENT_ID&scope=read:user"

# Step 2: User visits verification URL and enters code

# Step 3: Exchange for token
curl -X POST https://api.spectrl.dev/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"code":"device_code_from_step_1"}'
```

---

### POST /publish

Publish a spec to the public registry.

**Purpose:** Upload a spec manifest and files to the registry, making it discoverable and installable.

**Authentication:** Required (Bearer token)

**Request:**

```bash
curl -X POST https://api.spectrl.dev/publish \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @spec-payload.json
```

**Request Body:**

```json
{
  "manifest": {
    "name": "username/spec-name",
    "version": "1.0.0",
    "description": "A helpful spec",
    "agentTags": ["prd", "api"],
    "files": ["README.md", "spec.json"],
    "dependencies": {}
  },
  "files": {
    "README.md": "# My Spec\n\nContent here...",
    "spec.json": "{\"key\": \"value\"}"
  }
}
```

**Validation Rules:**

- Maximum 50 files per spec
- Maximum 1MB per file
- Maximum 10MB total size
- File paths must be relative (no `..` or absolute paths)
- Namespace must match authenticated username
- All files in manifest must be present in files object

**Response (200):**

```json
{
  "message": "Spec published successfully",
  "specId": "username/spec-name",
  "version": "1.0.0",
  "hash": "sha256:abc123..."
}
```

**Errors:**

- `400` - Invalid manifest, file validation failed, or missing files
- `401` - Missing or invalid authorization token
- `403` - Namespace ownership violation (username mismatch)
- `500` - S3 upload error or DynamoDB error

**Example:**

```bash
# Create payload file
cat > spec-payload.json << 'EOF'
{
  "manifest": {
    "name": "octocat/hello-world",
    "version": "1.0.0",
    "description": "Hello world spec",
    "agentTags": ["example"],
    "files": ["README.md"],
    "dependencies": {}
  },
  "files": {
    "README.md": "# Hello World\n\nThis is a test spec."
  }
}
EOF

# Publish
curl -X POST https://api.spectrl.dev/publish \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @spec-payload.json
```

---

### GET /search

Search for specs in the registry.

**Purpose:** Discover specs by searching across names, descriptions, and tags.

**Authentication:** Not required

**Request:**

```bash
curl "https://api.spectrl.dev/search?q=api"
```

**Query Parameters:**

- `q` (optional): Search query string
  - Searches across: `specName`, `description`, `agentTags`
  - Case-insensitive
  - If omitted, returns recent specs

**Response (200):**

```json
{
  "results": [
    {
      "specId": "username/spec-name",
      "specName": "spec-name",
      "username": "username",
      "version": "1.0.0",
      "description": "A helpful spec",
      "agentTags": ["prd", "api"],
      "publishedAt": "2024-12-08T18:00:00.000Z",
      "hash": "sha256:abc123..."
    }
  ],
  "count": 1
}
```

**Behavior:**

- Returns up to 20 results
- Results sorted by newest first (`publishedAt` descending)
- Scans up to 100 items in DynamoDB for performance
- Empty query returns recent specs

**Errors:**

- `500` - DynamoDB scan error

**Examples:**

```bash
# Search for API-related specs
curl "https://api.spectrl.dev/search?q=api"

# Get recent specs (no query)
curl "https://api.spectrl.dev/search"

# Search for specific tag
curl "https://api.spectrl.dev/search?q=prd"
```

---

### GET /specs/{username}/{specName}

Get all versions of a spec.

**Purpose:** Retrieve metadata for all published versions of a specific spec.

**Authentication:** Not required

**Request:**

```bash
curl "https://api.spectrl.dev/specs/octocat/hello-world"
```

**Path Parameters:**

- `username`: GitHub username (spec owner)
- `specName`: Name of the spec (without username prefix)

**Response (200):**

```json
{
  "specId": "octocat/hello-world",
  "specName": "hello-world",
  "username": "octocat",
  "versions": [
    {
      "version": "2.0.0",
      "description": "Updated version",
      "agentTags": ["example", "v2"],
      "publishedAt": "2024-12-08T19:00:00.000Z",
      "hash": "sha256:def456..."
    },
    {
      "version": "1.0.0",
      "description": "Hello world spec",
      "agentTags": ["example"],
      "publishedAt": "2024-12-08T18:00:00.000Z",
      "hash": "sha256:abc123..."
    }
  ]
}
```

**Behavior:**

- Versions sorted by newest first
- Uses DynamoDB Query (efficient, not Scan)
- Returns all versions in a single response

**Errors:**

- `404` - Spec not found (no versions exist)
- `500` - DynamoDB query error

**Examples:**

```bash
# Get all versions
curl "https://api.spectrl.dev/specs/octocat/hello-world"

# Pretty print with jq
curl -s "https://api.spectrl.dev/specs/octocat/hello-world" | jq .
```

---

### DELETE /specs/{username}/{specName}/{version}

Unpublish a specific version of a spec.

**Purpose:** Remove a spec version from the registry (deletes from S3 and DynamoDB).

**Authentication:** Required (Bearer token)

**Request:**

```bash
curl -X DELETE "https://api.spectrl.dev/specs/octocat/hello-world/1.0.0" \
  -H "Authorization: Bearer $GITHUB_TOKEN"
```

**Path Parameters:**

- `username`: GitHub username (spec owner)
- `specName`: Name of the spec
- `version`: Semantic version to delete (e.g., "1.0.0")

**Validation:**

- Token must be valid
- Authenticated user must match spec owner (namespace validation)
- Spec version must exist
- Version must be valid semver format

**Response (200):**

```json
{
  "message": "Spec version unpublished successfully",
  "specId": "octocat/hello-world",
  "version": "1.0.0"
}
```

**Errors:**

- `400` - Invalid path parameters or version format
- `401` - Missing or invalid authorization token
- `403` - Ownership validation failed (you don't own this spec)
- `404` - Spec version not found
- `500` - S3 deletion error or DynamoDB error

**Behavior:**

- Deletes DynamoDB metadata first (safer order)
- Then deletes all S3 files with prefix: `specs/{username}/{specName}/{version}/`
- Only deletes the specific version (other versions remain)
- Irreversible operation

**Examples:**

```bash
# Unpublish a version
curl -X DELETE "https://api.spectrl.dev/specs/octocat/hello-world/1.0.0" \
  -H "Authorization: Bearer $GITHUB_TOKEN"

# Verify deletion (should return 404 if it was the only version)
curl "https://api.spectrl.dev/specs/octocat/hello-world"
```

---

## Lambda Functions

### auth-exchange

**Purpose:** Exchange GitHub OAuth code for access token

**Environment Variables:**

- `SECRETS_ARN`: ARN of GitHub OAuth credentials in Secrets Manager
- `USERS_TABLE`: DynamoDB table name for users
- `AWS_REGION`: AWS region (default: eu-north-1)

**IAM Permissions:**

- `secretsmanager:GetSecretValue` - Read OAuth credentials
- `dynamodb:PutItem` - Store user record

**Error Handling:**

- Validates OAuth code format
- Verifies GitHub API responses
- Stores user in DynamoDB (creates or updates)
- Returns detailed error messages

---

### publish-spec

**Purpose:** Publish spec to S3 and DynamoDB

**Environment Variables:**

- `SPECS_BUCKET`: S3 bucket name for spec storage
- `SPECS_TABLE`: DynamoDB table name for spec metadata
- `AWS_REGION`: AWS region

**IAM Permissions:**

- `s3:PutObject` - Upload manifest and files
- `dynamodb:PutItem` - Store spec metadata

**Validation:**

- File count limit: 50 files
- File size limit: 1MB per file, 10MB total
- Path sanitization (no `..` or absolute paths)
- Namespace ownership (username must match spec name prefix)
- Manifest consistency (all files declared must be present)

**Error Handling:**

- Validates token with GitHub API
- Comprehensive Zod validation for request body
- Calculates SHA-256 hash for content integrity
- Atomic uploads (all or nothing)

---

### search-specs

**Purpose:** Search specs by query string

**Environment Variables:**

- `SPECS_TABLE`: DynamoDB table name

**IAM Permissions:**

- `dynamodb:Scan` - Search across all specs

**Behavior:**

- Scans up to 100 items (performance limit)
- Filters in-memory for case-insensitive search
- Returns up to 20 results
- Sorts by newest first

**Error Handling:**

- Handles empty queries gracefully
- Returns empty results if no matches
- Logs scan performance metrics

---

### get-spec

**Purpose:** Get all versions of a spec

**Environment Variables:**

- `SPECS_TABLE`: DynamoDB table name

**IAM Permissions:**

- `dynamodb:Query` - Efficient lookup by partition key

**Behavior:**

- Uses Query operation (not Scan) for efficiency
- Partition key: `specId` (format: "username/spec-name")
- Sort key: `version`
- Returns versions sorted newest first

**Error Handling:**

- Returns 404 if spec doesn't exist
- Validates path parameters
- Handles DynamoDB errors gracefully

---

### unpublish-spec

**Purpose:** Delete spec version from registry

**Environment Variables:**

- `SPECS_BUCKET`: S3 bucket name
- `SPECS_TABLE`: DynamoDB table name

**IAM Permissions:**

- `dynamodb:GetItem` - Check if spec exists
- `dynamodb:DeleteItem` - Remove metadata
- `s3:ListObjectsV2` - List files to delete
- `s3:DeleteObject` - Delete files

**Validation:**

- Authorization header format
- Path parameters (username, specName, version)
- Semver version format
- Ownership (authenticated user must match spec owner)
- Existence (spec version must exist)

**Deletion Order:**

1. Validate ownership and existence
2. Delete from DynamoDB first (safer)
3. Delete from S3 (all files with version prefix)

**Error Handling:**

- Comprehensive validation before deletion
- Separate validation helper module for testability
- Detailed error messages for debugging
- Logs all deletion operations

---

## Error Codes

### 400 Bad Request

- Invalid request body format
- Missing required fields
- File validation failed (size, count, paths)
- Invalid manifest structure
- Malformed version number

### 401 Unauthorized

- Missing Authorization header
- Invalid or expired token
- Token verification with GitHub failed

### 403 Forbidden

- Namespace ownership violation
- Authenticated user doesn't match spec owner
- Insufficient permissions

### 404 Not Found

- Spec doesn't exist
- Spec version not found
- Invalid endpoint

### 500 Internal Server Error

- DynamoDB operation failed
- S3 operation failed
- Secrets Manager error
- GitHub API error
- Unexpected server error

---

## Testing

### Integration Tests

Two test scripts are provided for comprehensive API testing:

**LocalStack (Development):**

```bash
cd infra
./test-localstack.sh
```

**Production (AWS):**

```bash
export GITHUB_TOKEN='your_personal_access_token'
cd infra
./test-prod.sh
```

### Test Coverage

Both scripts test:

1. ✅ Search with empty query
2. ✅ Search with query parameter
3. ✅ Get non-existent spec (404)
4. ✅ Publish spec
5. ✅ Get published spec
6. ✅ Search for published spec
7. ✅ Publish invalid spec (400)
8. ✅ Publish without token (401)
9. ✅ Unpublish spec
10. ✅ Verify unpublish (404)
11. ✅ CORS preflight (OPTIONS)

### Manual Testing

**Test Publish:**

```bash
# Create test payload
cat > test-spec.json << 'EOF'
{
  "manifest": {
    "name": "yourname/test-spec",
    "version": "1.0.0",
    "description": "Test spec",
    "agentTags": ["test"],
    "files": ["README.md"],
    "dependencies": {}
  },
  "files": {
    "README.md": "# Test\n\nThis is a test."
  }
}
EOF

# Publish
curl -X POST https://api.spectrl.dev/publish \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-spec.json
```

**Test Search:**

```bash
curl "https://api.spectrl.dev/search?q=test"
```

**Test Get:**

```bash
curl "https://api.spectrl.dev/specs/yourname/test-spec"
```

**Test Unpublish:**

```bash
curl -X DELETE "https://api.spectrl.dev/specs/yourname/test-spec/1.0.0" \
  -H "Authorization: Bearer $GITHUB_TOKEN"
```

---

## Troubleshooting

### "Missing Authorization header"

**Problem:** 401 error when calling authenticated endpoints

**Solution:**

```bash
# Ensure Authorization header is set
curl -H "Authorization: Bearer $GITHUB_TOKEN" ...

# Check token is valid
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

### "Namespace ownership violation"

**Problem:** 403 error when publishing

**Cause:** Spec name doesn't match your GitHub username

**Solution:**

```json
{
  "manifest": {
    "name": "your-github-username/spec-name",  // Must match your username
    ...
  }
}
```

### "Spec not found"

**Problem:** 404 when getting a spec

**Possible Causes:**

1. Spec was never published
2. Spec was unpublished
3. Wrong username or spec name in URL

**Solution:**

```bash
# Search for the spec first
curl "https://api.spectrl.dev/search?q=spec-name"

# Check exact specId format
curl "https://api.spectrl.dev/specs/username/spec-name"
```

### "File validation failed"

**Problem:** 400 error when publishing

**Common Issues:**

- File too large (>1MB)
- Too many files (>50)
- Total size too large (>10MB)
- File path contains `..` or starts with `/`
- File declared in manifest but not in files object

**Solution:**

```bash
# Check file sizes
du -h your-files/*

# Ensure all manifest files are present
jq '.manifest.files' spec-payload.json
jq '.files | keys' spec-payload.json
```

### Lambda Timeout

**Problem:** 500 error or timeout

**Possible Causes:**

1. Large file upload taking too long
2. DynamoDB throttling
3. S3 upload slow

**Solution:**

- Reduce file sizes
- Check AWS service health
- Retry the request
- Contact support if persistent

### CORS Errors in Browser

**Problem:** Browser blocks request with CORS error

**Cause:** Missing preflight request or incorrect headers

**Solution:**

```javascript
// Ensure preflight is sent
fetch('https://api.spectrl.dev/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});
```

### LocalStack Lambda 502 Errors

**Problem:** LocalStack returns 502 from Lambda

**Solution:**

1. Rebuild Lambdas with esbuild: `cd api && pnpm build`
2. Redeploy: `cd infra/environments/dev && tflocal apply`
3. Check Lambda logs: `awslocal logs tail /aws/lambda/spectrl-publish-spec-dev`

### DynamoDB Not Empty After Testing

**Problem:** Test data remains in DynamoDB

**Expected Behavior:**

- Specs table should be empty (unpublish cleans up)
- Users table may have your user record (created during auth)

**Cleanup:**

```bash
# Check specs table
aws dynamodb scan --table-name spectrl-specs-prod --region eu-north-1

# Check users table
aws dynamodb scan --table-name spectrl-users-prod --region eu-north-1

# Manual cleanup if needed
aws dynamodb delete-item \
  --table-name spectrl-specs-prod \
  --key '{"specId":{"S":"username/spec-name"},"version":{"S":"1.0.0"}}' \
  --region eu-north-1
```

---

## Build and Deployment

### Building Lambdas

```bash
cd api
pnpm install
pnpm build  # Uses esbuild to bundle all Lambdas
```

This creates bundled, minified JavaScript files in `api/dist/*/index.js` (~280KB each).

### Deploying to Production

```bash
cd infra/environments/prod
terraform init
terraform apply
```

### Deploying to LocalStack

```bash
# Start LocalStack
docker-compose up -d

# Deploy
cd infra/environments/dev
tflocal apply
```

---

## Architecture Decisions

### Why esbuild?

We use esbuild instead of plain TypeScript compilation because:

- **Smaller packages**: ~280KB vs several MB with node_modules
- **Faster cold starts**: Single bundled file, no module resolution
- **Tree-shaking**: Only includes code that's actually used
- **LocalStack compatibility**: Bundled code works reliably

### Why DynamoDB Query vs Scan?

- **get-spec**: Uses Query (efficient) because we know the partition key (`specId`)
- **search-specs**: Uses Scan (slower) because we search across multiple fields

### Why Delete DynamoDB First?

When unpublishing, we delete from DynamoDB before S3 because:

- If DynamoDB delete fails, S3 files remain (can retry)
- If S3 delete fails after DynamoDB, spec is already marked as deleted
- Safer failure mode: orphaned S3 files vs inconsistent metadata

---

## Support

For issues or questions:

- GitHub Issues: https://github.com/spectrl/spectrl/issues
- Documentation: https://spectrl.dev/docs
- Email: support@spectrl.dev
