import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod/v4';
import { publishRequestSchema, extractToken } from './schemas/request';
import { getGitHubUser } from '../shared/github';
import {
  validateFileSize,
  validateFileCount,
  sanitizeFilePath,
  validateManifestFiles,
  validateNamespaceOwnership,
} from './helpers/validation';
import { uploadToS3 } from './helpers/s3';
import { storeSpecMetadata } from './helpers/dynamodb';
import { calculateContentHash } from './helpers/hash';
import { createSpecPaths } from './helpers/paths';
import { getErrorStatusCode } from './helpers/errors';

/**
 * Lambda handler for publishing specs to the public registry
 *
 * Flow:
 * 1. Extract and validate Authorization header (Bearer token)
 * 2. Verify token with GitHub API and get username
 * 3. Parse and validate request body (manifest + files)
 * 4. Validate files (count, size, paths, manifest consistency)
 * 5. Check namespace ownership (username matches spec namespace)
 * 6. Calculate content hash (SHA-256 of manifest + files)
 * 7. Create S3 paths for manifest and files
 * 8. Upload manifest to S3: specs/{username}/{name}/{version}/spectrl.json
 * 9. Upload each file to S3: specs/{username}/{name}/{version}/files/{path}
 * 10. Store metadata in DynamoDB (specId, version, description, etc.)
 * 11. Return success response with published spec URL
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Received publish request:', JSON.stringify(event, null, 2));

  try {
    // 1. Extract and verify authorization token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing Authorization header' }),
      };
    }

    const token = extractToken(authHeader);

    // 2. Verify token with GitHub and get username
    const { username } = await getGitHubUser(token);
    console.log(`Authenticated user: ${username}`);

    // 3. Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body = publishRequestSchema.parse(JSON.parse(event.body));
    const { manifest, files } = body;

    // 4. Validate files
    validateFileCount(files);
    validateFileSize(files);
    validateManifestFiles(manifest, files);

    // Sanitize all file paths
    for (const filePath of Object.keys(files)) {
      sanitizeFilePath(filePath);
    }

    // 5. Check namespace ownership
    validateNamespaceOwnership(username, manifest.name);

    // 6. Calculate content hash
    const hash = calculateContentHash(manifest, files);

    // 7. Create paths
    const paths = createSpecPaths(username, manifest.name, manifest.version);

    // 8. Check bucket name
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable not set');
    }

    // 9. Upload manifest to S3
    await uploadToS3({
      bucket: bucketName,
      key: paths.manifestKey,
      content: JSON.stringify(manifest, null, 2),
    });

    // 10. Upload each file to S3
    for (const [filePath, content] of Object.entries(files)) {
      await uploadToS3({
        bucket: bucketName,
        key: paths.fileKey(filePath),
        content,
      });
    }

    // 11. Store metadata in DynamoDB
    await storeSpecMetadata({
      specId: paths.specId,
      version: manifest.version,
      username,
      specName: manifest.name,
      description: manifest.description,
      type: manifest.type,
      downloads: 0,
      createdAt: new Date().toISOString(),
      s3Path: paths.s3Path,
      hash,
      tags: manifest.agent?.tags,
      files: manifest.files,
      deps: manifest.deps,
    });

    // 12. Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Published ${paths.specId}@${manifest.version}`,
        url: `https://spectrl.pro/specs/${paths.specId}`,
        specId: paths.specId,
        version: manifest.version,
      }),
    };
  } catch (error) {
    console.error('Error publishing spec:', error);

    if (error instanceof ZodError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.issues[0]?.message ?? 'Validation error' }),
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
}
