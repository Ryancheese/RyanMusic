import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createApp } from '../server/src/app.ts';

const webRoot = join(process.cwd(), 'maicong-music');
const cacheDir = process.env.RYANMUSIC_CACHE_DIR || '/tmp/ryanmusic-cache';

const app = createApp({
  webRoot,
  cacheDir,
  coreMarker: join(webRoot, 'core'),
});

export const config = { runtime: 'nodejs', maxDuration: 60 };

function isFetchRequest(req: unknown): req is Request {
  return Boolean(req && typeof (req as Request).headers?.get === 'function' && typeof (req as Request).arrayBuffer === 'function');
}

function nodeHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

async function readNodeBody(req: IncomingMessage & { body?: unknown }): Promise<BodyInit | undefined> {
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD') return undefined;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body as BodyInit;
  if (req.body && typeof req.body === 'object') {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('application/json')) return JSON.stringify(req.body);
    return new URLSearchParams(req.body as Record<string, string>).toString();
  }
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function nodeToFetch(req: IncomingMessage & { body?: unknown }): Promise<Request> {
  const host = req.headers.host || 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const url = new URL(req.url || '/', `${proto}://${host}`);
  const method = req.method || 'GET';
  const headers = nodeHeaders(req);
  const body = await readNodeBody(req);
  return new Request(url, { method, headers, body, duplex: 'half' } as RequestInit);
}

async function writeFetchToNode(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) res.write(Buffer.from(value));
  }
  res.end();
}

export default async function handler(req: Request | IncomingMessage, res?: ServerResponse) {
  try {
    if (isFetchRequest(req)) return app.fetch(req);
    if (!res) throw new Error('Missing Node response object');
    const request = await nodeToFetch(req);
    const response = await app.fetch(request);
    await writeFetchToNode(response, res);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    if (res && typeof res.end === 'function') {
      if (!res.headersSent) res.statusCode = 500;
      res.end(message);
      return;
    }
    return new Response(message, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
