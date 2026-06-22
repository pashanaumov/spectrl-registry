import type { Request, Response } from 'express';
import { trackDownloadRequestSchema } from './schemas/request';
import { trackDownloadResponseSchema, errorResponseSchema } from './schemas/response';
import { incrementDownloadCount } from './helpers/dynamodb';

export async function handler(req: Request, res: Response): Promise<void> {
  console.log('Received track-download request');

  try {
    const bodyValidation = trackDownloadRequestSchema.safeParse(req.body || {});

    if (!bodyValidation.success) {
      res.status(400).json(
        errorResponseSchema.parse({
          error: `Invalid request parameters: ${bodyValidation.error.issues[0].message}`,
        }),
      );
      return;
    }

    const { username, specName, version } = bodyValidation.data;
    const specId = `${username}/${specName}`;
    console.log(`Tracking download for ${specId}@${version}`);

    const downloads = await incrementDownloadCount(specId, version);

    res.status(200).json(trackDownloadResponseSchema.parse({ success: true, downloads }));
  } catch (error) {
    console.error('Error tracking download:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    let statusCode = 500;
    if (errorMessage.includes('Spec version not found')) statusCode = 404;
    else if (errorMessage.includes('DynamoDB') || errorMessage.includes('service'))
      statusCode = 503;

    res.status(statusCode).json(errorResponseSchema.parse({ error: errorMessage }));
  }
}
