import { create } from 'zustand';
import type { HomeTab, LibraryLayoutMode } from '../types';

export interface LibraryEntry {
  type: import('../types').MusicSource;
  songid: string;
  title: string;
  author: string;
}

const UI_KEY = 'ryanmusic-library-ui-v3';
const LEGACY_KEYS = [
  'ryanmusic-liked-v1',
  'ryanmusic-recent-v1',
  'ryanmusic-playlist-v1',
  'ryanmusic-library-ui-v1',
  'ryanmusic-library-ui-v2',
];

function purgeLegacyCache() {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

function readPersistedUi(): { homeTab: HomeTab; layoutMode: LibraryLayoutMode } {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_KEY) || '{}') as {
      homeTab?: string;
      layoutMode?: string;
    };
    const homeTab: HomeTab = parsed.homeTab === 'qq' ? 'qq' : 'netease';
    const layoutMode: LibraryLayoutMode =
      parsed.layoutMode === 'square' || parsed.layoutMode === 'list' || parsed.layoutMode === 'honeycomb'
        ? parsed.layoutMode
        : 'honeycomb';
    return { homeTab, layoutMode };
  } catch {
    return { homeTab: 'netease', layoutMode: 'honeycomb' };
  }
}

purgeLegacyCache();
const initial = readPersistedUi();

interface LibraryState {
  homeTab: HomeTab;
  layoutMode: LibraryLayoutMode;
  setHomeTab: (tab: HomeTab) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  homeTab: initial.homeTab,
  layoutMode: initial.layoutMode,
  setHomeTab: (homeTab) => set({ homeTab }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
}));

useLibraryStore.subscribe((state) => {
  localStorage.setItem(UI_KEY, JSON.stringify({
    homeTab: state.homeTab,
    layoutMode: state.layoutMode,
  }));
});
