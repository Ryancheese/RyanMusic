import { useVisualizerTuningStore } from './visualizerTuningStore';
import type { TemperaTuning } from '../types';

type TemperaTuningSlice = {
  tuning: TemperaTuning;
  setTuning: (tuning: TemperaTuning) => void;
  patchTuning: (patch: Partial<TemperaTuning>) => void;
  resetTuning: () => void;
};

const toSlice = (): TemperaTuningSlice => {
  const state = useVisualizerTuningStore.getState();
  return {
    tuning: state.tempera,
    setTuning: (tuning) => {
      useVisualizerTuningStore.setState({ tempera: tuning });
      state.patchTempera(tuning);
    },
    patchTuning: state.patchTempera,
    resetTuning: () => state.resetMode('tempera'),
  };
};

/** Compatible selector store: useTemperaTuningStore((s) => s.tuning) */
export function useTemperaTuningStore(): TemperaTuningSlice;
export function useTemperaTuningStore<T>(selector: (state: TemperaTuningSlice) => T): T;
export function useTemperaTuningStore<T>(selector?: (state: TemperaTuningSlice) => T): T | TemperaTuningSlice {
  const tuning = useVisualizerTuningStore((state) => state.tempera);
  const patchTuning = useVisualizerTuningStore((state) => state.patchTempera);
  const resetMode = useVisualizerTuningStore((state) => state.resetMode);
  const slice: TemperaTuningSlice = {
    tuning,
    setTuning: (next) => patchTuning(next),
    patchTuning,
    resetTuning: () => resetMode('tempera'),
  };
  return selector ? selector(slice) : slice;
}

useTemperaTuningStore.getState = toSlice;
