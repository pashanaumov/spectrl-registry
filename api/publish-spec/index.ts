import type { Request, Response } from 'express';
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

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received publish request');

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    const token = extractToken(authHeader);
    const { username } = await getGitHubUser(token);
    console.log(`Authenticated user: ${username}`);

    if (!req.body) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    const body = publishRequestSchema.parse(req.body);
    const { manifest, files } = body;

    validateFileCount(files);
    validateFileSize(files);
    validateManifestFiles(manifest, files);

    for (const filePath of Object.keys(files)) {
      sanitizeFilePath(filePath);
    }

    validateNamespaceOwnership(username, manifest.name);

    const hash = calculateContentHash(manifest, files);
    const paths = createSpecPaths(username, manifest.name, manifest.version);

    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable not set');
    }

    await uploadToS3({
      bucket: bucketName,
      key: paths.manifestKey,
      content: JSON.stringify(manifest, null, 2),
    });

    for (const [filePath, content] of Object.entries(files)) {
      await uploadToS3({ bucket: bucketName, key: paths.fileKey(filePath), content });
    }

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

    res.status(200).json({
      message: `Published ${paths.specId}@${manifest.version}`,
      url: `https://spectrl.pro/specs/${paths.specId}`,
      specId: paths.specId,
      version: manifest.version,
    });
  } catch (error) {
    console.error('Error publishing spec:', error);

    if (error instanceof ZodError) {
      res.status(400).json({ error: error.issues[0]?.message ?? 'Validation error' });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);
    res.status(statusCode).json({ error: errorMessage });
  }
}

import * as ff from '@google-cloud/functions-framework';
ff.http('handler', handler);
