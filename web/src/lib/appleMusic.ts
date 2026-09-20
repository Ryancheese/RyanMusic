import type { SearchAlbumHit, SearchArtistHit, SearchBundle, SearchCategory, SearchPlaylistHit, Track } from '../types';
import { isMacosApp } from './media';

export interface AppleMusicStatus {
  available: boolean;
  authorized: boolean;
  authStatus?: string;
  canPlayCatalog?: boolean;
  canBecomeSubscriber?: boolean;
  nickname?: string;
  error?: string;
}

export interface AppleMusicCoverItem {
  url: string;
  title?: string;
}

export interface AppleMusicPlaylist {
  id: string;
  name: string;
  cover?: string;
  covers?: string[];
  coverItems?: AppleMusicCoverItem[];
  trackCount?: number;
  kind?: 'library' | 'catalog' | string;
  type?: 'apple';
  recommendKind?: 'daily' | 'radar' | 'fm' | 'playlist';
  description?: string;
}

type BridgePayload = Record<string, unknown>;

type Pending = {
  resolve: (value: BridgePayload) => void;
  reject: (error: Error) => void;
};

const pending = new Map<string, Pending>();
const listeners = new Set<(event: BridgePayload) => void>();
let wired = false;
let seq = 0;

function handler() {
  return window.webkit?.messageHandlers?.ryanAppleMusic;
}

export function canUseAppleMusic() {
  return isMacosApp() && Boolean(handler());
}

function ensureWired() {
  if (wired) return;
  wired = true;
  window.__ryanAppleMusicReply = (payload) => {
    const id = String(payload.requestId || payload.id || '');
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (payload.ok === false) {
      job.reject(new Error(friendlyBridgeError(payload.error)));
      return;
    }
    job.resolve(payload);
  };
  window.__ryanAppleMusicEvent = (payload) => {
    listeners.forEach((fn) => fn(payload));
  };
}

function friendlyBridgeError(error: unknown) {
  const raw = String(error || '').trim();
  if (/MusicDataRequest|MusicKit|未能完成操作/i.test(raw)) {
    return 'Apple Music 目录暂时不可用，请改用资料库歌单或最近播放。';
  }
  return raw || 'Apple Music 请求失败';
}

function call(action: string, params: BridgePayload = {}, timeoutMs = 20_000): Promise<BridgePayload> {
  ensureWired();
  const bridge = handler();
  if (!bridge) {
    return Promise.reject(new Error('当前不是 Mac 桌面版，无法使用 Apple Music'));
  }
  const id = `am-${Date.now().toString(36)}-${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('Apple Music 响应超时'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    });
    bridge.postMessage({ requestId: id, action, ...params });
  });
}

export function subscribeAppleMusic(listener: (event: BridgePayload) => void) {
  ensureWired();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function appleMusicStatus(): Promise<AppleMusicStatus> {
  if (!canUseAppleMusic()) {
    return { available: false, authorized: false };
  }
  const data = await call('status');
  return {
    available: true,
    authorized: Boolean(data.authorized),
    authStatus: String(data.authStatus || ''),
    canPlayCatalog: Boolean(data.canPlayCatalog),
    canBecomeSubscriber: Boolean(data.canBecomeSubscriber),
    nickname: String(data.nickname || 'Apple Music'),
    error: data.error ? String(data.error) : undefined,
  };
}

export async function authorizeAppleMusic(): Promise<AppleMusicStatus> {
  const data = await call('authorize', {}, 60_000);
  return {
    available: true,
    authorized: Boolean(data.authorized),
    authStatus: String(data.authStatus || ''),
    canPlayCatalog: Boolean(data.canPlayCatalog),
    canBecomeSubscriber: Boolean(data.canBecomeSubscriber),
    nickname: String(data.nickname || 'Apple Music'),
    error: data.error ? String(data.error) : undefined,
  };
}

function asTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Track => (
    Boolean(item && typeof item === 'object' && (item as Track).songid)
  )).map((item) => ({
    ...item,
    type: 'apple',
    songid: String(item.songid),
    title: item.title || '未知曲目',
    author: item.author || '',
    url: item.url || `applemusic://${item.songid}`,
    pic: item.pic || '',
    lrc: item.lrc || '',
  }));
}

function asPlaylists(value: unknown): SearchPlaylistHit[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SearchPlaylistHit => (
    Boolean(item && typeof item === 'object' && (item as SearchPlaylistHit).id)
  )).map((item) => ({
    ...item,
    type: 'apple',
    id: String(item.id),
    name: item.name || '未命名歌单',
  }));
}

function asAlbums(value: unknown): SearchAlbumHit[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SearchAlbumHit => (
    Boolean(item && typeof item === 'object' && (item as SearchAlbumHit).id)
  )).map((item) => ({
    ...item,
    type: 'apple',
    id: String(item.id),
    name: item.name || '未命名专辑',
  }));
}

function asArtists(value: unknown): SearchArtistHit[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SearchArtistHit => (
    Boolean(item && typeof item === 'object' && (item as SearchArtistHit).id)
  )).map((item) => ({
    ...item,
    type: 'apple',
    id: String(item.id),
    name: item.name || '未知艺人',
  }));
}

export async function searchAppleMusic(term: string, category: SearchCategory = 'all'): Promise<SearchBundle> {
  const data = await call('search', { term, category, limit: 25 });
  return {
    songs: asTracks(data.songs),
    playlists: asPlaylists(data.playlists),
    albums: asAlbums(data.albums),
    artists: asArtists(data.artists),
  };
}

export async function playAppleMusic(
  tracks: Array<string | { songid: string; title?: string; author?: string; durationMs?: number }>,
  index = 0,
) {
  const rows = tracks.map((item) => (
    typeof item === 'string'
      ? { songid: item, title: '', author: '', durationMs: 0 }
      : {
        songid: String(item.songid),
        title: item.title || '',
        author: item.author || '',
        durationMs: item.durationMs || 0,
      }
  ));
  await call('play', {
    songIds: rows.map((item) => item.songid),
    tracks: rows,
    index,
  }, 45_000);
}

export async function pauseAppleMusic() {
  await call('pause');
}

export async function resumeAppleMusic() {
  await call('resume');
}

export async function stopAppleMusic() {
  if (!canUseAppleMusic()) return;
  await call('stop').catch(() => undefined);
}

export async function seekAppleMusic(time: number) {
  await call('seek', { time });
}

export async function fetchAppleLibraryPlaylists(): Promise<AppleMusicPlaylist[]> {
  const data = await call('libraryPlaylists', {}, 45_000);
  return asPlaylists(data.playlists).map((item) => ({
    ...item,
    type: 'apple' as const,
    kind: 'library',
  }));
}

export async function fetchApplePlaylistTracks(id: string, kind: 'library' | 'catalog' = 'library', name = '') {
  const data = await call('playlistTracks', { id, kind, name }, 45_000);
  return {
    id: String(data.id || id),
    name: String(data.name || ''),
    cover: String(data.cover || ''),
    tracks: asTracks(data.tracks),
  };
}

export async function fetchAppleAlbumTracks(id: string) {
  const data = await call('albumTracks', { id });
  return {
    id: String(data.id || id),
    name: String(data.name || ''),
    cover: String(data.cover || ''),
    tracks: asTracks(data.tracks),
  };
}

export async function fetchAppleArtistSongs(id: string) {
  const data = await call('artistSongs', { id });
  return {
    id: String(data.id || id),
    name: String(data.name || ''),
    cover: String(data.cover || ''),
    tracks: asTracks(data.tracks),
  };
}

export async function fetchAppleRecommendations(): Promise<AppleMusicPlaylist[]> {
  const data = await call('recommendations');
  if (!Array.isArray(data.items)) return [];
  return data.items.filter((item): item is AppleMusicPlaylist => (
    Boolean(item && typeof item === 'object' && (item as AppleMusicPlaylist).id)
  )).map((item) => ({
    ...item,
    id: String(item.id),
    name: item.name || '推荐',
    recommendKind: item.recommendKind || 'playlist',
    type: 'apple',
    coverItems: Array.isArray(item.coverItems)
      ? item.coverItems
        .map((cover) => ({
          url: String(cover?.url || ''),
          title: String(cover?.title || item.name || ''),
        }))
        .filter((cover) => cover.url)
      : undefined,
  }));
}

export function isAppleTrack(track?: { type?: string; url?: string } | null) {
  if (!track) return false;
  return track.type === 'apple' || Boolean(track.url?.startsWith('applemusic://'));
}
