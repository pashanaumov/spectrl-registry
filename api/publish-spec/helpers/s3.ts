import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const defaultAWSRegion = 'eu-north-1';

export async function uploadToS3(params: {
  bucket: string;
  key: string;
  content: string;
}): Promise<void> {
  console.log(`Uploading to S3: ${params.key}`);

  const client = new S3Client({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });

  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.content,
    ContentType: params.key.endsWith('.json') ? 'application/json' : 'text/plain',
  });

  await client.send(command);
  console.log(`Successfully uploaded: ${params.key}`);
}
