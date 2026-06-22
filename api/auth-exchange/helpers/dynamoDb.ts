import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export async function storeUser({
  githubId,
  email,
  username,
}: {
  githubId: number;
  username: string;
  email: string;
}) {
  console.log('Storing user in DynamoDB...');

  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
  const docClient = DynamoDBDocumentClient.from(client);

  const command = new PutCommand({
    TableName: process.env.USERS_TABLE,
    Item: {
      githubId: githubId,
      username: username,
      email: email,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    },
  });

  await docClient.send(command);
  console.log('User stored successfully');
}
