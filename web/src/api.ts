import type { MusicSource, SearchResponse, Track } from './types';
import { getSizedCoverUrl } from './utils/coverUrl';

function origin(): string {
  return `${window.location.origin}${window.location.pathname.replace(/index\.php$/, '')}`;
}

const API_TIMEOUT_MS = 15_000;

async function postForm(body: URLSearchParams): Promise<Response> {
  return fetch(origin(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
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

  const response = await postForm(body);

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

/** 126.net 用 param 缩略图；桌面 WebView2 再经本地代理带 Referer，避免 CDN 防盗链。 */
export function coverImageUrl(url?: string, size = 400): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.includes('cover=1') || raw.includes('img=1') || raw.includes('get=pic')) return raw;

  let absolute = raw;
  if (raw.startsWith('//')) absolute = `https:${raw}`;
  else if (raw.startsWith('http://')) absolute = `https://${raw.slice(7)}`;
  else if (!/^https?:\/\//i.test(raw)) return raw;

  const sized = getSizedCoverUrl(absolute, size) || absolute;
  return `${origin()}?img=1&url=${encodeURIComponent(sized)}`;
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
  const response = await postForm(body);
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

export function toggleNeteaseLike(songid: string, like: boolean) {
  return postAction<{ liked: boolean; id: string }>('netease_like', {
    id: String(songid),
    like: like ? '1' : '0',
  });
}

export function checkNeteaseLike(songid: string) {
  return postAction<{ liked: boolean; id: string }>('netease_like_check', {
    id: String(songid),
  });
}

export function toggleQqLike(songid: string, like: boolean) {
  return postAction<{ liked: boolean; id: string }>('qq_like', {
    id: String(songid),
    like: like ? '1' : '0',
  });
}

export function checkQqLike(songid: string) {
  return postAction<{ liked: boolean; id: string }>('qq_like_check', {
    id: String(songid),
  });
}

export async function fetchTrackLyrics(options: {
  type: MusicSource;
  songid: string;
  title?: string;
  artist?: string;
  durationMs?: number;
  preferred?: 'netease' | 'qq' | 'kugou' | 'amll';
  autoUseBest?: boolean;
  forceSource?: boolean;
}): Promise<(Pick<Track, 'lrc' | 'yrc' | 'tlyric' | 'lyricSource'>) | null> {
  const result = await postAction<Pick<Track, 'lrc' | 'yrc' | 'tlyric'> & { source?: string }>('lyrics', {
    type: options.type,
    id: String(options.songid),
    title: options.title || '',
    artist: options.artist || '',
    durationMs: options.durationMs ? String(Math.round(options.durationMs)) : '',
    preferred: options.preferred || '',
    autoUseBest: options.autoUseBest ? '1' : '0',
    forceSource: options.forceSource ? '1' : '0',
  });
  if (result.code !== 200 || !result.data) return null;
  const source = result.data.source;
  const lyricSource = (
    source === 'netease' || source === 'qq' || source === 'kugou' || source === 'amll' || source === 'native'
  ) ? source : undefined;
  return {
    lrc: result.data.lrc || '',
    yrc: result.data.yrc || '',
    tlyric: result.data.tlyric || '',
    lyricSource,
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


export interface PlayQuality {
  level: string;
  label: string;
  br?: number;
  size?: number;
}

export async function fetchNeteaseQualities(songid: string) {
  return postAction<{ qualities: PlayQuality[] }>('netease_qualities', { id: songid });
}

export interface SongComment {
  id: string;
  userId: string;
  nickname: string;
  avatar: string;
  content: string;
  time: number;
  timeStr: string;
  likedCount: number;
  liked: boolean;
  location: string;
  reply: { nickname: string; content: string } | null;
}

export interface CommentsPayload {
  total: number;
  more: boolean;
  offset: number;
  limit: number;
  hotComments: SongComment[];
  comments: SongComment[];
  neteaseId: string;
  matched: { type: 'netease'; songid: string; title: string; author: string } | null;
}

export function fetchNeteaseComments(options: {
  type: MusicSource;
  id: string;
  title?: string;
  artist?: string;
  offset?: number;
  limit?: number;
}) {
  return postAction<CommentsPayload>('netease_comments', {
    type: options.type,
    id: String(options.id),
    title: options.title || '',
    artist: options.artist || '',
    offset: String(options.offset || 0),
    limit: String(options.limit || 20),
  });
}

export interface CacheUsage {
  rebuildableBytes: number;
  preservedBytes: number;
  totalBytes: number;
  rebuildableEntries: number;
  totalMB: number;
  rebuildableMB: number;
  preservedMB: number;
}

export interface ClearCacheResult {
  removedBytes: number;
  removedEntries: number;
  removedMB: number;
  preserved: string[];
  usage?: CacheUsage;
}

/** 查询当前缓存占用 */
export async function fetchCacheUsage() {
  return postAction<CacheUsage>('cache_usage');
}

/** 清理可重建缓存（保留登录态） */
export async function clearAppCache() {
  return postAction<ClearCacheResult>('clear_cache');
}
