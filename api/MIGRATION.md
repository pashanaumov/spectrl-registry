# DynamoDB Downloads Field Migration

## Overview

This document describes the migration process for adding the `downloads` field to existing spec entries in the DynamoDB table.

## Background

The download tracking feature requires a `downloads` field (Number type) on each spec version in DynamoDB. New specs published after the feature deployment will automatically have this field initialized to 0. However, existing specs need to be migrated.

## Migration Script

**Location**: `api/migrate-downloads-field.ts`

**Purpose**: Scans all items in the specs table and adds `downloads: 0` to any items that don't already have the field.

## Prerequisites

- Node.js 20+ installed
- AWS credentials configured (for production) or LocalStack running (for development)
- Access to the DynamoDB table

## Running the Migration

### Development Environment (LocalStack)

```bash
# 1. Ensure LocalStack is running
docker-compose up -d

# 2. Run migration in dry-run mode (preview changes)
AWS_REGION=us-east-1 \
SPECS_TABLE=spectrl-specs-dev \
DRY_RUN=true \
node api/migrate-downloads-field.ts

# 3. Run migration for real
AWS_REGION=us-east-1 \
SPECS_TABLE=spectrl-specs-dev \
node api/migrate-downloads-field.ts
```

### Production Environment

```bash
# 1. Run migration in dry-run mode (preview changes)
AWS_REGION=eu-north-1 \
SPECS_TABLE=spectrl-specs-prod \
DRY_RUN=true \
node api/migrate-downloads-field.ts

# 2. Review the output carefully

# 3. Run migration for real
AWS_REGION=eu-north-1 \
SPECS_TABLE=spectrl-specs-prod \
node api/migrate-downloads-field.ts
```

## Environment Variables

| Variable      | Required | Default      | Description                                            |
| ------------- | -------- | ------------ | ------------------------------------------------------ |
| `SPECS_TABLE` | Yes      | -            | DynamoDB table name                                    |
| `AWS_REGION`  | No       | `eu-north-1` | AWS region                                             |
| `DRY_RUN`     | No       | `false`      | Set to `true` to preview changes without applying them |

## Migration Process

The script performs the following steps:

1. **Scan**: Scans all items in the DynamoDB table
2. **Filter**: Identifies items that don't have a `downloads` field
3. **Update**: Uses `UpdateItem` with `if_not_exists()` to add `downloads: 0`
4. **Report**: Prints summary statistics

## Safety Features

- **Dry-run mode**: Preview changes before applying them
- **Conditional update**: Uses `if_not_exists()` to avoid overwriting existing values
- **Error handling**: Continues processing even if individual items fail
- **Progress reporting**: Shows progress every 10 items
- **Summary statistics**: Reports total items, updated items, and failures

## Expected Output

```
============================================================
DynamoDB Downloads Field Migration
============================================================
Region: eu-north-1
Table: spectrl-specs-prod
Mode: LIVE
============================================================

Step 1: Scanning table for all items...
Found 42 items

Step 2: Processing items...
  Updated 10 items...
  Updated 20 items...
  Updated 30 items...

============================================================
Migration Summary
============================================================
Total items scanned:           42
Items already with downloads:  5
Items updated:                 37
Items failed:                  0
============================================================
```

## Rollback

If you need to remove the `downloads` field (not recommended):

```bash
# This is destructive - use with caution
aws dynamodb scan \
  --table-name spectrl-specs-prod \
  --region eu-north-1 \
  | jq -r '.Items[] | "\(.specId.S) \(.version.S)"' \
  | while read specId version; do
      aws dynamodb update-item \
        --table-name spectrl-specs-prod \
        --region eu-north-1 \
        --key "{\"specId\":{\"S\":\"$specId\"},\"version\":{\"S\":\"$version\"}}" \
        --update-expression "REMOVE downloads"
    done
```

## Verification

After running the migration, verify that all items have the `downloads` field:

```bash
# Check a few random items
aws dynamodb get-item \
  --table-name spectrl-specs-prod \
  --region eu-north-1 \
  --key '{"specId":{"S":"username/spec-name"},"version":{"S":"1.0.0"}}'

# Count items without downloads field (should be 0)
aws dynamodb scan \
  --table-name spectrl-specs-prod \
  --region eu-north-1 \
  --filter-expression "attribute_not_exists(downloads)" \
  --select COUNT
```

## Troubleshooting

### Error: "SPECS_TABLE environment variable is required"

**Solution**: Set the `SPECS_TABLE` environment variable:

```bash
export SPECS_TABLE=spectrl-specs-prod
node api/migrate-downloads-field.ts
```

### Error: "ResourceNotFoundException"

**Solution**: Verify the table name and region are correct:

```bash
aws dynamodb list-tables --region eu-north-1
```

### Error: "AccessDeniedException"

**Solution**: Ensure your AWS credentials have the following permissions:

- `dynamodb:Scan`
- `dynamodb:UpdateItem`

### Migration is slow

**Solution**: The script processes items sequentially to avoid throttling. For large tables (1000+ items), consider:

- Running during off-peak hours
- Increasing DynamoDB provisioned throughput temporarily
- Using AWS Data Pipeline or EMR for very large migrations

## Post-Migration

After successful migration:

1. Verify all items have the `downloads` field
2. Test the download tracking feature end-to-end
3. Monitor CloudWatch logs for any errors
4. Archive this migration script (don't delete it for audit purposes)

## Questions?

Contact the infrastructure team or refer to the download tracking spec at `.kiro/specs/download-tracking/`.
