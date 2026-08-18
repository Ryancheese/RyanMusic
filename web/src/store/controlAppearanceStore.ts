import { create } from 'zustand';

const KEY = 'ryanmusic-control-appearance-v1';

export const CONTROL_APPEARANCE_DEFAULTS = {
  opacity: 58,
  blur: 18,
  hoverBoost: 10,
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.round(next)));
}

function readAppearance() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<typeof CONTROL_APPEARANCE_DEFAULTS>;
    return {
      opacity: clamp(parsed.opacity, 20, 90, CONTROL_APPEARANCE_DEFAULTS.opacity),
      blur: clamp(parsed.blur, 0, 40, CONTROL_APPEARANCE_DEFAULTS.blur),
      hoverBoost: clamp(parsed.hoverBoost, 0, 18, CONTROL_APPEARANCE_DEFAULTS.hoverBoost),
    };
  } catch {
    return { ...CONTROL_APPEARANCE_DEFAULTS };
  }
}

interface ControlAppearanceState {
  opacity: number;
  blur: number;
  hoverBoost: number;
  setOpacity: (opacity: number) => void;
  setBlur: (blur: number) => void;
  setHoverBoost: (hoverBoost: number) => void;
}

const initial = readAppearance();

export const useControlAppearanceStore = create<ControlAppearanceState>((set) => ({
  opacity: initial.opacity,
  blur: initial.blur,
  hoverBoost: initial.hoverBoost,
  setOpacity: (opacity) => set({ opacity: clamp(opacity, 20, 90, CONTROL_APPEARANCE_DEFAULTS.opacity) }),
  setBlur: (blur) => set({ blur: clamp(blur, 0, 40, CONTROL_APPEARANCE_DEFAULTS.blur) }),
  setHoverBoost: (hoverBoost) => set({ hoverBoost: clamp(hoverBoost, 0, 18, CONTROL_APPEARANCE_DEFAULTS.hoverBoost) }),
}));

useControlAppearanceStore.subscribe((state) => {
  localStorage.setItem(KEY, JSON.stringify({
    opacity: state.opacity,
    blur: state.blur,
    hoverBoost: state.hoverBoost,
  }));
});
