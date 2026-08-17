import type { MusicSource, SearchResponse, Track } from './types';

function origin(): string {
  return `${window.location.origin}${window.location.pathname.replace(/index\.php$/, '')}`;
}

export function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return origin() + url.replace(/^\//, '');
}

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    songid: String(track.songid),
    url: resolveMediaUrl(track.url),
    pic: resolveMediaUrl(track.pic),
    lrc: track.lrc || '',
  };
}

export async function searchMusic(options: {
  input: string;
  filter: 'name' | 'id' | 'url';
  type: MusicSource | '_';
  page?: number;
}): Promise<SearchResponse> {
  const body = new URLSearchParams({
    input: options.input,
    filter: options.filter,
    type: options.type,
    page: String(options.page || 1),
  });

  const response = await fetch(origin(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });

  const json = (await response.json()) as SearchResponse;
  if (json.code === 200 && Array.isArray(json.data)) {
    json.data = json.data.map(normalizeTrack);
  }
  return json;
}

export async function fetchTrackById(type: MusicSource, songid: string): Promise<Track | null> {
  const result = await searchMusic({
    input: String(songid),
    filter: 'id',
    type,
    page: 1,
  });
  if (result.code !== 200 || !result.data?.length) return null;
  return result.data[0];
}

export function coverRefreshUrl(type: MusicSource, songid: string): string {
  return `${origin()}?cover=1&type=${encodeURIComponent(type)}&id=${encodeURIComponent(songid)}`;
}

export function buildDownloadUrl(url: string, name: string): string {
  if (/api\.php\?/i.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}dl=1&name=${encodeURIComponent(name)}`;
  }
  return `${origin()}?download=1&url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

export function canNativeSave(): boolean {
  return Boolean(window.webkit?.messageHandlers?.ryanSave);
}

export function nativeSave(payload: { url?: string; text?: string; filename: string }): boolean {
  try {
    window.webkit?.messageHandlers?.ryanSave?.postMessage(payload);
    return true;
  } catch {
    return false;
  }
}
