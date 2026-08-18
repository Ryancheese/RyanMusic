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
    e += (e << 5) + text.charCodeAt(n);
  }
  return e & 2147483647;
}

/** QQ oauth g_tk：从 p_skey 算，初值必须是 5381，和 ptqrtoken 的 hash33 不是同一个函数。 */
export function getGtk(pSkey: string): number {
  let hash = 5381;
  for (let i = 0; i < pSkey.length; i++) {
    hash += (hash << 5) + pSkey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

export function qqGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  }).toUpperCase();
}
