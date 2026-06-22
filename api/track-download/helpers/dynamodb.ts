import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

const defaultAWSRegion = 'eu-north-1';

/**
 * Atomically increment the downloads counter for a spec version
 *
 * Uses UpdateItem with ADD operation for atomic increment.
 * This ensures accurate counting even under concurrent access.
 *
 * @param specId - Format: "username/spec-name"
 * @param version - Semver version string (e.g., "1.0.0")
 * @returns Updated download count
 * @throws Error if spec version doesn't exist
 */
export async function incrementDownloadCount(specId: string, version: string): Promise<number> {
  console.log(`Incrementing download count for ${specId}@${version}`);

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  try {
    const command = new UpdateCommand({
      TableName: process.env.SPECS_TABLE,
      Key: {
        specId,
        version,
      },
      // ADD operation atomically increments the downloads field
      // If the field doesn't exist, it initializes it to the increment value (1)
      UpdateExpression: 'ADD downloads :increment',
      ExpressionAttributeValues: {
        ':increment': 1,
      },
      // Ensure the item exists before updating
      ConditionExpression: 'attribute_exists(specId) AND attribute_exists(version)',
      // Return the updated value
      ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);
    const downloads = response.Attributes?.downloads ?? 1;

    console.log(`Download count updated to ${downloads} for ${specId}@${version}`);
    return downloads;
  } catch (error) {
    // Handle case where spec version doesn't exist
    if (error instanceof ConditionalCheckFailedException) {
      throw new Error(`Spec version not found: ${specId}@${version}`);
    }
    throw error;
  }
}
