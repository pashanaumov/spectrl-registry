import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SpecMetadata } from '../schemas/dynamodb';

const defaultAWSRegion = 'eu-north-1';

export async function storeSpecMetadata(metadata: SpecMetadata): Promise<void> {
  console.log('Storing spec metadata in DynamoDB...');

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  const command = new PutCommand({
    TableName: process.env.SPECS_TABLE,
    Item: metadata,
  });

  await docClient.send(command);
  console.log('Spec metadata stored successfully');
}
