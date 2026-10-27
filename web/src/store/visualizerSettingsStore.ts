import { create } from 'zustand';
import {
  DEFAULT_SMART_BEAT_SETTINGS,
  type SmartBeatSettings,
  type VisualizerBackgroundMode,
  type VisualizerMode,
} from '../types';
import {
  resolveSmartBeatSettings,
  toStoredSmartBeat,
  type SmartBeatPatch,
} from '../services/beatFx/smartBeatSettings';
import { readVisualizerMode, writeVisualizerMode, readBackgroundConfig } from '../lib/visualizer';
import {
  normalizeRandomVisualizerModes,
  pickRandomVisualizerMode,
} from '../utils/randomVisualizerModes';

const SMART_BEAT_KEY = 'ryanmusic-visualizer-smart-beat-v1';
const RANDOM_PER_SONG_KEY = 'ryanmusic-random-visualizer-mode-per-song';
const RANDOM_MODES_KEY = 'ryanmusic-random-visualizer-modes';

const readStoredSmartBeat = (): SmartBeatSettings => {
  try {
    const saved = localStorage.getItem(SMART_BEAT_KEY);
    if (!saved) return DEFAULT_SMART_BEAT_SETTINGS;
    return resolveSmartBeatSettings(JSON.parse(saved) as SmartBeatPatch, DEFAULT_SMART_BEAT_SETTINGS);
  } catch {
    return DEFAULT_SMART_BEAT_SETTINGS;
  }
};

const persistSmartBeat = (settings: SmartBeatSettings) => {
  try {
    localStorage.setItem(SMART_BEAT_KEY, JSON.stringify(toStoredSmartBeat(settings)));
  } catch {
    // ignore quota
  }
};

const readStoredBoolean = (key: string, fallback: boolean) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
};

const writeStoredBoolean = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore
  }
};

const readStoredRandomModes = (): VisualizerMode[] => {
  try {
    return normalizeRandomVisualizerModes(JSON.parse(localStorage.getItem(RANDOM_MODES_KEY) || 'null'));
  } catch {
    return normalizeRandomVisualizerModes(null);
  }
};

export type SetVisualizerModeOptions = {
  notify?: boolean;
  preserveRandom?: boolean;
};

export interface VisualizerSettingsState {
  smartBeat: SmartBeatSettings;
  visualizerMode: VisualizerMode;
  visualizerBackgroundMode: VisualizerBackgroundMode | null;
  randomVisualizerModePerSong: boolean;
  randomVisualizerModes: VisualizerMode[];
  handleSetSmartBeat: (patch: SmartBeatPatch) => void;
  setVisualizerMode: (mode: VisualizerMode) => void;
  handleSetVisualizerMode: (mode: VisualizerMode, options?: SetVisualizerModeOptions) => void;
  setVisualizerBackgroundMode: (mode: VisualizerBackgroundMode | null) => void;
  handleToggleRandomVisualizerModePerSong: (enable: boolean) => void;
  handleSetRandomVisualizerModes: (modes: readonly VisualizerMode[]) => void;
  rerollRandomVisualizerMode: () => VisualizerMode | null;
}

export const useVisualizerSettingsStore = create<VisualizerSettingsState>((set, get) => ({
  smartBeat: readStoredSmartBeat(),
  visualizerMode: readVisualizerMode(),
  visualizerBackgroundMode: readBackgroundConfig().mode ?? null,
  randomVisualizerModePerSong: readStoredBoolean(RANDOM_PER_SONG_KEY, false),
  randomVisualizerModes: readStoredRandomModes(),
  handleSetSmartBeat: (patch) => {
    const next = resolveSmartBeatSettings(patch, get().smartBeat);
    persistSmartBeat(next);
    set({ smartBeat: next });
  },
  setVisualizerMode: (mode) => set({ visualizerMode: mode }),
  handleSetVisualizerMode: (mode, options) => {
    writeVisualizerMode(mode);
    if (!options?.preserveRandom && get().randomVisualizerModePerSong) {
      writeStoredBoolean(RANDOM_PER_SONG_KEY, false);
      set({ visualizerMode: mode, randomVisualizerModePerSong: false });
      return;
    }
    set({ visualizerMode: mode });
  },
  setVisualizerBackgroundMode: (mode) => set({ visualizerBackgroundMode: mode }),
  handleToggleRandomVisualizerModePerSong: (enable) => {
    writeStoredBoolean(RANDOM_PER_SONG_KEY, enable);
    set({ randomVisualizerModePerSong: enable });
  },
  handleSetRandomVisualizerModes: (modes) => {
    const next = normalizeRandomVisualizerModes(modes);
    try {
      localStorage.setItem(RANDOM_MODES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    set({ randomVisualizerModes: next });
  },
  rerollRandomVisualizerMode: () => {
    const { randomVisualizerModes, visualizerMode } = get();
    const next = pickRandomVisualizerMode(randomVisualizerModes, visualizerMode);
    if (next === visualizerMode) return null;
    writeVisualizerMode(next);
    set({ visualizerMode: next, randomVisualizerModePerSong: true });
    writeStoredBoolean(RANDOM_PER_SONG_KEY, true);
    return next;
  },
}));
