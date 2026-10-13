// Portions of camera/typographic rules adapted from Folia by chthollyphile and contributors.
// Upstream: https://github.com/chthollyphile/folia-major/blob/1f2c32a5d91afd1446a9ca8e7d4305ca6f9f22ed/src/components/visualizer/lumiere/text/wordStyle.ts
// See THIRD_PARTY_NOTICES.md and licenses/AGPL-3.0.txt.
// The score: a whole song's lyric staging, compiled once from its lyric timing, its measurements and its words.
// Same song → same score (no randomness, no state), so seeking and stills agree with playback.
//
// Method learned from Folia's compiled lyric modes (Lumiere, Sonnet, Tempera, Partita, Diorama):
//   · a line is a set of units (a CJK character, or a Latin word), each with its own size class: function
//     words small, content words varied, one hero large (typographic hierarchy, not one flat row);
//   · every line picks a composition (row, steps, column, poster); the chorus gets its own vocabulary;
//   · units wake phrase by phrase (slices), each word with its own move, neighbours never alike.
// What is ours:
//   · mood and chorus are measured (loudness, measured high-energy phases, NetEase's chorus windows, refrains);
//   · every line has a tone (from the model's reading of the words when there is one, else from the measurements)
//     which sets its colours and its typeface pair: a line is set in one face while it waits and turns into
//     another as it is sung (lyric.js);
//   · line-timed lyrics only say when a line starts. Their words are placed by the song's own singing rate (not
//     stretched to the next line) and pulled onto measured onsets, so the picture does not fall behind the voice;
//   · lines sung back to back are staged together as a stanza (at most three lines). The lake is a place, not a
//     road: shots.js sets every stanza somewhere else on it, facing another way, and gives the stanza a formation
//     (its lines replace one another on the spot, unfold like the panels of a screen, or build toward the viewer
//     as a paragraph). Only a breath starts a new stanza;
//   · a line is not always set whole: where its words are far enough apart it may be staged word by word (one
//     beat at a time on the same spot, a relay, or beats standing all over the water); and some paragraphs are
//     laid on the water as pages and read from above.
import {CJK} from './data.js';
import {findImages, findGestures} from './sense.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const isCJK = ch => !!ch && CJK.test(ch);
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
export const ENTRANCES = ['bob', 'surge', 'swing', 'slide', 'stand', 'gather', 'bob'];
const SOFT = ['bob', 'gather', 'surge', 'slide'], HARD = ['stand', 'swing', 'surge', 'slide', 'bob'];
// how a stanza leaves (lyric.js), with the weight each has anyway; on a page (read from above) there are other ways
const EXITS = {sink: 1, fold: .9, part: .9, lift: .8, shut: .8, melt: .8, recede: .7, blow: .8}, PAGE_EXITS = {sink: 1.2, adrift: 1, wash: 1, part: .6};
// how one beat of a line set word by word arrives, and makes way for the next
const BEAT_IN = ['pop', 'rise', 'turn', 'drop', 'slide'], BEAT_OUT = ['sink', 'fold', 'back', 'pass', 'side'];
function pick(wt, u) { let tot = 0; for (const k in wt) tot += Math.max(0, wt[k]); let q = u * tot, last = null; for (const k in wt) { if (!(wt[k] > 0)) continue; last = k; q -= wt[k]; if (q <= 0) return k; } return last; }
export const ZS = 3.2;                                           // world units between two rows of a paragraph (each next row nearer the viewer)
export const TONES = ['tender', 'bright', 'dark', 'tense', 'euphoric', 'calm', 'wistful', 'defiant'];

const FN_EN = new Set('a an the and or but nor to of in on at for with by from as is are am was were be been it its so than then that this these those just oh ooh ah yeah la na hey do does did can will would could should shall may might must if when up down out into onto off over like no not yet too very what which who'.split(' '));
const FN_JA = new Set([...'のはがをにへとでもやかねよなぞさわ']);
const FN_ZH = new Set([...'的了着地得在和与也就都吗呢吧啊么']);
const CJK_RUN = /[぀-ヿ㐀-鿿豈-﫿]|[^぀-ヿ㐀-鿿豈-﫿]+/g;
const syllables = w => { let n = 0; for (const r of String(w).match(CJK_RUN) || []) n += isCJK(r) ? 1 : Math.max(1, (r.toLowerCase().match(/[aeiouy]+/g) || []).length); return Math.max(1, n); };

// split a timed word into display units: CJK characters one by one (time shared by character), Latin runs whole
function unitsOf(w) {
  const txt = String(w.w).trim();
  if (!txt) return [];
  const runs = txt.match(CJK_RUN) || [txt];
  const weights = runs.map(r => (isCJK(r) ? 1 : Math.max(1, r.length * .45)));
  const tot = weights.reduce((a, b) => a + b, 0), span = Math.max(.02, w.e - w.s);
  let acc = 0;
  return runs.map((r, i) => { const s = w.s + span * acc / tot; acc += weights[i]; return {t: r.trim() || r, s, e: w.s + span * acc / tot, cjk: isCJK(r)}; }).filter(u => u.t.trim());
}

// ---- when the words fall --------------------------------------------------------------------------------
// What was measured (tools/sync_eval.mjs, on the three library songs that have word times):
//   · the given word times sit on the music as they are (the best single shift of a whole file is 30–50 ms), and
//     measured onsets are too dense to say which of them a word belongs to. So a given word time is kept; it only
//     moves onto a STRONG onset when one lies within 40 ms of it (the eye then lands on what the ear hears);
//   · where only the line's time is given, no rule places its words: with the word times hidden, the middle error
//     of every placement tried was 0.16–0.39 s, about one word. So those words are placed evenly at the song's own
//     singing rate, and the line is staged so that nothing strikes on such a guess (see `soft` below, lyric.js).
// rate: this song's seconds per syllable, from its densest lines (the ones sung without a pause before the next)
function singingRate(LY) {
  const r = LY.filter(L => L.approx && L.words.length).map(L => (L.end - L.start) / L.words.reduce((s, w) => s + syllables(w.w), 0)).filter(x => x > .08 && x < 1.2).sort((a, b) => a - b);
  return r.length ? r[Math.floor(r.length * .22)] : .3;
}
// strong measured onsets in lyric time: [[t, strength]], at least `gap` s apart (the stronger of two wins)
function accents(track, shift, floors = {low: .45, mid: .42, high: .6}, gap = .11) {
  const on = track.motion.onsets || {}, all = [];
  for (const band in floors) for (const o of on[band] || []) if (o[1] >= floors[band]) all.push([o[0] + shift, o[1]]);
  all.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const o of all) { const p = out[out.length - 1]; if (p && o[0] - p[0] < gap) { if (o[1] > p[1]) { p[0] = o[0]; p[1] = o[1]; } } else out.push([o[0], o[1]]); }
  return out;
}
function retime(L, rate) {
  const ws = L.words.filter(w => String(w.w).trim()), syl = ws.map(w => syllables(w.w)), total = syl.reduce((a, b) => a + b, 0);
  if (!ws.length) return ws;
  const span = Math.max(.3, Math.min(L.end - L.start - .04, total * rate * 1.08));
  let acc = 0;
  return ws.map((w, i) => { const s = L.start + span * acc / total; acc += syl[i]; return {w: w.w, s, e: L.start + span * acc / total}; });
}
// given word times: onto a strong onset within 40 ms (either way), never out of order
function tighten(words, acc) {
  let lo = 0, prev = -1e9;
  return words.map((w, i) => {
    let s = w.s, best = null;
    while (lo < acc.length && acc[lo][0] < s - .04) lo++;
    for (let k = lo; k < acc.length && acc[k][0] <= s + .04; k++) if (acc[k][1] >= .5 && acc[k][0] > prev + .05 && (!best || acc[k][1] > best[1])) best = acc[k];
    const nx = words[i + 1];
    if (best && (!nx || best[0] < nx.s - .04)) s = best[0];
    prev = s;
    return {...w, s, e: Math.max(w.e, s + .02)};
  });
}

export function compileScore(track, sig, opts = {}) {
  const LY = track.lyrics, seed = (track.vinyl?.seed || 7) >>> 0, grammar = opts.grammar || {}, mode = opts.mode || {}, shift = opts.shift || 0;
  if (!LY.length) return {lines: [], stanzas: [], paragraphs: 0, motifs: []};

  // measured energy of each line, overlap with measured high-energy phases and with NetEase's chorus windows
  const energy = LY.map(L => { let s = 0, c = 0; for (let t = L.start; t <= L.end; t += .1) { s += sig.level('rms', t - shift); c++; } return c ? s / c : 0; });
  const sorted = [...energy].sort((a, b) => a - b), pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const overlap = (L, wins) => { let o = 0; for (const [a, b] of wins) o += Math.max(0, Math.min(b, L.end - shift) - Math.max(a, L.start - shift)); return o / Math.max(.01, L.end - L.start); };
  const bursts = track.states.filter(s => s[2] === 'burst').map(s => [s[0], s[1]]);
  const neChorus = track.neChorus || [];
  const norm = s => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  const seen = {}; for (const L of LY) { const k = norm(L.text); if (k.length > 1) seen[k] = (seen[k] || 0) + 1; }
  const gaps = LY.slice(1).map((L, i) => L.start - LY[i].end).filter(g => g > .05).sort((a, b) => a - b);
  const thr = clamp((gaps[Math.floor(gaps.length / 2)] || 1) * 2.5, 1.5, 6);
  const rate = singingRate(LY), strong = accents(track, shift);

  const lines = [];
  let para = -1;
  LY.forEach((L, i) => {
    const burst = overlap(L, bursts), ne = overlap(L, neChorus), refrain = (seen[norm(L.text)] || 0) >= 2;
    const chorus = burst >= .5 || ne >= .5 || (refrain && energy[i] >= pct(.55));
    const mood = burst >= .5 || (chorus && energy[i] >= pct(.6)) ? 'loud' : energy[i] <= pct(.3) ? 'quiet' : 'neutral';
    if (!lines.length || L.start - LY[i - 1].end > thr || lines[i - 1].chorus !== chorus) para++;

    // units, with the spaces the text actually has
    const src = L.approx ? retime(L, rate) : tighten(L.words, strong);
    // punctuation that is timed as a word of its own is joined to its neighbour (closing marks to the word before,
    // opening marks to the word after)
    const words = [];
    let prefix = '';
    for (const w of src) {
      const raw = String(w.w), tx = raw.trim();
      if (!tx) continue;
      if (/^[\p{P}\p{S}]+$/u.test(tx)) {
        const p = words[words.length - 1];
        if (p && !/^[\p{Ps}\p{Pi}¿¡]+$/u.test(tx)) { p.w += tx; p.raw = p.raw.trimEnd() + tx + (/\s$/.test(raw) ? ' ' : ''); p.e = Math.max(p.e, w.e); }
        else prefix += tx;
        continue;
      }
      words.push({raw: prefix + raw, w: prefix + tx, s: w.s, e: Math.max(w.e, w.s + .02)}); prefix = '';
    }
    const units = [];
    words.forEach((w, wi) => {
      const us = unitsOf(w);
      const n = words[wi + 1], spaceAfter = !!n && (L.approx || /\s$/.test(w.raw) || /^\s/.test(n.raw) || (!isCJK(w.w[w.w.length - 1]) && !isCJK(n.w[0]))) && !(isCJK(w.w[w.w.length - 1]) && isCJK(n.w[0]));
      us.forEach((u, k) => units.push({...u, word: wi, space: k === us.length - 1 ? spaceAfter : false}));
    });
    while (units.length > 44) {                                      // very long lines: join the shortest neighbours
      let k = 0; for (let j = 1; j < units.length - 1; j++) if (units[j].e - units[j].s + units[j + 1].e - units[j + 1].s < units[k].e - units[k].s + units[k + 1].e - units[k + 1].s) k = j;
      const a = units[k], b = units[k + 1];
      units.splice(k, 2, {t: a.t + (a.space ? ' ' : '') + b.t, s: a.s, e: b.e, cjk: a.cjk && b.cjk, word: a.word, space: b.space});
    }
    const cjk = CJK.test(L.text);
    let text = '';
    units.forEach(u => { u.a = text.length; text += u.t; u.b = text.length; if (u.space) text += ' '; });
    for (const u of units) {
      const low = u.t.toLowerCase().replace(/[^a-z']/g, '');
      u.fn = u.cjk ? (cjk && /[぀-ゟ]/.test(u.t) ? FN_JA.has(u.t) : FN_ZH.has(u.t)) : FN_EN.has(low);
    }
    // size classes (function words small, content words varied); CJK varies per word, not per character
    for (const u of units) u.size = u.fn ? (u.cjk ? .7 : .62) : u.cjk ? .94 + .12 * hash(seed + i, u.word) : .85 + .35 * hash(seed + i * 7, u.word);
    const end = units.length ? Math.max(L.start + .3, Math.min(L.end, units[units.length - 1].e + (L.approx ? .25 : 0))) : L.end;
    lines.push({i, start: L.start, end: L.approx ? end : L.end, text, tr: L.tr, approx: L.approx, cjk, mood, chorus, refrain, para, energy: energy[i], units, heroWord: -1, images: []});
  });

  lines.forEach((L, i) => {
    const U = L.units, r = k => hash(seed + L.i * 13.1, k);
    // measured hero: the word held longest and loudest; line-timed: the longest content word (a typographic choice)
    let heroWord = -1;
    if (U.length > 2) {
      const byWord = {};
      for (const u of U) { const w = byWord[u.word] ||= {s: u.s, e: u.e, len: 0, fn: true}; w.e = u.e; w.len += u.t.length; w.fn = w.fn && u.fn; }
      let best = 0;
      for (const [k, w] of Object.entries(byWord)) {
        if (w.fn) continue;
        const v = L.approx ? w.len + .01 * +k : (w.e - w.s >= .3 ? Math.pow(w.e - w.s, .8) * (.5 + sig.level('rms', (w.s + w.e) / 2 - shift)) : 0);
        if (v > best) { best = v; heroWord = +k; }
      }
    }
    L.measuredHero = heroWord;

    // beats: the words of a line as they are sung one by one. A function word goes with the word it leads to; a
    // beat is at least a fifth of a second and at most four words
    const beats = [];
    let cur = null;
    U.forEach((u, k) => {
      const newWord = !k || U[k - 1].word !== u.word;
      if (!cur || (newWord && cur.done)) { cur = {k0: k, k1: k, s: u.s, e: u.e, content: false, n: 0, cj: 0, done: false}; beats.push(cur); }
      cur.k1 = k; cur.e = u.e; cur.content ||= !u.fn; if (u.cjk) cur.cj++; if (newWord) cur.n++;
      const d = cur.e - cur.s;
      cur.done = (cur.content && d >= .2 && (!cur.cj || cur.cj >= 2 || d >= .36)) || cur.n >= 4 || cur.cj >= 5;
    });
    if (beats.length > 1 && !beats[beats.length - 1].content) { const z = beats.pop(), y = beats[beats.length - 1]; y.k1 = z.k1; y.e = z.e; }
    beats.forEach((b, bi) => { for (let k = b.k0; k <= b.k1; k++) U[k].beat = bi; });
    L.beats = beats.map(b => ({k0: b.k0, k1: b.k1, s: U[b.k0].s, e: b.e}));
    const nB = beats.length, bd = beats.map((b, bi) => (beats[bi + 1]?.s ?? b.e) - b.s).sort((a, b) => a - b), medB = bd[Math.floor(bd.length / 2)] || 0, sure = L.approx ? 0 : 1;

    // composition (a genre grammar can reweight; the chorus has its own)
    const nWords = new Set(U.map(u => u.word)).size, chars = L.text.replace(/\s/g, '').length;
    // estimated set width in em (the real one needs the fonts): a row too long to stand on one baseline becomes steps
    const est = U.reduce((s, u) => s + (u.cjk ? 1 : .5 * u.t.length) * u.size + (u.space ? .3 : .05), 0), long = est > (L.cjk ? 17 : 23) && nWords >= 4;
    const prevL = lines[i - 1], dense = !!prevL && L.start - prevL.end < .6;
    const W = {row: long ? 0 : 1, steps: long ? 1 : 0, column: L.cjk && chars <= 12 && !U.some(u => !u.cjk && u.t.length > 1) ? .6 : 0, poster: heroWord >= 0 && nWords <= 4 ? .4 : 0,
      // word by word: one beat at a time on the same spot; each new beat in front while the last steps back; or the
      // beats standing all over the water, each there from its own note on (where the word times are only guessed,
      // a word that appears on a guessed note would show the guess: rarely)
      single: nB >= 2 && nB <= 9 && medB >= .24 ? .42 * sure * (nB <= 5 ? 1.3 : 1) : 0,
      relay: nB >= 3 && nB <= 8 && medB >= .28 ? .36 * sure : 0,
      scatter: nB >= 3 && nB <= 9 ? .38 * sure : 0};
    for (const k in grammar.layout || {}) W[k] = (W[k] || 0) * grammar.layout[k];
    for (const k in mode.layout || {}) W[k] = (W[k] || 0) * mode.layout[k];
    if (L.mood === 'quiet') { W.row *= 1.3; W.column *= 1.3; W.steps *= .8; }
    if (L.chorus) { W.poster = nWords <= 7 && chars <= 24 ? 2.2 * (grammar.posterK ?? 1) * (mode.layout?.poster ?? 1) : 0; W.steps *= 1.4; W.column *= .5; W.single *= 1.3; }
    else if (dense) { W.column *= .35; W.poster *= .35; W.single *= .6; W.relay *= .6; W.scatter *= .6; }   // lines sung back to back mostly stay rows of one stanza
    if (opts.layout && W[opts.layout] != null && (opts.layout !== 'single' && opts.layout !== 'relay' && opts.layout !== 'scatter' || nB >= 2 && !L.approx)) { for (const k in W) W[k] = k === opts.layout ? 1 : 0; }
    L.est = est;
    const last2 = lines.slice(Math.max(0, i - 2), i).map(x => x.layout);
    for (const k in W) if (last2.length === 2 && last2[0] === k && last2[1] === k) W[k] = 0;
    let tot = 0; for (const k in W) tot += Math.max(0, W[k]);
    let q = r(1) * tot; L.layout = 'row';
    for (const k in W) { q -= Math.max(0, W[k]); if (q <= 0 && W[k] > 0) { L.layout = k; break; } }

    // slices: 2–4 words or ~2 s; a slice arrives together, just before it is sung
    const slices = [];
    let k0 = 0, weight = 0;
    U.forEach((u, k) => {
      weight += u.cjk ? .34 : 1;
      const dur = u.e - U[k0].s, lastU = k === U.length - 1, wordEnd = lastU || U[k + 1].word !== u.word;
      if (lastU || (wordEnd && (weight >= 4 || dur >= 2.2 || (weight >= 2 && dur >= 1.1)))) { slices.push({k0, k1: k, start: U[k0].s}); k0 = k + 1; weight = 0; }
    });
    if (slices.length > 1) { const z = slices[slices.length - 1], y = slices[slices.length - 2]; if (U[z.k1].e - U[z.k0].s < .6) { y.k1 = z.k1; slices.pop(); } }
    if (slices.length) slices[0].start = L.start;
    L.slices = slices;
    slices.forEach((s, si) => { for (let k = s.k0; k <= s.k1; k++) U[k].slice = si; });
    // entrances: one per word, neighbours never alike (step coprime with the set size)
    const set = L.mood === 'quiet' ? SOFT : L.mood === 'loud' || L.chorus ? HARD : ENTRANCES.slice(0, 6), n = set.length, step = n === 4 ? 3 : n === 5 ? 2 : 5;
    const base = Math.floor(r(2) * n);
    let wordIdx = -1, kk = -1;
    U.forEach(u => { if (u.word !== wordIdx) { wordIdx = u.word; kk++; } u.enter = set[(base + kk * step) % n]; u.k = kk; });
    L.seed = r(5);
    L.rows = L.layout === 'steps' ? (est > 42 ? 3 : 2) : 1;
    L.beatIn = BEAT_IN[Math.floor(r(7) * BEAT_IN.length)]; L.beatOut = BEAT_OUT[Math.floor(r(8) * BEAT_OUT.length)];
    // what the music does on each word: how hard its note is struck, and whether the sound is bright or dark there
    // Where the word times are only guessed, no word is struck on its guess: the light passes through the line
    // softly (each word turns over `soft` s either side of its guess), and what strikes are the measured onsets of
    // the music itself, each given to the word the light is on at that moment. The line's own start is given.
    if (L.approx && U.length) {
      const gap = U.length > 1 ? (U[U.length - 1].s - U[0].s) / (U.length - 1) : .4, w = L.soft = clamp(.8 * gap, .2, .42);
      for (const u of U) u.hits = [];
      let k0 = 0; while (k0 < strong.length && strong[k0][0] < L.start - .08) k0++;
      const first = strong[k0] && strong[k0][0] <= L.start + .08 ? strong[k0][0] : L.start;
      U[0].hits.push([first, 1]);
      for (let k = k0; k < strong.length && strong[k][0] <= U[U.length - 1].e + .12; k++) {
        const [t, s] = strong[k]; if (t < first + .16) continue;
        let j = 0; while (j + 1 < U.length && U[j + 1].s - .4 * w <= t) j++;
        const h = U[j].hits; if (h.length < 2 && (!h.length || t - h[h.length - 1][0] > .2)) h.push([t, .55 + .45 * s]);
      }
    }
    for (const u of U) {
      const ts = u.s - shift + .06;
      u.acc = L.approx ? .5 : clamp(Math.max(sig.pulse('mid', ts, .06), sig.pulse('high', ts, .06), .8 * sig.pulse('low', ts, .06)));
      u.br = clamp(.5 + 1.2 * (sig.level('high', ts) - sig.level('low', ts)));
    }
  });
  // stanzas: up to three one-row lines sung without a pause. A line with a composition of its own (rows, pillars,
  // a poster) stands alone.
  const stanzas = [];
  lines.forEach((L, i) => {
    const pv = lines[i - 1], S = stanzas[stanzas.length - 1], solo = L.layout !== 'row';
    if (!S || solo || S.solo || L.start - pv.end > .9 || L.para !== pv.para || S.lines.length >= 3) stanzas.push({i: stanzas.length, lines: [i], start: L.start, end: L.end, solo});
    else { S.lines.push(i); S.end = L.end; }
  });
  // pages: some paragraphs are laid on the water and read from straight above (shots.js, lyric.js). Only where
  // there is a breath before (to go up) and after (to come down again), never two paragraphs running, rather the
  // quiet ones than the chorus
  const paras = [];
  for (const S of stanzas) (paras[lines[S.lines[0]].para] ||= []).push(S);
  // (an MV on the horizon is not seen from above: far fewer pages in MV mode)
  const planK = opts.plan === 'none' ? 0 : opts.plan === 'all' ? 9 : (mode.planK ?? .5) * (opts.mv ? .35 : 1), elig = [];
  paras.forEach((SS0, p) => {
    if (!SS0 || !p) return;
    // a page is a few stanzas, not a whole long paragraph: the eye goes up, reads, and comes down again
    const span = (j0, j1) => { const S1 = SS0[j1]; return lines[S1.lines[S1.lines.length - 1]].end - lines[SS0[j0].lines[0]].start; };
    let j0 = 0, j1 = SS0.length - 1;
    if (span(j0, j1) > 15) {
      j0 = j1 = Math.min(SS0.length - 1, Math.floor(hash(seed + p * 5.1, 73) * SS0.length));
      while (j1 + 1 < SS0.length && span(j0, j1 + 1) <= 14) j1++;
      while (j0 > 0 && span(j0 - 1, j1) <= 14) j0--;
    }
    const SS = SS0.slice(j0, j1 + 1);
    const first = lines[SS[0].lines[0]], lastS = SS[SS.length - 1], last = lines[lastS.lines[lastS.lines.length - 1]], pvL = lines[first.i - 1], nxL = lines[last.i + 1];
    const endOf = L => (L.units.length ? L.units[L.units.length - 1].e : L.end), before = pvL ? first.start - endOf(pvL) : 9, after = nxL ? nxL.start - endOf(last) : 9, dur = last.end - first.start;
    // (where the breath is too short to climb or come down, the picture blinks: shots.js)
    if (dur < 4 || dur > 42) return;
    const calm = SS.every(S => lines[S.lines[0]].mood !== 'loud'), tight = before < .55 || after < .55;
    elig.push({p, SS, dur, k: planK * (first.chorus ? .5 : calm ? 1.4 : 1) * (tight ? .6 : 1), u: hash(seed + p * 3.3, 71)});
  });
  // (a page is a change of view: at most about a quarter of what is sung)
  const sung = lines.reduce((a, L) => a + L.end - L.start, 0) + lines.length * .6, cap = opts.plan === 'all' ? 1e9 : .36 * sung * (opts.mv ? .3 : 1);
  let lastPlan = -9, acc = 0;
  for (const e of elig) if (e.u < e.k && e.p - lastPlan > 1 && (!acc || acc + e.dur <= cap)) { e.on = true; lastPlan = e.p; acc += e.dur; }
  if (planK > 0 && elig.length && !elig.some(e => e.on)) elig.reduce((a, e) => (e.k - e.u > a.k - a.u ? e : a)).on = true;
  for (const e of elig) if (e.on) for (const S of e.SS) { S.plan = true; for (const li of S.lines) lines[li].plan = true; }
  let lastExit = null;
  for (const S of stanzas) {
    const r = k => hash(seed + S.i * 7.7, k), first = lines[S.lines[0]];
    const ew = S.plan ? {...PAGE_EXITS} : {...EXITS};
    if (!S.plan) {
      if (first.chorus) { ew.part *= 1.6; ew.lift *= 1.5; ew.melt *= 1.3; }
      if (first.mood === 'quiet') { ew.sink *= 1.4; ew.recede *= 1.5; ew.blow *= .5; ew.melt *= .6; }
      if (first.layout === 'column') { ew.blow = 0; ew.part = 0; ew.shut *= .5; }
      for (const k in mode.exit || {}) if (ew[k] != null) ew[k] *= mode.exit[k];
      for (const k in opts.style?.exit || {}) if (ew[k] != null) ew[k] *= opts.style.exit[k];
    }
    if (lastExit in ew) ew[lastExit] *= .12;
    S.exit = lastExit = pick(ew, r(1));
    S.align = ['left', 'diag', 'center', 'left'][Math.floor(r(2) * 4)];
    S.lines.forEach((li, k) => { const L = lines[li]; L.st = S.i; L.stK = k; L.exit = S.exit; L.last = k === S.lines.length - 1; });
  }
  const score = {lines, stanzas, paragraphs: para + 1, motifs: []};
  applySense(score, null);
  return score;
}

// tone → the pair of typefaces a line is set in (waiting → sung); see lyric.js
function typeOf(L) {
  const loudLayout = L.layout === 'poster' || L.layout === 'steps';
  switch (L.tone) {
    case 'tender': case 'calm': case 'wistful': return 'whisper';
    case 'bright': return 'wire';
    case 'euphoric': return loudLayout && L.chorus ? 'mass' : 'wire';
    case 'tense': case 'defiant': case 'dark': return L.seed < .35 && !L.chorus ? 'wire' : 'outline';
    default: return 'wire';
  }
}

// find a phrase in a line (case-insensitive; if the spacing differs, ignoring whitespace): [a, b] or null
function locate(text, needle) {
  const T = text.toLowerCase(), N = String(needle || '').toLowerCase().trim();
  if (!N) return null;
  const i = T.indexOf(N);
  if (i >= 0) return [i, i + N.length];
  const map = [], t2 = [...T].filter((ch, k) => { if (/\s/.test(ch)) return false; map.push(k); return true; }).join(''), n2 = N.replace(/\s/g, ''), j = n2 ? t2.indexOf(n2) : -1;
  return j >= 0 ? [map[j], map[j + n2.length - 1] + 1] : null;
}

// The words' meaning onto the score: images, the expressive word, tone. `sense` is the model's reading
// (service/sense.mjs: {mood, motifs, colors, lines: [{k: [{text, image}], hero, tone}]}) or null (local lexicon).
export function applySense(score, sense) {
  if (!score.lines.length) return score;
  score.lines.forEach((L, i) => {
    const R = sense?.lines?.[i];
    // images: the model's reading; a line it passed over still gets what the lexicon finds in it
    let hits = R ? R.k.map(k => { const ab = locate(L.text, k.text); return ab && {a: ab[0], b: ab[1], img: k.image}; }).filter(Boolean) : [];
    if (!hits.length) hits = findImages(L.text).slice(0, R ? 1 : 9);
    L.images = [...new Set(hits.map(h => h.img))];
    L.imageAt = hits.map(h => ({img: h.img, units: L.units.map((u, k) => (u.a < h.b && u.b > h.a ? k : -1)).filter(k => k >= 0)})).filter(h => h.units.length);
    for (const u of L.units) { u.img = null; u.imgColor = null; u.hero = false; u.fx = null; }
    for (const h of hits) for (const u of L.units) if (u.a < h.b && u.b > h.a) { u.img = h.img; u.imgColor = h.color || sense?.colors?.[h.img] || null; }
    // hero: the model's expressive word; else the measured one (held longest and loudest); else the image word
    const hr = R?.hero ? locate(L.text, R.hero) : null, chars = L.text.replace(/\s/g, '').length;
    let heroUnits = hr ? L.units.filter(u => u.a < hr[1] && u.b > hr[0]) : [];
    if (heroUnits.length && heroUnits.reduce((s, u) => s + u.t.length, 0) > Math.max(1, chars * .6)) heroUnits = [];
    if (!heroUnits.length && L.units.length > 2) {
      const imgWord = L.units.find(u => u.img && !u.fn), w = L.measuredHero >= 0 && !L.approx ? L.measuredHero : imgWord ? imgWord.word : L.measuredHero;
      heroUnits = L.units.filter(u => u.word === w);
    }
    if (heroUnits.length < L.units.length) for (const u of heroUnits) u.hero = true;
    const hk = L.units.map((u, k) => (u.hero ? k : -1)).filter(k => k >= 0);
    L.heroWord = hk.length ? L.units[hk[0]].word : -1;
    if (L.layout === 'poster' && !hk.length) L.layout = 'row';
    // what a word does (lyric.js): the model's reading when there is one, else the lexicon; at most two words of a
    // line make a gesture, never a function word, and a long held note without one sways
    let gh = (R?.g || []).map(g => { const ab = locate(L.text, g.text); return ab && {a: ab[0], b: ab[1], g: g.gesture}; }).filter(Boolean);
    // the lexicon is eager (it knows words, not what they mean here): one word, and not in two lines running
    if (!gh.length && !(i && score.lines[i - 1].units.some(u => u.fx))) gh = findGestures(L.text).filter(h => L.units.some(u => u.a < h.b && u.b > h.a && !u.fn && (u.hero || u.e - u.s >= .22))).slice(0, 1);
    let nG = 0;
    for (const h of gh) { const us = L.units.filter(u => u.a < h.b && u.b > h.a && !u.fn); if (!us.length || nG >= 2) continue; nG++; for (const u of us) u.fx = h.g; }
    if (!L.approx) for (const u of L.units) if (!u.fx && !u.fn && u.e - u.s >= 1.25 && nG < 2) { u.fx = 'sway'; nG++; }   // (lyric.js: a held swell, not a sway)
    L.tone = R?.tone || (L.mood === 'quiet' ? 'calm' : L.chorus ? (L.mood === 'loud' ? 'euphoric' : 'bright') : L.mood === 'loud' ? 'tense' : 'tender');
    L.type = typeOf(L);
  });
  if (sense) score.motifs = sense.motifs || [];
  else { const c = {}; for (const L of score.lines) for (const im of L.images) c[im] = (c[im] || 0) + 1; score.motifs = Object.entries(c).sort((a, b) => b[1] - a[1]).filter(([, n], i) => n >= 2 || i < 2).slice(0, 4).map(([k]) => k); }
  score.senseSource = sense?.source || 'lexicon'; score.mood = sense?.mood || null; score.colors = sense?.colors || {};
  return score;
}
