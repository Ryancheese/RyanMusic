import { join } from 'node:path';
import type { Hono } from 'hono';

export const config = { runtime: 'nodejs', maxDuration: 60 };

let appPromise: Promise<Hono> | null = null;

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.NOW_REGION,
  );
}

async function getApp(): Promise<Hono> {
  if (!appPromise) {
    appPromise = import('./bundle.mjs').then(({ createApp }) => createApp({
      webRoot: join(process.cwd(), 'web-root'),
      cacheDir: process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache',
      coreMarker: join(process.cwd(), 'web-root/core'),
    }));
  }
  return appPromise;
}

function normalizeRequest(req: Request): Request {
  const url = new URL(req.url);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.slice(4) || '/';
    return new Request(url, req);
  }
  return req;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('ping') === '1') {
    return Response.json({ ok: true, serverless: isServerless() });
  }
  const app = await getApp();
  return app.fetch(normalizeRequest(req));
}
