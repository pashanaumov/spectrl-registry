# Terraform State Backend Setup

This directory contains the infrastructure for storing Terraform state in S3 with DynamoDB locking.

## Why This Exists

Terraform state needs to be stored somewhere safe. By default, it's stored locally on your laptop, which means:

- If your laptop dies, you lose track of your infrastructure
- Multiple people can't work on the same infrastructure
- No history or backup of state changes

This creates an S3 bucket and DynamoDB table to store state safely in AWS.

## Setup Instructions

### Step 1: Create the state backend infrastructure

```bash
cd infra/environments/prod/state-backend
terraform init
terraform apply
```

This will create:

- S3 bucket: `spectrl-terraform-state-prod`
- DynamoDB table: `spectrl-terraform-locks-prod`

### Step 2: Note the output

After `terraform apply`, you'll see output with the backend configuration. Copy it.

### Step 3: Update the main backend.tf

Go back to `infra/environments/prod/backend.tf` and replace the content with:

```hcl
terraform {
  backend "s3" {
    bucket         = "spectrl-terraform-state-prod"
    key            = "terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "spectrl-terraform-locks-prod"
    encrypt        = true
  }
}
```

### Step 4: Migrate the state

```bash
cd infra/environments/prod
terraform init -migrate-state
```

Terraform will ask: "Do you want to copy existing state to the new backend?"
Type `yes`

### Step 5: Verify

Check that your state is now in S3:

```bash
aws s3 ls s3://spectrl-terraform-state-prod/
```

You should see `terraform.tfstate`

### Step 6: Clean up local state (optional)

Once you've verified the state is in S3, you can delete the local state files:

```bash
rm terraform.tfstate*
```

## Important Notes

- The state backend itself uses local state (stored in this directory)
- Keep this directory's state file safe - it tracks the state bucket
- If you lose this state, you'll need to import the resources manually

## Testing State Locking

To test that state locking works, try running `terraform plan` in two terminals simultaneously. The second one should wait for the first to finish.
