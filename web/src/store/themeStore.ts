import { create } from 'zustand';
import { DAYLIGHT_THEME, MIDNIGHT_THEME } from '../types';

export interface AccentPreset {
  id: string;
  label: string;
  /** null = 跟随日夜主题默认 accent */
  color: string | null;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'default', label: '默认', color: null },
  { id: 'orange', label: '琥珀', color: '#ea580c' },
  { id: 'rose', label: '玫红', color: '#e11d48' },
  { id: 'violet', label: '紫罗兰', color: '#7c3aed' },
  { id: 'sky', label: '晴空', color: '#0284c7' },
  { id: 'teal', label: '青绿', color: '#0d9488' },
  { id: 'lime', label: '青柠', color: '#65a30d' },
  { id: 'amber', label: '暖黄', color: '#d97706' },
];

const KEY = 'ryanmusic-accent-v1';

interface PersistedAccent {
  presetId: string;
  customColor: string;
  uiTint: number;
  /** 背景主题色晕染填充度 0–100 */
  bgWash: number;
}

function clampTint(value: unknown, fallback = 45): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(100, Math.max(0, Math.round(next)));
}

function readAccent(): PersistedAccent {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<PersistedAccent>;
    const presetId = ACCENT_PRESETS.some((item) => item.id === parsed.presetId)
      ? String(parsed.presetId)
      : 'default';
    const customColor = /^#[0-9a-fA-F]{6}$/.test(String(parsed.customColor || ''))
      ? String(parsed.customColor)
      : '#7c3aed';
    return {
      presetId,
      customColor,
      uiTint: clampTint(parsed.uiTint, 45),
      bgWash: clampTint(parsed.bgWash, 50),
    };
  } catch {
    return { presetId: 'default', customColor: '#7c3aed', uiTint: 45, bgWash: 50 };
  }
}

interface ThemeAccentState {
  presetId: string;
  customColor: string;
  uiTint: number;
  bgWash: number;
  setPreset: (id: string) => void;
  setCustomColor: (color: string) => void;
  setUiTint: (value: number) => void;
  setBgWash: (value: number) => void;
  resolveAccent: (isDaylight: boolean) => string;
}

const initial = readAccent();

export const useThemeAccentStore = create<ThemeAccentState>((set, get) => ({
  presetId: initial.presetId,
  customColor: initial.customColor,
  uiTint: initial.uiTint,
  bgWash: initial.bgWash,
  setPreset: (presetId) => set({ presetId }),
  setCustomColor: (customColor) => set({ presetId: 'custom', customColor }),
  setUiTint: (uiTint) => set({ uiTint: clampTint(uiTint, 45) }),
  setBgWash: (bgWash) => set({ bgWash: clampTint(bgWash, 50) }),
  resolveAccent: (isDaylight) => {
    const { presetId, customColor } = get();
    if (presetId === 'custom') return customColor;
    const preset = ACCENT_PRESETS.find((item) => item.id === presetId);
    if (!preset || !preset.color) {
      return isDaylight ? DAYLIGHT_THEME.accentColor : MIDNIGHT_THEME.accentColor;
    }
    return preset.color;
  },
}));

useThemeAccentStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    presetId: state.presetId,
    customColor: state.customColor,
    uiTint: state.uiTint,
    bgWash: state.bgWash,
  }));
});
