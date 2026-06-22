import type { Request, Response } from 'express';
import { pathParametersSchema, extractToken } from './schemas/request';
import { unpublishResponseSchema, errorResponseSchema } from './schemas/response';
import { getGitHubUser } from '../shared/github';
import { validateOwnership, validateSpecExists } from './helpers/validation';
import { checkSpecExists, deleteSpecMetadata } from './helpers/dynamodb';
import { deleteSpecFromS3 } from './helpers/s3';
import { getErrorStatusCode } from './helpers/errors';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received unpublish request:', JSON.stringify(req.params, null, 2));

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res
        .status(401)
        .json(errorResponseSchema.parse({ error: 'Authorization header is required' }));
      return;
    }

    const token = extractToken(authHeader);
    const { username: authenticatedUsername } = await getGitHubUser(token);
    console.log(`Authenticated user: ${authenticatedUsername}`);

    const pathParams = pathParametersSchema.safeParse(req.params);

    if (!pathParams.success) {
      res.status(400).json(
        errorResponseSchema.parse({
          error: `Invalid path parameters: ${pathParams.error.issues[0].message}`,
        }),
      );
      return;
    }

    const { username, specName, version } = pathParams.data;
    const specId = `${username}/${specName}`;
    console.log(`Unpublishing spec: ${specId}@${version}`);

    validateOwnership(authenticatedUsername, username);

    const specExists = await checkSpecExists(specId, version);
    validateSpecExists(specExists, specId, version);

    await deleteSpecMetadata(specId, version);

    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable not set');
    }

    await deleteSpecFromS3(bucketName, username, specName, version);

    res.status(200).json(
      unpublishResponseSchema.parse({
        message: `Unpublished ${specId}@${version}`,
        specId,
        version,
      }),
    );
  } catch (error) {
    console.error('Error unpublishing spec:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);
    res.status(statusCode).json(errorResponseSchema.parse({ error: errorMessage }));
  }
}
