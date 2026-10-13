// Song data for the prototype. Every source produces the SAME track object, so the player never asks where a
// song came from:
//   library  — files written by tools/spectra.py + tools/motion.mjs (window.LIBRARY, /l/tracks/<id>/…)
//   online   — the local service: NetEase (/api/ne/…), QQ Music (/api/qq/…), Kugou (/api/kg/…): metadata, lyrics,
//              tags; audio is decoded and measured in the browser by the same analysis code the library uses.
// Nothing here invents data: genre tags are catalogue classifications, lyric times are candidates.
import {paletteFromImage, focusPoints} from './palette.js';
import {schedule} from './analysis-structure.js';
import {classifyNetEase} from './catalog.js';

// RyanMusic has no /l library index. Library loaders stay unused; the stage reads a track built in host.ts.
const LIB = globalThis.LIBRARY || {manifest: {}, optics: {styles: {}}, tracks: {}};
const BASE = '/l/';

export const hex2rgb = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255);
const s2l = c => (c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
export const lin = h => hex2rgb(h).map(s2l);                       // '#rrggbb' → linear rgb for shaders
export const mixHex = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, '0')).join(''); };
export const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`; };
export const pad2 = n => String(n).padStart(2, '0');
export const fmt = (s, cs = true) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return pad2(m) + ':' + (cs ? r.toFixed(2).padStart(5, '0') : pad2(Math.floor(r))); };
export const CJK = /[぀-ヿ㐀-鿿＀-￯]/;

export const manifest = LIB.manifest;
export const optics = LIB.optics.styles;
const artistOf = a => String(a || '').replace(/^塞壬唱片-MSR\//, '');

export function libraryList() {
  return Object.values(LIB.tracks).map(r => r.meta).sort((a, b) => a.slot - b.slot).map(m => ({
    key: 'lib:' + m.id, source: 'library', id: m.id, slot: m.slot, title: m.title, artist: artistOf(m.artist), album: m.album,
    duration: LIB.tracks[m.id].analysis.duration, optic: m.optic?.style || 'spectra', genre: m.genres?.primary || null,
    classification: m.classification || null, catalogGenre: m.classification?.catalogPrimary || null,
    pressing: m.vinyl?.pressing || 'clear', seed: m.vinyl?.seed || 1, grain: LIB.tracks[m.id].lyrics.grain,
    thumb: BASE + `tracks/${m.id}/cover-512.jpg`, emit: LIB.tracks[m.id].palette?.emit || '#A8D2E6',
    deep: LIB.tracks[m.id].palette?.deep || '#345260', neteaseId: m.netease?.id || null,
  }));
}

// A second hue for every song: the most chromatic cluster far from the accent's hue, else the ramp's low end.
function secondHue(pal) {
  const cl = pal.clusters || [];
  if (!cl.length) return pal.ramp[0];
  const acc = cl.reduce((a, c) => (c.C * Math.sqrt(c.weight) > a.C * Math.sqrt(a.weight) ? c : a), cl[0]);
  let best = null;
  for (const c of cl) {
    const dh = Math.abs(((c.h - acc.h + 540) % 360) - 180);
    if (dh > 50 && c.C > .045 && (!best || c.C * Math.sqrt(c.weight) > best.C * Math.sqrt(best.weight))) best = c;
  }
  return best ? best.hex : pal.ramp[0];
}

const loadImage = (src, cross = false, signal = null) => new Promise((res, rej) => {
  const i = new Image(); if (cross) i.crossOrigin = 'anonymous';
  const off = () => { i.onload = i.onerror = null; signal?.removeEventListener('abort', abort); };
  const abort = () => { off(); i.src = ''; rej(signal.reason || new DOMException('image loading cancelled', 'AbortError')); };
  i.onload = () => { off(); res(i); }; i.onerror = () => { off(); rej(new Error('image ' + src)); };
  if (signal?.aborted) return abort();
  signal?.addEventListener('abort', abort, {once: true}); i.src = src;
});

// Words for a line. Word-timed songs keep their own times. Line-timed songs share the line's duration out by
// word length; `approx` marks them so the instrument never claims word sync.
function wordsOf(line) {
  if (line.words && line.words.length) return {approx: false, words: line.words.map(w => ({w: w.w, s: w.s ?? w.start, e: w.e ?? w.end}))};
  const text = line.text.trim(), parts = CJK.test(text) && !/\s/.test(text) ? [...text] : text.split(/\s+/);
  const tot = parts.reduce((s, p) => s + p.length + 1.5, 0), span = line.end - line.start;
  let acc = 0;
  return {approx: true, words: parts.map(p => { const s = line.start + span * acc / tot; acc += p.length + 1.5; return {w: p, s, e: line.start + span * acc / tot}; })};
}
const shapeLyrics = lines => lines.filter(l => l.text && l.end > l.start).map((l, i) => ({i, start: l.start, end: l.end, text: l.text, tr: l.tr || null, ...wordsOf(l)}));

function finish(t) {
  t.pal = {...t.pal, second: secondHue(t.pal)};
  t.focus = focusPoints(t.thumb);
  t.opticDef = optics[t.optic] || optics.spectra;      // catalogue-tag style record (name, family); not used to draw
  return t;
}

const cache = new Map(), KEEP = 4;                               // opened songs kept in memory (audio of online songs included)
export function loadTrack(key, onStage = () => {}, {onLyrics = null} = {}) {
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  while (cache.size >= KEEP) {
    const k = cache.keys().next().value, old = cache.get(k); cache.delete(k);
    old.then(t => t.release?.()).catch(() => {});
  }
  const pf = /^(ne|qq|kg):(.+)$/.exec(key);
  const pending = (pf ? loadOnline(pf[1], pf[2], onStage, onLyrics) : loadLibrary(key.slice(4), onStage)).catch(e => {
    if (cache.get(key) === pending) cache.delete(key);
    throw e;
  });
  cache.set(key, pending);
  return pending;
}

async function loadLibrary(id, onStage) {
  const r = LIB.tracks[id], m = r.meta, dir = BASE + `tracks/${id}/`;
  onStage('reading the library record', .2);
  // The shelf index contains exactly the measurements needed before playback.
  // Read the full original analysis only for an opened song; loadTrack shares
  // concurrent reads and keeps it in the existing four-song cache.
  const analysis = LIB.indexVersion === 1 ? fetch(dir + 'analysis.json').then(x => {
    if (!x.ok) throw new Error('library analysis ' + x.status);
    return x.json();
  }) : Promise.resolve(r.analysis);
  const [mj, mb, wb, cover, thumb, an] = await Promise.all([
    fetch(dir + 'motion.json').then(x => x.json()), fetch(dir + 'motion.bin').then(x => x.arrayBuffer()), fetch(dir + 'wave.bin').then(x => x.arrayBuffer()),
    loadImage(dir + 'cover.jpg'), loadImage(dir + 'cover-512.jpg'), analysis,
  ]);
  onStage('ready', 1);
  return finish({
    key: 'lib:' + id, source: 'library', id, slot: m.slot, title: m.title, artist: artistOf(m.artist), album: m.album,
    duration: mj.duration, audioSrc: dir + m.audio.file, trial: null,
    optic: m.optic?.style || 'spectra', opticSource: m.optic?.source || 'fallback', genre: m.genres?.primary || null,
    classification: m.classification || null, catalogGenre: m.classification?.catalogPrimary || null,
    vinyl: m.vinyl || {pressing: 'clear', seed: 1},
    states: an.states, phases: an.phases, env: an.env, spec: an.spec,
    lyrics: shapeLyrics(r.lyrics.lines), grain: r.lyrics.grain, verified: !!r.lyrics.verified, lyricSource: 'library',
    pal: r.palette, motion: {...mj, data: new Uint8Array(mb)}, wave: new Int8Array(wb),
    cover, thumb, thumbUrl: dir + 'cover-512.jpg',
  });
}

// ---- online: NetEase, QQ Music, Kugou ------------------------------------------------------------
const apiOf = p => async (path, signal = null, method = 'GET') => {
  const r = await fetch(`/api/${p}/` + path, {method, ...(signal ? {signal} : {})}); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) { const e = new Error(j.detail || j.error || `service error ${r.status}`); e.code = j.reason || null; e.provider = p; throw e; }
  return j;
};
const api = apiOf('ne');
const SOURCE = {ne: 'netease', qq: 'qq', kg: 'kugou'};
export const netease = {
  status: () => api('status'), qrStart: () => api('qr/start', null, 'POST'), qrCheck: key => api('qr/check?key=' + encodeURIComponent(key), null, 'POST'), logout: () => api('logout', null, 'POST'),
  search: (q, limit = 24) => api(`search?q=${encodeURIComponent(q)}&limit=${limit}`), playlists: () => api('playlists'), playlist: id => api('playlist?id=' + id),
};

// Cached catalogue facts can label saved playlist songs before their audio is loaded.
// They never overwrite genre, neStyles or optic, which select the existing performance.
let catalogIndex = null, catalogRequest = null;
export const loadCatalogIndex = () => catalogIndex ? Promise.resolve(catalogIndex) : (catalogRequest ||= fetch(BASE + 'tag-index.json')
  .then(r => { if (!r.ok) throw new Error('catalogue index ' + r.status); return r.json(); })
  .then(j => (catalogIndex = new Map((j.records || []).map(r => [r.key, r.classification]))))
  .finally(() => { catalogRequest = null; }));

let styleMap = null, styleRequest = null, opticData = null, opticRequest = null;
const styles = () => styleMap ? Promise.resolve(styleMap) : (styleRequest ||= fetch(BASE + 'netease-styles.json').then(r => r.json()).then(j => (styleMap = j.map)).finally(() => { styleRequest = null; }));
const opticTable = () => opticData ? Promise.resolve(opticData) : (opticRequest ||= fetch(BASE + 'optics.json').then(r => r.json()).then(j => (opticData = j)).finally(() => { opticRequest = null; }));
// The platform's style names ("嘻哈说唱-爵士嘻哈") → our tags → the same scoring the pipeline uses.
async function assignOptic(styleNames) {
  const map = await styles(), table = await opticTable(), tags = [];
  for (const name of styleNames) for (const part of name.split('-').reverse()) { const t = map[part.trim()]; if (t && !tags.includes(t)) { tags.push(t); break; } }
  const score = {};
  for (const tag of tags) for (const [k, st] of Object.entries(table.styles)) if (st.tags[tag]) score[k] = (score[k] || 0) + st.tags[tag];
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return {optic: best ? best[0] : table.fallback, tags, source: best ? 'netease-tags' : 'fallback', needsReview: !best};
}

// a song with no cover from its platform: a plain night square (the palette reads it as a neutral)
function plainCover(n) { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.fillStyle = '#2E3236'; x.fillRect(0, 0, n, n); x.fillStyle = '#5A6066'; x.fillRect(n * .1, n * .1, n * .8, n * .8); return c; }
function seedOf(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export async function decode22k(buf) {
  const AC = window.AudioContext || window.webkitAudioContext, tmp = new AC();
  let audio;
  try { audio = await tmp.decodeAudioData(buf); } finally { tmp.close(); }
  const off = new OfflineAudioContext(2, Math.ceil(audio.duration * 22050), 22050), src = off.createBufferSource();
  src.buffer = audio; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return [out.getChannelData(0).slice(), (out.numberOfChannels > 1 ? out.getChannelData(1) : out.getChannelData(0)).slice()];
}
export function analyseInWorker() {
  // The analysis worker is not part of this stage port. MV audio analysis is unused here.
  return Promise.reject(new Error('analysis worker is not included'));
}

// The three platforms answer in the same shape (the service's contract); only NetEase's cover URLs take a size.
// A Kugou preview arrives with the platform's window and no trusted length: its length is the decoded audio's,
// and nothing is shifted (the clip's place in the song is not confirmed).
async function loadOnline(p, id, onStage, onLyrics) {
  const api = apiOf(p), key = `${p}:${id}`;
  onStage('asking the platform for the song', .03);
  const info = await api('song?id=' + encodeURIComponent(id));
  if (!info.stream?.ok) { const e = new Error(info.stream?.reason || info.reason || 'not playable'); e.code = info.stream?.reason || 'not-playable'; e.provider = p; e.info = info; throw e; }
  // All these inputs are independent after the song response. Keep their exact materials and
  // calculations, but do not make a slow cover or catalogue response hold up audio transfer.
  const controller = new AbortController(), {signal} = controller;
  let blobUrl = null, progress = .03;
  const status = (message, amount) => { if (!signal.aborted && amount >= progress) { progress = amount; onStage(message, amount); } };
  const check = () => { if (signal.aborted) throw signal.reason || new DOMException('track loading cancelled', 'AbortError'); };
  const img = u => '/img?u=' + encodeURIComponent(u), big = p === 'ne' ? img(info.cover + '?param=1600y1600') : img(info.cover), small = p === 'ne' ? img(info.cover + '?param=512y512') : img(info.cover);
  try {
  const lyricRequest = api(`lyrics?id=${encodeURIComponent(id)}&duration=${info.duration || ''}`, signal).catch(() => ({grain: 'none', lines: []})).then(ly => {
    check(); const lyrics = shapeLyrics(ly.lines || []);
    // A preparation hook must not turn optional interpretation into a song-loading failure.
    if (onLyrics && lyrics.length) { try { Promise.resolve(onLyrics(key, lyrics)).catch(() => {}); } catch {} }
    return {ly, lyrics};
  });
  const aboutRequest = api('about?id=' + encodeURIComponent(id), signal).catch(() => ({styles: [], chorus: []}));
  const tablesRequest = Promise.all([styles(), opticTable()]);
  status('loading the cover', .1);
  const coverRequest = info.cover ? Promise.all([loadImage(big, false, signal), loadImage(small, false, signal)]) : Promise.resolve([plainCover(1024), plainCover(512)]);
  const musicRequest = (async () => {
    status('fetching the audio', .16);
    const buf = await fetch(info.stream.src, {signal}).then(r => { if (!r.ok) throw new Error('stream ' + r.status); return r.arrayBuffer(); });
    check(); status('decoding', .3);
    const [L, R] = await decode22k(buf.slice(0));
    check(); status('measuring the music', .38);
    const an = await analyseInWorker(L, R, p => status('measuring the music', .38 + p * .6), signal);
    return {buf, an};
  })();
  const [{ly, lyrics}, about, [map, table], [cover, thumb], {buf, an}] = await Promise.all([lyricRequest, aboutRequest, tablesRequest, coverRequest, musicRequest]);
  const pal = paletteFromImage(thumb);
  const {data, wave, ...mj} = an;
  const op = await assignOptic(about.styles || []);
  const classification = classifyNetEase(about, map, table);
  // a preview clip is shorter than the catalogue duration: say so instead of passing it off as the song
  const trial = info.stream.trial || (info.duration && info.duration - an.duration > 8 ? {start: 0, end: an.duration} : null);
  // Allocate the playback URL only after every required input has succeeded. A failed parallel
  // branch cannot leave a late-created URL behind after the load promise has already rejected.
  blobUrl = URL.createObjectURL(new Blob([buf], {type: info.stream.type === 'flac' ? 'audio/flac' : 'audio/mpeg'}));
  status('ready', 1);
  return finish({
    key, source: SOURCE[p], provider: p, id: String(id), slot: null, title: info.title, artist: info.artist, album: info.album,
    duration: an.duration, catalogueDuration: info.duration || null, audioSrc: blobUrl, release: () => URL.revokeObjectURL(blobUrl), trial, bitrate: info.stream.bitrate || (info.stream.level ? info.stream.level * 1000 : 0), level: info.stream.level,
    optic: op.optic, opticSource: op.source, opticReview: op.needsReview, genre: op.tags[0] || (about.styles || [])[0] || null, neStyles: about.styles || [], neChorus: about.chorus || [],
    classification, catalogGenre: classification.catalogPrimary,
    vinyl: {pressing: (optics[op.optic] || optics.spectra).pressing, seed: seedOf(p + id)},
    states: schedule(an.duration, an.phases, lyrics), phases: an.phases, env: an.env, spec: an.spec,
    lyrics, grain: ly.grain || 'none', verified: false, lyricSource: SOURCE[p], translated: !!ly.translated,
    pal, motion: {...mj, data}, wave, cover, thumb, thumbUrl: info.cover ? small : '',
  });
  } catch (e) { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); throw e; }
}
