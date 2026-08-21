import { create } from 'zustand';
import { DEFAULT_TEMPERA_TUNING, type TemperaTuning } from '../types';

const KEY = 'ryanmusic-tempera-tuning-v1';

const readTuning = (): TemperaTuning => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<TemperaTuning> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TEMPERA_TUNING;
    return {
      ...DEFAULT_TEMPERA_TUNING,
      ...parsed,
      layerImages: Array.isArray(parsed.layerImages) ? parsed.layerImages : [],
    };
  } catch {
    return DEFAULT_TEMPERA_TUNING;
  }
};

interface TemperaTuningState {
  tuning: TemperaTuning;
  setTuning: (tuning: TemperaTuning) => void;
  patchTuning: (patch: Partial<TemperaTuning>) => void;
  resetTuning: () => void;
}

export const useTemperaTuningStore = create<TemperaTuningState>((set, get) => ({
  tuning: readTuning(),
  setTuning: (tuning) => {
    set({ tuning });
    try {
      localStorage.setItem(KEY, JSON.stringify(tuning));
    } catch {
      // ignore quota
    }
  },
  patchTuning: (patch) => {
    get().setTuning({ ...get().tuning, ...patch });
  },
  resetTuning: () => {
    get().setTuning(DEFAULT_TEMPERA_TUNING);
  },
}));
