import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import type { Request, Response } from 'express';

// Import all handlers
import { handler as authDeviceInit } from './auth-device-init/index.js';
import { handler as authDevicePoll } from './auth-device-poll/index.js';
import { handler as authExchange } from './auth-exchange/index.js';
import { handler as getSpec } from './get-spec/index.js';
import { handler as publishSpec } from './publish-spec/index.js';
import { handler as searchSpecs } from './search-specs/index.js';
import { handler as trackDownload } from './track-download/index.js';
import { handler as unpublishSpec } from './unpublish-spec/index.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

// Adapt a handler that expects express-style req/res to work with Hono context
function adapt(handler: (req: Request, res: Response) => Promise<void>) {
  return async (c: Context) => {
    let statusCode = 200;
    let body: unknown = null;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: unknown) => {
        body = data;
        return res;
      },
    } as unknown as Response;

    const rawBody = await c.req.text();
    const parsedBody = rawBody
      ? (() => {
          try {
            return JSON.parse(rawBody);
          } catch {
            return null;
          }
        })()
      : null;

    const req = {
      params: c.req.param() as Record<string, string>,
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      body: parsedBody,
    } as unknown as Request;

    await handler(req, res);
    return c.json(body, statusCode as 200);
  };
}

// Routes
app.post('/auth/device/init', adapt(authDeviceInit));
app.post('/auth/device/poll', adapt(authDevicePoll));
app.post('/auth/exchange', adapt(authExchange));
app.get('/search', adapt(searchSpecs));
app.get('/specs/:username/:specName', adapt(getSpec));
app.post('/publish', adapt(publishSpec));
app.delete('/specs/:username/:specName/:version', adapt(unpublishSpec));
app.post('/track-download', adapt(trackDownload));

const port = Number.parseInt(process.env.PORT || '8080', 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on port ${port}`);
});
