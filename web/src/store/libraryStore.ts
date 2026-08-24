import { create } from 'zustand';
import type {
  HomeTab,
  LibraryCardStyle,
  LibraryLayoutMode,
  LibraryListColumns,
  NeteaseLibrarySection,
} from '../types';

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
  neteaseLibrarySection: NeteaseLibrarySection;
  layoutMode: LibraryLayoutMode;
  cardStyle: LibraryCardStyle;
  listColumns: LibraryListColumns;
} {
  try {
    const rawV4 = localStorage.getItem(UI_KEY);
    const rawV3 = localStorage.getItem('ryanmusic-library-ui-v3');
    const parsed = JSON.parse(rawV4 || rawV3 || '{}') as {
      homeTab?: string;
      layoutMode?: string;
      cardStyle?: string;
      listColumns?: string;
      neteaseLibrarySection?: string;
    };
    const homeTab: HomeTab = parsed.homeTab === 'qq' ? 'qq' : 'netease';
    const neteaseLibrarySection: NeteaseLibrarySection = parsed.neteaseLibrarySection === 'recommend'
      ? 'recommend'
      : 'playlists';

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

    const listColumns: LibraryListColumns = parsed.listColumns === 'multi' ? 'multi' : 'single';

    return { homeTab, neteaseLibrarySection, layoutMode, cardStyle, listColumns };
  } catch {
    return {
      homeTab: 'netease',
      neteaseLibrarySection: 'playlists',
      layoutMode: 'square',
      cardStyle: 'plaque',
      listColumns: 'single',
    };
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
  neteaseLibrarySection: NeteaseLibrarySection;
  layoutMode: LibraryLayoutMode;
  cardStyle: LibraryCardStyle;
  listColumns: LibraryListColumns;
  setHomeTab: (tab: HomeTab) => void;
  setNeteaseLibrarySection: (section: NeteaseLibrarySection) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
  setCardStyle: (style: LibraryCardStyle) => void;
  setListColumns: (columns: LibraryListColumns) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  homeTab: initial.homeTab,
  neteaseLibrarySection: initial.neteaseLibrarySection,
  layoutMode: initial.layoutMode,
  cardStyle: initial.cardStyle,
  listColumns: initial.listColumns,
  setHomeTab: (homeTab) => set({ homeTab }),
  setNeteaseLibrarySection: (neteaseLibrarySection) => set({ neteaseLibrarySection }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setCardStyle: (cardStyle) => set({ cardStyle }),
  setListColumns: (listColumns) => set({ listColumns }),
}));

useLibraryStore.subscribe((state) => {
  localStorage.setItem(UI_KEY, JSON.stringify({
    homeTab: state.homeTab,
    neteaseLibrarySection: state.neteaseLibrarySection,
    layoutMode: state.layoutMode,
    cardStyle: state.cardStyle,
    listColumns: state.listColumns,
  }));
});
