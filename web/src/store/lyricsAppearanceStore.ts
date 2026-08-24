import { create } from 'zustand';
import type { StoredCustomLyricsFont, SubtitleContentMode, Theme } from '../types';
import { normalizeFontFamilyStack, normalizeFontWeight } from '../utils/fontStacks';

const KEY = 'ryanmusic-lyrics-appearance-v1';

export type AnimationIntensity = Theme['animationIntensity'];
export type LyricsFontStyle = Theme['fontStyle'];

export interface LyricsWordColor {
  word: string;
  color: string;
}

export interface LyricsAppearanceState {
  fontStyle: LyricsFontStyle;
  fontScale: number;
  fontWeight: number | null;
  fontFallbackFamilies: string[];
  customFont: StoredCustomLyricsFont | null;
  animationIntensity: AnimationIntensity;
  visualizerOpacity: number;
  subtitleContentMode: SubtitleContentMode;
  subtitleFontScale: number;
  subtitleOverlayOpacity: number;
  subtitleOverlayBackground: boolean;
  hideTranslationSubtitle: boolean;
  showHarmonySubtitle: boolean;
  harmonySubtitleBackground: boolean;
  /** 手动关键字着色（Folia 里通常来自 AI 主题；这里开放给用户） */
  keywordColoringEnabled: boolean;
  wordColors: LyricsWordColor[];
  /** RyanMusic 扩展：舞台字距微调（部分模式会读 theme 间接感受） */
  letterSpacingEm: number;
}

export const LYRICS_APPEARANCE_DEFAULTS: LyricsAppearanceState = {
  fontStyle: 'serif',
  fontScale: 1,
  fontWeight: null,
  fontFallbackFamilies: [],
  customFont: null,
  animationIntensity: 'normal',
  visualizerOpacity: 1,
  subtitleContentMode: 'translation',
  subtitleFontScale: 1,
  subtitleOverlayOpacity: 0.6,
  subtitleOverlayBackground: true,
  hideTranslationSubtitle: false,
  showHarmonySubtitle: true,
  harmonySubtitleBackground: true,
  keywordColoringEnabled: true,
  wordColors: [],
  letterSpacingEm: 0,
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
};

const clampFontScale = (value: unknown) => clamp(value, 0.85, 1.4, 1);

const sanitizeWordColors = (value: unknown): LyricsWordColor[] => {
  if (!Array.isArray(value)) return [];
  const out: LyricsWordColor[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const word = String((item as LyricsWordColor).word || '').trim();
    const color = String((item as LyricsWordColor).color || '').trim();
    if (!word || !color) continue;
    out.push({ word, color });
    if (out.length >= 24) break;
  }
  return out;
};

const readAppearance = (): LyricsAppearanceState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<LyricsAppearanceState>;
    const fontStyle = parsed.fontStyle === 'sans' || parsed.fontStyle === 'mono' || parsed.fontStyle === 'serif'
      ? parsed.fontStyle
      : LYRICS_APPEARANCE_DEFAULTS.fontStyle;
    const animationIntensity = parsed.animationIntensity === 'calm'
      || parsed.animationIntensity === 'chaotic'
      || parsed.animationIntensity === 'normal'
      ? parsed.animationIntensity
      : LYRICS_APPEARANCE_DEFAULTS.animationIntensity;
    const subtitleContentMode = parsed.subtitleContentMode === 'romanization'
      || parsed.subtitleContentMode === 'none'
      || parsed.subtitleContentMode === 'translation'
      ? parsed.subtitleContentMode
      : LYRICS_APPEARANCE_DEFAULTS.subtitleContentMode;

    return {
      ...LYRICS_APPEARANCE_DEFAULTS,
      ...parsed,
      fontStyle,
      animationIntensity,
      subtitleContentMode,
      fontScale: clampFontScale(parsed.fontScale),
      fontWeight: normalizeFontWeight(parsed.fontWeight),
      fontFallbackFamilies: normalizeFontFamilyStack(parsed.fontFallbackFamilies),
      customFont: parsed.customFont && typeof parsed.customFont === 'object'
        ? parsed.customFont
        : null,
      visualizerOpacity: clamp(parsed.visualizerOpacity, 0.35, 1, 1),
      subtitleFontScale: clampFontScale(parsed.subtitleFontScale),
      subtitleOverlayOpacity: clamp(parsed.subtitleOverlayOpacity, 0.2, 1, 0.6),
      subtitleOverlayBackground: parsed.subtitleOverlayBackground !== false,
      hideTranslationSubtitle: Boolean(parsed.hideTranslationSubtitle),
      showHarmonySubtitle: parsed.showHarmonySubtitle !== false,
      harmonySubtitleBackground: parsed.harmonySubtitleBackground !== false,
      keywordColoringEnabled: parsed.keywordColoringEnabled !== false,
      wordColors: sanitizeWordColors(parsed.wordColors),
      letterSpacingEm: clamp(parsed.letterSpacingEm, -0.08, 0.2, 0),
    };
  } catch {
    return { ...LYRICS_APPEARANCE_DEFAULTS };
  }
};

interface LyricsAppearanceStore extends LyricsAppearanceState {
  patch: (patch: Partial<LyricsAppearanceState>) => void;
  setWordColors: (wordColors: LyricsWordColor[]) => void;
  addWordColor: (entry: LyricsWordColor) => void;
  removeWordColor: (word: string) => void;
  applyPreset: (preset: 'poetry' | 'stage' | 'rhapsody' | 'minimal') => void;
  reset: () => void;
}

const persist = (state: LyricsAppearanceState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota
  }
};

const pickState = (state: LyricsAppearanceStore): LyricsAppearanceState => ({
  fontStyle: state.fontStyle,
  fontScale: state.fontScale,
  fontWeight: state.fontWeight,
  fontFallbackFamilies: state.fontFallbackFamilies,
  customFont: state.customFont,
  animationIntensity: state.animationIntensity,
  visualizerOpacity: state.visualizerOpacity,
  subtitleContentMode: state.subtitleContentMode,
  subtitleFontScale: state.subtitleFontScale,
  subtitleOverlayOpacity: state.subtitleOverlayOpacity,
  subtitleOverlayBackground: state.subtitleOverlayBackground,
  hideTranslationSubtitle: state.hideTranslationSubtitle,
  showHarmonySubtitle: state.showHarmonySubtitle,
  harmonySubtitleBackground: state.harmonySubtitleBackground,
  keywordColoringEnabled: state.keywordColoringEnabled,
  wordColors: state.wordColors,
  letterSpacingEm: state.letterSpacingEm,
});

export const useLyricsAppearanceStore = create<LyricsAppearanceStore>((set, get) => ({
  ...readAppearance(),
  patch: (patch) => {
    const next = {
      ...pickState(get()),
      ...patch,
      fontScale: patch.fontScale !== undefined ? clampFontScale(patch.fontScale) : get().fontScale,
      fontWeight: patch.fontWeight !== undefined ? normalizeFontWeight(patch.fontWeight) : get().fontWeight,
      fontFallbackFamilies: patch.fontFallbackFamilies !== undefined
        ? normalizeFontFamilyStack(patch.fontFallbackFamilies)
        : get().fontFallbackFamilies,
      visualizerOpacity: patch.visualizerOpacity !== undefined
        ? clamp(patch.visualizerOpacity, 0.35, 1, 1)
        : get().visualizerOpacity,
      subtitleFontScale: patch.subtitleFontScale !== undefined
        ? clampFontScale(patch.subtitleFontScale)
        : get().subtitleFontScale,
      subtitleOverlayOpacity: patch.subtitleOverlayOpacity !== undefined
        ? clamp(patch.subtitleOverlayOpacity, 0.2, 1, 0.6)
        : get().subtitleOverlayOpacity,
      wordColors: patch.wordColors !== undefined
        ? sanitizeWordColors(patch.wordColors)
        : get().wordColors,
      letterSpacingEm: patch.letterSpacingEm !== undefined
        ? clamp(patch.letterSpacingEm, -0.08, 0.2, 0)
        : get().letterSpacingEm,
    };
    set(next);
    persist(next);
  },
  setWordColors: (wordColors) => get().patch({ wordColors }),
  addWordColor: (entry) => {
    const word = entry.word.trim();
    if (!word) return;
    const rest = get().wordColors.filter((item) => item.word !== word);
    get().patch({ wordColors: [...rest, { word, color: entry.color }] });
  },
  removeWordColor: (word) => {
    get().patch({ wordColors: get().wordColors.filter((item) => item.word !== word) });
  },
  applyPreset: (preset) => {
    if (preset === 'poetry') {
      get().patch({
        fontStyle: 'serif',
        fontScale: 1.08,
        fontWeight: 500,
        animationIntensity: 'calm',
        visualizerOpacity: 0.96,
        letterSpacingEm: 0.04,
        subtitleOverlayOpacity: 0.55,
      });
      return;
    }
    if (preset === 'stage') {
      get().patch({
        fontStyle: 'sans',
        fontScale: 1.18,
        fontWeight: 650,
        animationIntensity: 'normal',
        visualizerOpacity: 1,
        letterSpacingEm: 0,
        subtitleOverlayOpacity: 0.7,
      });
      return;
    }
    if (preset === 'rhapsody') {
      get().patch({
        fontStyle: 'sans',
        fontScale: 1.28,
        fontWeight: 700,
        animationIntensity: 'chaotic',
        visualizerOpacity: 1,
        letterSpacingEm: -0.02,
        subtitleOverlayOpacity: 0.75,
      });
      return;
    }
    get().patch({
      fontStyle: 'mono',
      fontScale: 0.95,
      fontWeight: 400,
      animationIntensity: 'calm',
      visualizerOpacity: 0.88,
      letterSpacingEm: 0.02,
      subtitleOverlayOpacity: 0.45,
      subtitleOverlayBackground: false,
    });
  },
  reset: () => {
    const next = { ...LYRICS_APPEARANCE_DEFAULTS };
    set(next);
    persist(next);
  },
}));
