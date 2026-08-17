import { create } from 'zustand';
import type { HomeTab, MusicSource, Track } from '../types';
import { libraryItem, trackKey } from '../types';

export interface LibraryEntry {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
}

interface LibraryState {
  liked: LibraryEntry[];
  recent: LibraryEntry[];
  playlist: LibraryEntry[];
  homeTab: HomeTab;
  channel: 'all' | MusicSource;
  setHomeTab: (tab: HomeTab) => void;
  setChannel: (channel: 'all' | MusicSource) => void;
  toggleLike: (track: Track) => void;
  isLiked: (track: Pick<Track, 'type' | 'songid'> | null) => boolean;
  addRecent: (track: Track) => void;
  addToPlaylist: (track: Track) => void;
  removeFromPlaylist: (track: Pick<Track, 'type' | 'songid'>) => void;
}

const LIKED_KEY = 'ryanmusic-liked-v1';
const RECENT_KEY = 'ryanmusic-recent-v1';
const PLAYLIST_KEY = 'ryanmusic-playlist-v1';
const UI_KEY = 'ryanmusic-library-ui-v1';

function readList(key: string): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUi(): Pick<LibraryState, 'homeTab' | 'channel'> {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_KEY) || '{}') as Partial<LibraryState>;
    return {
      homeTab: parsed.homeTab === 'recent' || parsed.homeTab === 'playlist' ? parsed.homeTab : 'liked',
      channel: parsed.channel === 'netease' || parsed.channel === 'qq' ? parsed.channel : 'all',
    };
  } catch {
    return { homeTab: 'liked', channel: 'all' };
  }
}

function upsert(list: LibraryEntry[], entry: LibraryEntry, cap: number): LibraryEntry[] {
  return [entry, ...list.filter((item) => trackKey(item) !== trackKey(entry))].slice(0, cap);
}

const ui = readUi();

export const useLibraryStore = create<LibraryState>((set, get) => ({
  liked: readList(LIKED_KEY),
  recent: readList(RECENT_KEY),
  playlist: readList(PLAYLIST_KEY),
  homeTab: ui.homeTab,
  channel: ui.channel,
  setHomeTab: (homeTab) => set({ homeTab }),
  setChannel: (channel) => set({ channel }),
  toggleLike: (track) => {
    const entry = libraryItem(track);
    const liked = get().liked;
    const exists = liked.some((item) => trackKey(item) === trackKey(entry));
    set({
      liked: exists ? liked.filter((item) => trackKey(item) !== trackKey(entry)) : upsert(liked, entry, 200),
    });
  },
  isLiked: (track) => Boolean(track && get().liked.some((item) => trackKey(item) === trackKey(track))),
  addRecent: (track) => set({ recent: upsert(get().recent, libraryItem(track), 80) }),
  addToPlaylist: (track) => set({ playlist: upsert(get().playlist, libraryItem(track), 200) }),
  removeFromPlaylist: (track) => {
    set({ playlist: get().playlist.filter((item) => trackKey(item) !== trackKey(track)) });
  },
}));

useLibraryStore.subscribe((state) => {
  localStorage.setItem(LIKED_KEY, JSON.stringify(state.liked));
  localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent));
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state.playlist));
  localStorage.setItem(UI_KEY, JSON.stringify({ homeTab: state.homeTab, channel: state.channel }));
});
