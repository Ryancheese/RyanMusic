import { motionValue, type MotionValue } from 'framer-motion';
import type { AudioBands, Theme, ThemeTokens, VisualizerBackgroundMode, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from '../components/visualizer/backgrounds/definition';
import {
  hasVisualizerBackgroundMode,
} from '../components/visualizer/backgrounds/registry';

export const VISUALIZER_MODE_KEY = 'ryanmusic-visualizer-mode';
export const VISUALIZER_BG_KEY = 'ryanmusic-visualizer-bg-v1';

export function createAudioBands(): AudioBands {
  return {
    bass: motionValue(0),
    lowMid: motionValue(0),
    mid: motionValue(0),
    vocal: motionValue(0),
    treble: motionValue(0),
  };
}

export function toFoliaTheme(theme: ThemeTokens, accent?: string | null): Theme {
  return {
    name: theme.name,
    backgroundColor: theme.backgroundColor,
    primaryColor: theme.primaryColor,
    accentColor: accent || theme.accentColor,
    secondaryColor: theme.secondaryColor,
    fontStyle: 'serif',
    animationIntensity: 'normal',
  };
}

export function readVisualizerMode(): VisualizerMode {
  try {
    return (localStorage.getItem(VISUALIZER_MODE_KEY) as VisualizerMode) || 'classic';
  } catch {
    return 'classic';
  }
}

export function writeVisualizerMode(mode: VisualizerMode) {
  localStorage.setItem(VISUALIZER_MODE_KEY, mode);
}

export function defaultBackgroundConfig(lightweight = false): VisualizerBackgroundConfig {
  return {
    mode: 'common',
    common: {
      useCoverColorBg: true,
      disableGeometricBackground: lightweight,
      opacity: 0.75,
      disableVignette: false,
    },
  };
}

export function readBackgroundConfig(lightweight = false): VisualizerBackgroundConfig {
  const fallback = defaultBackgroundConfig(lightweight);
  try {
    const parsed = JSON.parse(localStorage.getItem(VISUALIZER_BG_KEY) || '{}') as VisualizerBackgroundConfig;
    const mode = hasVisualizerBackgroundMode(parsed.mode)
      ? parsed.mode
      : fallback.mode;
    return {
      ...fallback,
      ...parsed,
      mode,
      common: {
        ...fallback.common,
        ...parsed.common,
      },
    };
  } catch {
    return fallback;
  }
}

export function writeBackgroundConfig(config: VisualizerBackgroundConfig) {
  localStorage.setItem(VISUALIZER_BG_KEY, JSON.stringify(config));
}

let analyserBuffer: Uint8Array | null = null;

export function pulseAudioBands(bands: AudioBands, analyser: AnalyserNode | null, playing: boolean) {
  if (!analyser || !playing) {
    const decay = (value: MotionValue<number>) => value.set(value.get() * 0.92);
    decay(bands.bass);
    decay(bands.lowMid);
    decay(bands.mid);
    decay(bands.vocal);
    decay(bands.treble);
    return;
  }
  if (!analyserBuffer || analyserBuffer.length !== analyser.frequencyBinCount) {
    analyserBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  }
  analyser.getByteFrequencyData(analyserBuffer as never);
  const data = analyserBuffer;
  const avg = (from: number, to: number) => {
    let sum = 0;
    const end = Math.min(to, data.length);
    for (let i = from; i < end; i += 1) sum += data[i];
    return sum / Math.max(end - from, 1) / 255;
  };
  bands.bass.set(avg(0, 4));
  bands.lowMid.set(avg(4, 10));
  bands.mid.set(avg(10, 22));
  bands.vocal.set(avg(22, 48));
  bands.treble.set(avg(48, 96));
}
