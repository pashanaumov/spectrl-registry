# Phase 1: AWS Infrastructure - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS
                 ▼
         ┌───────────────┐
         │  CloudFront   │  (CDN - Global edge locations)
         │  Distribution │
         └───────┬───────┘
                 │
                 │ Origin fetch
                 ▼
         ┌───────────────┐
         │   S3 Bucket   │  (Object storage)
         │ spectrl-specs │
         └───────────────┘

         Storage: specs/{username}/{spec-name}/{version}/
                  ├── spectrl.json
                  └── files/
                      ├── README.md
                      └── ...

┌─────────────────────────────────────────────────────────────┐
│                      Metadata Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │    DynamoDB      │         │    DynamoDB      │          │
│  │  spectrl-specs   │         │  spectrl-users   │          │
│  │                  │         │                  │          │
│  │  PK: specId      │         │  PK: githubId    │          │
│  │  SK: version     │         │                  │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Secrets Layer                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────┐               │
│  │         AWS Secrets Manager              │               │
│  │                                          │               │
│  │  spectrl/github-oauth                   │               │
│  │  {                                       │               │
│  │    "clientId": "...",                    │               │
│  │    "clientSecret": "..."                 │               │
│  │  }                                       │               │
│  └──────────────────────────────────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. S3 Bucket (Storage)

**Purpose:** Store all spec files (manifests + content files)

**Configuration:**

- **Name:** `spectrl-registry-prod` (must be globally unique)
- **Region:** `us-east-1` (required for CloudFront integration)
- **Versioning:** Enabled (safety net for accidental deletes)
- **Encryption:** AES-256 (AWS managed keys)
- **Public Access:** Block public write, allow public read for `/specs/*` path

**Directory Structure:**

```
specs/
  {username}/
    {spec-name}/
      {version}/
        spectrl.json          # Manifest
        files/
          README.md           # Spec files
          docs/
            architecture.md
```

**Why S3?**

- Cheap storage ($0.023/GB/month)
- Highly durable (99.999999999% durability)
- Integrates seamlessly with CloudFront
- Versioning provides safety net

### 2. CloudFront Distribution (CDN)

**Purpose:** Serve spec files globally with low latency and HTTPS

**Configuration:**

- **Origin:** S3 bucket
- **Cache Behavior:** Cache everything (specs are immutable once published)
- **Viewer Protocol:** Redirect HTTP → HTTPS
- **Price Class:** All edge locations (global distribution)
- **SSL Certificate:** AWS Certificate Manager (ACM) - free

**Why CloudFront?**

- Fast global access (edge locations worldwide)
- Free SSL certificates
- Reduces S3 costs (caching reduces requests)
- Required for custom domain with HTTPS

**Note:** Domain configuration deferred, will use CloudFront default domain for now

### 3. DynamoDB Tables (Metadata)

#### Table 1: `spectrl-specs`

**Purpose:** Store spec metadata for search and discovery

**Schema:**

```
Partition Key: specId (String)     # Format: "username/spec-name"
Sort Key: version (String)         # Format: "1.0.0"

Attributes:
- specId (PK)
- version (SK)
- username (String)
- specName (String)
- description (String)
- agentPurpose (String)            # From manifest.agent.purpose
- agentTags (List<String>)         # From manifest.agent.tags
- createdAt (String)               # ISO timestamp
- downloads (Number)
- s3Path (String)                  # Path in S3 bucket
- hash (String)                    # Content hash (sha256:...)

Global Secondary Index 1 (GSI-1):
- PK: username
- SK: createdAt
- Purpose: Query all specs by a user

Global Secondary Index 2 (GSI-2):
- PK: "ALL" (literal string)
- SK: downloads
- Purpose: Query popular specs
```

**Why this schema?**

- Composite key (specId + version) allows multiple versions per spec
- GSI-1 enables "show all specs by user X"
- GSI-2 enables "show most popular specs"
- On-demand billing = pay only for what you use

#### Table 2: `spectrl-users`

**Purpose:** Store user data from GitHub OAuth

**Schema:**

```
Partition Key: githubId (Number)   # GitHub user ID

Attributes:
- githubId (PK)
- username (String)                # GitHub username
- email (String)
- createdAt (String)
- lastLogin (String)

Global Secondary Index 1 (GSI-1):
- PK: username
- Purpose: Lookup user by username
```

**Why this schema?**

- GitHub ID is stable (username can change)
- GSI allows username lookups for namespace validation

### 4. AWS Secrets Manager

**Purpose:** Securely store GitHub OAuth credentials

**Secret Name:** `spectrl/github-oauth`

**Secret Value:**

```json
{
  "clientId": "your_github_oauth_client_id",
  "clientSecret": "your_github_oauth_client_secret"
}
```

**Why Secrets Manager?**

- Never hardcode credentials in code
- Automatic encryption at rest
- IAM-controlled access
- Can rotate secrets without code changes

## Terraform Structure

```
infra/
  terraform/
    main.tf              # Main configuration, provider setup
    variables.tf         # Input variables (region, environment, etc.)
    outputs.tf           # Output values (bucket name, CloudFront URL, etc.)

    modules/
      storage/
        main.tf          # S3 + CloudFront resources
        variables.tf
        outputs.tf

      database/
        main.tf          # DynamoDB tables
        variables.tf
        outputs.tf

      secrets/
        main.tf          # Secrets Manager
        variables.tf
        outputs.tf

    backend.tf           # Terraform state configuration

  README.md              # Setup and usage instructions
```

**Why modules?**

- Organize related resources together
- Reusable across environments (dev/prod)
- Easier to understand and maintain

## Terraform State Management

**Problem:** Terraform needs to track what resources it created. This "state" is stored in a file. If you lose this file, Terraform can't manage your infrastructure anymore.

**Solution:** Store Terraform state in S3 with DynamoDB locking

**How it works:**

1. Create an S3 bucket: `spectrl-terraform-state`
2. Create a DynamoDB table: `spectrl-terraform-locks`
3. Configure Terraform to use these for state storage
4. State file is now safe even if laptop dies
5. DynamoDB prevents multiple people from running Terraform simultaneously

**Initial Setup:**

- First run: Use local state to create the state bucket
- Second run: Migrate state to S3
- All future runs: State in S3

## Security Considerations

### S3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::spectrl-registry-prod/specs/*"
    }
  ]
}
```

**What this does:**

- Anyone can READ files under `/specs/*` path
- No one can WRITE or DELETE (only Lambda functions with IAM roles can)
- Root bucket is not publicly accessible

### IAM Roles (for Phase 2)

- Lambda execution role with minimal permissions
- Separate roles for different Lambda functions
- No hardcoded credentials anywhere

## Cost Estimation

**Monthly costs (assuming moderate usage):**

- **S3 Storage:** 10GB × $0.023 = $0.23
- **S3 Requests:** 100K GET × $0.0004 = $0.04
- **CloudFront:** 10GB transfer × $0.085 = $0.85
- **DynamoDB:** On-demand, ~$1-5 depending on usage
- **Secrets Manager:** $0.40/secret/month = $0.40

**Total: ~$2-7/month for infrastructure**

Lambda and API Gateway costs added in Phase 2 (also very cheap for low traffic).

## Validation Plan

After Terraform applies successfully:

1. **S3 Test:**

   ```bash
   aws s3 cp test.txt s3://spectrl-registry-prod/specs/test/test.txt
   aws s3 ls s3://spectrl-registry-prod/specs/test/
   ```

2. **CloudFront Test:**

   ```bash
   curl https://{cloudfront-domain}/specs/test/test.txt
   ```

3. **DynamoDB Test:**

   ```bash
   aws dynamodb put-item --table-name spectrl-specs-prod --item '{...}'
   aws dynamodb get-item --table-name spectrl-specs-prod --key '{...}'
   ```

4. **Secrets Test:**
   ```bash
   aws secretsmanager get-secret-value --secret-id spectrl/github-oauth
   ```

## Next Steps (Phase 2)

Once infrastructure is validated:

- Create Lambda functions
- Set up API Gateway
- Connect everything together
