# Task 3: Storage Module (S3 + CloudFront)

## Date

November 19, 2024

## What Was Implemented

Successfully created and deployed the storage infrastructure for Spectrl's public registry, including both production AWS resources and local development environment.

### Production Module (`infra/modules/storage/`)

Created a full-featured storage module with:

**S3 Bucket Configuration:**

- Globally unique bucket name with random suffix
- Versioning enabled for safety
- Server-side encryption (AES-256)
- Lifecycle policy to delete old versions after 60 days
- Public access block configured to allow bucket policies
- Bucket policy allowing public read on `/specs/*` path
- CORS configuration for browser access

**CloudFront Distribution:**

- Origin Access Control (OAC) for secure S3 access
- Global CDN with PriceClass_100 (North America + Europe)
- HTTPS redirect (HTTP → HTTPS)
- Aggressive caching (24 hours default, 1 year max)
- Compression enabled
- IPv6 support
- CloudFront default SSL certificate

**Outputs:**

- `bucket_name` - S3 bucket identifier
- `cloudfront_url` - Full HTTPS URL for accessing files

### Development Module (`infra/modules/storage-dev/`)

Created a simplified LocalStack-compatible module with:

**S3 Bucket Configuration:**

- Same core features as prod (versioning, encryption, CORS)
- No CloudFront (LocalStack free tier limitation)
- No tags (LocalStack compatibility)
- Direct S3 access for testing

**Outputs:**

- `bucket_name` - S3 bucket identifier
- `bucket_endpoint` - LocalStack S3 endpoint URL

### Environment Configuration

**Production (`infra/environments/prod/`):**

- Uses full storage module with CloudFront
- Standard AWS provider configuration
- Deployed successfully to AWS

**Development (`infra/environments/dev/`):**

- Uses simplified storage-dev module
- Configured for `tflocal` (LocalStack wrapper)
- Removed manual endpoint configuration (tflocal handles it)
- Removed tags for LocalStack compatibility

## Why These Decisions

**Separate Dev Module:**
LocalStack's free tier doesn't support CloudFront, which caused Terraform to hang. Creating a separate dev module without CloudFront allows fast local testing without AWS costs while maintaining the same S3 functionality.

**Using tflocal:**
The `tflocal` wrapper automatically configures all LocalStack endpoints, eliminating the need for manual endpoint configuration and reducing errors. This is the recommended approach per LocalStack documentation.

**PriceClass_100 for CloudFront:**
Chose North America + Europe edge locations to minimize costs while still providing good coverage for the primary developer audience. Can be upgraded to PriceClass_All later if global reach is needed.

**Lifecycle Policy (60 days):**
Automatically cleans up old object versions to control storage costs while maintaining a reasonable safety window for recovery.

**Origin Access Control (OAC):**
Modern AWS best practice for CloudFront-S3 integration, replacing the older Origin Access Identity (OAI) approach.

## Requirements Addressed

- **FR-1: Storage Infrastructure** - S3 bucket with public read access ✅
- **FR-1: CloudFront CDN** - Global CDN serving files with low latency ✅
- **FR-1: Versioning** - Bucket versioning enabled for safety ✅
- **NFR-1: Security** - Public write blocked, only read allowed ✅
- **NFR-2: Cost Efficiency** - Lifecycle rules reduce storage costs ✅

## Code Changes

**Created:**

- `infra/modules/storage/main.tf` - Full storage module with S3 + CloudFront
- `infra/modules/storage/variables.tf` - Module input variables
- `infra/modules/storage/outputs.tf` - Module outputs
- `infra/modules/storage-dev/main.tf` - Simplified dev module (S3 only)
- `infra/modules/storage-dev/variables.tf` - Dev module variables
- `infra/modules/storage-dev/outputs.tf` - Dev module outputs
- `infra/environments/prod/outputs.tf` - Prod environment outputs
- `infra/environments/dev/outputs.tf` - Dev environment outputs

**Modified:**

- `infra/environments/dev/main.tf` - Configured for tflocal, uses storage-dev module
- `~/.zshrc` - Added tflocal to PATH

## Deployed Resources

**Production (AWS):**

- S3 Bucket: `spectrl-registry-prod-56ec6430`
- CloudFront Distribution: `d12j78i0x57g1k.cloudfront.net`
- CloudFront URL: `https://d12j78i0x57g1k.cloudfront.net`

**Development (LocalStack):**

- S3 Bucket: `spectrl-registry-dev-1861223d`
- Endpoint: `http://spectrl-registry-dev-1861223d.s3.localhost.localstack.cloud:4566`

## Testing Results

**Production Testing:**

```bash
# Upload test file
echo "Hello from Spectrl Registry!" > test.txt
aws s3 cp test.txt s3://spectrl-registry-prod-56ec6430/specs/test/test.txt

# Access via CloudFront
curl https://d12j78i0x57g1k.cloudfront.net/specs/test/test.txt
# Result: ✅ File accessible via HTTPS
```

**Development Testing:**

```bash
# Upload test file
echo "Hello from LocalStack!" > test.txt
aws --endpoint-url=http://localhost:4566 s3 cp test.txt s3://spectrl-registry-dev-1861223d/specs/test/test.txt

# List files
aws --endpoint-url=http://localhost:4566 s3 ls s3://spectrl-registry-dev-1861223d/specs/test/
# Result: ✅ File uploaded successfully
```

## Challenges & Solutions

**Challenge 1: LocalStack CloudFront Support**

- **Issue:** LocalStack free tier doesn't support CloudFront, causing Terraform to fail
- **Solution:** Created separate storage-dev module without CloudFront for local testing

**Challenge 2: Terraform + LocalStack Flakiness**

- **Issue:** Manual endpoint configuration was incomplete, causing timeouts
- **Solution:** Used `tflocal` wrapper which automatically configures all endpoints

**Challenge 3: LocalStack Tag Support**

- **Issue:** LocalStack doesn't fully support S3 bucket tags, causing errors
- **Solution:** Removed tags from dev module for LocalStack compatibility

**Challenge 4: tflocal Not in PATH**

- **Issue:** Had to use full path `/Users/pasha/Library/Python/3.9/bin/tflocal`
- **Solution:** Added Python bin directory to PATH in `~/.zshrc`

## Cost Estimation

**Monthly AWS Costs (Production):**

- S3 Storage: ~$0.23 (10GB)
- S3 Requests: ~$0.04 (100K GET)
- CloudFront: ~$0.85 (10GB transfer)
- **Total: ~$1.12/month** (minimal usage)

**Development Costs:**

- LocalStack: Free (using free tier)
- No AWS costs for local development

## Next Steps

**Immediate:**

- Task 4: Database Module (DynamoDB tables)
- Task 5: Secrets Module (GitHub OAuth credentials)

**Future Improvements:**

- Add custom domain and SSL certificate (deferred)
- Consider upgrading to PriceClass_All if global reach needed
- Add CloudWatch metrics and alarms (Phase 6)

## Commands Reference

**Production:**

```bash
cd infra/environments/prod
terraform init
terraform plan
terraform apply
```

**Development:**

```bash
cd infra/environments/dev
docker-compose up -d  # Start LocalStack
tflocal init
tflocal plan
tflocal apply
```

**Testing:**

```bash
# Upload to prod
aws s3 cp file.txt s3://spectrl-registry-prod-56ec6430/specs/test/file.txt

# Upload to dev
aws --endpoint-url=http://localhost:4566 s3 cp file.txt s3://spectrl-registry-dev-1861223d/specs/test/file.txt
```
