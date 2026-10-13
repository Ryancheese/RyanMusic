type AudioGraph = {
  context: AudioContext;
  analyser: AnalyserNode;
  fade: GainNode;
  low: BiquadFilterNode;
  echo: GainNode;
};

export type BlendSchedule = {
  overlap: number;
  /** 0 是纯淡化；越大，两首歌在中间停得越久。 */
  together: number;
  swapBass: boolean;
  echo: boolean;
};

const decks = new WeakMap<HTMLMediaElement, { fade: GainNode; low: BiquadFilterNode; echo: GainNode }>();
const contexts = new Set<AudioContext>();
let unlockWired = false;
let shared: {
  context: AudioContext;
  analyser: AnalyserNode;
  mix: GainNode;
  delay: DelayNode;
} | null = null;

const BLEND_HEADROOM_DB = 1.5;
const CURVE_POINTS = 64;

function AudioContextCtor(): typeof AudioContext | undefined {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function wireUnlock() {
  if (unlockWired || typeof document === 'undefined') return;
  unlockWired = true;
  const resume = () => {
    unlockAudio();
  };
  document.addEventListener('pointerdown', resume, true);
  document.addEventListener('keydown', resume, true);
  document.addEventListener('touchstart', resume, true);
}

function dbToGain(db: number) {
  return 10 ** (db / 20);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Folia 的等功率曲线。together 是两首歌在交接中段保持同电平的比例：
 * 0 听起来是淡化，0.5 左右听起来是叠在一起。
 */
function buildCrossfadeCurves(together = 0) {
  const held = clamp01(Math.min(0.8, together));
  const lead = 0.5 * (1 - held);
  const trail = 0.5 + 0.5 * held;
  const out = new Float32Array(CURVE_POINTS);
  const incoming = new Float32Array(CURVE_POINTS);
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const progress = index / (CURVE_POINTS - 1);
    const warped = progress <= lead
      ? (progress / Math.max(1e-3, lead)) * 0.5
      : progress >= trail
        ? 0.5 + ((progress - trail) / Math.max(1e-3, 1 - trail)) * 0.5
        : 0.5;
    const angle = warped * (Math.PI / 2);
    const headroom = dbToGain(-BLEND_HEADROOM_DB * Math.sin(progress * Math.PI));
    out[index] = Math.cos(angle) * headroom;
    incoming[index] = Math.sin(angle) * headroom;
  }
  return { out, incoming };
}

function bassCurves() {
  const out = new Float32Array(CURVE_POINTS);
  const incoming = new Float32Array(CURVE_POINTS);
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const progress = index / (CURVE_POINTS - 1);
    const handover = clamp01((progress - 0.44) / 0.12);
    out[index] = -18 * handover;
    incoming[index] = -18 * (1 - handover);
  }
  return { out, incoming };
}

function releaseParam(param: AudioParam, now: number) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
}

function ensureShared(fftSize: number) {
  if (shared) return shared;
  const Ctor = AudioContextCtor();
  if (!Ctor) return null;
  const context = new Ctor();
  const mix = context.createGain();
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.86;
  mix.connect(analyser);
  analyser.connect(context.destination);
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.18;
  delay.connect(mix);
  shared = { context, analyser, mix, delay };
  contexts.add(context);
  wireUnlock();
  return shared;
}

/** WKWebView / Safari 里 AudioContext 默认挂起；必须在用户手势里 resume，否则会只播进度没声音。 */
export function readMixRms() {
  if (!shared) return 0;
  const bins = new Float32Array(shared.analyser.fftSize);
  shared.analyser.getFloatTimeDomainData(bins);
  let sum = 0;
  for (let index = 0; index < bins.length; index += 1) sum += bins[index] * bins[index];
  return Math.sqrt(sum / bins.length);
}

function needsResume(context: AudioContext) {
  return context.state !== 'running' && context.state !== 'closed';
}

const LONG_PAUSE_MS = 8_000;
let pausedStamp = 0;
let suspendTimer = 0;

function kickOutput(context: AudioContext) {
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  } catch {
    // 唤醒失败不影响后面的 play()。
  }
}

/** 暂停一会儿后挂起上下文。WKWebView 里上下文空转太久，再 play() 会只走进度、没有声音。 */
export function parkAudioGraph() {
  pausedStamp = performance.now();
  window.clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(() => {
    const context = shared?.context;
    if (!context || context.state !== 'running') return;
    void context.suspend().then(() => undefined, () => undefined);
  }, 1200);
}

export function unlockAudio(): Promise<void> {
  window.clearTimeout(suspendTimer);
  const pending: Promise<void>[] = [];
  for (const context of contexts) {
    if (!needsResume(context)) continue;
    kickOutput(context);
    pending.push(context.resume().then(() => undefined, () => undefined));
  }
  return pending.length ? Promise.all(pending).then(() => undefined) : Promise.resolve();
}

/**
 * 在点击处理里同步调用，保住用户手势。
 * 长暂停时调用方再拨一下 currentTime，叫醒已经静音的 MediaElementSource。
 */
export function beginAudioWake(): { longPause: boolean } {
  window.clearTimeout(suspendTimer);
  const longPause = pausedStamp > 0 && performance.now() - pausedStamp > LONG_PAUSE_MS;
  pausedStamp = 0;
  const context = shared?.context;
  if (!context || context.state === 'closed') return { longPause };
  kickOutput(context);
  if (needsResume(context)) void context.resume().then(() => undefined, () => undefined);
  return { longPause };
}

/** 重新接到总线上，让已经静音的 MediaElementSource 重新出声。 */
export function rearmDeckOutput(fade: GainNode) {
  if (!shared) return;
  try { fade.disconnect(); } catch { /* 可能尚未连接 */ }
  fade.connect(shared.mix);
  snapDeckGain(fade, 1);
}

export function attachAudioGraph(audio: HTMLMediaElement, fftSize = 256): AudioGraph | null {
  const bus = ensureShared(fftSize);
  if (!bus) return null;
  const existing = decks.get(audio);
  if (existing) {
    if (needsResume(bus.context)) void bus.context.resume();
    return { context: bus.context, analyser: bus.analyser, fade: existing.fade, low: existing.low, echo: existing.echo };
  }
  try {
    const source = bus.context.createMediaElementSource(audio);
    const low = bus.context.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 180;
    low.gain.value = 0;
    const fade = bus.context.createGain();
    fade.gain.value = 1;
    const echo = bus.context.createGain();
    echo.gain.value = 0;
    source.connect(low);
    low.connect(fade);
    fade.connect(bus.mix);
    low.connect(echo);
    echo.connect(bus.delay);
    decks.set(audio, { fade, low, echo });
    if (needsResume(bus.context)) void bus.context.resume();
    return { context: bus.context, analyser: bus.analyser, fade, low, echo };
  } catch {
    return null;
  }
}

export function snapDeckGain(fade: GainNode, value: number) {
  const now = fade.context.currentTime;
  releaseParam(fade.gain, now);
  fade.gain.setValueAtTime(value, now);
}

export function resetDeckTone(graph: AudioGraph | null | undefined) {
  if (!graph?.low || !graph.echo) return;
  const now = graph.context.currentTime;
  releaseParam(graph.low.gain, now);
  graph.low.gain.setValueAtTime(0, now);
  releaseParam(graph.echo.gain, now);
  graph.echo.gain.setValueAtTime(0, now);
}

/** 按计划把输出从 outgoing 交到 incoming。返回实际过渡秒数。 */
export function scheduleBlend(outgoing: AudioGraph, incoming: AudioGraph, schedule: BlendSchedule) {
  if (!outgoing?.fade || !incoming?.fade) return schedule.overlap;
  const beatCut = schedule.overlap < 0.2;
  const span = beatCut ? Math.max(0.04, schedule.overlap) : Math.max(0.8, schedule.overlap);
  const now = outgoing.context.currentTime;
  const curves = buildCrossfadeCurves(schedule.together);
  releaseParam(outgoing.fade.gain, now);
  releaseParam(incoming.fade.gain, now);
  outgoing.fade.gain.setValueCurveAtTime(curves.out, now, span);
  incoming.fade.gain.setValueCurveAtTime(curves.incoming, now, span);
  const end = now + span + 0.02;
  outgoing.fade.gain.setValueAtTime(0, end);
  incoming.fade.gain.setValueAtTime(1, end);
  if (schedule.swapBass) {
    const bass = bassCurves();
    releaseParam(outgoing.low.gain, now);
    releaseParam(incoming.low.gain, now);
    outgoing.low.gain.setValueCurveAtTime(bass.out, now, span);
    incoming.low.gain.setValueCurveAtTime(bass.incoming, now, span);
    outgoing.low.gain.setValueAtTime(0, end + 0.08);
    incoming.low.gain.setValueAtTime(0, end + 0.08);
  }
  if (schedule.echo) {
    releaseParam(outgoing.echo.gain, now);
    outgoing.echo.gain.setValueAtTime(0, now);
    outgoing.echo.gain.linearRampToValueAtTime(0.55, now + Math.min(0.12, span));
    outgoing.echo.gain.linearRampToValueAtTime(0, end);
  }
  return span;
}
