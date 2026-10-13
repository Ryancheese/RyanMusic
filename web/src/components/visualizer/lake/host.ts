import type { AudioBands, LakeLook, LakeOutline, Line } from '../../../types';
import { isInterludeLine } from '../../../utils/lyrics/parserCore';
import { CJK } from './upstream/data.js';
import { grammarOf, modeOf, MODES, styleOf } from './upstream/genre.js';
import { paletteFromImage } from './upstream/palette.js';
import { compileScore } from './upstream/score.js';
import { createStage } from './upstream/stage.js';

const THEME = { star: '#F4EFE6', night: '#07080c' };
const FAMILY: Record<LakeLook, string> = {
  rock: '摇滚',
  pop: '流行',
  electro: '电子',
  hiphop: '嘻哈说唱',
  anime: '二次元',
  soft: '轻音乐',
  indie: '另类/独立',
};

export interface LakeSnap {
  time: number;
  lines: Line[];
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  accent: string;
  outline: LakeOutline;
  look: LakeLook;
  paused: boolean;
  power: number;
  bands: AudioBands;
}

type Stage = ReturnType<typeof createStage>;

export function mountUniverseStage(host: HTMLElement, read: () => LakeSnap) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  host.appendChild(canvas);
  const opts = { sky: true, loops: false, modeName: 'lake' };
  const stage: Stage = createStage(canvas, opts);
  let dead = false;
  let frame = 0;
  let warned = false;
  let builtKey = '';
  let buildingKey = '';
  let songId = '';
  let signal: LiveSignal | null = null;
  let sized = { w: 0, h: 0 };

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    if (w === sized.w && h === sized.h) return;
    sized = { w, h };
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    stage.resize(w, h, ratio);
  };

  const pointer = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    stage.setPointer(x, y);
  };
  const clearPointer = () => stage.setPointer(-9, -9);
  host.addEventListener('pointermove', pointer);
  host.addEventListener('pointerleave', clearPointer);

  const rebuild = async (snap: LakeSnap, key: string, fly: boolean) => {
    const track = makeTrack(snap);
    opts.modeName = snap.outline;
    const sig = createLiveSignal(track);
    let cover: HTMLImageElement | null = null;
    try { cover = await loadCover(snap.coverUrl); } catch { cover = null; }
    if (dead || buildingKey !== key) return;
    if (cover) {
      track.cover = cover;
      track.thumb = cover;
      try {
        const pal = paletteFromImage(cover);
        if (pal?.emit) track.pal = { ...track.pal, ...pal, second: pal.ramp?.[2] || pal.ramp?.[0] || pal.emit };
      } catch { /* a cover without pixel access still draws on the disc */ }
    }
    try { await stage.prepare(track); } catch (error) { console.warn('lake prepare', error); }
    if (dead || buildingKey !== key) return;
    const modeName = modeOf(track, sig.character, opts.modeName);
    let score;
    try {
      score = compileScore(track, sig, {
        grammar: grammarOf(track),
        mode: MODES[modeName] || MODES.lake,
        style: track.style,
      });
    } catch (error) {
      console.warn('lake score', error);
      return;
    }
    try {
      stage.setTrack(track, sig, THEME, score, { fly });
      signal = sig;
      builtKey = key;
    } catch (error) { console.warn('lake track', error); }
  };

  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (dead) return;
    const snap = read();
    const nextSong = identityOf(snap);
    const key = `${nextSong}|${snap.outline}|${snap.look}|${snap.coverUrl}|${snap.accent}`;
    if (key !== builtKey && key !== buildingKey) {
      buildingKey = key;
      const fly = nextSong !== songId;
      songId = nextSong;
      void rebuild(snap, key, fly);
    }
    resize();
    if (!signal) return;
    signal.setLive(snap.time, snap.power, snap.bands);
    try {
      stage.render(signal.at(snap.time), { clock: performance.now() / 1000, live: snap.paused ? 0 : 1 });
    } catch (error) {
      if (!warned) { warned = true; console.warn('lake frame', error); }
    }
  };
  frame = requestAnimationFrame(loop);

  return () => {
    dead = true;
    cancelAnimationFrame(frame);
    host.removeEventListener('pointermove', pointer);
    host.removeEventListener('pointerleave', clearPointer);
    try { stage.renderer.dispose(); } catch { /* already gone */ }
    canvas.remove();
  };
}

function identityOf(snap: LakeSnap) {
  let hash = snap.lines.length;
  for (const line of snap.lines) {
    hash = Math.imul(hash ^ line.fullText.length ^ ((line.startTime * 100) | 0), 16777619);
  }
  return `${snap.title}|${snap.artist}|${hash >>> 0}`;
}

function makeTrack(snap: LakeSnap) {
  const lyrics = snap.lines.flatMap((line) => {
    const lyric = lyricOf(line);
    return lyric ? [lyric] : [];
  });
  const last = lyrics.length ? lyrics[lyrics.length - 1].end : 0;
  const duration = Math.max(30, last + 8, snap.time + 1);
  const seed = seedOf(`${snap.title}|${snap.artist}|${snap.album}`) || 7;
  const track: Record<string, any> = {
    key: `${snap.title}|${seed}`,
    title: snap.title || '',
    artist: snap.artist || '',
    album: snap.album || '',
    duration,
    lyrics,
    vinyl: { seed, pressing: 'clear' },
    states: [],
    neChorus: [],
    phases: [],
    env: [],
    mv: null,
    neStyles: [FAMILY[snap.look] || '流行'],
    forceStyle: snap.look,
    pal: palFrom(snap.accent),
    motion: motionOf(duration, seed),
  };
  track.style = styleOf(track);
  return track;
}

function lyricOf(line: Line) {
  const text = (line.fullText || '').trim();
  if (!text || isInterludeLine(line)) return null;
  const start = Number(line.startTime) || 0;
  const end = Math.max(start + 0.3, Number(line.endTime) || start + 2);
  const timed = (line.words || []).filter((word) => word.text && word.endTime > word.startTime + 0.02);
  const distinct = timed.length > 1 && timed.some((word) => Math.abs(word.startTime - start) > 0.05);
  const words = distinct
    ? timed.map((word) => ({ w: word.text, raw: word.text, s: word.startTime, e: Math.max(word.endTime, word.startTime + 0.02) }))
    : splitLine(text, start, end);
  return { start, end, text, tr: line.translation || null, approx: !distinct, words };
}

function splitLine(text: string, start: number, end: number) {
  const parts = CJK.test(text) && !/\s/.test(text) ? [...text] : text.split(/\s+/).filter(Boolean);
  const tot = parts.reduce((sum, part) => sum + part.length + 1.5, 0) || 1;
  const span = Math.max(0.3, end - start);
  let acc = 0;
  return parts.map((part) => {
    const s = start + span * acc / tot;
    acc += part.length + 1.5;
    return { w: part, raw: part, s, e: start + span * acc / tot };
  });
}

function palFrom(accent: string) {
  const emit = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#A8D2E6';
  return {
    emit,
    deep: '#1a2430',
    light: '#e7eef4',
    second: emit,
    night: '#0a1016',
    ramp: ['#243646', emit, '#e7eef4'],
    clusters: [{ C: 0.08, weight: 1, hex: emit, L: 0.55, h: 200 }],
    greyscale: false,
  };
}

function motionOf(duration: number, seed: number) {
  const fps = 20;
  const frames = Math.max(2, Math.ceil(duration * fps));
  const stride = 32;
  const data = new Uint8Array(frames * stride);
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    for (let m = 0; m < 32; m++) {
      data[f * stride + m] = Math.round(28 + 150 * Math.abs(Math.sin(t * 0.63 + m * 0.37 + seed * 0.001)));
    }
  }
  const channels: Record<string, number> = {};
  for (let i = 0; i < 32; i++) channels[`mel${String(i).padStart(2, '0')}`] = i;
  const onsets = { low: [] as number[][], mid: [] as number[][], high: [] as number[][] };
  for (let t = 0.45; t < duration; t += 0.5) {
    const k = 0.42 + 0.5 * Math.abs(Math.sin(t * 2.3 + seed));
    onsets.low.push([t, k]);
    onsets.mid.push([t + 0.08, k * 0.7]);
    onsets.high.push([t + 0.04, k * 0.45]);
  }
  return {
    fps, frames, stride, data, channels, onsets, sections: [],
    features: { percussive_share: 0.3, centroid_hz: 1800, dynamic_db: 12, onset_rate: 4, stereo_width: 0.6, flatness: 0.02 },
  };
}

interface LiveSignal {
  character: { punch: number; bright: number; range: number; busy: number; wide: number; noisy: number };
  sections: never[];
  at: (t: number) => any;
  level: (name: string, t: number) => number;
  pulse: (band: string, t: number, decay: number, floor?: number) => number;
  recent: (band: string, t: number, n: number, floor?: number, window?: number) => number[][];
  setLive: (time: number, power: number, bands: AudioBands) => void;
}

function createLiveSignal(track: { duration: number; lyrics: { length: number } } | Record<string, any>): LiveSignal {
  const duration = track.duration;
  const character = { punch: 0.45, bright: 0.5, range: 0.5, busy: 0.4, wide: 0.6, noisy: 0.3 };
  const mel = new Float32Array(32);
  const chroma = new Float32Array(12);
  let now = 0;
  let live = { rms: 0.35, low: 0.35, mid: 0.35, high: 0.28 };

  const synth = (name: string, t: number) => {
    const base = 0.22 + 0.5 * Math.abs(Math.sin(t * 0.17 + name.length * 0.2));
    if (name.startsWith('mel')) {
      const i = Number(name.slice(3)) || 0;
      return base * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + i * 0.4)));
    }
    if (name.startsWith('chroma')) return 0.15 + 0.25 * Math.abs(Math.sin(t + name.length));
    if (name === 'high' || name === 'air') return base * 0.65;
    return base;
  };

  const level = (name: string, t: number) => {
    if (Math.abs(t - now) < 0.22) {
      if (name === 'low' || name === 'lowmid') return live.low;
      if (name === 'mid' || name === 'harm') return live.mid;
      if (name === 'high' || name === 'air') return live.high;
      if (name.startsWith('mel')) return mel[Number(name.slice(3)) || 0] || live.mid;
      if (name === 'rms' || name === 'perc') return live.rms;
    }
    return synth(name, t);
  };

  const onsets: Record<string, number[][]> = (track as { motion?: { onsets?: Record<string, number[][]> } }).motion?.onsets || {};
  const lastIdx = (arr: number[][], t: number) => {
    let lo = 0;
    let hi = arr.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] <= t) { found = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return found;
  };
  const pulse = (band: string, t: number, decay: number, floor = 0) => {
    const arr = onsets[band] || [];
    let sum = 0;
    for (let k = lastIdx(arr, t); k >= 0; k--) {
      const age = t - arr[k][0];
      if (age > decay * 7) break;
      if (arr[k][1] >= floor) sum += arr[k][1] * Math.exp(-age / decay);
    }
    return Math.min(1, sum);
  };
  const recent = (band: string, t: number, n: number, floor = 0, window = 2) => {
    const arr = onsets[band] || [];
    const out: number[][] = [];
    for (let k = lastIdx(arr, t); k >= 0 && out.length < n; k--) {
      const age = t - arr[k][0];
      if (age > window) break;
      if (arr[k][1] >= floor) out.push([age, arr[k][1]]);
    }
    return out;
  };

  const at = (t: number) => {
    const time = Math.max(0, Math.min(duration, t || 0));
    const frame: Record<string, any> = { t: time, duration, u: duration ? time / duration : 0, ch: character };
    for (const key of ['rms', 'low', 'lowmid', 'mid', 'high', 'air', 'harm', 'perc', 'centroid', 'flatness', 'width', 'balance']) {
      frame[key] = level(key, time);
    }
    for (let i = 0; i < 32; i++) mel[i] = level(`mel${String(i).padStart(2, '0')}`, time);
    for (let i = 0; i < 12; i++) chroma[i] = level(`chroma${String(i).padStart(2, '0')}`, time);
    frame.mel = mel;
    frame.chroma = chroma;
    frame.slow = level('rms', time);
    frame.kick = 0;
    frame.snap = 0;
    frame.tick = 0;
    frame.rings = recent('low', time, 6, 0.3, 1.6);
    frame.section = { index: 0, label: 'a', kind: 0, age: time, left: Math.max(0, duration - time), count: 1 };
    frame.state = 'observe';
    frame.stateAge = time;
    frame.stateLeft = 0;
    frame.burst = live.rms > 0.62 ? 1 : 0;
    frame.lite = 0;
    frame.survey = 0;
    frame.drive = Math.min(1, frame.burst + live.rms * 0.35);
    frame.build = 0;
    frame.hold = 0;
    frame.lyric = { line: null, next: null, gap: 1e9, total: track.lyrics.length };
    return frame;
  };

  return {
    character,
    sections: [],
    at,
    level,
    pulse,
    recent,
    setLive(time, power, bands) {
      now = time;
      const bass = num(bands.bass.get());
      const mid = num(bands.mid.get());
      const treble = num(bands.treble.get());
      const vocal = num(bands.vocal.get());
      const lowMid = num(bands.lowMid.get());
      live = {
        rms: clamp(power || (bass + mid + treble) / 3),
        low: clamp(bass),
        mid: clamp((mid + vocal + lowMid) / 3),
        high: clamp(treble),
      };
      const spec = bands.spectrum?.get();
      if (spec && spec.length) {
        for (let i = 0; i < 32; i++) {
          const a = Math.floor((i * spec.length) / 32);
          const b = Math.max(a + 1, Math.floor(((i + 1) * spec.length) / 32));
          let sum = 0;
          for (let k = a; k < b && k < spec.length; k++) sum += spec[k];
          mel[i] = sum / (b - a) / 255;
        }
      } else {
        for (let i = 0; i < 32; i++) {
          const k = i / 31;
          const v = k < 0.18 ? bass : k < 0.38 ? lowMid : k < 0.62 ? mid : k < 0.8 ? vocal : treble;
          mel[i] = clamp(v);
        }
      }
    },
  };
}

function loadCover(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 900);
    const finish = (img: HTMLImageElement | null) => { window.clearTimeout(timer); resolve(img); };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

function seedOf(value: string) {
  let hash = 2166136261;
  for (const ch of value) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function num(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
