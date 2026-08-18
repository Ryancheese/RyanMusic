import { createHash } from 'node:crypto';

export const VERSION = '1.8.63';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const NETEASE_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.29.205117';

const CN_IP_A = [36, 58, 111, 112, 114, 117, 120, 123, 183, 218, 223];

export function randomCnIp(): string {
  const a = CN_IP_A[Math.floor(Math.random() * CN_IP_A.length)];
  const b = 1 + Math.floor(Math.random() * 254);
  const c = 1 + Math.floor(Math.random() * 254);
  const d = 1 + Math.floor(Math.random() * 254);
  return `${a}.${b}.${c}.${d}`;
}

export function withOsPcCookie(cookie: string): string {
  if (!cookie) return 'os=pc; appver=3.1.29.205117';
  if (/(?:^|;\s*)os=/.test(cookie)) return cookie;
  return `${cookie}; os=pc; appver=3.1.29.205117`;
}

export type MusicSource = 'netease' | 'qq';

export interface Track {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
  lrc: string;
  yrc?: string;
  tlyric?: string;
  url: string;
  pic: string;
  link?: string;
}

export interface SearchPayload {
  data: Track[] | '';
  code: number;
  error: string;
  has_more?: boolean;
}

export function bootstrapBase(): string | null {
  const raw = process.env.MC_QQ_PYQ_BOOTSTRAP ?? 'https://music.90svip.cn/';
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

export function apiSecret(coreMarker: string): string {
  const explicit = process.env.MC_API_SECRET;
  if (explicit) return explicit;
  return createHash('sha256').update(`${coreMarker}|ryanmusic-api`).digest('hex');
}
