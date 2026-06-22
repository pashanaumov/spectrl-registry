# Spectrl Infrastructure

AWS infrastructure for the Spectrl public registry using Terraform.

## Architecture

```
┌─────────────┐
│  CloudFront │  CDN for global delivery
└──────┬──────┘
       │
┌──────▼──────┐
│  S3 Bucket  │  Spec file storage
└─────────────┘

┌─────────────┐
│  DynamoDB   │  Metadata storage
│  - specs    │  Spec versions & info
│  - users    │  GitHub user data
└─────────────┘

┌─────────────┐
│  Secrets    │  GitHub OAuth credentials
│  Manager    │
└─────────────┘
```

## Quick Start

### Prerequisites

- AWS CLI configured
- Terraform installed
- For dev: LocalStack running

### Deploy Production

```bash
cd environments/prod
terraform init
terraform apply
```

### Deploy Development (LocalStack)

```bash
cd environments/dev
tflocal init
tflocal apply
```

### Run Tests

```bash
cd infra
./test-infrastructure.sh prod  # or 'dev'
```

## Structure

```
infra/
├── modules/              # Reusable Terraform modules
│   ├── storage/         # S3 + CloudFront (prod)
│   ├── storage-dev/     # S3 only (LocalStack)
│   ├── database/        # DynamoDB tables
│   ├── secrets/         # Secrets Manager
│   └── terraform-state/ # State backend
├── environments/
│   ├── dev/            # LocalStack environment
│   └── prod/           # AWS production
└── test-infrastructure.sh  # Integration tests
```

## Modules

### Storage (S3 + CloudFront)

- **S3 bucket**: Stores spec files at `specs/{username}/{spec-name}/{version}/`
- **CloudFront**: Global CDN with HTTPS
- **Versioning**: Enabled for safety
- **Encryption**: AES-256

### Database (DynamoDB)

- **specs table**: Spec metadata with GSIs for user queries and recent specs
- **users table**: GitHub user data with username lookup
- **Billing**: On-demand (pay per request)

### Secrets

- **GitHub OAuth**: Client ID and secret for authentication
- **Lifecycle**: Ignores changes after initial creation (update manually)

### Terraform State

- **S3 backend**: State stored in `spectrl-terraform-state-{env}`
- **DynamoDB locking**: Prevents concurrent modifications
- **Encryption**: Enabled

## Common Tasks

### Update Secret

```bash
aws secretsmanager update-secret \
  --secret-id spectrl/github-oauth-prod \
  --secret-string '{"clientId":"...","clientSecret":"..."}'
```

### Query Specs by User

```bash
aws dynamodb query \
  --table-name spectrl-specs-prod \
  --index-name username-createdAt-index \
  --key-condition-expression "username = :user" \
  --expression-attribute-values '{":user":{"S":"alice"}}'
```

### Upload Spec File

```bash
aws s3 cp spec.json s3://spectrl-registry-prod/specs/alice/my-spec/1.0.0/
```

## Costs

Estimated monthly costs (low traffic):

- S3: ~$0.25
- CloudFront: ~$1
- DynamoDB: ~$1-5
- Secrets Manager: $0.40
- **Total: ~$3-7/month**

## Troubleshooting

### State lock error

```bash
# Remove stuck lock
aws dynamodb delete-item \
  --table-name spectrl-terraform-locks-prod \
  --key '{"LockID":{"S":"spectrl-terraform-state-prod/terraform.tfstate"}}'
```

### LocalStack not persisting

```bash
# Restart with fresh data
docker-compose -f environments/dev/docker-compose.yml down -v
docker-compose -f environments/dev/docker-compose.yml up -d
```

### Terraform backend changed

```bash
terraform init -reconfigure
```

## Documentation

- [State Backend Setup](STATE_BACKEND_SETUP.md) - Detailed S3 backend migration guide
- [Integration Tests](TEST_INFRASTRUCTURE.md) - Testing documentation

## Destroy Infrastructure

**Warning**: This deletes everything!

```bash
cd environments/prod
terraform destroy
```

For state backend:

```bash
cd environments/prod/state-backend
terraform destroy
```
