# Spectrl Infrastructure Architecture

## Overview

Spectrl uses AWS services for a serverless, scalable registry infrastructure.

## Components

### 1. Storage Layer (S3 + CloudFront)

**Purpose**: Store and serve spec files globally

```
User Request
     │
     ▼
CloudFront (CDN)
     │
     ▼
S3 Bucket
  specs/
    {username}/
      {spec-name}/
        {version}/
          spectrl.json
          files/...
```

**Key Features**:

- Global CDN for low latency
- HTTPS by default
- Versioning enabled
- Public read, private write

### 2. Metadata Layer (DynamoDB)

**Purpose**: Store searchable spec and user metadata

#### Specs Table

```
Primary Key: specId + version
GSI-1: username + createdAt  → "Show all specs by user X"
GSI-2: allSpecs + createdAt  → "Show recently published specs"
```

**Attributes**:

- specId, version, username, description
- createdAt, downloads, s3Path, hash
- agentPurpose, agentTags

#### Users Table

```
Primary Key: githubId
GSI-1: username  → "Lookup user by username"
```

**Attributes**:

- githubId, username, email
- createdAt, lastLogin

### 3. Secrets Layer (Secrets Manager)

**Purpose**: Securely store GitHub OAuth credentials

```
Secret: spectrl/github-oauth
{
  "clientId": "...",
  "clientSecret": "..."
}
```

### 4. State Management (S3 + DynamoDB)

**Purpose**: Store Terraform state safely

```
S3 Bucket: spectrl-terraform-state-{env}
  └── terraform.tfstate (versioned, encrypted)

DynamoDB Table: spectrl-terraform-locks-{env}
  └── Prevents concurrent Terraform runs
```

## Data Flow

### Publishing a Spec

```
1. User authenticates via GitHub OAuth
   └→ Secrets Manager provides credentials

2. API validates user
   └→ DynamoDB users table lookup

3. API uploads files to S3
   └→ S3 bucket stores at specs/{user}/{name}/{version}/

4. API writes metadata to DynamoDB
   └→ specs table stores searchable info

5. CloudFront cache invalidated (if needed)
```

### Downloading a Spec

```
1. User requests spec file
   └→ CloudFront checks cache

2. If cache miss:
   └→ CloudFront fetches from S3
   └→ CloudFront caches for future requests

3. File served to user (HTTPS)
```

### Searching Specs

```
1. User searches for specs
   └→ API queries DynamoDB

2. Query uses GSI based on search type:
   - By user: username-createdAt-index
   - Recent: all-createdAt-index

3. Results returned with metadata
```

## Security

### Network

- All traffic over HTTPS
- CloudFront provides DDoS protection
- S3 bucket blocks public write

### Authentication

- GitHub OAuth for user identity
- Secrets Manager for credential storage
- IAM roles for service access (Phase 2)

### Data

- S3 encryption at rest (AES-256)
- Secrets Manager encryption
- DynamoDB encryption (default)

## Scalability

### Storage

- S3: Unlimited storage
- CloudFront: Global edge locations
- Auto-scales with demand

### Database

- DynamoDB: On-demand billing
- Auto-scales read/write capacity
- GSIs enable efficient queries

### Cost

- Pay only for what you use
- No servers to manage
- Estimated: $3-7/month for low traffic

## Environments

### Development (LocalStack)

- Runs locally in Docker
- Same infrastructure as prod
- Fast iteration, no AWS costs
- Data ephemeral (resets on restart)

### Production (AWS)

- Real AWS services
- State stored in S3
- Persistent data
- Global availability

## Future Enhancements (Phase 2+)

- Lambda functions for API logic
- API Gateway for HTTP endpoints
- Custom domain with Route 53
- CloudWatch monitoring and alerts
- WAF for additional security
