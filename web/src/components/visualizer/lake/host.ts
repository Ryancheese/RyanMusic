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
  duration: number;
  coverUrl: string;
  accent: string;
  outline: LakeOutline;
  look: LakeLook;
  paused: boolean;
  power: number;
  bands: AudioBands;
}

type Stage = ReturnType<typeof createStage>;

function clampUnit(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export interface LakeDetail {
  pixelRatio?: number;
  skyScale?: number;
  mirror?: number;
  msaa?: number | boolean;
  reflectEvery?: number;
}

export function mountUniverseStage(host: HTMLElement, read: () => LakeSnap, readDetail?: () => LakeDetail) {
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
  let sizedKey = '';

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    const detail = readDetail?.() ?? {};
    const requested = Number(detail.pixelRatio);
    const cap = Number.isFinite(requested) && requested > 0
      ? Math.min(3, Math.max(1, requested))
      : Math.min(3, window.devicePixelRatio || 1);
    const ratio = Math.min(cap, window.devicePixelRatio || 1);
    const skyScale = clampUnit(detail.skyScale, 0.35, 1, 1);
    const mirror = detail.mirror == null
      ? (w < 700 ? 1 : 0.5)
      : clampUnit(detail.mirror, 0.25, 1, 1);
    const msaa = detail.msaa === 0 || detail.msaa === false ? 0 : 4;
    const every = Math.max(1, Math.round(Number(detail.reflectEvery) || 1));
    const key = `${w}x${h}|${ratio}|${skyScale}|${mirror}|${msaa}|${every}`;
    if (key === sizedKey) return;
    sizedKey = key;
    stage.setQuality({ msaa, mirror, every, sky: skyScale, aur: 32 });
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
    const key = `${nextSong}|${Math.round(snap.duration)}|${snap.outline}|${snap.look}|${snap.coverUrl}|${snap.accent}`;
    if (key !== builtKey && key !== buildingKey) {
      buildingKey = key;
      const fly = nextSong !== songId;
      songId = nextSong;
      void rebuild(snap, key, fly);
    }
    resize();
    if (!signal) return;
    try {
      signal.setLive(snap.time, snap.power, snap.bands, snap.paused);
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
  const listed = snap.duration > 1 ? snap.duration : 0;
  // 纯音乐没有歌词时间轴。用歌曲时长排场面；缺时长时给一段够长的纯音乐，不能停在 30 秒。
  const duration = Math.max(listed, lyrics.length ? last + 12 : 0, lyrics.length ? 30 : 480);
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
  // 场面造型仍用这条包络；极光纹理会在开播时清掉，再按真实频谱逐列写上。
  const onsets = { low: [] as number[][], mid: [] as number[][], high: [] as number[][] };
  return {
    fps, frames, stride, data, channels, onsets, sections: [],
    features: { percussive_share: 0.3, centroid_hz: 1800, dynamic_db: 12, onset_rate: 4, stereo_width: 0.6, flatness: 0.02 },
  };
}

interface CurtainTexture {
  image?: { data?: Uint8Array; width?: number };
  needsUpdate?: boolean;
}

interface LiveSignal {
  character: { punch: number; bright: number; range: number; busy: number; wide: number; noisy: number };
  sections: never[];
  at: (t: number) => any;
  level: (name: string, t: number, attack?: number, release?: number) => number;
  pulse: (band: string, t: number, decay: number, floor?: number) => number;
  recent: (band: string, t: number, n: number, floor?: number, window?: number) => number[][];
  setLive: (time: number, power: number, bands: AudioBands, paused?: boolean) => void;
  paintCurtain: (spec: CurtainTexture | null | undefined) => void;
}

function createLiveSignal(track: { duration: number; lyrics: { length: number } } | Record<string, any>): LiveSignal {
  const duration = track.duration;
  const character = { punch: 0.45, bright: 0.5, range: 0.5, busy: 0.4, wide: 0.6, noisy: 0.3 };
  const mel = new Float32Array(32);
  const heard = new Float32Array(32);
  const chroma = new Float32Array(12);
  const CAP = 128;
  const histT = new Float64Array(CAP);
  const histMel = new Float32Array(CAP * 32);
  const histLow = new Float32Array(CAP);
  const histMid = new Float32Array(CAP);
  const histHigh = new Float32Array(CAP);
  const histRms = new Float32Array(CAP);
  let histN = 0;
  let histW = 0;
  let now = 0;
  let live = { rms: 0, low: 0, mid: 0, high: 0 };
  const liveNow: Record<string, number> = { rms: 0, low: 0, lowmid: 0, mid: 0, high: 0, air: 0, harm: 0, perc: 0 };
  let envLow = 0;
  let envMid = 0;
  let envHigh = 0;
  let slow = 0;
  let lastLowAt = -1;
  let lastMidAt = -1;
  let lastHighAt = -1;
  let curtainData: Uint8Array | null = null;
  let curtainCol = -1;
  const onsets: Record<string, number[][]> = { low: [], mid: [], high: [] };

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

  const histAt = (offset: number) => ((histW - histN + offset) % CAP + CAP) % CAP;

  const chan = (name: string, i: number) => {
    if (name === 'low') return histLow[i];
    if (name === 'lowmid') return (histLow[i] + histMid[i]) * 0.5;
    if (name === 'mid' || name === 'harm') return histMid[i];
    if (name === 'high') return histHigh[i];
    if (name === 'air') return histHigh[i] * 0.75;
    if (name === 'rms' || name === 'perc') return histRms[i];
    if (name.startsWith('mel')) return histMel[i * 32 + (Number(name.slice(3)) || 0)];
    return 0;
  };

  const level = (name: string, t: number, attack = 0, release = 0) => {
    if (!histN || name.startsWith('chroma') || name === 'centroid' || name === 'flatness' || name === 'width' || name === 'balance') {
      return synth(name, t);
    }
    const a = t - Math.max(0, release);
    const b = t + Math.max(0, attack);
    const span = Math.max(0.04, (b - a) * 0.5);
    let wsum = 0;
    let vsum = 0;
    for (let k = 0; k < histN; k += 1) {
      const i = histAt(k);
      const ht = histT[i];
      if (ht < a || ht > b) continue;
      const w = Math.exp(-Math.abs(ht - t) / span);
      wsum += w;
      vsum += w * chan(name, i);
    }
    if (wsum > 0) return vsum / wsum;
    if (Math.abs(t - now) < 0.6) return chan(name, histAt(histN - 1));
    return synth(name, t);
  };

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
      if (arr[k][1] >= floor) sum += arr[k][1] * Math.exp(-age / Math.max(0.04, decay));
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

  const strike = (band: 'low' | 'mid' | 'high', time: number, value: number, env: number, lastAt: number, rise: number, floor: number) => {
    const arr = onsets[band];
    if (arr.length && time + 0.05 < arr[arr.length - 1][0]) {
      while (arr.length && arr[arr.length - 1][0] > time) arr.pop();
    }
    const flux = value - env;
    if (flux > rise && value > floor && time - lastAt > 0.1) {
      arr.push([time, Math.min(1, 0.62 + flux * 5)]);
      while (arr.length && time - arr[0][0] > 6) arr.shift();
      return time;
    }
    return lastAt;
  };

  const follow = (env: number, value: number, dt: number) => {
    const tau = value > env ? 0.04 : 0.28;
    return env + (value - env) * (1 - Math.exp(-Math.max(0.001, dt) / tau));
  };

  const remember = (time: number) => {
    if (histN > 0) {
      const last = ((histW - 1) % CAP + CAP) % CAP;
      if (time < histT[last] - 0.2) {
        histN = 0;
        histW = 0;
      } else if (time - histT[last] < 0.012) {
        histT[last] = time;
        histMel.set(heard, last * 32);
        histLow[last] = live.low;
        histMid[last] = live.mid;
        histHigh[last] = live.high;
        histRms[last] = live.rms;
        return;
      }
    }
    const i = histW % CAP;
    histT[i] = time;
    histMel.set(heard, i * 32);
    histLow[i] = live.low;
    histMid[i] = live.mid;
    histHigh[i] = live.high;
    histRms[i] = live.rms;
    histW += 1;
    if (histN < CAP) histN += 1;
  };

  const at = (t: number) => {
    const time = Math.max(0, Math.min(duration, t || 0));
    const frame: Record<string, any> = { t: time, duration, u: duration ? time / duration : 0, ch: character };
    const here = histN > 0 && Math.abs(time - now) < 0.08;
    for (const key of ['rms', 'low', 'lowmid', 'mid', 'high', 'air', 'harm', 'perc', 'centroid', 'flatness', 'width', 'balance']) {
      frame[key] = here && key in liveNow ? liveNow[key] : level(key, time);
    }
    if (here) mel.set(heard);
    else for (let i = 0; i < 32; i++) mel[i] = level(`mel${String(i).padStart(2, '0')}`, time);
    for (let i = 0; i < 12; i++) chroma[i] = level(`chroma${String(i).padStart(2, '0')}`, time);
    frame.mel = mel;
    frame.chroma = chroma;
    // slow is the song's breathing (signal.js: rms over about two seconds), not this instant.
    // drive there is a measured loud section. A kick must not raise it, or bloom tracks every drum.
    frame.slow = here ? slow : frame.rms;
    frame.kick = pulse('low', time, 0.11);
    frame.snap = pulse('high', time, 0.07);
    frame.tick = pulse('mid', time, 0.08);
    frame.rings = recent('low', time, 6, 0.3, 1.6);
    frame.section = { index: 0, label: 'a', kind: 0, age: time, left: Math.max(0, duration - time), count: 1 };
    frame.state = 'observe';
    frame.stateAge = time;
    frame.stateLeft = 0;
    frame.burst = frame.kick > 0.45 ? 1 : 0;
    frame.lite = 0;
    frame.survey = 0;
    frame.drive = Math.min(0.4, frame.slow);
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
    setLive(time, power, bands, paused = false) {
      const prevT = now;
      now = time;
      const bass = clamp(num(bands.bass.get()));
      const midBand = clamp(num(bands.mid.get()));
      const treble = clamp(num(bands.treble.get()));
      const vocal = clamp(num(bands.vocal.get()));
      const lowMid = clamp(num(bands.lowMid.get()));
      const rawMid = clamp((midBand + vocal + lowMid) / 3);
      const rawRms = clamp(power || (bass + midBand + treble) / 3);
      const dt = prevT > 0 ? Math.min(0.05, Math.max(0.001, time - prevT)) : 0.016;
      const jumped = prevT > 0 && time < prevT - 0.2;
      if (jumped) {
        envLow = bass;
        envMid = rawMid;
        envHigh = treble;
        slow = 0;
      } else if (!paused && histN > 0) {
        lastLowAt = strike('low', time, bass, envLow, lastLowAt, 0.035, 0.12);
        lastMidAt = strike('mid', time, rawMid, envMid, lastMidAt, 0.03, 0.1);
        lastHighAt = strike('high', time, treble, envHigh, lastHighAt, 0.025, 0.08);
      }
      if (!jumped) {
        envLow = follow(envLow, bass, dt);
        envMid = follow(envMid, rawMid, dt);
        envHigh = follow(envHigh, treble, dt);
      }
      live = {
        rms: hear(rawRms),
        low: hear(bass),
        mid: hear(rawMid),
        high: hear(treble),
      };
      liveNow.rms = live.rms;
      liveNow.perc = live.rms;
      liveNow.low = live.low;
      liveNow.lowmid = hear((bass + lowMid) / 2);
      liveNow.mid = live.mid;
      liveNow.harm = live.mid;
      liveNow.high = live.high;
      liveNow.air = live.high * 0.75;
      const loud = paused ? 0 : live.rms;
      const tau = loud > slow ? 1.2 : 2.4;
      slow += (loud - slow) * (1 - Math.exp(-dt / tau));
      const spec = bands.spectrum?.get();
      if (spec && spec.length > 4) {
        const n = spec.length;
        const min = 1;
        const max = Math.max(min + 1, n - 1);
        for (let i = 0; i < 32; i++) {
          const u0 = i / 32;
          const u1 = (i + 1) / 32;
          const a = Math.min(n - 1, Math.floor(min * (max / min) ** u0));
          const b = Math.min(n, Math.max(a + 1, Math.floor(min * (max / min) ** u1)));
          let sum = 0;
          for (let k = a; k < b; k += 1) sum += spec[k];
          heard[i] = hear(sum / (b - a) / 255);
        }
      } else {
        for (let i = 0; i < 32; i++) {
          const k = i / 31;
          const v = k < 0.18 ? bass : k < 0.38 ? lowMid : k < 0.62 ? midBand : k < 0.8 ? vocal : treble;
          heard[i] = hear(v);
        }
      }
      remember(time);
    },
    paintCurtain(spec) {
      const image = spec?.image;
      const data = image?.data;
      const pw = image?.width || 0;
      if (!spec || !data || pw < 2 || !(duration > 0)) return;
      if (data !== curtainData) {
        data.fill(8);
        curtainData = data;
        curtainCol = -1;
      }
      const col = Math.max(0, Math.min(pw - 1, Math.floor((now / duration) * pw)));
      const from = curtainCol < 0 || col < curtainCol || col - curtainCol > 6 ? col : curtainCol;
      for (let x = from; x <= col; x += 1) {
        for (let m = 0; m < 32; m += 1) data[m * pw + x] = Math.round(clamp(heard[m]) * 255);
      }
      curtainCol = col;
      spec.needsUpdate = true;
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

// motion.bin 是对数频谱的字节。谱线和水面格子按「响的频段大约到一半」来画，
// 不是按分析器的满幅。电子乐的鼓如果原样送进去，整片格子会同时竖起来。
function hear(value: number) {
  const x = clamp(value);
  if (x <= 0.001) return 0;
  return clamp(0.48 * x ** 0.6);
}
