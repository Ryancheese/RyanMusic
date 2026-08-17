import { motionValue, type MotionValue } from 'framer-motion';
import type { AudioBands, Theme, ThemeTokens, VisualizerMode } from '../types';

export const VISUALIZER_MODE_KEY = 'ryanmusic-visualizer-mode';

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
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
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
