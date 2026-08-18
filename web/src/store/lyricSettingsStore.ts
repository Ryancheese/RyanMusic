import { create } from 'zustand';
import type { LyricProviderSource } from '../types';
import { DEFAULT_LYRIC_FILTER_PATTERN } from '../utils/lyrics/filtering';

const KEY = 'ryanmusic-lyric-source-v1';
export const LYRIC_SOURCE_OPTIONS: { id: LyricProviderSource; label: string }[] = [
  { id: 'netease', label: '网易云音乐' },
  { id: 'amll', label: 'AMLLDB' },
  { id: 'qq', label: 'QQ 音乐' },
  { id: 'kugou', label: '酷狗音乐' },
];

export const DEFAULT_PREFERRED_LYRIC_SOURCE: LyricProviderSource = 'qq';
export const BASE_LYRIC_SOURCE_ORDER: readonly LyricProviderSource[] = ['netease', 'amll', 'qq', 'kugou'];

export function buildLyricSourceOrder(
  preferred: LyricProviderSource = DEFAULT_PREFERRED_LYRIC_SOURCE,
): LyricProviderSource[] {
  return [preferred, ...BASE_LYRIC_SOURCE_ORDER.filter((source) => source !== preferred)];
}

function isLyricProviderSource(value: unknown): value is LyricProviderSource {
  return value === 'netease' || value === 'amll' || value === 'qq' || value === 'kugou';
}

interface PersistedLyricSettings {
  preferred?: string;
  filterEnabled?: boolean;
  filterPattern?: string;
  autoUseBest?: boolean;
}

function readSettings(): {
  preferredSource: LyricProviderSource;
  filterEnabled: boolean;
  filterPattern: string;
  autoUseBest: boolean;
} {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as PersistedLyricSettings | null;
    return {
      preferredSource: isLyricProviderSource(parsed?.preferred)
        ? parsed.preferred
        : DEFAULT_PREFERRED_LYRIC_SOURCE,
      filterEnabled: parsed?.filterEnabled !== false,
      filterPattern: typeof parsed?.filterPattern === 'string'
        ? parsed.filterPattern
        : DEFAULT_LYRIC_FILTER_PATTERN,
      autoUseBest: parsed?.autoUseBest !== false,
    };
  } catch {
    return {
      preferredSource: DEFAULT_PREFERRED_LYRIC_SOURCE,
      filterEnabled: true,
      filterPattern: DEFAULT_LYRIC_FILTER_PATTERN,
      autoUseBest: true,
    };
  }
}

interface LyricSettingsState {
  preferredSource: LyricProviderSource;
  filterEnabled: boolean;
  filterPattern: string;
  autoUseBest: boolean;
  setPreferredSource: (source: LyricProviderSource) => void;
  setFilterEnabled: (enabled: boolean) => void;
  setFilterPattern: (pattern: string) => void;
  setAutoUseBest: (enabled: boolean) => void;
}

const initial = readSettings();

export const useLyricSettingsStore = create<LyricSettingsState>((set) => ({
  preferredSource: initial.preferredSource,
  filterEnabled: initial.filterEnabled,
  filterPattern: initial.filterEnabled ? initial.filterPattern : '',
  autoUseBest: initial.autoUseBest,
  setPreferredSource: (preferredSource) => set({ preferredSource }),
  setFilterEnabled: (filterEnabled) => set((state) => ({
    filterEnabled,
    filterPattern: filterEnabled
      ? (state.filterPattern.trim() ? state.filterPattern : DEFAULT_LYRIC_FILTER_PATTERN)
      : '',
  })),
  setFilterPattern: (filterPattern) => set({ filterPattern }),
  setAutoUseBest: (autoUseBest) => set({ autoUseBest }),
}));

useLyricSettingsStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    preferred: state.preferredSource,
    filterEnabled: state.filterEnabled,
    filterPattern: state.filterEnabled
      ? state.filterPattern
      : (state.filterPattern || DEFAULT_LYRIC_FILTER_PATTERN),
    autoUseBest: state.autoUseBest,
  }));
});
