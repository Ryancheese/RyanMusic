import type { VercelRequest, VercelResponse } from '@vercel/node';
import { join } from 'node:path';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

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

function buildRequest(req: VercelRequest): Request {
  const host = String(req.headers.host || 'localhost');
  const path = req.url || '/';
  const url = new URL(path, `https://${host}`);

  if (
    url.searchParams.has('get')
    && (url.pathname === '/api' || url.pathname === '/' || url.pathname === '/index.php')
  ) {
    url.pathname = '/api.php';
  } else if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.slice(4) || '/';
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  const method = req.method || 'GET';
  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      const contentType = String(req.headers['content-type'] || '');
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
          if (value == null) continue;
          params.set(key, String(value));
        }
        body = params.toString();
      } else {
        body = JSON.stringify(req.body);
      }
    }
  }

  return new Request(url, { method, headers, body });
}

async function pipeResponse(res: VercelResponse, response: Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query?.ping === '1') {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.query?.probe === 'play') {
    const id = String(req.query.id || '186016');
    const results: Record<string, unknown> = {
      vercel: process.env.VERCEL || null,
      region: process.env.VERCEL_REGION || null,
    };
    try {
      const bootstrap = await fetch('https://music.90svip.cn/', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://music.90svip.cn/',
        },
        body: `input=${encodeURIComponent(id)}&filter=id&type=netease&page=1`,
        signal: AbortSignal.timeout(10_000),
      });
      results.bootstrapStatus = bootstrap.status;
    } catch (error) {
      results.bootstrapError = error instanceof Error ? error.message : String(error);
    }
    try {
      const search = await fetch(
        `https://search.kuwo.cn/r.s?all=${encodeURIComponent('晴天')}&ft=music&client=kt&pn=0&rn=1&rformat=json&encoding=utf8`,
        { signal: AbortSignal.timeout(10_000) },
      );
      results.kuwoSearchStatus = search.status;
      results.kuwoSearchBytes = (await search.text()).length;
    } catch (error) {
      results.kuwoSearchError = error instanceof Error ? error.message : String(error);
    }
    try {
      const anti = await fetch(
        'https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_228908&format=mp3&response=url&httpsStatus=1',
        { signal: AbortSignal.timeout(10_000) },
      );
      results.kuwoAntiStatus = anti.status;
      const body = await anti.text();
      results.kuwoAntiBody = body.slice(0, 180);
    } catch (error) {
      results.kuwoAntiError = error instanceof Error ? error.message : String(error);
    }
    res.status(200).json(results);
    return;
  }

  try {
    const app = await loadApp();
    await pipeResponse(res, await app.fetch(buildRequest(req)));
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Server error',
    });
  }
}
