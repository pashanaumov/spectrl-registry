import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const defaultAWSRegion = 'eu-north-1';

/**
 * Delete all files for a spec version from S3
 * Deletes manifest and all files in the version directory
 *
 * @param bucket - S3 bucket name
 * @param username - Spec owner username
 * @param specName - Spec name
 * @param version - Spec version
 */
export async function deleteSpecFromS3(
  bucket: string,
  username: string,
  specName: string,
  version: string,
): Promise<void> {
  console.log(`Deleting spec from S3: ${username}/${specName}@${version}`);

  const client = new S3Client({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });

  // Construct the prefix for all files in this version
  const prefix = `specs/${username}/${specName}/${version}/`;

  // List all objects with this prefix
  console.log(`Listing objects with prefix: ${prefix}`);
  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const listResponse = await client.send(listCommand);
  const objects = listResponse.Contents || [];

  console.log(`Found ${objects.length} objects to delete`);

  // Delete each object
  for (const obj of objects) {
    if (obj.Key) {
      console.log(`Deleting: ${obj.Key}`);
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: obj.Key,
      });
      await client.send(deleteCommand);
    }
  }

  console.log(`Successfully deleted all files for ${username}/${specName}@${version}`);
}
