import { handle } from 'hono/vercel';
import { join } from 'node:path';

const webRoot = join(process.cwd(), 'web-root');
const cacheDir = process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache';

type VercelHandler = (req: Request) => Response | Promise<Response>;

function normalizeApiPath(req: Request): Request {
  const url = new URL(req.url);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname === '/api' ? '/' : url.pathname.slice(4) || '/';
    return new Request(url, req);
  }
  return req;
}

let handlerPromise: Promise<VercelHandler> | null = null;

async function getHandler(): Promise<VercelHandler> {
  if (!handlerPromise) {
    handlerPromise = import('./bundle.mjs').then(({ createApp }) => {
      const app = createApp({
        webRoot,
        cacheDir,
        coreMarker: join(webRoot, 'core'),
      });
      return handle(app);
    });
  }
  return handlerPromise;
}

const handler: VercelHandler = async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('ping') === '1') {
    return Response.json({ ok: true, vercel: Boolean(process.env.VERCEL) });
  }
  const run = await getHandler();
  return run(normalizeApiPath(req));
};

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default handler;
