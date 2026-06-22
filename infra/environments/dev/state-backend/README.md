# Terraform State Backend Setup (Dev/LocalStack)

This directory contains the infrastructure for storing Terraform state in S3 with DynamoDB locking for the dev environment using LocalStack.

## Setup Instructions

### Step 1: Make sure LocalStack is running

```bash
localstack status
```

### Step 2: Create the state backend infrastructure

```bash
cd infra/environments/dev/state-backend
tflocal init
tflocal apply
```

This will create in LocalStack:

- S3 bucket: `spectrl-terraform-state-dev`
- DynamoDB table: `spectrl-terraform-locks-dev`

### Step 3: Note the output

After `tflocal apply`, you'll see output with the backend configuration.

### Step 4: Update the main backend.tf

Go back to `infra/environments/dev/backend.tf` and replace the content with:

```hcl
terraform {
  backend "s3" {
    bucket         = "spectrl-terraform-state-dev"
    key            = "terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "spectrl-terraform-locks-dev"
    encrypt        = true

    # LocalStack endpoints (when using tflocal, these are automatic)
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
  }
}
```

### Step 5: Migrate the state

```bash
cd infra/environments/dev
tflocal init -migrate-state
```

Type `yes` when prompted.

### Step 6: Verify

Check that your state is now in LocalStack S3:

```bash
awslocal s3 ls s3://spectrl-terraform-state-dev/
```

## Note

For dev/LocalStack, state backend is optional since LocalStack data is ephemeral anyway. But it's good practice to test the same setup you'll use in production!
