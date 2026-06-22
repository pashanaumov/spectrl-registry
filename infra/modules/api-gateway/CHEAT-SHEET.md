# API Gateway Cheat Sheet

## Core Concepts (5 Building Blocks)

### 1. REST API

**What:** The container for your entire API  
**Creates:** Base URL like `https://abc123.execute-api.eu-north-1.amazonaws.com`

```terraform
resource "aws_api_gateway_rest_api" "spectrl" {
  name = "spectrl-api"
}
```

---

### 2. Resource

**What:** A URL path segment  
**Creates:** `/auth`, `/publish`, `/specs`, etc.

```terraform
# Creates /auth
resource "aws_api_gateway_resource" "auth" {
  parent_id = aws_api_gateway_rest_api.spectrl.root_resource_id  # Parent is /
  path_part = "auth"
}

# Creates /auth/exchange
resource "aws_api_gateway_resource" "auth_exchange" {
  parent_id = aws_api_gateway_resource.auth.id  # Parent is /auth
  path_part = "exchange"
}
```

**Key Point:** Resources form a tree. Each path segment needs its own resource.

---

### 3. Method

**What:** HTTP verb (GET, POST, DELETE) on a resource  
**Creates:** `POST /auth/exchange`, `GET /search`, etc.

```terraform
resource "aws_api_gateway_method" "auth_exchange_post" {
  resource_id = aws_api_gateway_resource.auth_exchange.id  # Which path
  http_method = "POST"                                      # Which verb
}
```

---

### 4. Integration

**What:** Connects a method to a Lambda function  
**Creates:** The actual routing logic

```terraform
resource "aws_api_gateway_integration" "auth_exchange_post" {
  resource_id             = aws_api_gateway_resource.auth_exchange.id
  http_method             = aws_api_gateway_method.auth_exchange_post.http_method
  type                    = "AWS_PROXY"  # Pass request directly to Lambda
  integration_http_method = "POST"       # Always POST for Lambda
  uri                     = var.auth_exchange_invoke_arn  # Which Lambda
}
```

**Key Point:** `AWS_PROXY` means "pass everything to Lambda as-is"

---

### 5. Deployment + Stage

**What:** Makes your API live at a URL  
**Creates:** `https://abc123.../prod/...`

```terraform
resource "aws_api_gateway_deployment" "spectrl" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.spectrl.id
  stage_name    = "prod"  # Becomes part of URL
}
```

---

## Quick Reference: Building an Endpoint

To create `POST /auth/exchange → Lambda`:

```terraform
# 1. Create /auth path
resource "aws_api_gateway_resource" "auth" {
  parent_id = root
  path_part = "auth"
}

# 2. Create /exchange path under /auth
resource "aws_api_gateway_resource" "auth_exchange" {
  parent_id = aws_api_gateway_resource.auth.id
  path_part = "exchange"
}

# 3. Add POST method
resource "aws_api_gateway_method" "auth_exchange_post" {
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = "POST"
}

# 4. Connect to Lambda
resource "aws_api_gateway_integration" "auth_exchange_post" {
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = "POST"
  type        = "AWS_PROXY"
  uri         = var.lambda_invoke_arn
}

# 5. Allow API Gateway to invoke Lambda
resource "aws_lambda_permission" "auth_exchange" {
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
}
```

---

## CORS (for browsers)

Add OPTIONS method that returns CORS headers:

```terraform
# OPTIONS method
resource "aws_api_gateway_method" "auth_exchange_options" {
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = "OPTIONS"
}

# Mock integration (returns immediately, no Lambda)
resource "aws_api_gateway_integration" "auth_exchange_options" {
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = "OPTIONS"
  type        = "MOCK"
}

# Response with CORS headers
resource "aws_api_gateway_integration_response" "auth_exchange_options" {
  http_method = "OPTIONS"
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
  }
}
```

---

## Path Parameters

For `/specs/{username}/{specName}`:

```terraform
# /specs
resource "aws_api_gateway_resource" "specs" {
  parent_id = root
  path_part = "specs"
}

# /{username}
resource "aws_api_gateway_resource" "specs_username" {
  parent_id = aws_api_gateway_resource.specs.id
  path_part = "{username}"  # Curly braces = variable
}

# /{specName}
resource "aws_api_gateway_resource" "specs_username_specname" {
  parent_id = aws_api_gateway_resource.specs_username.id
  path_part = "{specName}"
}
```

Lambda receives: `event.pathParameters.username` and `event.pathParameters.specName`

---

## Common Patterns

### Single-level path: `/publish`

```
1 Resource + 1 Method + 1 Integration
```

### Two-level path: `/auth/exchange`

```
2 Resources + 1 Method + 1 Integration
```

### With path params: `/specs/{username}/{specName}`

```
3 Resources + 1 Method + 1 Integration
```

### With CORS:

```
Add: 1 OPTIONS Method + 1 MOCK Integration + Response configs
```

---

## Mental Model

Think of it like a file system:

```
API Gateway
├── /auth (folder)
│   └── /exchange (folder)
│       ├── POST (file) → Lambda
│       └── OPTIONS (file) → CORS
├── /publish (folder)
│   ├── POST (file) → Lambda
│   └── OPTIONS (file) → CORS
└── /specs (folder)
    └── /{username} (folder)
        └── /{specName} (folder)
            ├── GET (file) → Lambda
            └── OPTIONS (file) → CORS
```

- **Folders** = Resources (paths)
- **Files** = Methods (HTTP verbs)
- **File contents** = Integrations (what happens)

---

## Key Takeaways

1. **Resources** = URL paths (can be nested)
2. **Methods** = HTTP verbs on those paths
3. **Integrations** = What happens when method is called
4. **AWS_PROXY** = Pass everything to Lambda
5. **OPTIONS + MOCK** = CORS for browsers
6. **Deployment + Stage** = Make it live

---

## Our API Structure

```
POST   /auth/exchange                           (2 resources, 1 method)
POST   /publish                                 (1 resource, 1 method)
GET    /search                                  (1 resource, 1 method)
GET    /specs/{username}/{specName}             (3 resources, 1 method)
DELETE /specs/{username}/{specName}/{version}   (4 resources, 1 method)
```

Each endpoint also has OPTIONS for CORS = 2x the resources!

---

## Testing

After deployment:

```bash
# Get URL
terraform output api_endpoint

# Test
curl https://abc123.../prod/search?q=test
curl https://abc123.../prod/specs/pasha/my-spec
```

---

## Troubleshooting

| Error                          | Cause              | Fix                         |
| ------------------------------ | ------------------ | --------------------------- |
| "Missing Authentication Token" | Wrong URL          | Check path matches exactly  |
| "Internal Server Error"        | Lambda error       | Check CloudWatch Logs       |
| CORS error in browser          | Missing OPTIONS    | Add OPTIONS method          |
| "Access Denied"                | Missing permission | Add `aws_lambda_permission` |

---

## Cost

~$3.50 per million requests. Very cheap!

Example: 10,000 requests/day = $1.05/month
