import { create } from 'zustand';
import {
  AUTO_AUDIO_QUALITY,
  isAudioQualityPreference,
  type AudioQualityPreference,
} from '../lib/audioQuality';

const KEY = 'ryanmusic-playback-v1';

export const PLAYBACK_DEFAULTS = {
  /** 下架/无流时，自动换到另一渠道并用私链播放 */
  crossPlayFallback: true,
  /** 登录后默认音质；auto 按网速/环境选择 */
  preferredQuality: AUTO_AUDIO_QUALITY as AudioQualityPreference,
} as const;

interface PersistedPlayback {
  crossPlayFallback?: boolean;
  preferredQuality?: string;
}

function readPlayback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedPlayback;
    return {
      crossPlayFallback: parsed.crossPlayFallback !== false,
      preferredQuality: isAudioQualityPreference(parsed.preferredQuality)
        ? parsed.preferredQuality
        : PLAYBACK_DEFAULTS.preferredQuality,
    };
  } catch {
    return { ...PLAYBACK_DEFAULTS };
  }
}

interface PlaybackSettingsState {
  crossPlayFallback: boolean;
  preferredQuality: AudioQualityPreference;
  setCrossPlayFallback: (enabled: boolean) => void;
  setPreferredQuality: (quality: AudioQualityPreference) => void;
}

const initial = readPlayback();

export const usePlaybackSettingsStore = create<PlaybackSettingsState>((set) => ({
  crossPlayFallback: initial.crossPlayFallback,
  preferredQuality: initial.preferredQuality,
  setCrossPlayFallback: (crossPlayFallback) => set({ crossPlayFallback }),
  setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
}));

usePlaybackSettingsStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    crossPlayFallback: state.crossPlayFallback,
    preferredQuality: state.preferredQuality,
  }));
});
