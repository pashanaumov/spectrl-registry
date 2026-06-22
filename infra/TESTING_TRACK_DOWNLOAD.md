# Testing track-download Infrastructure

This document describes how to test the track-download Lambda infrastructure deployment.

## Prerequisites

- LocalStack running for dev environment
- Lambda code built: `cd api && pnpm build`
- tflocal installed for dev environment
- terraform installed for prod environment

## Development Environment Testing

### 1. Initialize Terraform

```bash
cd infra/environments/dev
tflocal init
```

### 2. Validate Configuration

```bash
tflocal validate
```

Expected output: `Success! The configuration is valid.`

### 3. Plan Deployment

```bash
tflocal plan
```

This will show:

- New track-download Lambda function
- New track-download IAM role and policy
- New /track-download API Gateway route
- New CORS configuration for /track-download
- Updated API Gateway deployment

### 4. Apply Infrastructure

```bash
tflocal apply
```

Review the plan and type `yes` to confirm.

### 5. Verify Lambda Function

```bash
awslocal lambda list-functions | grep track-download
```

Expected output should include `spectrl-track-download-dev`.

### 6. Verify API Gateway Route

```bash
awslocal apigateway get-resources --rest-api-id <api-id>
```

Look for `/track-download` in the path.

### 7. Test Lambda Invocation

```bash
awslocal lambda invoke \
  --function-name spectrl-track-download-dev \
  --payload '{"body": "{\"username\":\"test\",\"specName\":\"test-spec\",\"version\":\"1.0.0\"}"}' \
  response.json
cat response.json
```

### 8. Test API Gateway Endpoint

Get the API Gateway URL:

```bash
cd infra/environments/dev
tflocal output api_gateway_url
```

Test the endpoint:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"username":"test","specName":"test-spec","version":"1.0.0"}' \
  <api-gateway-url>/track-download
```

### 9. Verify CloudWatch Logs

```bash
awslocal logs tail /aws/lambda/spectrl-track-download-dev --follow
```

### 10. Verify IAM Permissions

Check that the Lambda has DynamoDB UpdateItem permissions:

```bash
awslocal iam get-role-policy \
  --role-name spectrl-track-download-dev \
  --policy-name spectrl-track-download-policy-dev
```

Expected permissions:

- `dynamodb:UpdateItem` on specs table
- `secretsmanager:GetSecretValue` on GitHub OAuth secret
- CloudWatch Logs permissions

## Production Environment Testing

### 1. Initialize Terraform

```bash
cd infra/environments/prod
terraform init
```

### 2. Validate Configuration

```bash
terraform validate
```

### 3. Plan Deployment

```bash
terraform plan
```

Review the plan carefully before applying to production.

### 4. Apply Infrastructure

```bash
terraform apply
```

**Warning**: This deploys to production AWS. Review carefully.

### 5. Verify Deployment

```bash
aws lambda list-functions --region eu-north-1 | grep track-download
```

### 6. Test with Integration Script

```bash
cd infra
./scripts/test-infrastructure.sh prod
```

This will test S3, DynamoDB, and Secrets Manager connectivity.

## Rate Limiting Verification

The API Gateway is configured with rate limiting:

- 100 requests per minute per IP
- 200 burst limit

To verify:

```bash
# For dev
awslocal apigateway get-stage \
  --rest-api-id <api-id> \
  --stage-name prod

# For prod
aws apigateway get-stage \
  --rest-api-id <api-id> \
  --stage-name prod \
  --region eu-north-1
```

Look for `throttlingRateLimit: 100` and `throttlingBurstLimit: 200`.

## CORS Verification

Test CORS preflight:

```bash
curl -X OPTIONS \
  -H "Origin: https://spectrl.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  <api-gateway-url>/track-download -v
```

Expected headers in response:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type,Authorization`

## Troubleshooting

### Lambda not found

```bash
# Check if Lambda was created
awslocal lambda list-functions | grep track-download

# Check Terraform state
tflocal state list | grep track_download
```

### API Gateway route not accessible

```bash
# Get API Gateway ID
tflocal output api_gateway_id

# List all resources
awslocal apigateway get-resources --rest-api-id <api-id>
```

### Permission errors

```bash
# Check IAM role policy
awslocal iam get-role-policy \
  --role-name spectrl-track-download-dev \
  --policy-name spectrl-track-download-policy-dev
```

### CloudWatch logs not appearing

```bash
# Check log group exists
awslocal logs describe-log-groups | grep track-download

# Create log group manually if needed
awslocal logs create-log-group \
  --log-group-name /aws/lambda/spectrl-track-download-dev
```

## Cleanup

To destroy the infrastructure:

```bash
# Dev
cd infra/environments/dev
tflocal destroy

# Prod (use with caution!)
cd infra/environments/prod
terraform destroy
```

## Next Steps

After infrastructure is deployed:

1. Implement the Lambda function code (Task 2)
2. Integrate with CLI (Task 3)
3. Run end-to-end tests
