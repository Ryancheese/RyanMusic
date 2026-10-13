export interface TrackEnds {
  bpm: number | null;
  leadIn: number;
  startsHot: boolean;
  endsHot: boolean;
  /** 最后几秒的斜率，负值表示自己在淡出。 */
  outroSlope: number;
}

export interface BlendPlan {
  style: 'beatCut' | 'bassSwap' | 'tailRide' | 'plainBlend';
  overlap: number;
  together: number;
  swapBass: boolean;
  echo: boolean;
  inStart: number;
}

const profiles = new Map<string, TrackEnds | null>();
const pending = new Map<string, Promise<TrackEnds | null>>();

function dbOf(rms: number) {
  return 20 * Math.log10(Math.max(rms, 1e-8));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateBpm(envelope: number[], frameSec: number) {
  const onset = envelope.map((value, index) => Math.max(0, value - (envelope[index - 1] || 0)));
  let best = 0;
  let bestBpm = 0;
  for (let bpm = 72; bpm <= 168; bpm += 1) {
    const lag = Math.round((60 / bpm) / frameSec);
    if (lag < 2 || lag >= onset.length / 2) continue;
    let corr = 0;
    let norm = 0;
    for (let index = 0; index < onset.length - lag; index += 1) {
      corr += onset[index] * onset[index + lag];
      norm += onset[index] * onset[index];
    }
    const score = corr / (norm || 1);
    if (score > best) {
      best = score;
      bestBpm = bpm;
    }
  }
  return best > 0.18 ? bestBpm : null;
}

export function analyseEnds(buffer: AudioBuffer): TrackEnds {
  const data = buffer.getChannelData(0);
  const frame = Math.max(1, Math.floor(buffer.sampleRate * 0.05));
  const envelope: number[] = [];
  for (let index = 0; index + frame < data.length; index += frame) {
    let sum = 0;
    const step = 8;
    let count = 0;
    for (let sample = 0; sample < frame; sample += step) {
      const value = data[index + sample];
      sum += value * value;
      count += 1;
    }
    envelope.push(Math.sqrt(sum / Math.max(1, count)));
  }
  const frameSec = frame / buffer.sampleRate;
  const peak = envelope.reduce((max, value) => Math.max(max, value), 1e-6);
  const gate = peak * 0.07;
  let leadFrames = 0;
  while (leadFrames < envelope.length && envelope[leadFrames] < gate) leadFrames += 1;
  const leadIn = leadFrames * frameSec;
  const body = envelope.slice(
    Math.floor(envelope.length * 0.25),
    Math.floor(envelope.length * 0.75),
  );
  const bodyDb = dbOf(average(body.length ? body : envelope));
  const headDb = dbOf(average(envelope.slice(leadFrames, leadFrames + 8)));
  const tailDb = dbOf(average(envelope.slice(-8)));
  const last = envelope.slice(-60);
  const outroSlope = last.length > 16
    ? (dbOf(average(last.slice(-8))) - dbOf(average(last.slice(0, 8)))) / Math.max(0.5, last.length * frameSec)
    : 0;
  return {
    bpm: estimateBpm(envelope, frameSec),
    leadIn,
    startsHot: headDb > bodyDb - 3.5,
    endsHot: tailDb > bodyDb - 7,
    outroSlope,
  };
}

async function loadProfile(url: string): Promise<TrackEnds | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      cache: 'force-cache',
      signal: controller.signal,
      headers: { Range: 'bytes=0-524287' },
    });
    if (!response.ok && response.status !== 206) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 16_000 || bytes.byteLength > 700_000) return null;
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(bytes.slice(0));
      return analyseEnds(buffer);
    } finally {
      void context.close();
    }
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 后台量一首歌的首尾。同一首只做一次。 */
export function primeTrackProfile(key: string, url: string) {
  if (!key || !url || profiles.has(key) || pending.has(key)) return;
  const job = loadProfile(url)
    .then((profile) => {
      profiles.set(key, profile);
      return profile;
    })
    .catch(() => {
      profiles.set(key, null);
      return null;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, job);
}

/** undefined：还在量。null：量失败。 */
export function peekTrackProfile(key: string): TrackEnds | null | undefined {
  return profiles.get(key);
}

/** 正在播的这首不再整首重下，用最后十几秒的电平看它是淡出还是突然停。 */
export function profileFromTail(samples: number[], frameSec = 0.05): TrackEnds | null {
  if (samples.length < 24) return null;
  const body = samples.slice(0, Math.max(8, Math.floor(samples.length * 0.45)));
  const tail = samples.slice(-8);
  const head = samples.slice(0, 8);
  const bodyDb = dbOf(average(body));
  const tailDb = dbOf(average(tail));
  const span = Math.max(0.5, samples.length * frameSec);
  return {
    bpm: estimateBpm(samples, frameSec),
    leadIn: 0,
    startsHot: false,
    endsHot: tailDb > bodyDb - 7,
    outroSlope: (tailDb - dbOf(average(head))) / span,
  };
}

function temposFar(left: number | null, right: number | null) {
  if (!left || !right) return false;
  let ratio = Math.max(left, right) / Math.min(left, right);
  if (ratio > 1.7) ratio /= 2;
  return ratio > 1.12;
}

export function plainBlend(room: number, seconds: number): BlendPlan {
  return {
    style: 'plainBlend',
    overlap: Math.max(0.8, Math.min(room, seconds)),
    together: 0,
    swapBass: false,
    echo: false,
    inStart: 0,
  };
}

/**
 * Folia Automix 的兼容档：没有拍点模型和分轨，只根据首尾响度、淡出和速度选接法。
 * 证据不够时退回固定淡化。
 */
export function planAutomix(
  from: TrackEnds | null | undefined,
  to: TrackEnds | null | undefined,
  room: number,
  fallbackSeconds: number,
): BlendPlan {
  if (!from && !to) return plainBlend(room, fallbackSeconds);
  const beat = from?.bpm ? 60 / from.bpm : 0.5;

  if (to?.startsHot && from?.bpm && to.leadIn >= beat) {
    return {
      style: 'beatCut',
      overlap: 0.05,
      together: 0,
      swapBass: false,
      echo: true,
      inStart: Math.max(0, to.leadIn - 0.04),
    };
  }
  if (to?.startsHot) {
    return {
      style: 'bassSwap',
      overlap: Math.max(0.8, Math.min(room, 4)),
      together: 0.45,
      swapBass: true,
      echo: Boolean(from?.endsHot),
      inStart: to.leadIn > 0.2 ? Math.max(0, to.leadIn - 0.08) : 0,
    };
  }
  if (from && temposFar(from.bpm, to?.bpm ?? null) && to && to.leadIn >= beat) {
    return {
      style: 'beatCut',
      overlap: 0.05,
      together: 0,
      swapBass: false,
      echo: true,
      inStart: Math.max(0, to.leadIn - 0.04),
    };
  }
  if (from && from.outroSlope <= -1.5) {
    return {
      style: 'bassSwap',
      overlap: Math.max(0.8, Math.min(room, 7)),
      together: 0.55,
      swapBass: true,
      echo: false,
      inStart: to && to.leadIn > 0.2 ? Math.max(0, to.leadIn - 0.08) : 0,
    };
  }
  if (from && !from.endsHot && to && (to.leadIn > 0.3 || !to.startsHot)) {
    return {
      style: 'tailRide',
      overlap: Math.max(1.2, Math.min(room, 11)),
      together: 0.5,
      swapBass: true,
      echo: false,
      inStart: to.leadIn > 0.25 ? Math.max(0, to.leadIn - 0.1) : 0,
    };
  }
  if (from || to) {
    return {
      style: 'bassSwap',
      overlap: Math.max(0.8, Math.min(room, 8)),
      together: 0.55,
      swapBass: true,
      echo: Boolean(from?.endsHot),
      inStart: to && to.leadIn > 0.2 ? Math.max(0, to.leadIn - 0.08) : 0,
    };
  }
  return plainBlend(room, fallbackSeconds);
}
