import { createHash } from 'node:crypto';

export const VERSION = '1.8.56';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const NETEASE_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.29.205117';

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
