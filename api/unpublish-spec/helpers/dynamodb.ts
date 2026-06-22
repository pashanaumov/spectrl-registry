import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const defaultAWSRegion = 'eu-north-1';

/**
 * Check if a spec version exists in DynamoDB
 *
 * @param specId - Format: "username/spec-name"
 * @param version - Semver format: "1.0.0"
 * @returns true if spec exists, false otherwise
 */
export async function checkSpecExists(specId: string, version: string): Promise<boolean> {
  console.log(`Checking if spec exists: ${specId}@${version}`);

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  const command = new GetCommand({
    TableName: process.env.SPECS_TABLE,
    Key: {
      specId,
      version,
    },
  });

  const response = await docClient.send(command);
  const exists = !!response.Item;

  console.log(`Spec ${specId}@${version} exists: ${exists}`);
  return exists;
}

/**
 * Delete spec metadata from DynamoDB
 *
 * @param specId - Format: "username/spec-name"
 * @param version - Semver format: "1.0.0"
 */
export async function deleteSpecMetadata(specId: string, version: string): Promise<void> {
  console.log(`Deleting spec metadata from DynamoDB: ${specId}@${version}`);

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  const command = new DeleteCommand({
    TableName: process.env.SPECS_TABLE,
    Key: {
      specId,
      version,
    },
  });

  await docClient.send(command);
  console.log(`Successfully deleted metadata for ${specId}@${version}`);
}
