import { handle } from 'hono/vercel';
import { join } from 'node:path';
import { createApp } from './bundle.mjs';

const webRoot = join(process.cwd(), 'maicong-music');
const cacheDir = process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache';

const app = createApp({
  webRoot,
  cacheDir,
  coreMarker: join(webRoot, 'core'),
});

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default handle(app);
