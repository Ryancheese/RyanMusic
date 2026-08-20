import { create } from 'zustand';
import type { LyricSearchCandidate } from '../api';

export type ManualLyricSelection = LyricSearchCandidate;

interface LyricMatchState {
  manualByTrackKey: Record<string, ManualLyricSelection>;
  setManualSelection: (trackKey: string, selection: ManualLyricSelection | null) => void;
  hasManualSelection: (trackKey: string) => boolean;
  getManualSelection: (trackKey: string) => ManualLyricSelection | null;
}

export const useLyricMatchStore = create<LyricMatchState>((set, get) => ({
  manualByTrackKey: {},
  setManualSelection: (trackKey, selection) => set((state) => {
    const next = { ...state.manualByTrackKey };
    if (!selection) delete next[trackKey];
    else next[trackKey] = selection;
    return { manualByTrackKey: next };
  }),
  hasManualSelection: (trackKey) => Boolean(get().manualByTrackKey[trackKey]),
  getManualSelection: (trackKey) => get().manualByTrackKey[trackKey] || null,
}));
