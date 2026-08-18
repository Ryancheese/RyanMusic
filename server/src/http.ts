import { UA } from './config.ts';

const FAKE_IP_MASK = 0xfffe0000;
const FAKE_IP_NET = ipToInt('198.18.0.0') & FAKE_IP_MASK;
const hostCache = new Map<string, string | null>();

function ipToInt(ip: string): number {
  const p = ip.split('.').map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return 0;
  return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
}

function isFakeIp(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  return (ipToInt(ip) & FAKE_IP_MASK) === FAKE_IP_NET;
}

async function dohResolve(host: string): Promise<string | null> {
  const endpoints = [
    `https://dns.alidns.com/resolve?name=${encodeURIComponent(host)}&type=A`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/dns-json', 'User-Agent': 'RyanMusic/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
      for (const ans of json.Answer || []) {
        if (ans.type === 1 && ans.data && !isFakeIp(ans.data)) return ans.data;
      }
    } catch {
      // next
    }
  }
  return null;
}

export async function resolveHost(host: string): Promise<string | null> {
  const key = host.toLowerCase();
  if (hostCache.has(key)) return hostCache.get(key) || null;
  const ip = await dohResolve(key);
  hostCache.set(key, ip);
  return ip;
}

export interface HttpResult {
  ok: boolean;
  status: number;
  body: string;
  json: any;
  cookies: string;
  headers: Headers;
  error: string;
}

function parseSetCookies(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const lines = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : [];
  const map = new Map<string, string>();
  for (const line of lines) {
    const pair = line.split(';')[0]?.trim() || '';
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (v === '' && map.has(k) && map.get(k)!.slice(k.length + 1) !== '') continue;
    map.set(k, `${k}=${v}`);
  }
  return [...map.values()].join('; ');
}

export async function request(
  method: 'GET' | 'POST',
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: string | URLSearchParams | Record<string, string | number>;
    timeoutMs?: number;
    redirect?: RequestRedirect;
  } = {},
): Promise<HttpResult> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    ...(options.headers || {}),
  };
  let body: string | undefined;
  if (method === 'POST' && options.body != null) {
    if (typeof options.body === 'string') {
      body = options.body;
      if (body.startsWith('{') && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (options.body instanceof URLSearchParams) {
      body = options.body.toString();
      headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
    } else {
      body = new URLSearchParams(
        Object.entries(options.body).map(([k, v]) => [k, String(v)]),
      ).toString();
      headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect: options.redirect || 'manual',
      signal: AbortSignal.timeout(options.timeoutMs || 20_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      const m = text.trim().match(/^\w+\((.*)\);?\s*$/s);
      if (m) {
        try {
          json = JSON.parse(m[1]);
        } catch {
          json = null;
        }
      }
    }
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      body: text,
      json,
      cookies: parseSetCookies(res.headers),
      headers: res.headers,
      error: '',
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: '',
      json: null,
      cookies: '',
      headers: new Headers(),
      error: err instanceof Error ? err.message : 'request failed',
    };
  }
}

export async function requestBuffer(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ status: number; headers: Headers; body: Buffer; cookies: string } | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: options.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs || 25_000),
    });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body, cookies: parseSetCookies(res.headers) };
  } catch {
    return null;
  }
}

export async function followLocation(url: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA, Referer: referer },
      signal: AbortSignal.timeout(20_000),
    });
    const loc = res.headers.get('location');
    if (loc) return new URL(loc, url).toString();
    const text = await res.text();
    const code = text.match(/[?&]code=([^&\s'"]+)/);
    if (code) return `${url}${url.includes('?') ? '&' : '?'}code=${code[1]}`;
    return null;
  } catch {
    return null;
  }
}
