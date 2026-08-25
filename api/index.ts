export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('ping') === '1') {
    return Response.json({ ok: true });
  }

  const [{ createApp }, { join }] = await Promise.all([
    import('./bundle.mjs'),
    import('node:path'),
  ]);

  const app = createApp({
    webRoot: join(process.cwd(), 'web-root'),
    cacheDir: process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache',
    coreMarker: join(process.cwd(), 'web-root/core'),
  });

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.slice(4) || '/';
    return app.fetch(new Request(url, req));
  }

  return app.fetch(req);
}
