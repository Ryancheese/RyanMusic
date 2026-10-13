import type { JizuraStyle, Line } from '../../../types';

declare module 'jizura-engine' {}

export interface JizuraSnap {
  time: number;
  lines: Line[];
  title: string;
  artist: string;
  style: JizuraStyle;
}

interface JizuraPlan {
  W: number;
  H: number;
  fps: number;
  fx: Record<string, unknown>;
}

interface JizuraApi {
  defaultProject: () => { timing: Record<string, unknown>; fx: Record<string, unknown> };
  plan: (project: Record<string, unknown>, audio: null) => JizuraPlan;
  Renderer: new () => {
    frame: (ctx: CanvasRenderingContext2D, plan: JizuraPlan, t: number, opt?: { scale?: number; noBloom?: boolean }) => void;
  };
  stepDur: (fx: Record<string, unknown>, fps: number) => number;
  ensureFonts: (text: string, keys: string[]) => Promise<void>;
  fontsOfPlan: (plan: JizuraPlan) => string[];
}

let loading: Promise<JizuraApi> | null = null;

function loadEngine(): Promise<JizuraApi> {
  if (!loading) {
    loading = import('jizura-engine').then(() => (window as unknown as { J: JizuraApi }).J);
  }
  return loading;
}

const ASPECTS: [string, number][] = [
  ['21:9', 21 / 9],
  ['16:9', 16 / 9],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['3:4', 3 / 4],
  ['9:16', 9 / 16],
];

function aspectOf(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  let best = ASPECTS[1][0];
  let bestDistance = Infinity;
  for (const [name, value] of ASPECTS) {
    const distance = Math.abs(Math.log(value / ratio));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

function seedOf(title: string, artist: string): number {
  let hash = 2166136261;
  const text = `${title}\0${artist}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stamp(time: number): string {
  const seconds = Math.max(0, time);
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(2).padStart(5, '0');
  return `${String(minutes).padStart(2, '0')}:${rest}`;
}

function isGap(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || /^[.．。…·\s]+$/.test(trimmed);
}

function lyricsOf(lines: Line[]): string {
  const rows: string[] = [];
  for (const line of lines) {
    const text = (line.fullText || '').replace(/\|/g, ' ').trim();
    const tag = `[${stamp(line.startTime)}]`;
    if (isGap(text)) {
      const duration = Math.max(0.4, (line.endTime || line.startTime) - line.startTime);
      rows.push(`${tag}[间奏 ${duration.toFixed(1)}]`);
      continue;
    }
    const note = (line.translation || '').replace(/\|/g, ' ').trim();
    rows.push(note && note !== text ? `${tag}${text}|${note}` : tag + text);
  }
  return rows.join('\n');
}

function lyricKey(lines: Line[]): number {
  let hash = lines.length >>> 0;
  for (const line of lines) {
    hash = Math.imul(hash ^ (line.startTime * 1000 | 0), 16777619);
    const text = line.fullText || '';
    hash = Math.imul(hash ^ text.length ^ (line.translation || '').length, 16777619);
    if (text.length) hash = Math.imul(hash ^ text.charCodeAt(0) ^ text.charCodeAt(text.length - 1), 16777619);
  }
  return hash >>> 0;
}

export function mountJizuraStage(host: HTMLElement, read: () => JizuraSnap): () => void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
  host.appendChild(canvas);

  let dead = false;
  let api: JizuraApi | null = null;
  let renderer: InstanceType<JizuraApi['Renderer']> | null = null;
  let plan: JizuraPlan | null = null;
  let token = 0;
  let drawn = Number.NaN;
  let key = '';
  let warned = false;
  let frameId = 0;

  const fit = (current: JizuraPlan) => {
    const cap = 1280;
    const scale = Math.min(cap / current.W, cap / current.H);
    const width = Math.max(2, Math.round(current.W * scale));
    const height = Math.max(2, Math.round(current.H * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      drawn = Number.NaN;
    }
    return canvas.width / current.W;
  };

  const rebuild = async (snap: JizuraSnap, aspect: string, nextKey: string) => {
    const mine = ++token;
    try {
      api = await loadEngine();
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('[jizura] engine failed to load', error);
      }
      return;
    }
    if (dead || mine !== token) return;
    if (!renderer) renderer = new api.Renderer();
    const base = api.defaultProject();
    const lyrics = lyricsOf(snap.lines);
    let next: JizuraPlan;
    try {
      next = api.plan({
        ...base,
        title: snap.title,
        artist: snap.artist,
        lyrics,
        style: snap.style,
        lang: 'auto',
        seed: seedOf(snap.title, snap.artist),
        aspect,
        extra: true,
        wa: true,
        horror: snap.style.startsWith('hr'),
        typo: true,
        kinetic: true,
        fps: 60,
        fx: { ...base.fx, koma: 0, onTwos: false },
        timing: { ...base.timing, snap: false, offset: 0, tail: 1.2, bpm: 0 },
      }, null);
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('[jizura] plan failed', error);
      }
      return;
    }
    if (dead || mine !== token || key !== nextKey) return;
    plan = next;
    drawn = Number.NaN;
    const text = snap.lines.map((line) => line.fullText || '').join('');
    api.ensureFonts(text, api.fontsOfPlan(next)).then(() => {
      if (!dead && mine === token) drawn = Number.NaN;
    }).catch(() => {});
  };

  const tick = () => {
    if (dead) return;
    frameId = requestAnimationFrame(tick);
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 8 || height < 8) return;
    const snap = read();
    const aspect = aspectOf(width, height);
    const nextKey = `${snap.style}|${aspect}|${lyricKey(snap.lines)}|${snap.title}|${snap.artist}`;
    if (nextKey !== key) {
      key = nextKey;
      void rebuild(snap, aspect, nextKey);
    }
    if (!api || !renderer || !plan || document.hidden) return;
    const scale = fit(plan);
    const step = Math.max(1 / 60, api.stepDur(plan.fx, plan.fps));
    const quantized = Math.floor(snap.time / step + 1e-6) * step;
    if (quantized === drawn) return;
    drawn = quantized;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      renderer.frame(ctx, plan, snap.time, { scale, noBloom: true });
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('[jizura] frame failed', error);
      }
    }
  };

  frameId = requestAnimationFrame(tick);
  return () => {
    dead = true;
    token += 1;
    cancelAnimationFrame(frameId);
    canvas.remove();
  };
}
