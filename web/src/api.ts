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
    yrc: track.yrc || '',
    tlyric: track.tlyric || '',
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

export async function postAction<T = unknown>(action: string, data: Record<string, string> = {}): Promise<{
  data: T;
  code: number;
  error: string;
}> {
  const body = new URLSearchParams({ action, ...data });
  const response = await fetch(origin(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });
  return (await response.json()) as { data: T; code: number; error: string };
}

export interface AccountStatus {
  loggedIn: boolean;
  nickname?: string;
  vip?: number;
  uid?: number;
  uin?: string;
  avatar?: string;
}

export function fetchNeteaseStatus() {
  return postAction<AccountStatus>('netease_status');
}

export function fetchQqStatus() {
  return postAction<AccountStatus>('qq_status');
}

export interface CloudPlaylist {
  id: string;
  name: string;
  cover?: string;
  trackCount?: number;
  specialType?: number;
  dirid?: number;
  subscribed?: boolean;
}

export interface CloudTrack {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
  pic?: string;
}

export interface CloudPlaylistDetail {
  id?: string;
  playlistId?: string;
  name?: string;
  total?: number;
  trackIds?: Array<string | number>;
  tracks?: CloudTrack[];
}

export function fetchNeteasePlaylists() {
  return postAction<{ playlists: CloudPlaylist[] }>('netease_playlists');
}

export function fetchQqPlaylists() {
  return postAction<{ playlists: CloudPlaylist[] }>('qq_playlists');
}

export function fetchNeteasePlaylistDetail(id: string, offset = 0, limit = 200) {
  return postAction<CloudPlaylistDetail>('netease_playlist_detail', {
    id,
    offset: String(offset),
    limit: String(limit),
  });
}

export function fetchNeteaseLikelist(offset = 0, limit = 200) {
  return postAction<CloudPlaylistDetail>('netease_likelist', {
    offset: String(offset),
    limit: String(limit),
  });
}

export function fetchQqPlaylistDetail(id: string) {
  return postAction<CloudPlaylistDetail>('qq_playlist_detail', { id });
}

export function fetchQqLikelist() {
  return postAction<CloudPlaylistDetail>('qq_likelist');
}

export async function fetchTrackLyrics(type: MusicSource, songid: string): Promise<Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null> {
  const result = await postAction<Pick<Track, 'lrc' | 'yrc' | 'tlyric'>>('lyrics', {
    type,
    id: String(songid),
  });
  if (result.code !== 200 || !result.data) return null;
  return {
    lrc: result.data.lrc || '',
    yrc: result.data.yrc || '',
    tlyric: result.data.tlyric || '',
  };
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
