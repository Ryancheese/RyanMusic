import { motionValue, type MotionValue } from 'framer-motion';
import type { AudioBands, Theme, ThemeTokens, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from '../components/visualizer/backgrounds/definition';
import {
  DEFAULT_LATENT_BACKGROUND_TUNING,
  DEFAULT_MONET_BACKGROUND_TUNING,
  DEFAULT_NOMAND_BACKGROUND_TUNING,
  DEFAULT_SORA_BACKGROUND_TUNING,
} from '../types';
import {
  hasVisualizerBackgroundMode,
} from '../components/visualizer/backgrounds/registry';
import { saveCustomBackgroundImage, stripCustomImageUrl } from './customBackgroundImage';
import { sanitizeUrlBackgroundList } from '../utils/urlBackground';
import type { LyricsAppearanceState } from '../store/lyricsAppearanceStore';

export const VISUALIZER_MODE_KEY = 'ryanmusic-visualizer-mode';
export const VISUALIZER_BG_KEY = 'ryanmusic-visualizer-bg-v1';

export function createAudioBands(): AudioBands {
  return {
    bass: motionValue(0),
    lowMid: motionValue(0),
    mid: motionValue(0),
    vocal: motionValue(0),
    treble: motionValue(0),
    spectrum: motionValue(new Uint8Array(new ArrayBuffer(0))),
  };
}

export type FoliaThemeOptions = Partial<Pick<
  LyricsAppearanceState,
  | 'fontStyle'
  | 'fontWeight'
  | 'fontFallbackFamilies'
  | 'customFont'
  | 'animationIntensity'
  | 'keywordColoringEnabled'
  | 'wordColors'
>>;

/** Build Folia Theme from RyanMusic tokens + lyrics appearance overrides. */
export function toFoliaTheme(
  theme: ThemeTokens,
  accent?: string | null,
  appearance?: FoliaThemeOptions | null,
): Theme {
  const fontStyle = appearance?.fontStyle || 'serif';
  const wordColors = appearance?.keywordColoringEnabled === false
    ? []
    : (appearance?.wordColors || []);

  return {
    name: theme.name,
    backgroundColor: theme.backgroundColor,
    primaryColor: theme.primaryColor,
    accentColor: accent || theme.accentColor,
    secondaryColor: theme.secondaryColor,
    fontStyle,
    fontWeight: appearance?.fontWeight ?? undefined,
    fontFamily: appearance?.customFont?.family || undefined,
    fontFamilyStack: appearance?.fontFallbackFamilies?.length
      ? appearance.fontFallbackFamilies
      : undefined,
    animationIntensity: appearance?.animationIntensity || 'normal',
    wordColors: wordColors.length ? wordColors : undefined,
  };
}

export function readVisualizerMode(): VisualizerMode {
  try {
    const raw = localStorage.getItem(VISUALIZER_MODE_KEY) || 'classic';
    // 旧模式迁移：墨染/回响 → 散字；IOS → 聚光
    if (raw === 'moran' || raw === 'echo') return 'classic';
    if (raw === 'ios') return 'spotlight';
    return raw as VisualizerMode;
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
    const urlItems = parsed.url?.items !== undefined
      ? sanitizeUrlBackgroundList(parsed.url.items)
      : parsed.url?.items;
    const selectedId = parsed.url?.selectedId;
    const urlSelectedId = selectedId && urlItems?.some(item => item.id === selectedId)
      ? selectedId
      : (urlItems?.[0]?.id ?? null);

    return {
      ...fallback,
      ...parsed,
      mode,
      common: {
        ...fallback.common,
        ...parsed.common,
      },
      monet: parsed.monet?.tuning
        ? { tuning: { ...DEFAULT_MONET_BACKGROUND_TUNING, ...parsed.monet.tuning } }
        : parsed.monet,
      nomand: parsed.nomand?.tuning
        ? { tuning: { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...parsed.nomand.tuning } }
        : parsed.nomand,
      latent: parsed.latent?.tuning
        ? { tuning: { ...DEFAULT_LATENT_BACKGROUND_TUNING, ...parsed.latent.tuning } }
        : parsed.latent,
      sora: parsed.sora?.tuning
        ? { tuning: { ...DEFAULT_SORA_BACKGROUND_TUNING, ...parsed.sora.tuning } }
        : parsed.sora,
      url: parsed.url
        ? { items: urlItems ?? [], selectedId: urlSelectedId }
        : parsed.url,
    };
  } catch {
    return fallback;
  }
}

export function writeBackgroundConfig(config: VisualizerBackgroundConfig) {
  const persistable: VisualizerBackgroundConfig = {
    ...config,
    customImage: stripCustomImageUrl(config.customImage),
  };
  try {
    localStorage.setItem(VISUALIZER_BG_KEY, JSON.stringify(persistable));
  } catch {
    // 大图可能撑爆 localStorage，图片走 IndexedDB
  }
  void saveCustomBackgroundImage(config.customImage ?? null);
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
    const spec = bands.spectrum?.get();
    if (spec?.length) {
      for (let i = 0; i < spec.length; i += 1) spec[i] = (spec[i] * 0.92) | 0;
    }
    return;
  }
  if (!analyserBuffer || analyserBuffer.length !== analyser.frequencyBinCount) {
    analyserBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  }
  analyser.getByteFrequencyData(analyserBuffer as never);
  if (bands.spectrum && bands.spectrum.get() !== analyserBuffer) bands.spectrum.set(analyserBuffer);
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
