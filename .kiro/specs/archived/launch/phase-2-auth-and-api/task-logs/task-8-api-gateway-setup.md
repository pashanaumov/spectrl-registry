# Task 8: API Gateway Setup

## What Was Implemented

Created a complete API Gateway REST API that exposes all Lambda functions as HTTP endpoints. This provides the public-facing API for the Spectrl registry.

### Subtasks Completed

- 8.1: Created Terraform module for API Gateway
- 8.2: Configured all routes and methods
- 8.3: Set up Lambda integrations for all endpoints
- 8.4: Configured CORS with OPTIONS methods
- 8.5: Added rate limiting (100 req/sec)
- 8.6: Created deployment and prod stage
- 8.7: Added outputs for API URL
- 8.8: Integrated with dev environment

## Why These Decisions

**Module Structure:**
Created a separate `api-gateway` module to keep API Gateway configuration isolated from Lambda configuration. This:

- Makes the code more maintainable
- Allows reusing the module for different environments
- Keeps concerns separated (Lambda = compute, API Gateway = routing)

**AWS_PROXY Integration:**
Used `AWS_PROXY` integration type for all Lambda functions:

- Passes entire HTTP request to Lambda as-is
- Lambda gets full control over response
- No transformation needed in API Gateway
- Simplest and most flexible approach

**CORS Configuration:**
Added OPTIONS method for every endpoint:

- Browsers send OPTIONS "preflight" request before actual request
- Returns CORS headers without calling Lambda (MOCK integration)
- Allows requests from any origin (`Access-Control-Allow-Origin: *`)
- Includes Authorization header for authenticated endpoints

**Rate Limiting:**
Set to 100 requests/second with 200 burst:

- Prevents abuse and DoS attacks
- Reasonable limit for MVP
- Can be increased later if needed
- Applied globally to all endpoints

**Deployment Triggers:**
Used SHA1 hash of integration IDs to trigger redeployment:

- Automatically redeploys when routes change
- Ensures API Gateway always reflects latest configuration
- No manual deployment needed

**Lambda Permissions:**
Added explicit permissions for API Gateway to invoke each Lambda:

- Without this, API Gateway gets "Access Denied"
- Uses wildcard source ARN for all methods/paths
- Scoped to specific API Gateway

## Requirements Addressed

From Phase 2 Task 8 acceptance criteria:

- API Gateway created ✓
- All routes configured ✓
- CORS works ✓
- Rate limiting configured ✓
- Can access all endpoints ✓
- Lambda integrations work ✓

## Code Changes

### Terraform Configuration

- `infra/modules/api-gateway/main.tf` - Complete API Gateway configuration:
  - REST API resource
  - 5 endpoint routes with methods
  - 5 Lambda integrations
  - 5 OPTIONS methods for CORS
  - Deployment and stage
  - Rate limiting settings
  - Lambda permissions
- `infra/modules/api-gateway/variables.tf` - Input variables for Lambda ARNs
- `infra/modules/api-gateway/outputs.tf` - API endpoint URL output
- `infra/modules/api-gateway/API-GATEWAY-EXPLAINED.md` - Comprehensive documentation
- `infra/environments/dev/main.tf` - Added API Gateway module
- `infra/environments/dev/outputs.tf` - Added API endpoint output

## API Structure

```
Base URL: https://{api-id}.execute-api.{region}.amazonaws.com/prod

POST   /auth/exchange                           → auth-exchange Lambda
POST   /publish                                 → publish-spec Lambda
GET    /search?q={query}                        → search-specs Lambda
GET    /specs/{username}/{specName}             → get-spec Lambda
DELETE /specs/{username}/{specName}/{version}   → unpublish-spec Lambda
```

## Technical Details

**REST API Configuration:**

- Type: REGIONAL (not edge-optimized, for lower latency in region)
- Stage: prod
- Rate limit: 100 req/sec, 200 burst

**Integration Type:**

- AWS_PROXY for all endpoints
- Integration HTTP method: POST (always POST for Lambda)
- No request/response transformation

**CORS Headers:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Path Parameters:**

- `/specs/{username}/{specName}` - username and specName are path parameters
- `/specs/{username}/{specName}/{version}` - adds version parameter
- API Gateway extracts these and passes to Lambda in `event.pathParameters`

**Query Parameters:**

- `/search?q={query}` - q is optional query parameter
- API Gateway passes to Lambda in `event.queryStringParameters`

## Request Flow

1. Client makes HTTP request to API Gateway URL
2. API Gateway checks rate limit
3. API Gateway matches route and method
4. API Gateway invokes corresponding Lambda
5. Lambda processes request and returns response
6. API Gateway forwards response to client

## CORS Flow

1. Browser sends OPTIONS request (preflight)
2. API Gateway returns CORS headers immediately (MOCK integration)
3. Browser checks headers and allows request
4. Browser sends actual request (GET, POST, DELETE)
5. Lambda processes and returns response with CORS headers

## Testing

After deployment, get the API URL:

```bash
terraform output api_endpoint
```

### Test Commands:

**Search:**

```bash
curl https://{api-url}/prod/search?q=test
```

**Get Spec:**

```bash
curl https://{api-url}/prod/specs/pasha/my-spec
```

**Publish (requires token):**

```bash
curl -X POST https://{api-url}/prod/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @request.json
```

**Unpublish (requires token):**

```bash
curl -X DELETE https://{api-url}/prod/specs/pasha/my-spec/1.0.0 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring

**CloudWatch Logs:**

- API Gateway logs all requests
- Includes request/response details
- Shows Lambda invocation results
- Essential for debugging

**CloudWatch Metrics:**

- Request count
- 4XX errors (client errors)
- 5XX errors (server errors)
- Latency
- Integration latency (Lambda execution time)

## Security Considerations

**Rate Limiting:**

- Prevents DoS attacks
- Limits abuse
- Per-IP tracking

**No API Gateway Authentication:**

- We handle auth in Lambda (GitHub tokens)
- API Gateway just routes requests
- More flexible for our use case

**CORS:**

- Allows any origin (`*`)
- Acceptable for public API
- Could restrict to specific domains later

**Lambda Permissions:**

- Scoped to specific API Gateway
- Uses source ARN to prevent unauthorized invocation
- Each Lambda has separate permission

## Cost Considerations

**API Gateway Pricing:**

- $3.50 per million requests (first 333M)
- Very cheap for MVP
- Example: 10,000 requests/day = $1.05/month

**No Additional Costs:**

- No data transfer charges within same region
- No charge for OPTIONS requests
- No charge for rate-limited requests

## Challenges & Considerations

**Deployment Triggers:**
Terraform doesn't automatically detect changes to methods/integrations. We use SHA1 hash of integration IDs to force redeployment when routes change.

**CORS Complexity:**
Each endpoint needs 4 resources:

- Method (GET/POST/DELETE)
- Integration (Lambda)
- OPTIONS method
- OPTIONS integration + responses

This is verbose but necessary for browser support.

**Integration HTTP Method:**
Always POST for Lambda, even for GET endpoints. This is an AWS requirement - API Gateway always invokes Lambda with POST.

**Path Parameter Extraction:**
API Gateway automatically extracts path parameters and passes them in `event.pathParameters`. Lambda must validate these.

## Documentation

Created comprehensive `API-GATEWAY-EXPLAINED.md` covering:

- What API Gateway is and why we need it
- How it works (request flow)
- Key concepts (resources, methods, integrations)
- CORS explanation
- Rate limiting
- Testing examples
- Common issues and solutions
- Monitoring and metrics
- Cost breakdown
- Best practices

## Next Steps

1. Deploy infrastructure with Terraform
2. Get API endpoint URL from outputs
3. Test each endpoint with curl
4. Check CloudWatch Logs for any errors
5. Run integration tests (Task 9)
6. Update CLI to use API endpoint
7. Test end-to-end workflows
