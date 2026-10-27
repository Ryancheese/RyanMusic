import { useEffect, useRef } from 'react';
import type { VisualizerMode } from '../types';
import { pickRandomVisualizerMode } from '../utils/randomVisualizerModes';

function songKey(track: { type?: string; songid?: string | number } | null | undefined): string | null {
  if (!track?.type || track.songid == null || track.songid === '') return null;
  return `${track.type}:${track.songid}`;
}

/** Applies a different registered lyric animation mode when the active track changes. */
export function useRandomVisualizerMode({
  currentSong,
  enabled,
  visualizerMode,
  modes,
  setVisualizerMode,
}: {
  currentSong: { type?: string; songid?: string | number } | null;
  enabled: boolean;
  visualizerMode: VisualizerMode;
  modes: readonly VisualizerMode[];
  setVisualizerMode: (mode: VisualizerMode, options?: { preserveRandom?: boolean }) => void;
}) {
  const observedSongIdRef = useRef<string | null>(null);
  const pendingChoiceRef = useRef<{
    songId: string | null;
    from: VisualizerMode;
    modes: readonly VisualizerMode[];
  } | null>(null);

  useEffect(() => {
    const id = songKey(currentSong);
    if (!enabled) {
      observedSongIdRef.current = id;
      pendingChoiceRef.current = null;
      return;
    }
    const songChanged = id !== null && observedSongIdRef.current !== null && observedSongIdRef.current !== id;
    if (id !== null) observedSongIdRef.current = id;

    // Keep one choice for the whole song. Enabling random or editing its pool only replaces a
    // style that is outside the selection; StrictMode and refreshed metadata do not reroll.
    if (!songChanged && modes.includes(visualizerMode)) {
      pendingChoiceRef.current = null;
      return;
    }
    const pending = pendingChoiceRef.current;
    if (pending?.songId === id && pending.from === visualizerMode && pending.modes === modes) return;
    pendingChoiceRef.current = { songId: id, from: visualizerMode, modes };

    const nextMode = pickRandomVisualizerMode(modes, visualizerMode);
    if (nextMode !== visualizerMode) {
      setVisualizerMode(nextMode, { preserveRandom: true });
    }
  }, [currentSong, enabled, modes, setVisualizerMode, visualizerMode]);
}
