// An MV and the release it was made from. The MV is heard with its own sound (its recording, cut or arrangement may
// differ), so the release's lyric times and the model's reading of the words are carried over by measuring where
// each moment of the MV's sound is in the release. Both sides are measured the same way (motion: 50 fps mel bands);
// the curve compared is onset strength (the positive change of four band groups), at 25 Hz for the search.
//   1  every 8 s window of the MV (2 s apart) is compared with the release at every lag within ±45 s (Pearson)
//   2  a path through the windows (dynamic programming): a lag is kept while it fits, changed only where another
//      fits much better (repeated choruses would otherwise pull it about), and a window fitting no lag is "inserted"
//      (only in the MV: an intro, a scene with dialogue, an extended ending)
//   3  runs of one lag are the matched segments; each is refined at 50 fps to the millisecond. What of the release no
//      segment covers was removed in the MV.
// The result is a measurement, not a verification: verified stays false.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** onset strength at 50 fps from a motion record (library motion.bin or the in-browser analysis) */
export function onsetCurve(M) {
  const D = M.data, S = M.stride, N = M.frames, C = M.channels, out = new Float32Array(N), prev = new Float32Array(4);
  const mel = Array.from({length: 32}, (_, i) => C['mel' + String(i).padStart(2, '0')]);
  for (let f = 0; f < N; f++) {
    let s = 0;
    for (let g = 0; g < 4; g++) {
      let e = 0; for (let m = g * 8; m < g * 8 + 8; m++) e += D[f * S + mel[m]];
      e /= 8 * 255;
      if (f) s += Math.max(0, e - prev[g]);
      prev[g] = e;
    }
    out[f] = s;
  }
  // standardised against its own running level (5 s), so a quiet and a loud master look alike
  const W = 125, pre = new Float64Array(N + 1);
  for (let f = 0; f < N; f++) pre[f + 1] = pre[f] + out[f];
  const z = new Float32Array(N);
  for (let f = 0; f < N; f++) { const a = Math.max(0, f - W), b = Math.min(N, f + W); z[f] = out[f] / ((pre[b] - pre[a]) / (b - a) + 1e-3); }
  return z;
}
// to 25 Hz for the search: smoothed first (σ ≈ 1.6 frames), so that a version shifted by an odd number of frames
// pools the same way (an onset is a frame or two wide: summed pairs alone would halve the match)
const pool2 = x => {
  const K = [.05, .12, .2, .26, .2, .12, .05], n = x.length >> 1, y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = -3; k <= 3; k++) { const j = 2 * i + k; if (j >= 0 && j < x.length) s += K[k + 3] * x[j]; } y[i] = s; }
  return y;
};

/** where the MV's moments are in the release. rel, mv: motion records (fps 50). */
export function alignMv(relM, mvM, {range = 45, win = 8, step = 2, tau = .22, jump = 1.4} = {}) {
  const fr = onsetCurve(relM), fm = onsetCurve(mvM), R = pool2(fr), V = pool2(fm), HZ = 25;
  const nR = R.length, nV = V.length, W = Math.round(win * HZ), ST = Math.round(step * HZ), L0 = -Math.round(range * HZ), NL = 2 * Math.round(range * HZ) + 1;
  const pre = new Float64Array(nR + 1), pre2 = new Float64Array(nR + 1);
  for (let i = 0; i < nR; i++) { pre[i + 1] = pre[i] + R[i]; pre2[i + 1] = pre2[i] + R[i] * R[i]; }
  const starts = []; for (let s = 0; s + W <= nV; s += ST) starts.push(s);
  if (nV >= W && starts[starts.length - 1] + W < nV) starts.push(nV - W);
  const NW = starts.length;
  if (!NW) return null;
  // 1  Pearson of each window at each lag (lag: release frame − MV frame)
  const E = new Float32Array(NW * NL).fill(-1);
  for (let w = 0; w < NW; w++) {
    const s = starts[w]; let mx = 0, mx2 = 0;
    for (let i = 0; i < W; i++) { mx += V[s + i]; mx2 += V[s + i] * V[s + i]; }
    const vm = mx / W, vs = Math.sqrt(Math.max(1e-9, mx2 / W - vm * vm));
    for (let l = 0; l < NL; l++) {
      const r0 = s + L0 + l; if (r0 < 0 || r0 + W > nR) continue;
      let dot = 0; for (let i = 0; i < W; i++) dot += V[s + i] * R[r0 + i];
      const rm = (pre[r0 + W] - pre[r0]) / W, rs = Math.sqrt(Math.max(1e-9, (pre2[r0 + W] - pre2[r0]) / W - rm * rm));
      E[w * NL + l] = (dot / W - vm * rm) / (vs * rs);
    }
  }
  // 2  the path: keep a lag (±1 step for free drift), jump at a cost, or be "inserted"
  const INS = NL, from = new Int32Array(NW * (NL + 1));
  let prev = new Float32Array(NL + 1), cur = new Float32Array(NL + 1);
  for (let l = 0; l < NL; l++) prev[l] = E[l]; prev[INS] = tau;
  for (let w = 1; w < NW; w++) {
    let best = 0; for (let l = 1; l < NL; l++) if (prev[l] > prev[best]) best = l;
    for (let l = 0; l < NL; l++) {
      let v = prev[l], k = l;
      if (l > 0 && prev[l - 1] - .02 > v) { v = prev[l - 1] - .02; k = l - 1; }
      if (l < NL - 1 && prev[l + 1] - .02 > v) { v = prev[l + 1] - .02; k = l + 1; }
      if (prev[best] - jump > v) { v = prev[best] - jump; k = best; }
      if (prev[INS] - .5 > v) { v = prev[INS] - .5; k = INS; }
      cur[l] = E[w * NL + l] + v; from[w * (NL + 1) + l] = k;
    }
    let v = prev[INS], k = INS; if (prev[best] - .5 > v) { v = prev[best] - .5; k = best; }
    cur[INS] = tau + v; from[w * (NL + 1) + INS] = k;
    [prev, cur] = [cur, prev];
  }
  const path = new Int32Array(NW); let k = 0; for (let l = 1; l <= NL; l++) if (prev[l] > prev[k]) k = l;
  for (let w = NW - 1; w >= 0; w--) { path[w] = k; if (w) k = from[w * (NL + 1) + k]; }
  // 3  runs of one lag → segments (each window owns the middle of its stretch)
  const core = w => { const c = starts[w] + W / 2; return [w ? c - ST / 2 : 0, w === NW - 1 ? nV : c + ST / 2]; };
  const runs = [];
  for (let w = 0; w < NW; w++) {
    const p = path[w], last = runs[runs.length - 1], [a, b] = core(w);
    if (last && (p === INS ? last.ins : !last.ins && Math.abs(p - last.p) <= 2)) { last.b = b; last.ws.push(w); }
    else runs.push({ins: p === INS, p, a, b, ws: [w]});
  }
  // a matched run of a single window between others is not trusted: it becomes part of what it interrupts
  const segs = [];
  for (const r of runs) {
    const conf = r.ins ? 0 : r.ws.reduce((s, w) => s + E[w * NL + r.p], 0) / r.ws.length;
    if (!r.ins && r.ws.length < 2 && conf < .55 && segs.length) { segs[segs.length - 1].b = r.b; continue; }
    segs.push({kind: r.ins ? 'inserted' : 'match', a: r.a, b: r.b, p: r.p, conf});
  }
  // refine each match at 50 fps (±3 frames round the coarse lag, then a parabola through the best three)
  const out = segs.map(s => {
    const mv = [s.a / HZ, s.b / HZ];
    if (s.kind !== 'match') return {kind: 'inserted', mv, rel: null, lag: null, conf: 0};
    const f0 = Math.round(mv[0] * 50), f1 = Math.min(fm.length, Math.round(mv[1] * 50)), c0 = (L0 + s.p) * 2, sc = [];
    for (let d = -3; d <= 3; d++) { let dot = 0, n = 0; for (let f = f0; f < f1; f++) { const g = f + c0 + d; if (g >= 0 && g < fr.length) { dot += fm[f] * fr[g]; n++; } } sc.push(n ? dot / n : -1e9); }
    let bi = 0; for (let i = 1; i < 7; i++) if (sc[i] > sc[bi]) bi = i;
    let sub = 0; if (bi > 0 && bi < 6) { const a = sc[bi - 1], b = sc[bi], c = sc[bi + 1], den = a - 2 * b + c; if (den < 0) sub = clamp(.5 * (a - c) / den, -.5, .5); }
    const lag = (c0 + bi - 3 + sub) / 50;
    return {kind: 'match', mv, rel: [mv[0] + lag, mv[1] + lag], lag: Math.round(lag * 1000) / 1000, conf: Math.round(s.conf * 100) / 100};
  });
  // the windows only place a change to within a step: each boundary is set at 50 fps where the fit of the lag before
  // it gives way to the fit of the one after (an inserted stretch fits nothing: a fixed .35)
  const fit = (lag, a, b) => {
    const n = b - a, out = new Float32Array(Math.max(0, n));
    if (lag == null) return out.fill(.35);
    const d = Math.round(lag * 50), H = 25;
    for (let i = 0; i < n; i++) {
      const f = a + i; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, k = 0;
      for (let g = Math.max(0, f - H); g < Math.min(fm.length, f + H); g++) { const r = g + d; if (r < 0 || r >= fr.length) continue; const x = fm[g], y = fr[r]; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; k++; }
      out[i] = k > 10 ? (sxy / k - sx * sy / k / k) / Math.sqrt(Math.max(1e-9, (sxx / k - sx * sx / k / k) * (syy / k - sy * sy / k / k))) : -.2;
    }
    return out;
  };
  for (let i = 0; i + 1 < out.length; i++) {
    const A = out[i], B = out[i + 1];
    const z0 = Math.round(Math.max(A.mv[0], A.mv[1] - 4) * 50), z1 = Math.round(Math.min(B.mv[1], B.mv[0] + 4) * 50);
    if (z1 - z0 < 4) continue;
    const fa = fit(A.lag, z0, z1), fb = fit(B.lag, z0, z1);
    let acc = 0; for (let j = 0; j < fb.length; j++) acc += fb[j];
    let best = acc, bx = 0;
    for (let j = 0; j < fa.length; j++) { acc += fa[j] - fb[j]; if (acc > best) { best = acc; bx = j + 1; } }
    A.mv[1] = B.mv[0] = (z0 + bx) / 50;
  }
  for (const s of out) if (s.kind === 'match') s.rel = [s.mv[0] + s.lag, s.mv[1] + s.lag];
  for (let i = out.length - 1; i >= 0; i--) if (out[i].mv[1] - out[i].mv[0] < .3) out.splice(i, 1);
  // what of the release no segment covers: removed in the MV
  const relDur = relM.frames / 50, cov = out.filter(s => s.kind === 'match').map(s => [Math.max(0, s.rel[0]), Math.min(relDur, s.rel[1])]).sort((a, b) => a[0] - b[0]);
  const removed = []; let at = 0;
  for (const [a, b] of cov) { if (a - at > 1) removed.push({kind: 'removed', rel: [at, a]}); at = Math.max(at, b); }
  if (relDur - at > 1) removed.push({kind: 'removed', rel: [at, relDur]});
  const matched = out.filter(s => s.kind === 'match'), mvDur = mvM.frames / 50;
  const longest = matched.reduce((a, s) => (!a || s.mv[1] - s.mv[0] > a.mv[1] - a.mv[0] ? s : a), null);
  return {
    segments: out, removed, offset: longest ? longest.lag : null, method: 'onset-xcorr+dp', verified: false,
    cover: {mv: matched.reduce((s, x) => s + x.mv[1] - x.mv[0], 0) / mvDur, rel: cov.reduce((s, x) => s + x[1] - x[0], 0) / relDur},
  };
}

/** release time → MV time(s): a moment the MV repeats is there more than once; one it removed, not at all */
export function toMv(al, tRel) { return al.segments.filter(s => s.kind === 'match' && tRel >= s.rel[0] && tRel < s.rel[1]).map(s => tRel - s.lag); }
/** MV time → release time (an inserted stretch: the release time where it was inserted) */
export function toRelease(al, tMv) {
  let last = null;
  for (const s of al.segments) { if (tMv < s.mv[0]) break; if (s.kind === 'match') { if (tMv < s.mv[1]) return tMv + s.lag; last = s.mv[1] + s.lag; } }
  return last ?? 0;
}
/** the release's lyric lines in MV time: every matched segment takes the lines that start in it; a line running past
 *  its segment's end keeps the segment's lag (marked `cross`) */
export function mapLyrics(lines, al) {
  const out = [];
  for (const s of al.segments) {
    if (s.kind !== 'match') continue;
    for (const L of lines) {
      if (L.start < s.rel[0] || L.start >= s.rel[1]) continue;
      const d = -s.lag, cross = L.end > s.rel[1] + .3;
      out.push({...L, start: L.start + d, end: L.end + d, words: L.words.map(w => ({...w, s: w.s + d, e: w.e + d})), relI: L.i, cross});
    }
  }
  out.sort((a, b) => a.start - b.start);
  out.forEach((L, i) => { L.i = i; });
  return out;
}
