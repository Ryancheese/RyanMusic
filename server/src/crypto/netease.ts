import { createCipheriv, createHash, randomInt } from 'node:crypto';
import { NETEASE_UA, randomCnIp, withOsPcCookie } from '../config.ts';
import { request, type HttpResult } from '../http.ts';

const LINUX_KEY = Buffer.from('7246674226682325323F5E6544673A51', 'hex');
const WEAPI_PRESET = '0CoJUm6Qyw8W8jud';
const WEAPI_IV = Buffer.from('0102030405060708');
const EAPI_KEY = Buffer.from('e82ckenh8dichen8');
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const RSA_N = BigInt(
  '0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7',
);
const RSA_E = BigInt('0x010001');

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function aesEcb(key: Buffer, data: string | Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null);
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return Buffer.concat([cipher.update(input), cipher.final()]);
}

function aesCbc(text: string, key: string): Buffer {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(key), WEAPI_IV);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
}

export function encodeLinuxData(data: unknown): Record<string, string> {
  const json = JSON.stringify(data);
  const raw = aesEcb(LINUX_KEY, json);
  return { eparams: raw.toString('hex').toUpperCase() };
}

function rsaEncrypt(secretKey: string): string {
  const reversed = Buffer.from(secretKey, 'utf8').reverse();
  const padded = Buffer.concat([Buffer.alloc(128 - reversed.length), reversed]);
  const m = BigInt('0x' + padded.toString('hex'));
  const c = modPow(m, RSA_E, RSA_N);
  return c.toString(16).padStart(256, '0');
}

export function weapiEncode(object: Record<string, unknown>): { params: string; encSecKey: string } {
  let secretKey = '';
  for (let i = 0; i < 16; i++) secretKey += BASE62[randomInt(0, 62)];
  const text = JSON.stringify(object);
  const params = aesCbc(aesCbc(text, WEAPI_PRESET).toString('base64'), secretKey).toString('base64');
  return { params, encSecKey: rsaEncrypt(secretKey) };
}

export function eapiEncode(apiPath: string, object: Record<string, unknown>): { params: string } {
  const text = JSON.stringify(object);
  const digest = createHash('md5').update(`nobody${apiPath}use${text}md5forencrypt`).digest('hex');
  const payload = `${apiPath}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return { params: aesEcb(EAPI_KEY, payload).toString('hex').toUpperCase() };
}

export function cookieCsrf(cookie: string): string {
  const m = cookie.match(/(?:^|;\s*)(?:__csrf|MUSIC_CSRF)=([^;]+)/);
  return m ? m[1].trim() : '';
}

export function mergeCookies(existing: string, incoming: string): string {
  const map = new Map<string, string>();
  for (const part of `${existing};${incoming}`.split(';')) {
    const item = part.trim();
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    map.set(item.slice(0, eq).trim(), item);
  }
  return [...map.values()].join('; ');
}

function cookieMap(headers: Record<string, string>, cookie: string): Record<string, string> {
  const headersOut = { ...headers };
  if (cookie) headersOut.Cookie = cookie;
  return headersOut;
}

export async function neteaseHttp(
  method: 'GET' | 'POST',
  url: string,
  body?: Record<string, string> | string,
  cookie = '',
  extraHeaders: Record<string, string> = {},
): Promise<HttpResult> {
  const cnIp = randomCnIp();
  const headers: Record<string, string> = {
    'User-Agent': extraHeaders['User-Agent'] || NETEASE_UA,
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
    'X-Real-IP': cnIp,
    'X-Forwarded-For': cnIp,
    ...extraHeaders,
  };
  return request(method, url, {
    headers: cookieMap(headers, cookie ? withOsPcCookie(cookie) : cookie),
    body,
    redirect: 'manual',
  });
}

export async function linuxForward(
  apiPath: string,
  params: Record<string, unknown>,
  cookie = '',
  method: 'GET' | 'POST' = 'POST',
): Promise<HttpResult> {
  const encoded = encodeLinuxData({
    method,
    url: `https://music.163.com${apiPath}`,
    params,
  });
  return neteaseHttp('POST', 'https://music.163.com/api/linux/forward', encoded, cookie);
}

export async function neteaseApi(
  apiPath: string,
  params: Record<string, unknown> = {},
  cookie = '',
  method: 'GET' | 'POST' = 'GET',
): Promise<HttpResult> {
  if (method === 'GET') {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
    ).toString();
    const url = `https://music.163.com${apiPath}${qs ? `?${qs}` : ''}`;
    const res = await neteaseHttp('GET', url, undefined, cookie);
    if (res.ok && res.json) return res;
  } else {
    const body = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
    );
    const res = await neteaseHttp('POST', `https://music.163.com${apiPath}`, body, cookie);
    if (res.ok && res.json) return res;
  }
  return linuxForward(apiPath, params, cookie, method);
}

export async function weapiRequest(
  path: string,
  data: Record<string, unknown>,
  cookie = '',
): Promise<HttpResult> {
  const encoded = weapiEncode(data);
  const csrf = cookieCsrf(cookie);
  const url = `https://music.163.com${path}${path.includes('?') ? '&' : '?'}csrf_token=${encodeURIComponent(csrf)}`;
  return neteaseHttp('POST', url, encoded, cookie);
}

function eapiClientHeader(cookie: string): Record<string, string> {
  const now = String(Math.floor(Date.now() / 1000));
  const header: Record<string, string> = {
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId: `p${createHash('md5').update(now + String(randomInt(0, 999999))).digest('hex').slice(0, 15)}`,
    os: 'pc',
    appver: '3.1.17.204416',
    versioncode: '140',
    mobilename: '',
    buildver: now.slice(0, 10),
    resolution: '1920x1080',
    __csrf: cookieCsrf(cookie),
    channel: 'netease',
    requestId: `${now}_${String(randomInt(0, 9999)).padStart(4, '0')}`,
  };
  const m = cookie.match(/(?:^|;\s*)MUSIC_U=([^;]+)/);
  if (m) header.MUSIC_U = m[1].trim();
  return header;
}

export async function eapiRequest(
  apiPath: string,
  data: Record<string, unknown>,
  cookie = '',
): Promise<HttpResult> {
  const header = eapiClientHeader(cookie);
  const payload: Record<string, unknown> = { ...data, header, e_r: data.e_r ?? false };
  const encoded = eapiEncode(apiPath, payload);
  const eapiSuffix = `/eapi/${apiPath.replace(/^\/api\//, '')}`;
  const hosts = [
    'https://interfacepc.music.163.com',
    'https://interface.music.163.com',
    'https://music.163.com',
  ];
  const cookieParts = Object.entries(header).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
  );
  if (cookie) cookieParts.push(withOsPcCookie(cookie));
  const cnIp = randomCnIp();
  let last: HttpResult = {
    ok: false,
    status: 0,
    body: '',
    json: null,
    cookies: '',
    headers: new Headers(),
    error: 'eapi 全部失败',
  };
  for (const host of hosts) {
    last = await request('POST', host + eapiSuffix, {
      headers: {
        'User-Agent': NETEASE_UA,
        Referer: 'https://music.163.com/',
        Origin: 'https://music.163.com',
        Cookie: cookieParts.join('; '),
        'X-Real-IP': cnIp,
        'X-Forwarded-For': cnIp,
      },
      body: encoded,
    });
    if (last.ok && last.json) return last;
  }
  return last;
}
