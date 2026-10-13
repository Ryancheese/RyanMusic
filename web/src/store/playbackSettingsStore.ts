import { create } from 'zustand';
import {
  AUTO_AUDIO_QUALITY,
  isAudioQualityPreference,
  type AudioQualityPreference,
} from '../lib/audioQuality';

const KEY = 'ryanmusic-playback-v1';

export type TransitionMode = 'automix' | 'crossfade';

export const CROSSFADE_MIN_SEC = 1;
export const CROSSFADE_MAX_SEC = 12;
export const CROSSFADE_DEFAULT_SEC = 5;

export function clampCrossfadeSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return CROSSFADE_DEFAULT_SEC;
  return Math.min(CROSSFADE_MAX_SEC, Math.max(CROSSFADE_MIN_SEC, Math.round(seconds)));
}

export const PLAYBACK_DEFAULTS = {
  /** 下架/无流时，自动换到另一渠道并用私链播放 */
  crossPlayFallback: true,
  /** 登录后默认音质；auto 按网速/环境选择 */
  preferredQuality: AUTO_AUDIO_QUALITY as AudioQualityPreference,
  /** 切歌时两首叠一段 */
  transitionEnabled: true,
  transitionMode: 'automix' as TransitionMode,
  transitionSeconds: CROSSFADE_DEFAULT_SEC,
} as const;

interface PersistedPlayback {
  crossPlayFallback?: boolean;
  preferredQuality?: string;
  transitionEnabled?: boolean;
  transitionMode?: string;
  transitionSeconds?: number;
}

function readPlayback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as PersistedPlayback;
    return {
      crossPlayFallback: parsed.crossPlayFallback !== false,
      preferredQuality: isAudioQualityPreference(parsed.preferredQuality)
        ? parsed.preferredQuality
        : PLAYBACK_DEFAULTS.preferredQuality,
      transitionEnabled: parsed.transitionEnabled !== false,
      transitionMode: parsed.transitionMode === 'crossfade' ? 'crossfade' as const : 'automix' as const,
      transitionSeconds: clampCrossfadeSeconds(
        parsed.transitionSeconds ?? PLAYBACK_DEFAULTS.transitionSeconds,
      ),
    };
  } catch {
    return { ...PLAYBACK_DEFAULTS };
  }
}

interface PlaybackSettingsState {
  crossPlayFallback: boolean;
  preferredQuality: AudioQualityPreference;
  transitionEnabled: boolean;
  transitionMode: TransitionMode;
  transitionSeconds: number;
  setCrossPlayFallback: (enabled: boolean) => void;
  setPreferredQuality: (quality: AudioQualityPreference) => void;
  setTransitionEnabled: (enabled: boolean) => void;
  setTransitionMode: (mode: TransitionMode) => void;
  setTransitionSeconds: (seconds: number) => void;
}

const initial = readPlayback();

export const usePlaybackSettingsStore = create<PlaybackSettingsState>((set) => ({
  crossPlayFallback: initial.crossPlayFallback,
  preferredQuality: initial.preferredQuality,
  transitionEnabled: initial.transitionEnabled,
  transitionMode: initial.transitionMode,
  transitionSeconds: initial.transitionSeconds,
  setCrossPlayFallback: (crossPlayFallback) => set({ crossPlayFallback }),
  setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
  setTransitionEnabled: (transitionEnabled) => set({ transitionEnabled }),
  setTransitionMode: (transitionMode) => set({ transitionMode }),
  setTransitionSeconds: (seconds) => set({ transitionSeconds: clampCrossfadeSeconds(seconds) }),
}));

usePlaybackSettingsStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    crossPlayFallback: state.crossPlayFallback,
    preferredQuality: state.preferredQuality,
    transitionEnabled: state.transitionEnabled,
    transitionMode: state.transitionMode,
    transitionSeconds: state.transitionSeconds,
  }));
});
