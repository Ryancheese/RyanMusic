import { create } from 'zustand';
import type { HomeTab, LibraryCardStyle, LibraryLayoutMode } from '../types';

export interface LibraryEntry {
  type: import('../types').MusicSource;
  songid: string;
  title: string;
  author: string;
  delisted?: boolean;
}

const UI_KEY = 'ryanmusic-library-ui-v4';
const LEGACY_KEYS = [
  'ryanmusic-liked-v1',
  'ryanmusic-recent-v1',
  'ryanmusic-playlist-v1',
  'ryanmusic-library-ui-v1',
  'ryanmusic-library-ui-v2',
  'ryanmusic-library-ui-v3',
];

function purgeLegacyCache() {
  for (const key of LEGACY_KEYS) {
    if (key === 'ryanmusic-library-ui-v3') continue;
    localStorage.removeItem(key);
  }
}

function readPersistedUi(): {
  homeTab: HomeTab;
  layoutMode: LibraryLayoutMode;
  cardStyle: LibraryCardStyle;
} {
  try {
    const rawV4 = localStorage.getItem(UI_KEY);
    const rawV3 = localStorage.getItem('ryanmusic-library-ui-v3');
    const parsed = JSON.parse(rawV4 || rawV3 || '{}') as {
      homeTab?: string;
      layoutMode?: string;
      cardStyle?: string;
    };
    const homeTab: HomeTab = parsed.homeTab === 'qq' ? 'qq' : 'netease';

    // 旧「卡片」布局 → 方形 + 铭牌；其它布局默认纯封面，除非已存铭牌
    let layoutMode: LibraryLayoutMode = 'square';
    let cardStyle: LibraryCardStyle = 'plaque';
    if (parsed.layoutMode === 'card') {
      layoutMode = 'square';
      cardStyle = 'plaque';
    } else if (
      parsed.layoutMode === 'square'
      || parsed.layoutMode === 'list'
      || parsed.layoutMode === 'honeycomb'
    ) {
      layoutMode = parsed.layoutMode;
      if (parsed.cardStyle === 'cover' || parsed.cardStyle === 'plaque') {
        cardStyle = parsed.cardStyle;
      } else {
        cardStyle = rawV4 ? 'plaque' : 'cover';
      }
    }

    return { homeTab, layoutMode, cardStyle };
  } catch {
    return { homeTab: 'netease', layoutMode: 'square', cardStyle: 'plaque' };
  }
}

const initial = readPersistedUi();
purgeLegacyCache();
try {
  localStorage.removeItem('ryanmusic-library-ui-v3');
} catch {
  // ignore
}

interface LibraryState {
  homeTab: HomeTab;
  layoutMode: LibraryLayoutMode;
  cardStyle: LibraryCardStyle;
  setHomeTab: (tab: HomeTab) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
  setCardStyle: (style: LibraryCardStyle) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  homeTab: initial.homeTab,
  layoutMode: initial.layoutMode,
  cardStyle: initial.cardStyle,
  setHomeTab: (homeTab) => set({ homeTab }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setCardStyle: (cardStyle) => set({ cardStyle }),
}));

useLibraryStore.subscribe((state) => {
  localStorage.setItem(UI_KEY, JSON.stringify({
    homeTab: state.homeTab,
    layoutMode: state.layoutMode,
    cardStyle: state.cardStyle,
  }));
});
