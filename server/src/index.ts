import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { installDirectNetwork } from './http.ts';

installDirectNetwork();

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '../../web-root');
const webRoot = resolve(arg('web-root', process.env.RYANMUSIC_WEB_ROOT || defaultRoot));
const cacheDir = resolve(
  arg('cache-dir', process.env.RYANMUSIC_CACHE_DIR || join(webRoot, 'core/cache')),
);
const listen = arg('listen', process.env.RYANMUSIC_LISTEN || '127.0.0.1');
const port = Number(arg('port', process.env.PORT || process.env.RYANMUSIC_PORT || '18765'));

const app = createApp({
  webRoot,
  cacheDir,
  coreMarker: join(webRoot, 'core'),
});

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || `${listen}:${port}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) headers.set(k, v.join(', '));
      else headers.set(k, v);
    }
    const method = req.method || 'GET';
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await new Promise<Buffer>((resolvePromise, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            req.on('end', () => resolvePromise(Buffer.concat(chunks)));
            req.on('error', reject);
          });
    const request = new Request(url, { method, headers, body, duplex: 'half' } as RequestInit);
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    if (!response.body) {
      res.end();
      return;
    }
    const reader = response.body.getReader();
    const pump = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
    };
    pump().catch(() => {
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  } catch (err) {
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : 'internal error');
  }
});

server.listen(port, listen, () => {
  console.log(`RyanMusic server http://${listen}:${port}/  webRoot=${webRoot}`);
});
