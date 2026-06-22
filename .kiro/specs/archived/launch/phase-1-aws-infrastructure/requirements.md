# Phase 1: AWS Infrastructure - Requirements

## Overview

Set up the foundational AWS infrastructure needed for Spectrl's public registry using Terraform (Infrastructure as Code).

## Goals

1. Provision all AWS resources needed for the public registry
2. Use Terraform for reproducible, version-controlled infrastructure
3. Ensure resources are properly configured for production use
4. Validate that infrastructure works end-to-end

## Functional Requirements

### FR-1: Storage Infrastructure

- S3 bucket must store spec files with public read access
- CloudFront CDN must serve files globally with low latency
- Files must be accessible via `https://registry.spectrl.dev/specs/{username}/{spec-name}/{version}/...`
- Bucket must support versioning for safety

### FR-2: Database Infrastructure

- DynamoDB table for spec metadata (name, version, description, downloads, etc.)
- DynamoDB table for user data (GitHub ID, username, email)
- Tables must support efficient queries for search and retrieval
- On-demand billing to minimize costs

### FR-3: Secrets Management

- GitHub OAuth credentials stored securely in AWS Secrets Manager
- Lambda functions can read secrets with proper IAM permissions

### FR-4: Infrastructure as Code

- All resources defined in Terraform
- Terraform state managed safely (not lost if laptop dies)
- Easy to tear down and recreate infrastructure
- Clear documentation of what each resource does

## Non-Functional Requirements

### NFR-1: Security

- S3 bucket blocks public write access (only read)
- IAM roles follow least-privilege principle
- Secrets never exposed in code or logs

### NFR-2: Cost Efficiency

- Use on-demand billing where possible
- No unnecessary resources running
- CloudFront caching reduces S3 requests

### NFR-3: Reliability

- S3 versioning prevents accidental data loss
- DynamoDB provides automatic backups
- Infrastructure can be recreated from Terraform code

## Acceptance Criteria

### AC-1: Terraform Setup

- [ ] Terraform installed and working
- [ ] AWS account created and CLI configured
- [ ] Terraform project structure created
- [ ] Can run `terraform plan` without errors

### AC-2: Storage Layer

- [ ] S3 bucket created and accessible
- [ ] CloudFront distribution serving from S3
- [ ] Can upload a test file and download it via CloudFront
- [ ] HTTPS works (SSL certificate configured)

### AC-3: Database Layer

- [ ] `spectrl-specs` DynamoDB table created with correct schema
- [ ] `spectrl-users` DynamoDB table created with correct schema
- [ ] Can write and read test data from both tables
- [ ] GSIs (Global Secondary Indexes) configured for search

### AC-4: Secrets Management

- [ ] Secrets Manager resource created
- [ ] GitHub OAuth credentials stored (placeholder values OK for now)
- [ ] IAM policy allows Lambda to read secrets

### AC-5: Documentation

- [ ] README explains what each Terraform resource does
- [ ] Clear instructions for applying infrastructure
- [ ] Instructions for tearing down infrastructure

## Out of Scope

- Domain purchase and DNS configuration (deferred)
- Lambda functions (Phase 2)
- API Gateway (Phase 2)
- Monitoring and alerting (Phase 6)
