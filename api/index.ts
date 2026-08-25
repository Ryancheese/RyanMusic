import { handle } from 'hono/vercel';
import { join } from 'node:path';

const webRoot = join(process.cwd(), 'web-root');
const cacheDir = process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache';

type VercelHandler = (req: Request) => Response | Promise<Response>;

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
  const run = await getHandler();
  return run(req);
};

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default handler;
