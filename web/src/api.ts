import type { MusicSource, SearchCategory, SearchResponse, Track } from './types';
import { getSizedCoverUrl } from './utils/coverUrl';

function origin(): string {
  return `${window.location.origin}${window.location.pathname.replace(/index\.php$/, '')}`;
}

function apiEndpoint(): string {
  const base = origin().replace(/\/$/, '') || window.location.origin;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.vercel.app') || host === 'ryanmusic.vercel.app') {
    return `${base}/api`;
  }
  return base;
}

const API_TIMEOUT_MS = 15_000;
const LYRICS_TIMEOUT_MS = 45_000;

async function postForm(body: URLSearchParams, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  return fetch(apiEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
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
  category?: SearchCategory;
}): Promise<SearchResponse> {
  const body = new URLSearchParams({
    input: options.input,
    filter: options.filter,
    type: options.type,
    page: String(options.page || 1),
    category: options.category || 'all',
  });

  const response = await postForm(body);

  const json = (await response.json()) as SearchResponse;
  if (json.code === 200) {
    if (Array.isArray(json.data)) {
      json.data = json.data.map((item) => (
        'songid' in item ? normalizeTrack(item as Track) : item
      ));
    } else if (json.data && typeof json.data === 'object' && 'songs' in json.data) {
      json.data = {
        ...json.data,
        songs: json.data.songs.map(normalizeTrack),
      };
    }
  }
  return json;
}

export async function fetchTrackById(type: MusicSource, songid: string): Promise<Track | null> {
  const result = await searchMusic({
    input: String(songid),
    filter: 'id',
    type,
    page: 1,
    category: 'song',
  });
  if (result.code !== 200 || !Array.isArray(result.data) || !result.data.length) return null;
  return result.data[0];
}

export async function fetchSignedMedia(
  type: MusicSource,
  songid: string,
  meta?: { title?: string; author?: string; delisted?: boolean },
): Promise<{ url: string; pic: string; delisted?: boolean } | null> {
  const res = await postAction<{ url?: string; pic?: string; delisted?: boolean }>('sign_media', {
    type,
    id: String(songid),
    title: meta?.title || '',
    author: meta?.author || '',
    delisted: meta?.delisted ? '1' : '',
  });
  if (res.code !== 200 || !res.data?.url) return null;
  return {
    url: resolveMediaUrl(res.data.url),
    pic: resolveMediaUrl(res.data.pic || ''),
    delisted: Boolean(res.data.delisted || meta?.delisted),
  };
}

export function coverRefreshUrl(type: MusicSource, songid: string): string {
  const base = origin().replace(/\/$/, '') || window.location.origin;
  return `${base}/?cover=1&type=${encodeURIComponent(type)}&id=${encodeURIComponent(songid)}`;
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
  const base = origin().replace(/\/$/, '') || window.location.origin;
  return `${base}/?img=1&url=${encodeURIComponent(sized)}`;
}

export function buildDownloadUrl(url: string, name: string): string {
  if (/api\.php\?/i.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}dl=1&name=${encodeURIComponent(name)}`;
  }
  return `${(origin().replace(/\/$/, '') || window.location.origin)}/?download=1&url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

export async function postAction<T = unknown>(
  action: string,
  data: Record<string, string> = {},
  timeoutMs = API_TIMEOUT_MS,
): Promise<{
  data: T;
  code: number;
  error: string;
}> {
  const body = new URLSearchParams({ action, ...data });
  const response = await postForm(body, timeoutMs);
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

export function fetchKugouStatus() {
  return postAction<AccountStatus>('kugou_status');
}

export interface CloudPlaylist {
  id: string;
  name: string;
  cover?: string;
  trackCount?: number;
  specialType?: number;
  dirid?: number;
  subscribed?: boolean;
  order?: number;
  createTime?: number;
  description?: string;
  /** 网易云 / QQ 推荐区虚拟条目 */
  recommendKind?: 'daily' | 'radar' | 'fm' | 'playlist';
}

export interface NeteaseRecommendItem extends CloudPlaylist {
  recommendKind: 'daily' | 'radar' | 'fm' | 'playlist';
}

export interface CloudTrack {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
  pic?: string;
  delisted?: boolean;
}

export interface CloudPlaylistDetail {
  id?: string;
  playlistId?: string;
  name?: string;
  cover?: string;
  total?: number;
  trackIds?: Array<string | number>;
  tracks?: CloudTrack[];
}

export function fetchNeteasePlaylists() {
  return postAction<{ playlists: CloudPlaylist[] }>('netease_playlists');
}

export function fetchNeteaseRecommendFeed(limit = 24) {
  return postAction<{ items: NeteaseRecommendItem[] }>('netease_recommend_feed', {
    limit: String(limit),
  });
}

export function fetchNeteaseDailySongs() {
  return postAction<CloudPlaylistDetail>('netease_daily_songs');
}

export function fetchNeteasePersonalFm() {
  return postAction<{ tracks: CloudTrack[] }>('netease_personal_fm');
}

export function fetchQqPlaylists() {
  return postAction<{ playlists: CloudPlaylist[] }>('qq_playlists');
}

export function fetchQqRecommendFeed(limit = 24) {
  return postAction<{ items: NeteaseRecommendItem[] }>('qq_recommend_feed', {
    limit: String(limit),
  });
}

export function fetchQqPersonalFm() {
  return postAction<{ tracks: CloudTrack[] }>('qq_personal_fm');
}

export function fetchQqDailySongs() {
  return postAction<CloudPlaylistDetail>('qq_daily_songs');
}

export function fetchQqRadarSongs() {
  return postAction<CloudPlaylistDetail>('qq_radar_songs');
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

export function addNeteasePlaylistTrack(playlistId: string, songid: string) {
  return postAction<{ playlistId: string; songid: string; added: boolean }>('netease_playlist_add', {
    playlistId,
    songid,
  });
}

export function addQqPlaylistTrack(options: { playlistId: string; songid: string; dirid?: number }) {
  return postAction<{ playlistId: string; songid: string; added: boolean; dirId?: number }>('qq_playlist_add', {
    playlistId: options.playlistId,
    songid: options.songid,
    dirid: options.dirid ? String(options.dirid) : '',
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
  album?: string;
  durationMs?: number;
  preferred?: 'netease' | 'qq' | 'kugou' | 'amll';
  autoUseBest?: boolean;
  forceSource?: boolean;
  nativeOnly?: boolean;
  providerSongId?: string;
  kgHash?: string;
  amllPlatform?: 'ncm' | 'qq';
}): Promise<(Pick<Track, 'lrc' | 'yrc' | 'tlyric' | 'lyricSource'>) | null> {
  const result = await postAction<Pick<Track, 'lrc' | 'yrc' | 'tlyric'> & { source?: string }>('lyrics', {
    type: options.type,
    id: String(options.songid),
    title: options.title || '',
    artist: options.artist || '',
    album: options.album || '',
    durationMs: options.durationMs ? String(Math.round(options.durationMs)) : '',
    preferred: options.nativeOnly ? '' : (options.preferred || ''),
    autoUseBest: options.autoUseBest ? '1' : '0',
    forceSource: options.forceSource ? '1' : '0',
    providerSongId: options.providerSongId || '',
    kgHash: options.kgHash || '',
    amllPlatform: options.amllPlatform || '',
  }, LYRICS_TIMEOUT_MS);
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

export interface LyricSearchCandidate {
  provider: 'netease' | 'qq' | 'kugou' | 'amll';
  providerSongId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  pic: string;
  matchScore: number;
  titleMatched: boolean;
  artistMatched: boolean;
  kgHash?: string;
  amllPlatform?: 'ncm' | 'qq';
}

export async function searchLyricCandidates(options: {
  title: string;
  artist: string;
  durationMs?: number;
  source: 'netease' | 'qq' | 'kugou' | 'amll';
  query?: string;
  /** 正在播放曲目的平台 ID，与 source 同源时优先置顶 */
  nativeSongId?: string;
  nativeSource?: 'netease' | 'qq';
}): Promise<LyricSearchCandidate[]> {
  const result = await postAction<LyricSearchCandidate[]>('lyrics_search', {
    title: options.title || '',
    artist: options.artist || '',
    durationMs: options.durationMs ? String(Math.round(options.durationMs)) : '',
    source: options.source,
    query: options.query || '',
    nativeSongId: options.nativeSongId || '',
    nativeSource: options.nativeSource || '',
  }, LYRICS_TIMEOUT_MS);
  if (result.code !== 200 || !Array.isArray(result.data)) return [];
  return result.data.map((item) => ({
    ...item,
    title: item.title || '',
    artist: item.artist || '',
    album: item.album || '',
    matchScore: Number(item.matchScore) || 0,
    pic: resolveCandidateCover(item.pic || '', item.provider, item.providerSongId),
  }));
}

function resolveCandidateCover(pic: string, provider: string, providerSongId: string): string {
  const raw = (pic || '').trim();
  if (!raw) {
    if (provider === 'netease' && providerSongId) {
      return coverRefreshUrl('netease', providerSongId);
    }
    if (provider === 'qq' && providerSongId) {
      return coverRefreshUrl('qq', providerSongId);
    }
    return '';
  }
  if (raw.includes('api.php') || raw.includes('get=pic') || raw.includes('cover=1')) {
    return resolveMediaUrl(raw);
  }
  return coverImageUrl(raw, 120);
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

export type CommentSource = 'netease' | 'qq' | 'kugou';

export interface CommentsPayload {
  total: number;
  more: boolean;
  offset: number;
  limit: number;
  hotComments: SongComment[];
  comments: SongComment[];
  source?: CommentSource;
  sourceId?: string;
  neteaseId: string;
  matched: { type: CommentSource; songid: string; title: string; author: string } | null;
}

export function fetchSongComments(options: {
  type: MusicSource;
  id: string;
  title?: string;
  artist?: string;
  offset?: number;
  limit?: number;
  preferred?: CommentSource;
  source?: CommentSource;
  /** 自动选择评论数最多的平台 */
  mode?: 'best' | '';
}) {
  return postAction<CommentsPayload>('netease_comments', {
    type: options.type,
    id: String(options.id),
    title: options.title || '',
    artist: options.artist || '',
    offset: String(options.offset || 0),
    limit: String(options.limit || 20),
    preferred: options.preferred || '',
    source: options.source || '',
    mode: options.mode || '',
  });
}

export type CacheCategoryId = 'lyrics' | 'play' | 'comments' | 'other';

export interface CacheCategoryUsage {
  id: CacheCategoryId;
  bytes: number;
  entries: number;
  dirs: string[];
  mb: number;
}

export interface CacheUsage {
  rebuildableBytes: number;
  preservedBytes: number;
  totalBytes: number;
  rebuildableEntries: number;
  totalMB: number;
  rebuildableMB: number;
  preservedMB: number;
  categories?: CacheCategoryUsage[];
}

export interface ClearCacheResult {
  removedBytes: number;
  removedEntries: number;
  removedMB: number;
  preserved: string[];
  category?: CacheCategoryId | 'all';
  usage?: CacheUsage;
}

/** 查询当前缓存占用 */
export async function fetchCacheUsage() {
  return postAction<CacheUsage>('cache_usage');
}

/** 清理可重建缓存（保留登录态）；可指定分类 */
export async function clearAppCache(category: CacheCategoryId | 'all' = 'all') {
  return postAction<ClearCacheResult>('clear_cache', { category });
}
