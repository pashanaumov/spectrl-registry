import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { specVersionSchema, type SpecVersion } from '../schemas/response';

const defaultAWSRegion = 'eu-north-1';

/**
 * Query all versions of a spec from DynamoDB
 *
 * Uses Query operation with partition key (specId) to efficiently retrieve
 * all versions of a specific spec. Results are sorted by version (sort key).
 *
 * @param specId - Format: "username/spec-name"
 * @returns Array of spec versions, sorted by version descending (newest first)
 */
export async function getSpecVersions(specId: string): Promise<SpecVersion[]> {
  console.log(`Querying DynamoDB for spec: ${specId}`);

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  // Query by partition key (specId)
  // This is efficient because we're using the primary key
  const command = new QueryCommand({
    TableName: process.env.SPECS_TABLE,
    KeyConditionExpression: 'specId = :specId',
    ExpressionAttributeValues: {
      ':specId': specId,
    },
    ScanIndexForward: false, // Sort descending (newest first)
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  console.log(`Found ${items.length} versions for spec: ${specId}`);

  // Validate and map each item
  return items.map((item) => {
    return specVersionSchema.parse({
      specId: item.specId,
      version: item.version,
      username: item.username,
      specName: item.specName,
      description: item.description,
      type: item.type || 'spec',
      tags: item.tags || [],
      createdAt: item.createdAt,
      s3Path: item.s3Path,
      hash: item.hash,
      files: item.files,
      downloads: item.downloads || 0,
      deps: item.deps,
    });
  });
}
