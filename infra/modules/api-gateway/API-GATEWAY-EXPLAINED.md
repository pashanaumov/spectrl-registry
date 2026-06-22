# API Gateway Explained

## What is API Gateway?

API Gateway is AWS's managed service that acts as the "front door" for your APIs. It's essentially a reverse proxy that receives HTTP requests from clients and routes them to backend services (in our case, Lambda functions).

## Why Do We Need It?

Lambda functions by themselves have no HTTP endpoint - they're just functions sitting in AWS. API Gateway gives them public URLs that clients can call over the internet.

**Without API Gateway:**

```
❌ No way to call Lambda from internet
❌ No HTTP endpoints
❌ No REST API
```

**With API Gateway:**

```
✅ Public HTTPS endpoints
✅ REST API with proper routes
✅ CORS support for browsers
✅ Rate limiting
✅ Request/response transformation
```

## How It Works

```
Client (CLI/Browser)
    ↓
    HTTP Request: POST https://abc123.execute-api.eu-north-1.amazonaws.com/prod/publish
    ↓
API Gateway (receives request)
    ↓
    Routes to: publish-spec Lambda
    ↓
Lambda (processes request)
    ↓
    Returns: { message: "Published!" }
    ↓
API Gateway (forwards response)
    ↓
Client (receives response)
```

## Key Concepts

### 1. REST API

The top-level container for your API. Think of it as your entire API service.

```terraform
resource "aws_api_gateway_rest_api" "spectrl" {
  name = "spectrl-api-dev"
}
```

This creates an API with a URL like:

```
https://abc123.execute-api.eu-north-1.amazonaws.com
```

### 2. Resources

Resources are URL paths in your API. They form a tree structure.

```
Root (/)
├── /auth
│   └── /exchange
├── /publish
├── /search
└── /specs
    └── /{username}
        └── /{specName}
            └── /{version}
```

**Path Parameters:**

- `{username}` - Variable part of the URL
- `{specName}` - Another variable
- `{version}` - Yet another variable

Example: `/specs/pasha/my-spec/1.0.0`

- username = "pasha"
- specName = "my-spec"
- version = "1.0.0"

### 3. Methods

HTTP verbs (GET, POST, DELETE, etc.) on resources.

```terraform
resource "aws_api_gateway_method" "publish_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.publish.id
  http_method   = "POST"
  authorization = "NONE"  # No API Gateway auth (we handle it in Lambda)
}
```

### 4. Integration

Connects a method to a Lambda function.

```terraform
resource "aws_api_gateway_integration" "publish_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.publish.id
  http_method             = aws_api_gateway_method.publish_post.http_method
  integration_http_method = "POST"  # Always POST for Lambda
  type                    = "AWS_PROXY"  # Pass request directly to Lambda
  uri                     = var.publish_spec_invoke_arn
}
```

**AWS_PROXY Integration:**

- Passes entire HTTP request to Lambda as-is
- Lambda gets headers, body, query params, path params
- Lambda returns HTTP response directly
- No transformation needed

### 5. Lambda Permission

Allows API Gateway to invoke your Lambda.

```terraform
resource "aws_lambda_permission" "publish_spec" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.publish_spec_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}
```

Without this, API Gateway gets "Access Denied" when trying to invoke Lambda.

### 6. Deployment

Makes your API live. Think of it as "publishing" your API.

```terraform
resource "aws_api_gateway_deployment" "spectrl" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id

  # Redeploy when integrations change
  triggers = {
    redeployment = sha1(jsonencode([...]))
  }
}
```

**Important:** API Gateway doesn't automatically deploy changes. You must create a new deployment whenever you modify routes, methods, or integrations.

### 7. Stage

An environment for your deployment (prod, dev, staging).

```terraform
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.spectrl.id
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  stage_name    = "prod"
}
```

The stage name becomes part of the URL:

```
https://abc123.execute-api.eu-north-1.amazonaws.com/prod/publish
                                                    ^^^^
                                                    stage
```

## CORS (Cross-Origin Resource Sharing)

### What is CORS?

Browsers block requests from one domain to another for security. For example:

- Your website: `https://spectrl.dev`
- Your API: `https://abc123.execute-api.amazonaws.com`

Without CORS, the browser blocks the request because they're different domains.

### How CORS Works

1. **Preflight Request (OPTIONS):**
   Browser sends OPTIONS request first to ask "Can I make this request?"

2. **CORS Headers:**
   Server responds with headers saying "Yes, you can!"

   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, DELETE
   Access-Control-Allow-Headers: Authorization, Content-Type
   ```

3. **Actual Request:**
   Browser makes the real request (GET, POST, etc.)

### Our CORS Implementation

For each endpoint, we add:

1. **OPTIONS Method:**

   ```terraform
   resource "aws_api_gateway_method" "publish_options" {
     http_method   = "OPTIONS"
     authorization = "NONE"
   }
   ```

2. **Mock Integration:**
   Returns 200 immediately without calling Lambda

   ```terraform
   resource "aws_api_gateway_integration" "publish_options" {
     type = "MOCK"
     request_templates = {
       "application/json" = "{\"statusCode\": 200}"
     }
   }
   ```

3. **CORS Headers:**
   ```terraform
   response_parameters = {
     "method.response.header.Access-Control-Allow-Origin"  = "'*'"
     "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
     "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
   }
   ```

**Why `'*'` in quotes?**
Terraform requires double quotes for strings, and the value itself needs single quotes for API Gateway. So: `"'*'"`

## Rate Limiting

Prevents abuse by limiting requests per IP address.

```terraform
resource "aws_api_gateway_method_settings" "all" {
  method_path = "*/*"  # Apply to all methods

  settings {
    throttling_rate_limit  = 100  # 100 requests per second
    throttling_burst_limit = 200  # Allow bursts up to 200
  }
}
```

**How it works:**

- Tracks requests per IP address
- Returns 429 (Too Many Requests) when limit exceeded
- Resets every second

## Our API Structure

```
POST   /auth/exchange                           → auth-exchange Lambda
POST   /publish                                 → publish-spec Lambda
GET    /search?q=query                          → search-specs Lambda
GET    /specs/{username}/{specName}             → get-spec Lambda
DELETE /specs/{username}/{specName}/{version}   → unpublish-spec Lambda
```

## Request Flow Example

Let's trace a publish request:

1. **Client makes request:**

   ```bash
   curl -X POST https://abc123.execute-api.eu-north-1.amazonaws.com/prod/publish \
     -H "Authorization: Bearer github_token" \
     -H "Content-Type: application/json" \
     -d '{"manifest": {...}, "files": {...}}'
   ```

2. **API Gateway receives request:**
   - Checks rate limit (under 100/sec? ✓)
   - Matches route: `/publish` with method `POST`
   - Finds integration: `publish-spec Lambda`

3. **API Gateway invokes Lambda:**

   ```json
   {
     "httpMethod": "POST",
     "path": "/publish",
     "headers": {
       "Authorization": "Bearer github_token",
       "Content-Type": "application/json"
     },
     "body": "{\"manifest\": {...}, \"files\": {...}}"
   }
   ```

4. **Lambda processes request:**
   - Validates token
   - Validates manifest
   - Uploads to S3
   - Stores in DynamoDB
   - Returns response

5. **Lambda returns response:**

   ```json
   {
     "statusCode": 200,
     "headers": {
       "Content-Type": "application/json"
     },
     "body": "{\"message\": \"Published pasha/my-spec@1.0.0\"}"
   }
   ```

6. **API Gateway forwards to client:**

   ```
   HTTP/1.1 200 OK
   Content-Type: application/json

   {"message": "Published pasha/my-spec@1.0.0"}
   ```

## Testing the API

After deployment, you'll get a URL like:

```
https://abc123.execute-api.eu-north-1.amazonaws.com/prod
```

### Test with curl:

**Search specs:**

```bash
curl https://abc123.execute-api.eu-north-1.amazonaws.com/prod/search?q=test
```

**Get spec:**

```bash
curl https://abc123.execute-api.eu-north-1.amazonaws.com/prod/specs/pasha/my-spec
```

**Publish spec:**

```bash
curl -X POST https://abc123.execute-api.eu-north-1.amazonaws.com/prod/publish \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d @publish-request.json
```

**Unpublish spec:**

```bash
curl -X DELETE https://abc123.execute-api.eu-north-1.amazonaws.com/prod/specs/pasha/my-spec/1.0.0 \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN"
```

## Common Issues

### 1. "Missing Authentication Token"

**Error:**

```json
{ "message": "Missing Authentication Token" }
```

**Cause:** Wrong URL or path

**Fix:** Check the URL matches your API structure exactly

### 2. "Internal Server Error"

**Error:**

```json
{ "message": "Internal server error" }
```

**Cause:** Lambda error or permission issue

**Fix:** Check CloudWatch Logs for Lambda errors

### 3. CORS Error in Browser

**Error:**

```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Cause:** Missing CORS headers or OPTIONS method

**Fix:** Ensure OPTIONS method exists and returns correct headers

### 4. 429 Too Many Requests

**Error:**

```json
{ "message": "Too Many Requests" }
```

**Cause:** Rate limit exceeded

**Fix:** Wait a second and retry, or increase rate limit

## Monitoring

### CloudWatch Logs

API Gateway logs requests to CloudWatch:

- Request/response details
- Latency
- Integration latency
- Errors

### Metrics

Available in CloudWatch Metrics:

- `Count` - Number of requests
- `4XXError` - Client errors
- `5XXError` - Server errors
- `Latency` - Response time
- `IntegrationLatency` - Lambda execution time

## Cost

API Gateway pricing (as of 2024):

- First 333 million requests: $3.50 per million
- Next 667 million requests: $2.80 per million
- Over 1 billion requests: $2.38 per million

**Example:**

- 1,000 requests/day = 30,000/month = $0.11/month
- 10,000 requests/day = 300,000/month = $1.05/month
- 100,000 requests/day = 3,000,000/month = $10.50/month

Very cheap for MVP!

## Best Practices

1. **Use AWS_PROXY integration** - Simplest, most flexible
2. **Enable CloudWatch logging** - Essential for debugging
3. **Set reasonable rate limits** - Prevent abuse
4. **Use stages for environments** - prod, dev, staging
5. **Version your API** - Use `/v1/`, `/v2/` prefixes if needed
6. **Monitor metrics** - Watch for errors and latency
7. **Enable CORS properly** - Don't forget OPTIONS methods

## Next Steps

After deploying:

1. Get the API URL from Terraform outputs
2. Test each endpoint with curl
3. Check CloudWatch Logs for any errors
4. Update CLI to use the API URL
5. Test end-to-end workflows
