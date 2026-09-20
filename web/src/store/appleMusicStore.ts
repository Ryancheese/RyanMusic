import { create } from 'zustand';
import type { CloudPlaylist, NeteaseRecommendItem } from '../api';
import type { Track } from '../types';
import type { LibraryEntry } from './libraryStore';
import {
  authorizeAppleMusic,
  canUseAppleMusic,
  fetchAppleAlbumTracks,
  fetchAppleLibraryPlaylists,
  fetchApplePlaylistTracks,
  fetchAppleRecommendations,
  type AppleMusicStatus,
  appleMusicStatus,
} from '../lib/appleMusic';

const OPT_OUT_KEY = 'ryanmusic-apple-optout';

function optedOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function setOptOut(value: boolean) {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // ignore
  }
}

function friendlyAppleError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : '';
  if (/MusicDataRequest|MusicKit|未能完成操作/i.test(raw)) {
    return '这个 Apple Music 目录歌单暂时打不开，请改用资料库或最近播放。';
  }
  return raw || fallback;
}

function toEntries(tracks: Track[]): LibraryEntry[] {
  return tracks.map((item) => ({
    type: 'apple',
    songid: String(item.songid),
    title: item.title,
    author: item.author,
    pic: item.pic,
  }));
}

function asAccount(status: AppleMusicStatus | null, enabled: boolean) {
  if (!status?.available || !status.authorized || !enabled) {
    return { loggedIn: false } as const;
  }
  return {
    loggedIn: true,
    nickname: status.canPlayCatalog ? 'Apple Music' : 'Apple Music · 未开通',
    vip: status.canPlayCatalog ? 1 : 0,
  };
}

interface AppleMusicState {
  available: boolean;
  enabled: boolean;
  status: AppleMusicStatus | null;
  account: { loggedIn: boolean; nickname?: string; vip?: number };
  playlists: CloudPlaylist[];
  recommendItems: NeteaseRecommendItem[];
  open: CloudPlaylist | null;
  tracks: LibraryEntry[];
  trackMap: Record<string, Track>;
  syncing: boolean;
  recommendSyncing: boolean;
  loading: boolean;
  error: string;
  recommendError: string;
  rememberTracks: (tracks: Track[]) => void;
  getTrack: (songid: string) => Track | undefined;
  refreshStatus: () => Promise<void>;
  authorize: () => Promise<void>;
  disconnect: () => void;
  syncLibrary: () => Promise<void>;
  syncRecommend: () => Promise<void>;
  openPlaylist: (playlist: CloudPlaylist) => Promise<void>;
  openAlbum: (id: string, name?: string, cover?: string) => Promise<void>;
  closePlaylist: () => void;
}

export const useAppleMusicStore = create<AppleMusicState>((set, get) => ({
  available: canUseAppleMusic(),
  enabled: !optedOut(),
  status: null,
  account: { loggedIn: false },
  playlists: [],
  recommendItems: [],
  open: null,
  tracks: [],
  trackMap: {},
  syncing: false,
  recommendSyncing: false,
  loading: false,
  error: '',
  recommendError: '',
  rememberTracks: (tracks) => {
    if (!tracks.length) return;
    set((state) => {
      const trackMap = { ...state.trackMap };
      for (const track of tracks) {
        trackMap[String(track.songid)] = track;
      }
      return { trackMap };
    });
  },
  getTrack: (songid) => get().trackMap[String(songid)],
  refreshStatus: async () => {
    if (!canUseAppleMusic()) {
      set({ available: false, account: { loggedIn: false } });
      return;
    }
    const status = await appleMusicStatus();
    const enabled = get().enabled && !optedOut();
    set({
      available: true,
      enabled,
      status,
      account: asAccount(status, enabled),
    });
  },
  authorize: async () => {
    setOptOut(false);
    set({ enabled: true, error: '' });
    const status = await authorizeAppleMusic();
    set({
      status,
      enabled: true,
      account: asAccount(status, true),
      error: status.authorized ? '' : (status.error || '授权未完成'),
    });
    if (status.authorized) {
      await get().syncLibrary();
      await get().syncRecommend();
    }
  },
  disconnect: () => {
    setOptOut(true);
    set({
      enabled: false,
      account: { loggedIn: false },
      playlists: [],
      recommendItems: [],
      open: null,
      tracks: [],
      error: '',
      recommendError: '',
    });
  },
  syncLibrary: async () => {
    if (!get().account.loggedIn) return;
    set({ syncing: true, error: '' });
    try {
      const playlists = await fetchAppleLibraryPlaylists();
      set({ playlists, syncing: false });
    } catch (error) {
      set({
        syncing: false,
        error: friendlyAppleError(error, '同步 Apple Music 歌单失败'),
      });
    }
  },
  syncRecommend: async () => {
    if (!get().account.loggedIn) return;
    set({ recommendSyncing: true, recommendError: '' });
    try {
      const items = await fetchAppleRecommendations();
      set({
        recommendItems: items.map((item) => ({
          ...item,
          recommendKind: item.recommendKind || 'playlist',
        })),
        recommendSyncing: false,
      });
    } catch (error) {
      set({
        recommendSyncing: false,
        recommendError: friendlyAppleError(error, '同步 Apple Music 推荐失败'),
      });
    }
  },
  openPlaylist: async (playlist) => {
    set({ open: playlist, loading: true, error: '', tracks: [] });
    try {
      const id = String(playlist.id || '');
      const kind = playlist.kind === 'album' || playlist.kind === 'catalog' || playlist.kind === 'library'
        ? playlist.kind
        : id.startsWith('pl.') || id.startsWith('apple-chart-')
          ? 'catalog'
          : id.startsWith('l.') || id.startsWith('p.') || Number.isNaN(Number(id))
            ? 'library'
            : 'catalog';
      const detail = kind === 'album'
        ? await fetchAppleAlbumTracks(playlist.id)
        : await fetchApplePlaylistTracks(playlist.id, kind === 'catalog' ? 'catalog' : 'library', playlist.name || '');
      get().rememberTracks(detail.tracks);
      set({
        open: {
          ...playlist,
          name: detail.name || playlist.name,
          cover: detail.cover || playlist.cover,
          trackCount: detail.tracks.length,
        },
        tracks: toEntries(detail.tracks),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: friendlyAppleError(error, '加载 Apple Music 歌单失败'),
      });
    }
  },
  openAlbum: async (id, name, cover) => {
    await get().openPlaylist({
      id,
      name: name || '专辑',
      cover,
      kind: 'album',
      recommendKind: 'playlist',
    } as CloudPlaylist);
  },
  closePlaylist: () => set({ open: null, tracks: [], error: '' }),
}));
