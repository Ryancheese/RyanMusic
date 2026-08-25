import dns from 'node:dns';
import { Resolver } from 'node:dns/promises';
import { UA } from './config.ts';

const FAKE_IP_MASK = 0xfffe0000;
const FAKE_IP_NET = ipToInt('198.18.0.0') & FAKE_IP_MASK;
const DEFAULT_TIMEOUT_MS = 8_000;
const BUFFER_TIMEOUT_MS = 12_000;
const REDIRECT_TIMEOUT_MS = 3_000;
const DNS_TIMEOUT_MS = 1_200;
const DOH_TIMEOUT_MS = 1_500;
const SYSTEM_DNS_GRACE_MS = 280;
const hostCache = new Map<string, string>();
let dnsPatched = false;
const originalLookup = dns.lookup.bind(dns);

const cnResolver = new Resolver();
cnResolver.setServers(['223.5.5.5', '119.29.29.29']);
const intlResolver = new Resolver();
intlResolver.setServers(['1.1.1.1', '8.8.8.8']);

export const PROXY_ENV_KEYS = [
  'http_proxy',
  'https_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
  'socks_proxy',
  'SOCKS_PROXY',
  'socks5_proxy',
  'SOCKS5_PROXY',
  'socks5h_proxy',
  'SOCKS5H_PROXY',
  'ftp_proxy',
  'FTP_PROXY',
] as const;

function ipToInt(ip: string): number {
  const p = ip.split('.').map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return 0;
  return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
}

export function isFakeIp(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  return (ipToInt(ip) & FAKE_IP_MASK) === FAKE_IP_NET;
}

export function isLiteralHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  if (!value) return true;
  if (value === 'localhost' || value.endsWith('.local')) return true;
  if (value === '::1' || value === '[::1]') return true;
  return /^\d+\.\d+\.\d+\.\d+$/.test(value);
}

function firstRealA(answers: Array<{ type?: number; data?: string }> | string[] | undefined): string | null {
  if (!answers?.length) return null;
  for (const ans of answers) {
    const ip = typeof ans === 'string' ? ans : ans.type === 1 ? ans.data : undefined;
    if (ip && !isFakeIp(ip)) return ip;
  }
  return null;
}

async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveUdp(resolver: Resolver, host: string): Promise<string | null> {
  try {
    const ips = await withTimeout(resolver.resolve4(host), DNS_TIMEOUT_MS);
    return firstRealA(ips);
  } catch {
    return null;
  }
}

async function dohQuery(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json', 'User-Agent': 'RyanMusic/1.0' },
      signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
    });
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    return firstRealA(json.Answer);
  } catch {
    return null;
  }
}

async function dohResolve(host: string): Promise<string | null> {
  const name = encodeURIComponent(host);
  return raceFirstNonNull([
    // 走解析器 IP，避免 DoH 域名自己再被假 IP 劫持
    dohQuery(`https://223.5.5.5/resolve?name=${name}&type=A`),
    dohQuery(`https://1.1.1.1/dns-query?name=${name}&type=A`),
  ]);
}

async function raceFirstNonNull<T>(tasks: Array<Promise<T | null>>): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = tasks.length;
    if (!pending) {
      resolve(null);
      return;
    }
    let settled = false;
    for (const task of tasks) {
      void task.then((value) => {
        if (!settled && value) {
          settled = true;
          resolve(value);
          return;
        }
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      }).catch(() => {
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      });
    }
  });
}

export async function resolveHost(host: string): Promise<string | null> {
  const key = host.toLowerCase();
  if (isLiteralHost(key)) return null;
  const cached = hostCache.get(key);
  if (cached) return cached;
  const ip = await raceFirstNonNull([
    resolveUdp(cnResolver, key),
    resolveUdp(intlResolver, key),
    dohResolve(key),
  ]);
  if (ip) hostCache.set(key, ip);
  return ip;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

function firstLookupIp(address: string | dns.LookupAddress[] | undefined): string | null {
  if (!address) return null;
  if (typeof address === 'string') return address;
  const v4 = address.find((item) => item.family === 4) || address[0];
  return v4?.address || null;
}

function systemLookup(
  hostname: string,
  opts: dns.LookupOptions,
): Promise<{
  err: NodeJS.ErrnoException | null;
  address: string | dns.LookupAddress[];
  family?: number;
}> {
  return new Promise((resolve) => {
    const forced: dns.LookupOptions = { ...opts, family: opts.family || 4 };
    originalLookup(hostname, forced, (err, address, family) => {
      resolve({ err, address, family });
    });
  });
}

function patchedLookup(
  hostname: string,
  options?: dns.LookupOneOptions | dns.LookupAllOptions | dns.LookupOptions | number | LookupCallback,
  callback?: LookupCallback,
): void {
  const opts = typeof options === 'function' || options == null
    ? {}
    : typeof options === 'number'
      ? { family: options }
      : options;
  const cb = (typeof options === 'function' ? options : callback) as LookupCallback;
  if (isLiteralHost(hostname)) {
    originalLookup(hostname, opts as dns.LookupOptions, cb as Parameters<typeof originalLookup>[2]);
    return;
  }

  let finished = false;
  const finish: LookupCallback = (err, address, family) => {
    if (finished) return;
    finished = true;
    cb(err, address, family);
  };
  const deliverIp = (ip: string) => {
    if ((opts as dns.LookupAllOptions).all) {
      finish(null, [{ address: ip, family: 4 }]);
      return;
    }
    finish(null, ip, 4);
  };

  const system = systemLookup(hostname, opts as dns.LookupOptions);
  const publicDns = new Promise<string | null>((resolve) => {
    setTimeout(() => {
      void resolveHost(hostname).then(resolve).catch(() => resolve(null));
    }, SYSTEM_DNS_GRACE_MS);
  });

  void Promise.race([
    system.then((result) => ({ src: 'sys' as const, result })),
    publicDns.then((ip) => ({ src: 'pub' as const, ip })),
  ]).then(async (winner) => {
    if (winner.src === 'sys') {
      const ip = firstLookupIp(winner.result.address);
      if (!winner.result.err && ip && !isFakeIp(ip)) {
        finish(winner.result.err, winner.result.address, winner.result.family);
        return;
      }
      const bypass = await resolveHost(hostname);
      if (bypass) {
        deliverIp(bypass);
        return;
      }
      finish(winner.result.err, winner.result.address, winner.result.family);
      return;
    }
    if (winner.ip) {
      deliverIp(winner.ip);
      return;
    }
    const sys = await system;
    const ip = firstLookupIp(sys.address);
    if (!sys.err && ip && !isFakeIp(ip)) {
      finish(sys.err, sys.address, sys.family);
      return;
    }
    const bypass = await resolveHost(hostname);
    if (bypass) {
      deliverIp(bypass);
      return;
    }
    finish(sys.err, sys.address, sys.family);
  }).catch(() => {
    originalLookup(hostname, opts as dns.LookupOptions, cb as Parameters<typeof originalLookup>[2]);
  });
}

export function stripProxyEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of PROXY_ENV_KEYS) {
    delete env[key];
  }
  env.NO_PROXY = '*';
  env.no_proxy = '*';
}

/** 绕开梯子假 IP / IPv6 空转，让网易云、QQ 走真实地址 */
export function installDirectNetwork(): void {
  stripProxyEnv();
  try {
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  } catch {
    // Vercel 等环境可能锁住该变量
  }
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // ignore
  }
  if (dnsPatched) return;
  dnsPatched = true;
  try {
    (dns as typeof dns & { lookup: typeof patchedLookup }).lookup = patchedLookup as typeof dns.lookup;
  } catch {
    // Vercel 等 serverless 环境可能不允许 patch dns.lookup
  }
}

if (!process.env.VERCEL) {
  installDirectNetwork();
}

function thirdPartyTimeout(url: string): number {
  if (/90svip\.cn|myhkw\.cn/i.test(url)) return 6_000;
  if (/injahow\.cn/i.test(url)) return 2_800;
  return DEFAULT_TIMEOUT_MS;
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

/** 只限制连上的时间，拿到响应头后不再打断音频流 */
export async function fetchOpen(
  url: string,
  init: RequestInit & { connectTimeoutMs?: number } = {},
): Promise<Response> {
  const { connectTimeoutMs = 4_000, ...rest } = init;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), connectTimeoutMs);
  if (rest.signal) {
    if (rest.signal.aborted) ac.abort();
    else rest.signal.addEventListener('abort', () => ac.abort(), { once: true });
  }
  try {
    const res = await fetch(url, { ...rest, signal: ac.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
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
      signal: AbortSignal.timeout(options.timeoutMs || thirdPartyTimeout(url)),
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
      signal: AbortSignal.timeout(options.timeoutMs || BUFFER_TIMEOUT_MS),
    });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body, cookies: parseSetCookies(res.headers) };
  } catch {
    return null;
  }
}

export async function followLocation(url: string, referer: string, timeoutMs = REDIRECT_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA, Referer: referer },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const loc = res.headers.get('location');
    if (loc) {
      void res.body?.cancel();
      return new URL(loc, url).toString();
    }
    const text = await res.text();
    const code = text.match(/[?&]code=([^&\s'"]+)/);
    if (code) return `${url}${url.includes('?') ? '&' : '?'}code=${code[1]}`;
    return null;
  } catch {
    return null;
  }
}
