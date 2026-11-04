import React, { useEffect, useMemo, useRef, useState } from 'react';
import { readAnalyserFormat } from '../../../lib/audioGraph';
import { normalizeLyricWallTuning, type AudioBands, type Line, type LyricWallMode } from '../../../types';
import type { VisualizerSharedProps } from '../definition';
import VisualizerShell from '../VisualizerShell';

const STYLE_ID = 'jmgo-scene-style';
const LIMITS = [35, 80, 160, 320, 640, 1280, 2560, 5120, 12000];
const RHYTHMIC_SCENES = new Set<LyricWallMode>(['mobius', 'shapes', 'elantra']);

type AudioInput = {
  low: number;
  mid: number;
  bands: number[];
  spectrum: Uint8Array | null;
  sampleRate: number;
  fftSize: number;
};
type RhythmOutput = { low: number; mid: number; bands: number[]; beat: number; energy: number; onset: boolean };
type JmgoSnapshot = AudioInput & {
  time: number;
  paused: boolean;
  lines: { startTime: number; fullText: string; endTime: number }[];
  showText: boolean;
  fontScale: number;
  lyricEffect: string;
  lyricFont: string;
  rhythmEnabled: boolean;
  rhythmStrength: number;
  shapeVariant: number;
  beat: number;
  energy: number;
  onset: boolean;
  title: string;
  artist: string;
  album: string;
};
type CreateRenderer = (canvas: HTMLCanvasElement, options?: { linear?: boolean }) => Promise<unknown>;
type MountedScene = {
  scenes: Record<string, { load: () => Promise<CreateRenderer>; lyricPresentation?: Record<string, unknown> }>;
};
type MountModule = {
  mountJmgoScene: (
    host: HTMLElement,
    readSnapshot: () => JmgoSnapshot,
    options: {
      createRenderer: CreateRenderer;
      lyricPresentation?: Record<string, unknown>;
      onReady?: () => void;
      onError?: (error: Error) => void;
    },
  ) => () => void;
};
type RhythmModule = {
  createRhythmTracker: () => { update: (snapshot: AudioInput & { time: number; paused: boolean }) => RhythmOutput };
};

function averageRange(bytes: Uint8Array, sampleRate: number, fftSize: number, from: number, to: number) {
  const lo = Math.max(1, Math.ceil(from * fftSize / sampleRate));
  const hi = Math.min(bytes.length, Math.ceil(to * fftSize / sampleRate));
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i += 1) sum += (bytes[i] / 255) ** 2;
  return Math.sqrt(sum / (hi - lo));
}
function readAudio(audioBands: AudioBands): AudioInput {
  const spectrum = audioBands.spectrum?.get() ?? null;
  const format = readAnalyserFormat();
  const fftSize = format?.fftSize ?? (spectrum?.length ? spectrum.length * 2 : 256);
  const sampleRate = format?.sampleRate ?? 48000;
  if (spectrum?.length) {
    return {
      low: averageRange(spectrum, sampleRate, fftSize, 35, 250),
      mid: averageRange(spectrum, sampleRate, fftSize, 250, 2200),
      bands: LIMITS.slice(0, 8).map((from, band) => averageRange(spectrum, sampleRate, fftSize, from, LIMITS[band + 1])),
      spectrum, sampleRate, fftSize,
    };
  }
  const low = audioBands.bass.get(), lowMid = audioBands.lowMid.get(), mid = audioBands.mid.get();
  const vocal = audioBands.vocal.get(), treble = audioBands.treble.get();
  return { low, mid, bands: [low, lowMid, mid, mid, vocal, vocal, treble, treble], spectrum: null, sampleRate, fftSize };
}
function lyricLines(lines: Line[], title: string) {
  // Keep timed empty lines: they clear the caption rather than extending the previous lyric.
  if (lines.some(line => line.fullText.trim())) {
    return lines.map(({ startTime, fullText, endTime }) => ({ startTime, fullText, endTime }));
  }
  return title ? [{ startTime: 0, fullText: title, endTime: Number.POSITIVE_INFINITY }] : [];
}
function ensureSceneStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID; link.rel = 'stylesheet';
  link.href = `${import.meta.env.BASE_URL}jmgo/scene.css`;
  document.head.appendChild(link);
}

const VisualizerJmgo: React.FC<VisualizerSharedProps & { scene: LyricWallMode }> = ({
  currentTime, lines, theme, audioPower, audioBands, showText = true,
  songTitle, songArtist, songAlbum, coverUrl, paused = false, staticMode = false,
  background, visualizerOpacity, isDaylight, seed, backgroundStaticMode, isPanelOpen,
  onPlayerPanelGuideHotspotChange, lyricsFontScale = 1, lyricWallTuning, scene,
}) => {
  const frameRef = useRef<HTMLDivElement>(null), hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  const tuning = normalizeLyricWallTuning(lyricWallTuning);
  const preparedLines = useMemo(() => lyricLines(lines, songTitle || ''), [lines, songTitle]);
  const latestRef = useRef({ tuning, paused: paused || staticMode, lines: preparedLines, showText, lyricsFontScale, songTitle, songArtist, songAlbum });
  latestRef.current = { tuning, paused: paused || staticMode, lines: preparedLines, showText, lyricsFontScale, songTitle, songArtist, songAlbum };

  useEffect(() => {
    const host = hostRef.current, frame = frameRef.current;
    if (!host || !frame) return undefined;
    ensureSceneStyle();
    let stopped = false, cleanup: (() => void) | undefined;
    setStatus(''); delete host.dataset.jmgoReady;
    // Preserve the original 16:9 composition inside any player or preview dimensions.
    const fit = () => {
      const width = Math.max(1, Math.min(frame.clientWidth, frame.clientHeight * 16 / 9));
      host.style.width = `${width}px`; host.style.height = `${width * 9 / 16}px`;
    };
    fit();
    const observer = new ResizeObserver(fit); observer.observe(frame);
    const base = `${import.meta.env.BASE_URL}jmgo/`;
    (async () => {
      try {
        const [sceneMod, rendererMod, rhythmMod] = await Promise.all([
          import(/* @vite-ignore */ `${base}scenes.js`) as Promise<MountedScene>,
          import(/* @vite-ignore */ `${base}renderer.js`) as Promise<MountModule>,
          import(/* @vite-ignore */ `${base}rhythm.js`) as Promise<RhythmModule>,
        ]);
        if (stopped) return;
        const selected = sceneMod.scenes[scene] ?? sceneMod.scenes.flowing;
        const createRenderer = await selected.load();
        if (stopped) return;
        const rhythm = rhythmMod.createRhythmTracker();
        cleanup = rendererMod.mountJmgoScene(host, () => {
          const latest = latestRef.current, settings = latest.tuning;
          const time = currentTime.get(), audio = readAudio(audioBands);
          const input = { ...audio, low: audio.low * settings.inputGain, mid: audio.mid * settings.inputGain,
            bands: audio.bands.map(value => value * settings.inputGain) };
          const enhanced = rhythm.update({ ...input, time, paused: latest.paused });
          const driven = settings.rhythmEnabled && RHYTHMIC_SCENES.has(scene) ? enhanced : input;
          return {
            ...input, ...driven, time, paused: latest.paused,
            beat: enhanced.beat, energy: enhanced.energy, onset: enhanced.onset,
            rhythmEnabled: settings.rhythmEnabled, rhythmStrength: settings.rhythmStrength,
            lines: latest.lines, showText: latest.showText,
            fontScale: latest.lyricsFontScale * settings.fontScale,
            lyricEffect: settings.lyricEffect, lyricFont: settings.lyricFont, shapeVariant: settings.shapeVariant,
            title: latest.songTitle || '', artist: latest.songArtist || '', album: latest.songAlbum || '',
          };
        }, {
          createRenderer, lyricPresentation: selected.lyricPresentation,
          onReady: () => { if (!stopped) host.dataset.jmgoReady = scene; },
          onError: error => { if (!stopped) setStatus(error.message || '特效加载失败'); },
        });
      } catch (error) {
        if (!stopped) setStatus(error instanceof Error ? error.message : '特效加载失败');
      }
    })();
    return () => { stopped = true; observer.disconnect(); cleanup?.(); delete host.dataset.jmgoReady; };
  }, [audioBands, currentTime, scene]);

  return (
    <VisualizerShell theme={theme} audioPower={audioPower} audioBands={audioBands}
      visualizerOpacity={visualizerOpacity} renderBackground={false}
      sharedProps={{ coverUrl, isDaylight, seed, visualizerOpacity, background, staticMode,
        backgroundStaticMode, paused, isPanelOpen, onPlayerPanelGuideHotspotChange }}>
      <div ref={frameRef} className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
        <div ref={hostRef} className="relative shrink-0 overflow-hidden bg-black" />
      </div>
      {status ? <div role="alert" className="pointer-events-none absolute inset-x-0 top-[18%] z-20 text-center text-[13px] text-white/70">{status}</div> : null}
    </VisualizerShell>
  );
};
export default VisualizerJmgo;
