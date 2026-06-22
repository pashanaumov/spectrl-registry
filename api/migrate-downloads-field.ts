#!/usr/bin/env node
/**
 * Migration script to add downloads field to existing DynamoDB specs
 *
 * This script scans all items in the specs table and adds a downloads field
 * (initialized to 0) for any items that don't already have it.
 *
 * Usage:
 *   # For local development (LocalStack)
 *   AWS_REGION=us-east-1 SPECS_TABLE=spectrl-specs-dev node api/migrate-downloads-field.ts
 *
 *   # For production (requires AWS credentials)
 *   AWS_REGION=eu-north-1 SPECS_TABLE=spectrl-specs-prod node api/migrate-downloads-field.ts
 *
 * Environment variables:
 *   - AWS_REGION: AWS region (default: eu-north-1)
 *   - SPECS_TABLE: DynamoDB table name (required)
 *   - DRY_RUN: Set to 'true' to preview changes without applying them
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  ScanCommand,
  UpdateCommand,
  DynamoDBDocumentClient,
  type ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';

const defaultAWSRegion = 'eu-north-1';

interface MigrationStats {
  totalItems: number;
  itemsWithDownloads: number;
  itemsUpdated: number;
  itemsFailed: number;
  errors: Array<{ specId: string; version: string; error: string }>;
}

/**
 * Scan all items in the DynamoDB table
 */
async function scanAllItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<Array<Record<string, unknown>>> {
  const items: Array<Record<string, unknown>> = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const command = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response: ScanCommandOutput = await docClient.send(command);

    if (response.Items) {
      items.push(...response.Items);
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Add downloads field to a single item
 */
async function addDownloadsField(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  specId: string,
  version: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would update ${specId}@${version}`);
    return;
  }

  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      specId,
      version,
    },
    UpdateExpression: 'SET downloads = if_not_exists(downloads, :zero)',
    ExpressionAttributeValues: {
      ':zero': 0,
    },
  });

  await docClient.send(command);
}

/**
 * Run the migration
 */
async function migrate(): Promise<void> {
  // Validate environment variables
  const tableName = process.env.SPECS_TABLE;
  if (!tableName) {
    console.error('Error: SPECS_TABLE environment variable is required');
    process.exit(1);
  }

  const region = process.env.AWS_REGION ?? defaultAWSRegion;
  const dryRun = process.env.DRY_RUN === 'true';

  console.log('='.repeat(60));
  console.log('DynamoDB Downloads Field Migration');
  console.log('='.repeat(60));
  console.log(`Region: ${region}`);
  console.log(`Table: ${tableName}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log();

  // Initialize DynamoDB client
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  const stats: MigrationStats = {
    totalItems: 0,
    itemsWithDownloads: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
    errors: [],
  };

  try {
    // Step 1: Scan all items
    console.log('Step 1: Scanning table for all items...');
    const items = await scanAllItems(docClient, tableName);
    stats.totalItems = items.length;
    console.log(`Found ${stats.totalItems} items\n`);

    if (stats.totalItems === 0) {
      console.log('No items found in table. Migration complete.');
      return;
    }

    // Step 2: Process each item
    console.log('Step 2: Processing items...');

    for (const item of items) {
      const specId = item.specId as string;
      const version = item.version as string;

      // Check if downloads field already exists
      if (typeof item.downloads === 'number') {
        stats.itemsWithDownloads++;
        continue;
      }

      // Add downloads field
      try {
        await addDownloadsField(docClient, tableName, specId, version, dryRun);
        stats.itemsUpdated++;

        if (!dryRun && stats.itemsUpdated % 10 === 0) {
          console.log(`  Updated ${stats.itemsUpdated} items...`);
        }
      } catch (error) {
        stats.itemsFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({ specId, version, error: errorMessage });
        console.error(`  Failed to update ${specId}@${version}: ${errorMessage}`);
      }
    }

    console.log();

    // Step 3: Print summary
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total items scanned:           ${stats.totalItems}`);
    console.log(`Items already with downloads:  ${stats.itemsWithDownloads}`);
    console.log(`Items updated:                 ${stats.itemsUpdated}`);
    console.log(`Items failed:                  ${stats.itemsFailed}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log();
      console.log('Errors:');
      for (const error of stats.errors) {
        console.log(`  - ${error.specId}@${error.version}: ${error.error}`);
      }
    }

    if (dryRun) {
      console.log();
      console.log('This was a DRY RUN. No changes were made.');
      console.log('Run without DRY_RUN=true to apply changes.');
    }

    console.log();

    if (stats.itemsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
