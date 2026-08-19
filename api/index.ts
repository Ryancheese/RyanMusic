import { handle } from 'hono/vercel';
import { join } from 'node:path';
import { createApp } from '../server/src/app.ts';
// 显式引用，避免 Vercel 打包漏掉 comments 模块导致函数启动崩溃
import { loadSongComments } from '../server/src/comments.ts';

void loadSongComments;

const webRoot = join(process.cwd(), 'maicong-music');
const cacheDir = process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache';

const app = createApp({
  webRoot,
  cacheDir,
  coreMarker: join(webRoot, 'core'),
});

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default handle(app);
