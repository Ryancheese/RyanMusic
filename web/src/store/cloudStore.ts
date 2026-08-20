import { create } from 'zustand';
import type { MusicSource } from '../types';
import type { LibraryEntry } from './libraryStore';
import {
  coverRefreshUrl,
  fetchNeteaseLikelist,
  fetchNeteasePlaylistDetail,
  fetchNeteasePlaylists,
  fetchQqLikelist,
  fetchQqPlaylistDetail,
  fetchQqPlaylists,
  type CloudPlaylist,
  type CloudTrack,
} from '../api';
import { touchPlaylistRecent } from './playlistRecentStore';

const NETEASE_KEY = 'ryanmusic-netease-cloud-v1';
const QQ_KEY = 'ryanmusic-qq-cloud-v1';
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
}

function readTrackCache(): PlaylistTrackCacheStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACK_CACHE_KEY) || 'null') as PlaylistTrackCacheStore | null;
    return {
      netease: parsed?.netease && typeof parsed.netease === 'object' ? parsed.netease : {},
      qq: parsed?.qq && typeof parsed.qq === 'object' ? parsed.qq : {},
    };
  } catch {
    return { netease: {}, qq: {} };
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
  provider: 'netease' | 'qq',
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

function getTrackCache(provider: 'netease' | 'qq', playlistId: string): PlaylistTrackCacheEntry | null {
  return readTrackCache()[provider][playlistId] || null;
}

interface CloudState {
  neteasePlaylists: CloudPlaylist[];
  qqPlaylists: CloudPlaylist[];
  neteaseOpen: CloudPlaylist | null;
  qqOpen: CloudPlaylist | null;
  neteaseTracks: LibraryEntry[];
  qqTracks: LibraryEntry[];
  neteaseSyncing: boolean;
  qqSyncing: boolean;
  neteaseLoading: boolean;
  qqLoading: boolean;
  neteaseError: string;
  qqError: string;
  syncNetease: () => Promise<void>;
  syncQq: () => Promise<void>;
  openNeteasePlaylist: (playlist: CloudPlaylist) => Promise<void>;
  openQqPlaylist: (playlist: CloudPlaylist) => Promise<void>;
  closeNeteasePlaylist: () => void;
  closeQqPlaylist: () => void;
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

export const useCloudStore = create<CloudState>((set, get) => ({
  neteasePlaylists: readMeta(NETEASE_KEY).playlists,
  qqPlaylists: readMeta(QQ_KEY).playlists,
  neteaseOpen: null,
  qqOpen: null,
  neteaseTracks: [],
  qqTracks: [],
  neteaseSyncing: false,
  qqSyncing: false,
  neteaseLoading: false,
  qqLoading: false,
  neteaseError: '',
  qqError: '',
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
  clearProvider: (provider) => {
    if (provider === 'netease') {
      localStorage.removeItem(NETEASE_KEY);
      const cache = readTrackCache();
      cache.netease = {};
      writeTrackCache(cache);
      set({
        neteasePlaylists: [],
        neteaseOpen: null,
        neteaseTracks: [],
        neteaseError: '',
        neteaseLoading: false,
        neteaseSyncing: false,
      });
      return;
    }
    localStorage.removeItem(QQ_KEY);
    const cache = readTrackCache();
    cache.qq = {};
    writeTrackCache(cache);
    set({
      qqPlaylists: [],
      qqOpen: null,
      qqTracks: [],
      qqError: '',
      qqLoading: false,
      qqSyncing: false,
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
})();
