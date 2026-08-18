import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

export function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // ignore
  }
}

export function cookieGet(cookie: string, key: string): string {
  const map = cookieToMap(cookie);
  return map[key] || '';
}

export function cookieToMap(cookie: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of cookie.split(';')) {
    const item = part.trim();
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    map[item.slice(0, eq).trim()] = item.slice(eq + 1).trim();
  }
  return map;
}

export function mergeCookies(existing: string, incoming: string): string {
  const map = cookieToMap(existing);
  const extra = cookieToMap(incoming);
  for (const [k, v] of Object.entries(extra)) {
    if (v === '' && map[k]) continue;
    map[k] = v;
  }
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function normalizeCookie(raw: string): string {
  return raw.replace(/\r?\n/g, ';').replace(/;;+/g, ';').trim();
}

export function hash33(text: string): number {
  let e = 0;
  for (let n = 0; n < text.length; n++) {
    e = (e + (((e << 5) & 0x7fffffff) + text.charCodeAt(n))) & 0x7fffffff;
  }
  return e & 2147483647;
}
