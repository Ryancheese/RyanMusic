import { create } from 'zustand';
import type { MusicSource } from '../types';
import type { LibraryEntry } from './libraryStore';
import {
  coverRefreshUrl,
  fetchNeteaseDailySongs,
  fetchNeteaseLikelist,
  fetchNeteasePersonalFm,
  fetchNeteasePlaylistDetail,
  fetchNeteasePlaylists,
  fetchNeteaseRecommendFeed,
  fetchQqDailySongs,
  fetchQqLikelist,
  fetchQqPersonalFm,
  fetchQqPlaylistDetail,
  fetchQqPlaylists,
  fetchQqRadarSongs,
  fetchQqRecommendFeed,
  fetchQishuiPlaylists,
  fetchQishuiPlaylistDetail,
  fetchQishuiRecentSongs,
  fetchQishuiRecommendFeed,
  type CloudPlaylist,
  type CloudTrack,
  type NeteaseRecommendItem,
} from '../api';
import { touchPlaylistRecent } from './playlistRecentStore';

const NETEASE_KEY = 'ryanmusic-netease-cloud-v1';
const QQ_KEY = 'ryanmusic-qq-cloud-v1';
const QISHUI_KEY = 'ryanmusic-qishui-cloud-v1';
const TRACK_CACHE_KEY = 'ryanmusic-playlist-tracks-v1';
const TRACK_CACHE_LIMIT = 24;

interface CloudMeta {
  playlists: CloudPlaylist[];
  nickname?: string;
  syncedAt?: number;
}

interface PlaylistTrackCacheEntry {
  tracks: LibraryEntry[];
  name?: string;
  cover?: string;
  savedAt: number;
}

interface PlaylistTrackCacheStore {
  netease: Record<string, PlaylistTrackCacheEntry>;
  qq: Record<string, PlaylistTrackCacheEntry>;
  qishui: Record<string, PlaylistTrackCacheEntry>;
}

function readTrackCache(): PlaylistTrackCacheStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACK_CACHE_KEY) || 'null') as PlaylistTrackCacheStore | null;
    return {
      netease: parsed?.netease && typeof parsed.netease === 'object' ? parsed.netease : {},
      qq: parsed?.qq && typeof parsed.qq === 'object' ? parsed.qq : {},
      qishui: parsed?.qishui && typeof parsed.qishui === 'object' ? parsed.qishui : {},
    };
  } catch {
    return { netease: {}, qq: {}, qishui: {} };
  }
}

function writeTrackCache(store: PlaylistTrackCacheStore) {
  localStorage.setItem(TRACK_CACHE_KEY, JSON.stringify(store));
}

function trimTrackCache(bucket: Record<string, PlaylistTrackCacheEntry>): Record<string, PlaylistTrackCacheEntry> {
  const entries = Object.entries(bucket).sort((a, b) => b[1].savedAt - a[1].savedAt);
  return Object.fromEntries(entries.slice(0, TRACK_CACHE_LIMIT));
}

function putTrackCache(
  provider: 'netease' | 'qq' | 'qishui',
  playlistId: string,
  entry: PlaylistTrackCacheEntry,
) {
  const store = readTrackCache();
  store[provider] = trimTrackCache({
    ...store[provider],
    [playlistId]: entry,
  });
  writeTrackCache(store);
}

function getTrackCache(provider: 'netease' | 'qq' | 'qishui', playlistId: string): PlaylistTrackCacheEntry | null {
  return readTrackCache()[provider][playlistId] || null;
}

interface CloudState {
  neteasePlaylists: CloudPlaylist[];
  qqPlaylists: CloudPlaylist[];
  qishuiPlaylists: CloudPlaylist[];
  neteaseRecommendItems: NeteaseRecommendItem[];
  qqRecommendItems: NeteaseRecommendItem[];
  qishuiRecommendItems: NeteaseRecommendItem[];
  neteaseOpen: CloudPlaylist | null;
  qqOpen: CloudPlaylist | null;
  qishuiOpen: CloudPlaylist | null;
  neteaseTracks: LibraryEntry[];
  qqTracks: LibraryEntry[];
  qishuiTracks: LibraryEntry[];
  neteaseSyncing: boolean;
  qqSyncing: boolean;
  qishuiSyncing: boolean;
  neteaseRecommendSyncing: boolean;
  qqRecommendSyncing: boolean;
  qishuiRecommendSyncing: boolean;
  neteaseLoading: boolean;
  qqLoading: boolean;
  qishuiLoading: boolean;
  neteaseError: string;
  qqError: string;
  qishuiError: string;
  neteaseRecommendError: string;
  qqRecommendError: string;
  qishuiRecommendError: string;
  syncNetease: () => Promise<void>;
  syncNeteaseRecommend: () => Promise<void>;
  syncQq: () => Promise<void>;
  syncQqRecommend: () => Promise<void>;
  syncQishui: () => Promise<void>;
  syncQishuiRecommend: () => Promise<void>;
  openNeteasePlaylist: (playlist: CloudPlaylist) => Promise<void>;
  openNeteaseRecommend: (item: NeteaseRecommendItem) => Promise<void>;
  playNeteasePersonalFm: () => Promise<LibraryEntry[]>;
  openQqPlaylist: (playlist: CloudPlaylist) => Promise<void>;
  openQqRecommend: (item: NeteaseRecommendItem) => Promise<void>;
  openQqRadar: (item: NeteaseRecommendItem) => Promise<void>;
  playQqPersonalFm: () => Promise<LibraryEntry[]>;
  openQishuiPlaylist: (playlist: CloudPlaylist) => Promise<void>;
  openQishuiRecommend: (item: NeteaseRecommendItem) => Promise<void>;
  playQishuiRecent: () => Promise<LibraryEntry[]>;
  closeNeteasePlaylist: () => void;
  closeQqPlaylist: () => void;
  closeQishuiPlaylist: () => void;
  clearProvider: (provider: MusicSource) => void;
}

function readMeta(key: string): CloudMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as CloudMeta | null;
    if (!parsed || !Array.isArray(parsed.playlists)) return { playlists: [] };
    return parsed;
  } catch {
    return { playlists: [] };
  }
}

function writeMeta(key: string, meta: CloudMeta) {
  localStorage.setItem(key, JSON.stringify(meta));
}

function toEntries(tracks: CloudTrack[] | undefined, type: MusicSource): LibraryEntry[] {
  return (tracks || [])
    .filter((item) => item?.songid)
    .map((item) => ({
      type: item.type || type,
      songid: String(item.songid),
      title: item.title || '未知曲目',
      author: item.author || '未知艺人',
      ...(item.delisted ? { delisted: true } : {}),
    }));
}

function coverFromTrack(track: CloudTrack | undefined, type: MusicSource): string {
  if (!track?.songid) return '';
  if (track.pic?.trim()) return track.pic.trim();
  return coverRefreshUrl(type, String(track.songid));
}

async function firstTrackCover(playlist: CloudPlaylist, type: MusicSource): Promise<string> {
  try {
    if (type === 'netease') {
      const liked = playlist.specialType === 5;
      const res = liked
        ? await fetchNeteaseLikelist(0, 1)
        : await fetchNeteasePlaylistDetail(playlist.id, 0, 1);
      return coverFromTrack(res.data?.tracks?.[0], 'netease');
    }
    if (type === 'qishui') {
      const res = playlist.id === '__qishui_recent__'
        ? await fetchQishuiRecentSongs()
        : await fetchQishuiPlaylistDetail(playlist.id, 0, 1);
      return coverFromTrack(res.data?.tracks?.[0], 'qishui');
    }
    const liked = playlist.dirid === 201;
    const res = liked ? await fetchQqLikelist() : await fetchQqPlaylistDetail(playlist.id);
    return coverFromTrack(res.data?.tracks?.[0], 'qq');
  } catch {
    return '';
  }
}

async function enrichMissingCovers(
  playlists: CloudPlaylist[],
  type: MusicSource,
  onProgress?: (next: CloudPlaylist[]) => void,
): Promise<CloudPlaylist[]> {
  const next = playlists.map((item) => ({ ...item }));
  const missing = next
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.cover?.trim() || item.specialType === 5 || item.dirid === 201)
    .slice(0, 24);

  const queue = [...missing];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      const cover = await firstTrackCover(job.item, type);
      if (!cover) continue;
      next[job.index] = { ...next[job.index], cover };
      onProgress?.(next.map((item) => ({ ...item })));
    }
  });
  await Promise.all(workers);
  return next;
}

function patchPlaylistCover(
  playlists: CloudPlaylist[],
  playlistId: string,
  cover: string,
): CloudPlaylist[] {
  if (!cover) return playlists;
  return playlists.map((item) => (item.id === playlistId
    ? { ...item, cover: cover || item.cover }
    : item));
}

async function collectNeteaseTracks(playlist: CloudPlaylist): Promise<{ name: string; tracks: LibraryEntry[]; cover: string }> {
  const liked = playlist.specialType === 5;
  const first = liked
    ? await fetchNeteaseLikelist(0, 200)
    : await fetchNeteasePlaylistDetail(playlist.id, 0, 200);
  if (first.code !== 200 || !first.data) {
    throw new Error(first.error || '加载歌单失败');
  }
  const total = Math.min(Number(first.data.total) || (first.data.tracks?.length ?? 0), 500);
  let tracks = toEntries(first.data.tracks, 'netease');
  const cover = playlist.cover?.trim() || coverFromTrack(first.data.tracks?.[0], 'netease');
  while (tracks.length < total) {
    const page = liked
      ? await fetchNeteaseLikelist(tracks.length, 200)
      : await fetchNeteasePlaylistDetail(playlist.id, tracks.length, 200);
    const more = toEntries(page.data?.tracks, 'netease');
    if (!more.length) break;
    tracks = tracks.concat(more);
  }
  return { name: first.data.name || playlist.name, tracks, cover };
}

async function collectQqTracks(playlist: CloudPlaylist): Promise<{ name: string; tracks: LibraryEntry[]; cover: string }> {
  if (playlist.id === '__qq_radar__' || playlist.recommendKind === 'radar') {
    const res = await fetchQqRadarSongs();
    if (res.code !== 200 || !res.data) {
      throw new Error(res.error || '加载私人雷达失败');
    }
    return {
      name: res.data.name || playlist.name,
      tracks: toEntries(res.data.tracks, 'qq'),
      cover: playlist.cover?.trim() || res.data.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'qq'),
    };
  }
  if (playlist.id === '__qq_daily__' || playlist.recommendKind === 'daily') {
    const res = await fetchQqDailySongs();
    if (res.code !== 200 || !res.data) {
      throw new Error(res.error || '加载每日30首失败');
    }
    return {
      name: res.data.name || playlist.name,
      tracks: toEntries(res.data.tracks, 'qq'),
      cover: playlist.cover?.trim() || res.data.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'qq'),
    };
  }
  const liked = playlist.dirid === 201;
  const res = liked ? await fetchQqLikelist() : await fetchQqPlaylistDetail(playlist.id);
  if (res.code !== 200 || !res.data) {
    throw new Error(res.error || '加载歌单失败');
  }
  return {
    name: res.data.name || playlist.name,
    tracks: toEntries(res.data.tracks, 'qq'),
    cover: playlist.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'qq'),
  };
}

async function collectQishuiTracks(playlist: CloudPlaylist): Promise<{ name: string; tracks: LibraryEntry[]; cover: string }> {
  const first = playlist.id === '__qishui_recent__'
    ? await fetchQishuiRecentSongs()
    : await fetchQishuiPlaylistDetail(playlist.id, 0, 80);
  if (first.code !== 200 || !first.data) {
    throw new Error(first.error || '加载歌单失败');
  }
  const total = Math.min(Number(first.data.total) || (first.data.tracks?.length ?? 0), 400);
  let tracks = toEntries(first.data.tracks, 'qishui');
  const cover = playlist.cover?.trim() || first.data.cover?.trim() || coverFromTrack(first.data.tracks?.[0], 'qishui');
  while (playlist.id !== '__qishui_recent__' && tracks.length < total) {
    const page = await fetchQishuiPlaylistDetail(playlist.id, tracks.length, 80);
    const more = toEntries(page.data?.tracks, 'qishui');
    if (!more.length) break;
    tracks = tracks.concat(more);
  }
  return { name: first.data.name || playlist.name, tracks, cover };
}

export const useCloudStore = create<CloudState>((set, get) => ({
  neteasePlaylists: readMeta(NETEASE_KEY).playlists,
  qqPlaylists: readMeta(QQ_KEY).playlists,
  qishuiPlaylists: readMeta(QISHUI_KEY).playlists,
  neteaseRecommendItems: [],
  qqRecommendItems: [],
  qishuiRecommendItems: [],
  neteaseOpen: null,
  qqOpen: null,
  qishuiOpen: null,
  neteaseTracks: [],
  qqTracks: [],
  qishuiTracks: [],
  neteaseSyncing: false,
  qqSyncing: false,
  qishuiSyncing: false,
  neteaseRecommendSyncing: false,
  qqRecommendSyncing: false,
  qishuiRecommendSyncing: false,
  neteaseLoading: false,
  qqLoading: false,
  qishuiLoading: false,
  neteaseError: '',
  qqError: '',
  qishuiError: '',
  neteaseRecommendError: '',
  qqRecommendError: '',
  qishuiRecommendError: '',
  syncNetease: async () => {
    set({ neteaseSyncing: true, neteaseError: '' });
    const res = await fetchNeteasePlaylists();
    if (res.code !== 200 || !res.data) {
      set({ neteaseSyncing: false, neteaseError: res.error || '同步失败' });
      return;
    }
    let playlists = res.data.playlists || [];
    playlists = playlists.map((pl, index) => ({
      ...pl,
      order: pl.order ?? index,
    }));
    writeMeta(NETEASE_KEY, { playlists, syncedAt: Date.now() });
    set({
      neteasePlaylists: playlists,
      neteaseSyncing: false,
      neteaseOpen: null,
      neteaseTracks: [],
      neteaseError: playlists.length ? '' : '账号下没有歌单',
    });
    playlists = await enrichMissingCovers(playlists, 'netease', (partial) => {
      writeMeta(NETEASE_KEY, { playlists: partial, syncedAt: Date.now() });
      set({ neteasePlaylists: partial });
    });
    writeMeta(NETEASE_KEY, { playlists, syncedAt: Date.now() });
    set({ neteasePlaylists: playlists });
  },
  syncNeteaseRecommend: async () => {
    set({ neteaseRecommendSyncing: true, neteaseRecommendError: '' });
    const res = await fetchNeteaseRecommendFeed();
    if (res.code !== 200 || !res.data) {
      set({
        neteaseRecommendSyncing: false,
        neteaseRecommendError: res.error || '拉取推荐失败',
      });
      return;
    }
    const items = (res.data.items || []).filter((item) => item?.id && item.recommendKind);
    set({
      neteaseRecommendItems: items,
      neteaseRecommendSyncing: false,
      neteaseRecommendError: items.length ? '' : '暂无推荐内容',
      neteaseOpen: null,
      neteaseTracks: [],
    });
  },
  syncQq: async () => {
    set({ qqSyncing: true, qqError: '' });
    const res = await fetchQqPlaylists();
    if (res.code !== 200 || !res.data) {
      set({ qqSyncing: false, qqError: res.error || '同步失败' });
      return;
    }
    let playlists = res.data.playlists || [];
    playlists = playlists.map((pl, index) => ({
      ...pl,
      order: pl.order ?? index,
    }));
    writeMeta(QQ_KEY, { playlists, syncedAt: Date.now() });
    set({
      qqPlaylists: playlists,
      qqSyncing: false,
      qqOpen: null,
      qqTracks: [],
      qqError: playlists.length ? '' : '账号下没有歌单',
    });
    playlists = await enrichMissingCovers(playlists, 'qq', (partial) => {
      writeMeta(QQ_KEY, { playlists: partial, syncedAt: Date.now() });
      set({ qqPlaylists: partial });
    });
    writeMeta(QQ_KEY, { playlists, syncedAt: Date.now() });
    set({ qqPlaylists: playlists });
  },
  syncQqRecommend: async () => {
    set({ qqRecommendSyncing: true, qqRecommendError: '' });
    const res = await fetchQqRecommendFeed();
    if (res.code !== 200 || !res.data) {
      set({ qqRecommendSyncing: false, qqRecommendError: res.error || '拉取 QQ 推荐失败' });
      return;
    }
    const items = (res.data.items || []).filter((item) => item?.id && item.recommendKind);
    set({
      qqRecommendItems: items,
      qqRecommendSyncing: false,
      qqRecommendError: items.length ? '' : '暂无推荐内容',
      qqOpen: null,
      qqTracks: [],
    });
  },
  syncQishui: async () => {
    set({ qishuiSyncing: true, qishuiError: '' });
    const res = await fetchQishuiPlaylists();
    if (res.code !== 200 || !res.data) {
      set({ qishuiSyncing: false, qishuiError: res.error || '同步失败' });
      return;
    }
    let playlists = (res.data.playlists || []).map((pl, index) => ({
      ...pl,
      order: pl.order ?? index,
    }));
    writeMeta(QISHUI_KEY, { playlists, syncedAt: Date.now() });
    set({
      qishuiPlaylists: playlists,
      qishuiSyncing: false,
      qishuiOpen: null,
      qishuiTracks: [],
      qishuiError: playlists.length ? '' : '账号下没有歌单',
    });
    playlists = await enrichMissingCovers(playlists, 'qishui', (partial) => {
      writeMeta(QISHUI_KEY, { playlists: partial, syncedAt: Date.now() });
      set({ qishuiPlaylists: partial });
    });
    writeMeta(QISHUI_KEY, { playlists, syncedAt: Date.now() });
    set({ qishuiPlaylists: playlists });
  },
  syncQishuiRecommend: async () => {
    set({ qishuiRecommendSyncing: true, qishuiRecommendError: '' });
    const res = await fetchQishuiRecommendFeed();
    if (res.code !== 200 || !res.data) {
      set({ qishuiRecommendSyncing: false, qishuiRecommendError: res.error || '拉取汽水推荐失败' });
      return;
    }
    const items = (res.data.items || []).filter((item) => item?.id && item.recommendKind);
    set({
      qishuiRecommendItems: items,
      qishuiRecommendSyncing: false,
      qishuiRecommendError: items.length ? '' : '暂无推荐内容',
      qishuiOpen: null,
      qishuiTracks: [],
    });
  },
  playQishuiRecent: async () => {
    set({ qishuiRecommendError: '' });
    const res = await fetchQishuiRecentSongs();
    if (res.code !== 200 || !res.data?.tracks?.length) {
      const message = res.error || '拉取最近播放失败';
      set({ qishuiRecommendError: message });
      throw new Error(message);
    }
    return toEntries(res.data.tracks, 'qishui');
  },
  playQqPersonalFm: async () => {
    set({ qqRecommendError: '' });
    const res = await fetchQqPersonalFm();
    if (res.code !== 200 || !res.data?.tracks?.length) {
      const message = res.error || '拉取 QQ 音乐推荐失败';
      set({ qqRecommendError: message });
      throw new Error(message);
    }
    return toEntries(res.data.tracks, 'qq');
  },
  openNeteasePlaylist: async (playlist) => {
    touchPlaylistRecent('netease', playlist.id);
    const cached = getTrackCache('netease', playlist.id);
    set({
      neteaseLoading: !cached,
      neteaseError: '',
      neteaseOpen: cached
        ? { ...playlist, name: cached.name || playlist.name, cover: cached.cover || playlist.cover }
        : playlist,
      neteaseTracks: cached?.tracks || [],
    });
    try {
      const result = await collectNeteaseTracks(playlist);
      const playlists = patchPlaylistCover(get().neteasePlaylists, playlist.id, result.cover);
      writeMeta(NETEASE_KEY, { playlists, syncedAt: Date.now() });
      putTrackCache('netease', playlist.id, {
        tracks: result.tracks,
        name: result.name,
        cover: result.cover || playlist.cover,
        savedAt: Date.now(),
      });
      set({
        neteaseLoading: false,
        neteasePlaylists: playlists,
        neteaseOpen: { ...playlist, name: result.name, cover: result.cover || playlist.cover },
        neteaseTracks: result.tracks,
        neteaseError: result.tracks.length ? '' : '这个歌单是空的',
      });
    } catch (error) {
      set({
        neteaseLoading: false,
        neteaseError: cached?.tracks.length
          ? ''
          : (error instanceof Error ? error.message : '加载歌单失败'),
      });
    }
  },
  openNeteaseRecommend: async (item) => {
    if (item.recommendKind !== 'daily') return;
    const virtual: CloudPlaylist = {
      id: item.id,
      name: item.name,
      cover: item.cover,
      recommendKind: 'daily',
    };
    set({
      neteaseLoading: true,
      neteaseError: '',
      neteaseOpen: virtual,
      neteaseTracks: [],
    });
    try {
      const res = await fetchNeteaseDailySongs();
      if (res.code !== 200 || !res.data) {
        throw new Error(res.error || '加载每日推荐失败');
      }
      const tracks = toEntries(res.data.tracks, 'netease');
      const cover = item.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'netease');
      set({
        neteaseLoading: false,
        neteaseOpen: { ...virtual, name: res.data.name || item.name, cover },
        neteaseTracks: tracks,
        neteaseError: tracks.length ? '' : '今日推荐为空',
      });
    } catch (error) {
      set({
        neteaseLoading: false,
        neteaseError: error instanceof Error ? error.message : '加载每日推荐失败',
      });
    }
  },
  playNeteasePersonalFm: async () => {
    set({ neteaseRecommendError: '' });
    const res = await fetchNeteasePersonalFm();
    if (res.code !== 200 || !res.data?.tracks?.length) {
      const message = res.error || '拉取私人 FM 失败';
      set({ neteaseRecommendError: message });
      throw new Error(message);
    }
    return toEntries(res.data.tracks, 'netease');
  },
  openQqRecommend: async (item) => {
    if (item.recommendKind !== 'daily') return;
    const virtual: CloudPlaylist = {
      id: item.id,
      name: item.name,
      cover: item.cover,
      recommendKind: 'daily',
    };
    set({
      qqLoading: true,
      qqError: '',
      qqOpen: virtual,
      qqTracks: [],
    });
    try {
      const res = await fetchQqDailySongs();
      if (res.code !== 200 || !res.data) {
        throw new Error(res.error || '加载每日30首失败');
      }
      const tracks = toEntries(res.data.tracks, 'qq');
      const cover = item.cover?.trim() || res.data.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'qq');
      set({
        qqLoading: false,
        qqOpen: { ...virtual, name: res.data.name || item.name, cover },
        qqTracks: tracks,
        qqError: tracks.length ? '' : '今日推荐为空',
      });
    } catch (error) {
      set({
        qqLoading: false,
        qqError: error instanceof Error ? error.message : '加载每日30首失败',
      });
    }
  },
  openQqRadar: async (item) => {
    if (item.recommendKind !== 'radar') return;
    const virtual: CloudPlaylist = {
      id: item.id,
      name: item.name,
      cover: item.cover,
      recommendKind: 'radar',
    };
    set({
      qqLoading: true,
      qqError: '',
      qqOpen: virtual,
      qqTracks: [],
    });
    try {
      const res = await fetchQqRadarSongs();
      if (res.code !== 200 || !res.data) {
        throw new Error(res.error || '加载私人雷达失败');
      }
      const tracks = toEntries(res.data.tracks, 'qq');
      const cover = item.cover?.trim() || res.data.cover?.trim() || coverFromTrack(res.data.tracks?.[0], 'qq');
      set({
        qqLoading: false,
        qqOpen: { ...virtual, name: res.data.name || item.name, cover },
        qqTracks: tracks,
        qqError: tracks.length ? '' : '私人雷达为空',
      });
    } catch (error) {
      set({
        qqLoading: false,
        qqError: error instanceof Error ? error.message : '加载私人雷达失败',
      });
    }
  },
  openQqPlaylist: async (playlist) => {
    touchPlaylistRecent('qq', playlist.id);
    const cached = getTrackCache('qq', playlist.id);
    set({
      qqLoading: !cached,
      qqError: '',
      qqOpen: cached
        ? { ...playlist, name: cached.name || playlist.name, cover: cached.cover || playlist.cover }
        : playlist,
      qqTracks: cached?.tracks || [],
    });
    try {
      const result = await collectQqTracks(playlist);
      const playlists = patchPlaylistCover(get().qqPlaylists, playlist.id, result.cover);
      writeMeta(QQ_KEY, { playlists, syncedAt: Date.now() });
      putTrackCache('qq', playlist.id, {
        tracks: result.tracks,
        name: result.name,
        cover: result.cover || playlist.cover,
        savedAt: Date.now(),
      });
      set({
        qqLoading: false,
        qqPlaylists: playlists,
        qqOpen: { ...playlist, name: result.name, cover: result.cover || playlist.cover },
        qqTracks: result.tracks,
        qqError: result.tracks.length ? '' : '这个歌单是空的',
      });
    } catch (error) {
      set({
        qqLoading: false,
        qqError: cached?.tracks.length
          ? ''
          : (error instanceof Error ? error.message : '加载歌单失败'),
      });
    }
  },
  closeNeteasePlaylist: () => set({ neteaseOpen: null, neteaseError: '', neteaseLoading: false }),
  closeQqPlaylist: () => set({ qqOpen: null, qqError: '', qqLoading: false }),
  closeQishuiPlaylist: () => set({ qishuiOpen: null, qishuiError: '', qishuiLoading: false }),
  openQishuiRecommend: async (item) => {
    if (item.recommendKind === 'fm') return;
    if (item.recommendKind === 'playlist' || (item.id && item.id !== '__qishui_recent__' && item.recommendKind !== 'daily')) {
      await get().openQishuiPlaylist(item);
      return;
    }
    const virtual: CloudPlaylist = {
      id: '__qishui_recent__',
      name: item.name || '最近播放',
      cover: item.cover,
      recommendKind: 'daily',
    };
    const cached = getTrackCache('qishui', virtual.id);
    set({
      qishuiLoading: !cached,
      qishuiError: '',
      qishuiOpen: cached
        ? { ...virtual, name: cached.name || virtual.name, cover: cached.cover || virtual.cover }
        : virtual,
      qishuiTracks: cached?.tracks || [],
    });
    try {
      const result = await collectQishuiTracks(virtual);
      putTrackCache('qishui', virtual.id, {
        tracks: result.tracks,
        name: result.name,
        cover: result.cover || virtual.cover,
        savedAt: Date.now(),
      });
      set({
        qishuiLoading: false,
        qishuiOpen: { ...virtual, name: result.name, cover: result.cover || virtual.cover },
        qishuiTracks: result.tracks,
        qishuiError: result.tracks.length ? '' : '最近播放是空的',
      });
    } catch (error) {
      set({
        qishuiLoading: false,
        qishuiError: cached?.tracks.length
          ? ''
          : (error instanceof Error ? error.message : '加载最近播放失败'),
      });
    }
  },
  openQishuiPlaylist: async (playlist) => {
    if (playlist.id === '__qishui_recent__' || playlist.recommendKind === 'daily') {
      await get().openQishuiRecommend({ ...playlist, recommendKind: 'daily' });
      return;
    }
    touchPlaylistRecent('qishui', playlist.id);
    const cached = getTrackCache('qishui', playlist.id);
    set({
      qishuiLoading: !cached,
      qishuiError: '',
      qishuiOpen: cached
        ? { ...playlist, name: cached.name || playlist.name, cover: cached.cover || playlist.cover }
        : playlist,
      qishuiTracks: cached?.tracks || [],
    });
    try {
      const result = await collectQishuiTracks(playlist);
      const playlists = patchPlaylistCover(get().qishuiPlaylists, playlist.id, result.cover);
      writeMeta(QISHUI_KEY, { playlists, syncedAt: Date.now() });
      putTrackCache('qishui', playlist.id, {
        tracks: result.tracks,
        name: result.name,
        cover: result.cover || playlist.cover,
        savedAt: Date.now(),
      });
      set({
        qishuiLoading: false,
        qishuiPlaylists: playlists,
        qishuiOpen: { ...playlist, name: result.name, cover: result.cover || playlist.cover },
        qishuiTracks: result.tracks,
        qishuiError: result.tracks.length ? '' : '这个歌单是空的',
      });
    } catch (error) {
      set({
        qishuiLoading: false,
        qishuiError: cached?.tracks.length
          ? ''
          : (error instanceof Error ? error.message : '加载歌单失败'),
      });
    }
  },
  clearProvider: (provider) => {
    if (provider === 'apple') return;
    if (provider === 'netease') {
      localStorage.removeItem(NETEASE_KEY);
      const cache = readTrackCache();
      cache.netease = {};
      writeTrackCache(cache);
      set({
        neteasePlaylists: [],
        neteaseRecommendItems: [],
        neteaseOpen: null,
        neteaseTracks: [],
        neteaseError: '',
        neteaseRecommendError: '',
        neteaseLoading: false,
        neteaseSyncing: false,
        neteaseRecommendSyncing: false,
      });
      return;
    }
    if (provider === 'qishui') {
      localStorage.removeItem(QISHUI_KEY);
      const cache = readTrackCache();
      cache.qishui = {};
      writeTrackCache(cache);
      set({
        qishuiPlaylists: [],
        qishuiRecommendItems: [],
        qishuiOpen: null,
        qishuiTracks: [],
        qishuiError: '',
        qishuiRecommendError: '',
        qishuiLoading: false,
        qishuiSyncing: false,
        qishuiRecommendSyncing: false,
      });
      return;
    }
    localStorage.removeItem(QQ_KEY);
    const cache = readTrackCache();
    cache.qq = {};
    writeTrackCache(cache);
    set({
      qqPlaylists: [],
      qqRecommendItems: [],
      qqOpen: null,
      qqTracks: [],
      qqError: '',
      qqRecommendError: '',
      qqLoading: false,
      qqSyncing: false,
      qqRecommendSyncing: false,
    });
  },
}));

void (async () => {
  const netease = readMeta(NETEASE_KEY).playlists;
  if (netease.some((item) => !item.cover?.trim() || item.specialType === 5)) {
    const playlists = await enrichMissingCovers(netease, 'netease', (partial) => {
      writeMeta(NETEASE_KEY, { playlists: partial, syncedAt: Date.now() });
      useCloudStore.setState({ neteasePlaylists: partial });
    });
    writeMeta(NETEASE_KEY, { playlists, syncedAt: Date.now() });
    useCloudStore.setState({ neteasePlaylists: playlists });
  }
  const qq = readMeta(QQ_KEY).playlists;
  if (qq.some((item) => !item.cover?.trim() || item.dirid === 201)) {
    const playlists = await enrichMissingCovers(qq, 'qq', (partial) => {
      writeMeta(QQ_KEY, { playlists: partial, syncedAt: Date.now() });
      useCloudStore.setState({ qqPlaylists: partial });
    });
    writeMeta(QQ_KEY, { playlists, syncedAt: Date.now() });
    useCloudStore.setState({ qqPlaylists: playlists });
  }
  const qishui = readMeta(QISHUI_KEY).playlists;
  if (qishui.some((item) => !item.cover?.trim())) {
    const playlists = await enrichMissingCovers(qishui, 'qishui', (partial) => {
      writeMeta(QISHUI_KEY, { playlists: partial, syncedAt: Date.now() });
      useCloudStore.setState({ qishuiPlaylists: partial });
    });
    writeMeta(QISHUI_KEY, { playlists, syncedAt: Date.now() });
    useCloudStore.setState({ qishuiPlaylists: playlists });
  }
})();
