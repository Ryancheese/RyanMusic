import { create } from 'zustand';
import type { HomeTab, MusicSource } from '../types';

export interface LibraryEntry {
  type: MusicSource;
  songid: string;
  title: string;
  author: string;
}

const UI_KEY = 'ryanmusic-library-ui-v2';
const LEGACY_KEYS = [
  'ryanmusic-liked-v1',
  'ryanmusic-recent-v1',
  'ryanmusic-playlist-v1',
  'ryanmusic-library-ui-v1',
];

function purgeLegacyCache() {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

function readHomeTab(): HomeTab {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_KEY) || '{}') as { homeTab?: string };
    return parsed.homeTab === 'qq' ? 'qq' : 'netease';
  } catch {
    return 'netease';
  }
}

purgeLegacyCache();

interface LibraryState {
  homeTab: HomeTab;
  setHomeTab: (tab: HomeTab) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  homeTab: readHomeTab(),
  setHomeTab: (homeTab) => set({ homeTab }),
}));

useLibraryStore.subscribe((state) => {
  localStorage.setItem(UI_KEY, JSON.stringify({ homeTab: state.homeTab }));
});
