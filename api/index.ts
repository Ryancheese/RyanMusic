import { handle } from 'hono/vercel';
import { join } from 'node:path';
import { createApp } from './bundle.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const config = { runtime: 'nodejs', maxDuration: 60 };

function boot() {
  try {
    const webRoot = join(process.cwd(), 'maicong-music');
    const app = createApp({
      webRoot,
      cacheDir: process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache',
      coreMarker: join(webRoot, 'core'),
    });
    return handle(app);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('RyanMusic boot failed', err);
    return (_req: Request) =>
      new Response(`RyanMusic boot failed:\n${msg}`, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
  }
}

const handler = boot();

export default handler;
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
