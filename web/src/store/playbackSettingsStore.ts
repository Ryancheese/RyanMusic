import { create } from 'zustand';

const KEY = 'ryanmusic-playback-v1';

export const PLAYBACK_DEFAULTS = {
  /** 下架/无流时，自动换到另一渠道并用私链播放 */
  crossPlayFallback: true,
} as const;

interface PersistedPlayback {
  crossPlayFallback?: boolean;
}

function readPlayback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedPlayback;
    return {
      crossPlayFallback: parsed.crossPlayFallback !== false,
    };
  } catch {
    return { ...PLAYBACK_DEFAULTS };
  }
}

interface PlaybackSettingsState {
  crossPlayFallback: boolean;
  setCrossPlayFallback: (enabled: boolean) => void;
}

const initial = readPlayback();

export const usePlaybackSettingsStore = create<PlaybackSettingsState>((set) => ({
  crossPlayFallback: initial.crossPlayFallback,
  setCrossPlayFallback: (crossPlayFallback) => set({ crossPlayFallback }),
}));

usePlaybackSettingsStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    crossPlayFallback: state.crossPlayFallback,
  }));
});
