import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { join } from 'node:path';

export const config = { runtime: 'nodejs', maxDuration: 60 };

type RyanApp = Awaited<ReturnType<typeof loadAppInternal>>;
let appPromise: ReturnType<typeof loadAppInternal> | null = null;

function loadAppInternal() {
  return import('./bundle.mjs').then(({ createApp }) => createApp({
    webRoot: join(process.cwd(), 'web-root'),
    cacheDir: process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache',
    coreMarker: join(process.cwd(), 'web-root/core'),
  }));
}

function loadApp(): Promise<RyanApp> {
  if (!appPromise) appPromise = loadAppInternal();
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

const gateway = new Hono();

gateway.all('*', async (c) => {
  if (c.req.query('ping') === '1') {
    return c.json({ ok: true });
  }
  const app = await loadApp();
  return app.fetch(normalizeRequest(c.req.raw));
});

export default handle(gateway);
