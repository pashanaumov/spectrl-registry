# Phase 1: AWS Infrastructure - Tasks

## Task 1: Prerequisites Setup

**Goal:** Get AWS account and Terraform ready

### Subtasks:

- [x] Create AWS account at https://aws.amazon.com
- [x] Set up billing alerts (to avoid surprise charges)
- [x] Create IAM user for Terraform with admin access
- [x] Install AWS CLI: `brew install awscli` (macOS)
- [x] Configure AWS CLI: `aws configure` (enter access key, secret, region)
- [x] Install Terraform: `brew install terraform`
- [x] Verify installations: `aws sts get-caller-identity` and `terraform --version`

**Acceptance Criteria:**

- [x] AWS account created and accessible
- [x] AWS CLI configured with credentials
- [x] Terraform installed and working
- [x] Can run AWS CLI commands successfully

---

## Task 2: Terraform Project Structure

**Goal:** Create organized Terraform project with modules

### Subtasks:

- [x] Create directory structure: `infra/terraform/` with modules
- [x] Create `main.tf` with AWS provider configuration
- [x] Create `variables.tf` with input variables (region, project name, etc.)
- [x] Create `outputs.tf` for resource outputs
- [x] Create `backend.tf` for state configuration (local for now)
- [x] Create module directories: `storage/`, `database/`, `secrets/`
- [x] Create `infra/terraform/README.md` with setup instructions

**Acceptance Criteria:**

- [x] Directory structure matches design
- [x] Can run `terraform init` successfully
- [x] Provider configured for `eu-north-1` region
- [x] README documents the structure

---

## Task 3: Storage Module (S3 + CloudFront)

**Goal:** Create S3 bucket and CloudFront distribution for spec files

### Subtasks:

- [x] Create `modules/storage/main.tf`
- [x] Define S3 bucket resource with:
  - Unique name (e.g., `spectrl-registry-prod-{random-suffix}`)
  - Versioning enabled
  - Server-side encryption (AES-256)
  - Block public ACLs but allow public read via bucket policy
- [x] Create bucket policy for public read on `/specs/*` path
- [x] Configure CORS rules for browser access
- [x] Create CloudFront distribution:
  - Origin: S3 bucket
  - Cache behavior: cache everything
  - Viewer protocol: redirect HTTP to HTTPS
  - Price class: all edge locations
- [x] Create outputs: bucket name, CloudFront domain
- [x] Test: Upload file to S3, access via CloudFront URL

**Acceptance Criteria:**

- [x] S3 bucket created with correct configuration
- [x] CloudFront distribution serving from S3
- [x] Can upload test file and download via CloudFront
- [x] HTTPS works (using CloudFront default certificate)
- [x] Public read works, public write blocked

---

## Task 4: Database Module (DynamoDB)

**Goal:** Create DynamoDB tables for specs and users

### Subtasks:

- [x] Create `modules/database/main.tf`
- [x] Define `spectrl-specs` table:
  - Partition key: `specId` (String)
  - Sort key: `version` (String)
  - Billing mode: on-demand
  - GSI-1: username + createdAt
  - GSI-2: "ALL" + downloads
- [x] Define `spectrl-users` table:
  - Partition key: `githubId` (Number)
  - Billing mode: on-demand
  - GSI-1: username
- [x] Create outputs: table names, ARNs
- [x] Test: Write and read test data from both tables

**Acceptance Criteria:**

- [x] Both tables created with correct schema
- [x] GSIs configured properly
- [x] Can write test data to tables
- [x] Can query using GSIs
- [x] On-demand billing enabled

---

## Task 5: Secrets Module

**Goal:** Create Secrets Manager resource for GitHub OAuth

### Subtasks:

- [x] Create `modules/secrets/main.tf`
- [x] Define Secrets Manager secret resource
- [x] Store placeholder OAuth credentials:
  ```json
  {
    "clientId": "placeholder",
    "clientSecret": "placeholder"
  }
  ```
- [x] Create IAM policy for Lambda to read secrets (for Phase 2)
- [x] Create outputs: secret ARN, IAM policy ARN
- [x] Test: Retrieve secret value via AWS CLI

**Acceptance Criteria:**

- [x] Secret created in Secrets Manager
- [x] Placeholder values stored
- [x] IAM policy created for Lambda access
- [x] Can retrieve secret via CLI

---

## Task 6: Terraform State Backend

**Goal:** Move Terraform state to S3 for safety

### Subtasks:

- [x] Create S3 bucket for Terraform state: `spectrl-terraform-state-{random}`
- [x] Create DynamoDB table for state locking: `spectrl-terraform-locks`
- [x] Update `backend.tf` to use S3 backend
- [x] Run `terraform init -migrate-state` to move state to S3
- [x] Verify state is now in S3
- [x] Test: Make a change, verify state updates in S3

**Acceptance Criteria:**

- [x] State bucket created
- [x] Lock table created
- [x] State migrated to S3
- [x] State locking works (prevents concurrent runs)
- [x] Local state file removed

---

## Task 7: Integration Testing

**Goal:** Validate entire infrastructure works end-to-end

### Subtasks:

- [x] Create test script: `infra/test-infrastructure.sh`
- [x] Test S3 upload:
  ```bash
  echo "test content" > test.txt
  aws s3 cp test.txt s3://{bucket}/specs/test/test.txt
  ```
- [x] Test CloudFront access:
  ```bash
  curl https://{cloudfront-domain}/specs/test/test.txt
  ```
- [x] Test DynamoDB write/read:
  ```bash
  aws dynamodb put-item --table-name spectrl-specs-prod --item '{...}'
  aws dynamodb get-item --table-name spectrl-specs-prod --key '{...}'
  ```
- [x] Test Secrets Manager:
  ```bash
  aws secretsmanager get-secret-value --secret-id spectrl/github-oauth
  ```
- [x] Document test results

**Acceptance Criteria:**

- [x] All tests pass
- [x] Can upload to S3 and download via CloudFront
- [x] Can write/read DynamoDB data
- [x] Can retrieve secrets
- [x] Test script documented in README

---

## Task 8: Documentation

**Goal:** Document infrastructure for future reference

### Subtasks:

- [x] Update `infra/README.md` with:
  - What each module does
  - How to apply infrastructure
  - How to destroy infrastructure
  - Cost estimates
  - Troubleshooting common issues
- [x] Add inline comments to Terraform files
- [x] Document outputs and how to use them
- [x] Create architecture diagram (ASCII art or Mermaid)

**Acceptance Criteria:**

- [x] README is comprehensive
- [x] Someone else could follow it to recreate infrastructure
- [x] All Terraform files have clear comments
- [x] Architecture diagram included

---

## Summary

**Total Tasks:** 8
**Estimated Time:** 3-5 days (depending on AWS familiarity)

**Task Dependencies:**

- Task 1 must complete first (prerequisites)
- Task 2 must complete before 3, 4, 5 (project structure)
- Tasks 3, 4, 5 can run in parallel (independent modules)
- Task 6 requires tasks 3, 4, 5 complete (state backend)
- Task 7 requires all infrastructure tasks complete (testing)
- Task 8 can happen throughout (documentation)

**Next Phase:** Once infrastructure is validated, move to Phase 2 (Authentication & API)
