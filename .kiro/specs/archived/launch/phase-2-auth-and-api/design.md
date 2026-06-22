# Phase 2: Authentication & API - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI / Browser                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS
                 ▼
         ┌───────────────┐
         │  API Gateway  │  (api.spectrl.dev or default domain)
         │   REST API    │
         └───────┬───────┘
                 │
                 │ Invoke
                 ▼
    ┌────────────────────────────┐
    │     Lambda Functions       │
    ├────────────────────────────┤
    │  • auth-exchange           │
    │  • publish-spec            │
    │  • search-specs            │
    │  • get-spec                │
    │  • unpublish-spec          │
    └────────┬───────────────────┘
             │
             │ Read/Write
             ▼
    ┌────────────────────────────┐
    │   AWS Resources            │
    ├────────────────────────────┤
    │  • S3 (spec files)         │
    │  • DynamoDB (metadata)     │
    │  • Secrets Manager (OAuth) │
    └────────────────────────────┘
```

## API Endpoints

### POST /auth/exchange

**Purpose:** Exchange GitHub OAuth code for access token

**Request:**

```json
{
  "code": "github_oauth_code"
}
```

**Response:**

```json
{
  "token": "github_access_token",
  "username": "github_username"
}
```

**Flow:**

1. Receive OAuth code from CLI
2. Get OAuth credentials from Secrets Manager
3. Exchange code for token with GitHub API
4. Get user info from GitHub API
5. Store/update user in DynamoDB
6. Return token to CLI

---

### POST /publish

**Purpose:** Publish a spec to the public registry

**Headers:**

```
Authorization: Bearer {github_token}
Content-Type: application/json
```

**Request:**

```json
{
  "manifest": {
    "name": "my-spec",
    "version": "1.0.0",
    "description": "My awesome spec",
    "files": ["README.md", "docs/design.md"],
    "dependencies": {},
    "agent": {
      "purpose": "Spec description",
      "tags": ["architecture", "design"]
    }
  },
  "files": {
    "README.md": "# Content here...",
    "docs/design.md": "# Design content..."
  }
}
```

**Response:**

```json
{
  "message": "Published username/my-spec@1.0.0",
  "url": "https://spectrl.dev/specs/username/my-spec"
}
```

**Flow:**

1. Verify token with GitHub API
2. Validate manifest format
3. Check namespace ownership (username matches token)
4. Calculate content hash
5. Upload manifest to S3: `specs/{username}/{name}/{version}/spectrl.json`
6. Upload each file to S3: `specs/{username}/{name}/{version}/files/{path}`
7. Store metadata in DynamoDB
8. Return success response

---

### GET /search?q={query}

**Purpose:** Search for specs (no auth required)

**Query Parameters:**

- `q` - Search query (searches name, description, tags)

**Response:**

```json
{
  "results": [
    {
      "id": "username/spec-name",
      "version": "1.0.0",
      "description": "Spec description",
      "downloads": 42,
      "tags": ["architecture"]
    }
  ]
}
```

**Flow:**

1. Scan DynamoDB with filter expression
2. Match query against specName, description, agentTags
3. Limit to 20 results
4. Return formatted results

---

### GET /specs/{username}/{specName}

**Purpose:** Get all versions of a spec (no auth required)

**Response:**

```json
{
  "id": "username/spec-name",
  "versions": [
    {
      "version": "1.0.0",
      "description": "Spec description",
      "downloads": 42,
      "createdAt": "2025-01-15T10:00:00Z",
      "s3Path": "specs/username/spec-name/1.0.0",
      "hash": "sha256:abc123..."
    }
  ]
}
```

**Flow:**

1. Query DynamoDB by specId
2. Return all versions sorted by newest first
3. Include metadata for each version

---

### DELETE /specs/{username}/{specName}/{version}

**Purpose:** Unpublish a spec (auth required)

**Headers:**

```
Authorization: Bearer {github_token}
```

**Response:**

```json
{
  "message": "Unpublished username/spec-name@1.0.0"
}
```

**Flow:**

1. Verify token with GitHub API
2. Check ownership (username matches token)
3. Delete files from S3
4. Delete metadata from DynamoDB
5. Return success response

## Lambda Functions

### 1. auth-exchange

**Runtime:** Node.js 20.x
**Memory:** 256 MB
**Timeout:** 30 seconds

**Environment Variables:**

- `SECRETS_ARN` - ARN of GitHub OAuth secret
- `USERS_TABLE` - DynamoDB users table name

**IAM Permissions:**

- `secretsmanager:GetSecretValue` on OAuth secret
- `dynamodb:PutItem` on users table

**Code Structure:**

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export async function handler(event: any) {
  // 1. Parse request body
  // 2. Get OAuth credentials from Secrets Manager
  // 3. Exchange code for token (GitHub API)
  // 4. Get user info (GitHub API)
  // 5. Store user in DynamoDB
  // 6. Return token and username
}
```

---

### 2. publish-spec

**Runtime:** Node.js 20.x
**Memory:** 512 MB (needs more for file uploads)
**Timeout:** 60 seconds

**Environment Variables:**

- `BUCKET_NAME` - S3 bucket name
- `SPECS_TABLE` - DynamoDB specs table name

**IAM Permissions:**

- `s3:PutObject` on bucket
- `dynamodb:PutItem` on specs table

**Code Structure:**

```typescript
import { S3 } from '@aws-sdk/client-s3';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import crypto from 'crypto';

export async function handler(event: any) {
  // 1. Verify token with GitHub API
  // 2. Validate manifest
  // 3. Check namespace ownership
  // 4. Calculate content hash
  // 5. Upload manifest to S3
  // 6. Upload files to S3
  // 7. Store metadata in DynamoDB
  // 8. Return success response
}
```

---

### 3. search-specs

**Runtime:** Node.js 20.x
**Memory:** 256 MB
**Timeout:** 10 seconds

**Environment Variables:**

- `SPECS_TABLE` - DynamoDB specs table name

**IAM Permissions:**

- `dynamodb:Scan` on specs table

**Code Structure:**

```typescript
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export async function handler(event: any) {
  // 1. Parse query parameter
  // 2. Scan DynamoDB with filter
  // 3. Format results
  // 4. Return response
}
```

---

### 4. get-spec

**Runtime:** Node.js 20.x
**Memory:** 256 MB
**Timeout:** 10 seconds

**Environment Variables:**

- `SPECS_TABLE` - DynamoDB specs table name

**IAM Permissions:**

- `dynamodb:Query` on specs table

**Code Structure:**

```typescript
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export async function handler(event: any) {
  // 1. Parse path parameters
  // 2. Query DynamoDB by specId
  // 3. Format versions
  // 4. Return response
}
```

---

### 5. unpublish-spec

**Runtime:** Node.js 20.x
**Memory:** 256 MB
**Timeout:** 30 seconds

**Environment Variables:**

- `BUCKET_NAME` - S3 bucket name
- `SPECS_TABLE` - DynamoDB specs table name

**IAM Permissions:**

- `s3:DeleteObject` on bucket
- `dynamodb:DeleteItem` on specs table

**Code Structure:**

```typescript
import { S3 } from '@aws-sdk/client-s3';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export async function handler(event: any) {
  // 1. Verify token with GitHub API
  // 2. Check ownership
  // 3. Delete from S3
  // 4. Delete from DynamoDB
  // 5. Return success response
}
```

## Terraform Structure

```
infra/
  terraform/
    modules/
      api/
        main.tf              # Lambda functions + API Gateway
        lambda/
          auth-exchange/
            index.ts
            package.json
          publish-spec/
            index.ts
            package.json
          search-specs/
            index.ts
            package.json
          get-spec/
            index.ts
            package.json
          unpublish-spec/
            index.ts
            package.json
        variables.tf
        outputs.tf
```

## API Gateway Configuration

**Type:** REST API (not HTTP API - need more control)

**CORS Configuration:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

**Rate Limiting:**

- 100 requests per minute per IP
- Burst: 200 requests

**Stages:**

- `prod` - Production stage

**Custom Domain:** Deferred (will use default API Gateway domain for now)

## Security Considerations

### Token Validation

Every protected endpoint must:

1. Extract token from `Authorization: Bearer {token}` header
2. Validate with GitHub API: `GET https://api.github.com/user`
3. Cache validation result for 5 minutes (optional optimization)
4. Return 401 if invalid

### Namespace Protection

Users can only publish to their own namespace:

```typescript
const specId = `${user.login}/${manifest.name}`;
// User "alice" can only publish "alice/my-spec", not "bob/my-spec"
```

### Input Validation

- Validate manifest schema (use Zod from @spectrl/schema)
- Sanitize file paths (no `..`, no absolute paths)
- Limit file sizes (max 10MB per file, 50MB total)
- Limit number of files (max 100 files per spec)

### Rate Limiting

- API Gateway throttling: 100 req/min per IP
- Lambda concurrency limits (optional)

## Error Handling

**Standard Error Response:**

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Error Codes:**

- `INVALID_TOKEN` - Token validation failed
- `INVALID_MANIFEST` - Manifest validation failed
- `NAMESPACE_CONFLICT` - User doesn't own namespace
- `SPEC_NOT_FOUND` - Spec doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Testing Strategy

### Unit Tests

- Test each Lambda function independently
- Mock AWS SDK calls
- Test error cases

### Integration Tests

- Deploy to AWS
- Test with real API calls using curl/Postman
- Verify S3 uploads
- Verify DynamoDB writes

### Test Scenarios

1. **Happy Path:**
   - Complete OAuth flow
   - Publish spec
   - Search for spec
   - Get spec details
   - Unpublish spec

2. **Error Cases:**
   - Invalid token
   - Invalid manifest
   - Namespace conflict
   - Missing spec
   - Duplicate version

## Next Steps (Phase 3)

Once API is validated:

- Integrate with CLI
- Add token storage (keytar)
- Implement CLI commands (login, publish, search, install)
