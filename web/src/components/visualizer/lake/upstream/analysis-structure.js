// Structure from measured features: onsets, beat candidates, sections, high-energy phases, builds, breaks,
// and the state schedule (observe / burst / burst-lite / survey). Pure JS, shared by Worker and Node.
// The schedule rules are the library pipeline's (tools/spectra.py): phases = smoothed loudness above its
// 72nd percentile for >= 6 s; bursts >= 20 s apart; survey = lyric gap >= 8 s, settling 2 s before the next line.
import {percentile} from './analysis-util.js';

const FPS = 50, COLS = 720;
export const RULES = {BURST_MIN_GAP: 20, SURVEY_GAP: 8, SURVEY_LEAD: 2, PHASE_PCT: 72, PHASE_MIN: 6};

function boxcar(x, k) {
  const out = new Float32Array(x.length), h = Math.floor(k / 2);
  let s = 0;
  const pre = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) pre[i + 1] = pre[i] + x[i];
  for (let i = 0; i < x.length; i++) { const a = Math.max(0, i - h), b = Math.min(x.length, i - h + k); s = pre[b] - pre[a]; out[i] = s / k; }
  return out;
}

// local maxima above a moving mean + delta, at least `wait` frames apart (same idea as librosa.util.peak_pick)
function peaks(x, {pre = 3, post = 3, avgPre = 12, avgPost = 12, delta = .05, wait = 6, floor = 0}) {
  const out = [];
  let last = -1e9;
  const pfx = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) pfx[i + 1] = pfx[i] + x[i];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (v < floor || i - last <= wait) continue;
    let ok = true;
    for (let k = Math.max(0, i - pre); k <= Math.min(x.length - 1, i + post); k++) if (x[k] > v) { ok = false; break; }
    if (!ok) continue;
    const a = Math.max(0, i - avgPre), b = Math.min(x.length, i + avgPost + 1), mean = (pfx[b] - pfx[a]) / (b - a);
    if (v >= mean + delta) { out.push(i); last = i; }
  }
  return out;
}

// Tempo candidate by autocorrelation of the onset envelope (log-normal prior around 120), then a dynamic-
// programming beat tracker (Ellis 2007). Candidates only.
function beatTrack(onset) {
  const n = onset.length, mean = onset.reduce((a, b) => a + b, 0) / n, x = onset.map(v => v - mean);
  let best = 0, bestLag = Math.round(FPS * .5);
  for (let lag = Math.round(FPS * 60 / 200); lag <= Math.round(FPS * 60 / 60); lag++) {
    let s = 0;
    for (let i = lag; i < n; i += 2) s += x[i] * x[i - lag];
    const bpm = 60 * FPS / lag, w = Math.exp(-.5 * Math.pow(Math.log2(bpm / 120) / 1, 2));
    if (s * w > best) { best = s * w; bestLag = lag; }
  }
  const period = bestLag, tight = 100, score = new Float32Array(n), back = new Int32Array(n).fill(-1);
  const sd = Math.sqrt(x.reduce((a, b) => a + b * b, 0) / n) || 1, local = x.map(v => v / sd);
  for (let i = 0; i < n; i++) {
    let bs = -1e9, bi = -1;
    for (let p = Math.max(0, i - 2 * period); p <= i - Math.round(period / 2); p++) {
      const s = score[p] - tight * Math.pow(Math.log((i - p) / period), 2);
      if (s > bs) { bs = s; bi = p; }
    }
    score[i] = local[i] + (bi >= 0 ? Math.max(bs, 0) : 0); back[i] = bi >= 0 && bs > 0 ? bi : -1;
  }
  let end = n - 1, top = -1e9;
  for (let i = Math.max(0, n - 2 * period); i < n; i++) if (score[i] > top) { top = score[i]; end = i; }
  const beats = [];
  for (let i = end; i >= 0; i = back[i]) { beats.push(i / FPS); if (back[i] < 0) break; }
  return {tempo: Math.round(600 * FPS / period) / 10, beats: beats.reverse().map(t => Math.round(t * 1000) / 1000)};
}

// Sections: boundaries where 6 s before and 6 s after differ most in timbre + harmony, at least 8 s apart;
// similar sections share a letter so the picture can return to a state, not only move on.
function sections(melDb, chroma, rms, n, duration) {
  const step = FPS / 2, m = Math.ceil(n / step), dims = melDb.length + 12, feat = Array.from({length: m}, () => new Float32Array(dims));
  for (let d = 0; d < melDb.length; d++) {
    let mu = 0, sd = 0;
    for (let f = 0; f < n; f++) mu += melDb[d][f];
    mu /= n;
    for (let f = 0; f < n; f++) sd += (melDb[d][f] - mu) ** 2;
    sd = Math.sqrt(sd / n) + 1e-9;
    for (let i = 0; i < m; i++) { let s = 0, c = 0; for (let f = i * step; f < Math.min(n, (i + 1) * step); f++) { s += (melDb[d][f] - mu) / sd; c++; } feat[i][d] = c ? s / c : 0; }
  }
  for (let d = 0; d < 12; d++) for (let i = 0; i < m; i++) { let s = 0, c = 0; for (let f = i * step; f < Math.min(n, (i + 1) * step); f++) { s += chroma[d][f]; c++; } feat[i][melDb.length + d] = (c ? s / c : 0) * 2; }
  const k = 12, nov = new Float32Array(m);
  const meanOf = (a, b) => { const v = new Float32Array(dims); for (let i = a; i < b; i++) for (let d = 0; d < dims; d++) v[d] += feat[i][d]; for (let d = 0; d < dims; d++) v[d] /= Math.max(1, b - a); return v; };
  for (let i = k; i < m - k; i++) { const a = meanOf(i - k, i), b = meanOf(i, i + k); let s = 0; for (let d = 0; d < dims; d++) s += (a[d] - b[d]) ** 2; nov[i] = Math.sqrt(s); }
  const top = Math.max(percentile(nov, 99), 1e-9);
  for (let i = 0; i < m; i++) nov[i] /= top;
  const cand = peaks(nov, {pre: 8, post: 8, avgPre: 16, avgPost: 16, delta: .08, wait: 16}).map(i => i / 2).filter(t => t > 6 && t < duration - 6);
  const bounds = [0, ...cand, Math.round(duration * 100) / 100], out = [], protos = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1], v = meanOf(Math.floor(a * 2), Math.max(Math.floor(a * 2) + 1, Math.floor(b * 2)));
    let mu = 0; for (const x of v) mu += x; mu /= dims;
    let nr = 0; for (let d = 0; d < dims; d++) { v[d] -= mu; nr += v[d] * v[d]; }
    nr = Math.sqrt(nr) + 1e-9;
    for (let d = 0; d < dims; d++) v[d] /= nr;
    let bi = -1, bs = -1;
    protos.forEach((p, j) => { let s = 0; for (let d = 0; d < dims; d++) s += p[d] * v[d]; if (s > bs) { bs = s; bi = j; } });
    if (bi < 0 || bs <= .72) { protos.push(v); bi = protos.length - 1; }
    let e = 0, c = 0; for (let f = Math.floor(a * FPS); f < Math.min(n, Math.floor(b * FPS)); f++) { e += rms[f]; c++; }
    out.push({start: a, end: b, energy: Math.round(e / Math.max(1, c) * 1000) / 1000, label: String.fromCharCode(65 + Math.min(25, bi))});
  }
  return out;
}

export function phasesOf(env, duration) {
  const k = Math.max(1, Math.floor(COLS * 4 / duration)), sm = boxcar(env, k), thr = percentile(sm, RULES.PHASE_PCT), out = [];
  for (let i = 0; i < COLS;) {
    if (sm[i] > thr) { let j = i; while (j < COLS && sm[j] > thr) j++; const a = i / COLS * duration, b = j / COLS * duration; if (b - a >= RULES.PHASE_MIN) out.push([Math.round(a * 100) / 100, Math.round(b * 100) / 100]); i = j; }
    else i++;
  }
  return out;
}

// lines: [{start, end}] or []. manual: optional [[a,b]] overriding measured phases.
export function schedule(duration, phases, lines = [], manual = null) {
  const ev = [];
  let last = -1e9;
  for (const [a, b] of manual || phases) { const kind = a - last >= RULES.BURST_MIN_GAP ? 'burst' : 'burst-lite'; if (kind === 'burst') last = a; ev.push([a, b, kind]); }
  if (lines.length) {
    const bounds = [[0, lines[0].start], ...lines.slice(1).map((y, i) => [lines[i].end, y.start]), [lines[lines.length - 1].end, duration]];
    for (const [a, b] of bounds) { const end = b < duration ? b - RULES.SURVEY_LEAD : b; if (b - a >= RULES.SURVEY_GAP && end - a > 3) ev.push([a, end, 'survey']); }
  }
  const cuts = [...new Set([0, duration, ...ev.flatMap(e => [e[0], e[1]])])].sort((a, b) => a - b), out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a < .05) continue;
    const mid = (a + b) / 2, here = ev.filter(e => e[0] <= mid && mid < e[1]).map(e => e[2]);
    const st = ['burst', 'burst-lite', 'survey'].find(s => here.includes(s)) || 'observe';
    if (out.length && out[out.length - 1][2] === st) out[out.length - 1][1] = Math.round(b * 100) / 100;
    else out.push([Math.round(a * 100) / 100, Math.round(b * 100) / 100, st]);
  }
  const merged = [];
  for (const seg of out) { if (merged.length && (seg[1] - seg[0] < 2 || merged[merged.length - 1][2] === seg[2])) merged[merged.length - 1][1] = seg[1]; else merged.push(seg); }
  return merged;
}

export function structure({n, duration, melDb, chroma, fl, rms, env}) {
  const r3 = v => Math.round(v * 1000) / 1000;
  const pick = (x, delta, floor) => peaks(x, {delta, floor}).map(i => [r3(i / FPS), r3(x[i])]);
  const onsets = {low: pick(fl.low, .06, .18), mid: pick(fl.mid, .05, .16), high: pick(fl.high, .05, .16)};
  // onset envelope for beats: positive change of the mel spectrum, summed over bands
  const oenv = new Float32Array(n);
  for (const row of melDb) for (let f = 1; f < n; f++) { const d = row[f] - row[f - 1]; if (d > 0) oenv[f] += d; }
  const bt = beatTrack(oenv);
  const phases = phasesOf(env, duration);
  const slow = boxcar(rms, Math.round(1.5 * FPS)), builds = [];
  for (const [a] of phases) {
    const i1 = Math.floor(a * FPS), i0 = Math.max(0, i1 - 12 * FPS);
    let j = i1; for (let i = i0; i < i1; i++) if (slow[i] < slow[j]) j = i;
    const rise = i1 > j ? slow[i1 - 1] - slow[j] : 0, start = rise >= .06 && a - j / FPS >= 1.5 ? j / FPS : Math.max(0, a - 1.5);
    builds.push([Math.round(start * 100) / 100, a, r3(rise)]);
  }
  const breaks = [];
  for (let i = 0; i < n;) {
    const q = f => rms[f] < Math.max(.25 * slow[f], .04);
    if (q(i)) { let j = i; while (j < n && q(j)) j++; const d = (j - i) / FPS; if (d >= .15 && d <= 2.5 && slow[i] > .35) breaks.push([Math.round(i / FPS * 100) / 100, Math.round(j / FPS * 100) / 100]); i = j; }
    else i++;
  }
  return {onsets, beats_candidate: bt.beats, tempo_candidate: bt.tempo, sections: sections(melDb, chroma, rms, n, duration), phases, builds, breaks};
}
