import type { Request, Response } from 'express';
import { pathParametersSchema } from './schemas/request';
import { getSpecResponseSchema, errorResponseSchema } from './schemas/response';
import { getSpecVersions } from './helpers/dynamodb';
import { getErrorStatusCode } from './helpers/errors';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received get-spec request:', JSON.stringify(req.params, null, 2));

  try {
    const pathParams = pathParametersSchema.safeParse(req.params);

    if (!pathParams.success) {
      const errorResponse = errorResponseSchema.parse({
        error: `Invalid path parameters: ${pathParams.error.issues[0].message}`,
      });
      res.status(400).json(errorResponse);
      return;
    }

    const { username, specName } = pathParams.data;
    const specId = `${username}/${specName}`;
    console.log(`Fetching spec: ${specId}`);

    const versions = await getSpecVersions(specId);

    if (versions.length === 0) {
      const errorResponse = errorResponseSchema.parse({
        error: `Spec not found: ${specId}`,
      });
      res.status(404).json(errorResponse);
      return;
    }

    const transformedVersions = versions.map((v) => ({
      version: v.version,
      description: v.description,
      type: v.type ?? 'spec',
      tags: v.tags,
      publishedAt: v.createdAt,
      s3Path: v.s3Path,
      hash: v.hash,
      files: v.files,
      downloads: v.downloads,
      deps: v.deps,
    }));

    res.status(200).json({ specId, username, specName, versions: transformedVersions });
  } catch (error) {
    console.error('Error getting spec:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);

    const errorResponse = errorResponseSchema.parse({ error: errorMessage });
    res.status(statusCode).json(errorResponse);
  }
}

import * as ff from '@google-cloud/functions-framework';
ff.http('handler', handler);
