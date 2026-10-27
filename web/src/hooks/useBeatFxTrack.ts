import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useVisualizerSettingsStore } from '../store/visualizerSettingsStore';
import { BEAT_EFFECT_IDS, resolveBeatEffectSetting, smartBeatMayAnalyse } from '../services/beatFx/beatEffects';
import {
  beginBeatFxTrack,
  getBeatFxHeard,
  setBeatFxEvents,
  setBeatFxIntensities,
  setBeatFxLiveEffects,
  stopBeatFx,
} from '../services/beatFx/beatFxLive';
import { beatFxAnalysisKey as loadBeatFxTrackKey, loadBeatFxTrackBeats, loadBeatFxTrackDrums } from '../services/beatFx/beatFxSource';
import { modelsPresent, subscribeModelAvailability } from '../services/analysis/modelAvailability';
import { drumHitsSettled, setWantedDrumTrack } from '../services/analysis/drumHits';
import { setStemDrumsWanted } from '../services/analysis/stemRange';
import {
  liveBeatEffects,
  liveBeatEffectStrength,
  visualizerWantsBeatClock,
  visualizerWantsBeats,
  visualizerWantsDrumHits,
} from '../components/visualizer/beatClockTargets';

const RETRY_ATTEMPTS = 4;
const RETRY_DELAY_MS = 3000;
/** Let the audio element claim the first Range bytes before a full-file analysis download starts. */
const BEAT_ANALYSIS_DELAY_MS = 1800;
const DRUM_ANALYSIS_DELAY_MS = 3500;

/** Whether the beat clock should be stepped this frame. */
export function useBeatFxTrack(mediaUrl: string | null): boolean {
  const track = usePlayerStore((state) => state.queue[state.index] ?? null);
  const playbackStatus = usePlayerStore((state) => state.status);
  // Wait until the stream has started (or been paused after start) so analysis does not race the first buffer.
  const playbackSettled = playbackStatus === 'playing' || playbackStatus === 'paused';
  const smartBeat = useVisualizerSettingsStore((state) => state.smartBeat);
  const visualizerMode = useVisualizerSettingsStore((state) => state.visualizerMode);
  const visualizerBackgroundMode = useVisualizerSettingsStore((state) => state.visualizerBackgroundMode);

  const clockSettings = { smartBeat, visualizerMode, visualizerBackgroundMode };
  const beatsWanted = visualizerWantsBeats(clockSettings);
  const drumsWanted = visualizerWantsDrumHits(clockSettings);
  const wanted = visualizerWantsBeatClock(clockSettings);
  // Read by the drum hits' retries, which must not restart (and so cancel a separation) when it changes.
  const beatsWantedRef = useRef(beatsWanted);
  beatsWantedRef.current = beatsWanted;
  const storedOnly = !smartBeatMayAnalyse(smartBeat);
  const beatStrength = liveBeatEffectStrength(clockSettings, 'beats');
  const liveEffectsKey = useVisualizerSettingsStore((state) => liveBeatEffects({
    smartBeat: state.smartBeat,
    visualizerMode: state.visualizerMode,
    visualizerBackgroundMode: state.visualizerBackgroundMode,
  })
    .map((effect) => `${effect.id}=${resolveBeatEffectSetting(state.smartBeat, effect.id).strength}`)
    .join(','));

  // Asked again when htdemucs_gpu's answer arrives (the startup HEAD check).
  const drumModel = useSyncExternalStore(subscribeModelAvailability, modelsPresent).htdemucs_gpu;
  // Whether a track's drum hits may still be separated, on any picture: only then are the drums that
  // automix's segments leave behind kept (stemRange.ts), and only for a track whose hits are not in yet.
  const drumsMayRun = useVisualizerSettingsStore((state) => smartBeatMayAnalyse(state.smartBeat)
    && resolveBeatEffectSetting(state.smartBeat, BEAT_EFFECT_IDS.pendoloDrumhead).on) && drumModel;
  useEffect(() => {
    setStemDrumsWanted(drumsMayRun ? (key) => !drumHitsSettled(key) : () => false);
  }, [drumsMayRun]);

  useEffect(() => {
    setBeatFxIntensities(beatStrength, beatStrength);
  }, [beatStrength]);

  useEffect(() => {
    const strengths: Record<string, number> = {};
    if (wanted && liveEffectsKey) {
      for (const pair of liveEffectsKey.split(',')) {
        if (!pair) continue;
        const at = pair.lastIndexOf('=');
        strengths[pair.slice(0, at)] = Number(pair.slice(at + 1));
      }
    }
    setBeatFxLiveEffects(strengths);
  }, [liveEffectsKey, wanted]);

  const identity = wanted && track && mediaUrl ? `${track.type}:${track.songid}:${mediaUrl}` : null;

  useEffect(() => {
    if (!wanted) {
      stopBeatFx();
      return;
    }
    if (!track || !mediaUrl) {
      beginBeatFxTrack(null);
      return;
    }
    if (!beatsWanted) {
      // Drum hits alone: the clock carries the track and its heard time, with no beats installed.
      beginBeatFxTrack(loadBeatFxTrackKey(track, mediaUrl));
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let deferTimer: ReturnType<typeof setTimeout> | null = null;
    let begunKey: string | null = null;
    const load = (attempt: number) => {
      const { key, beats } = loadBeatFxTrackBeats(track, mediaUrl, { storedOnly });
      if (key !== begunKey) {
        beginBeatFxTrack(key);
        begunKey = key;
      }
      void beats.then((result) => {
        if (cancelled) return;
        setBeatFxEvents(key, result.events, result.source, result.note, result.trackScale);
        if (result.source === 'none' && result.retry && attempt < RETRY_ATTEMPTS) {
          retryTimer = setTimeout(() => load(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        if (result.source === 'none') console.info(`[BeatFx] no beats for this track: ${result.note}`);
        void result.accented?.then((accented) => {
          if (cancelled || !accented) return;
          setBeatFxEvents(key, accented.events, accented.source, accented.note, accented.trackScale);
        });
      }).catch((error) => {
        if (cancelled) return;
        setBeatFxEvents(key, [], 'none', String(error));
        console.warn('[BeatFx] beat lookup failed', error);
      });
    };
    // Cached lists can load immediately; network analysis waits until playback has claimed bandwidth.
    if (storedOnly || playbackSettled) {
      const delay = storedOnly ? 0 : BEAT_ANALYSIS_DELAY_MS;
      if (delay > 0) deferTimer = setTimeout(() => { if (!cancelled) load(0); }, delay);
      else load(0);
    } else {
      beginBeatFxTrack(loadBeatFxTrackKey(track, mediaUrl));
    }
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (deferTimer) clearTimeout(deferTimer);
    };
  }, [identity, wanted, beatsWanted, storedOnly, track, mediaUrl, playbackSettled]);

  useEffect(() => {
    if (!drumsWanted || !identity || !track || !mediaUrl) return undefined;
    let left = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let deferTimer: ReturnType<typeof setTimeout> | null = null;
    // The hits are read off getDrumHits by the frame loop once in; a track with none plays nothing.
    const load = (attempt: number) => {
      const { key, drums } = loadBeatFxTrackDrums(track, mediaUrl, { storedOnly });
      if (!beatsWantedRef.current && key !== getBeatFxHeard().key) beginBeatFxTrack(key);
      void drums
        .then((result) => {
          if (!left && result === 'retry' && attempt < RETRY_ATTEMPTS) retryTimer = setTimeout(() => load(attempt + 1), RETRY_DELAY_MS);
        })
        .catch((error) => console.warn('[BeatFx] drum hits failed', error));
    };
    if (storedOnly || playbackSettled) {
      const delay = storedOnly ? 0 : DRUM_ANALYSIS_DELAY_MS;
      if (delay > 0) deferTimer = setTimeout(() => { if (!left) load(0); }, delay);
      else load(0);
    }
    return () => {
      left = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (deferTimer) clearTimeout(deferTimer);
      // The separation stops at its next segment and keeps where it was (drumHits.ts, DrumResume).
      setWantedDrumTrack(null);
    };
    // Keyed like the lookup above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, drumsWanted, drumModel, storedOnly, playbackSettled]);

  return wanted;
}

/** Ref-friendly hook for the App RAF loop without re-subscribing each render. */
export function useBeatFxWantedRef(mediaUrl: string | null) {
  const wanted = useBeatFxTrack(mediaUrl);
  const ref = useRef(wanted);
  ref.current = wanted;
  return ref;
}
