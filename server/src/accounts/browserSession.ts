export const NE_COOKIE = 'rm_ne';
export const NE_META = 'rm_ne_meta';
export const QQ_COOKIE = 'rm_qq';
export const QQ_META = 'rm_qq_meta';

export interface BrowserCookie {
  name: string;
  value: string;
  maxAge?: number;
}

export interface NeteaseMeta {
  uid: number;
  nickname: string;
  avatar: string;
  vip: number;
}

export interface QqMeta {
  uin: string;
  nickname: string;
  vip: number;
}

export function packValue(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function unpackValue(packed?: string | null): string {
  if (!packed) return '';
  try {
    return Buffer.from(packed, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

export function cookieHeaderValue(header: string, name: string): string {
  const parts = header.split(';');
  for (const part of parts) {
    const item = part.trim();
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    if (item.slice(0, eq).trim() === name) return item.slice(eq + 1).trim();
  }
  return '';
}

export function readPackedCookie(header: string, name: string): string {
  return unpackValue(cookieHeaderValue(header, name));
}

export function serializeBrowserCookie(cookie: BrowserCookie, secure: boolean): string {
  const maxAge = cookie.maxAge ?? 0;
  const parts = [
    `${cookie.name}=${cookie.value}`,
    'Path=/',
    `Max-Age=${Math.max(0, maxAge)}`,
    'SameSite=Lax',
    'HttpOnly',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function compactNeteaseCookie(cookie: string): string {
  const map: Record<string, string> = {};
  for (const part of cookie.split(';')) {
    const item = part.trim();
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    map[item.slice(0, eq).trim()] = item.slice(eq + 1).trim();
  }
  const parts = ['MUSIC_U', '__csrf', 'MUSIC_CSRF']
    .filter((key) => map[key])
    .map((key) => `${key}=${map[key]}`);
  return parts.length ? parts.join('; ') : cookie;
}

export function persistCookies(
  cookie: string,
  metaName: string,
  cookieName: string,
  meta: Record<string, unknown>,
): BrowserCookie[] {
  return [
    { name: cookieName, value: packValue(cookie), maxAge: 60 * 60 * 24 * 30 },
    { name: metaName, value: packValue(JSON.stringify(meta)), maxAge: 60 * 60 * 24 * 30 },
  ];
}

export function clearCookies(...names: string[]): BrowserCookie[] {
  return names.map((name) => ({ name, value: '', maxAge: 0 }));
}

export function parseJsonMeta<T>(header: string, name: string): T | null {
  const raw = readPackedCookie(header, name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
