import { join } from 'node:path';
import { createApp } from './app.ts';

const webRoot = join(process.cwd(), 'maicong-music');
const app = createApp({
  webRoot,
  cacheDir: process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache',
  coreMarker: join(webRoot, 'core'),
});

async function handleRequest(request: Request): Promise<Response> {
  try {
    return await app.fetch(request);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    return new Response(message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

export default app;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
export const OPTIONS = handleRequest;
export const config = { runtime: 'nodejs', maxDuration: 60 };
