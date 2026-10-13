// Portions of camera/typographic rules adapted from Folia by chthollyphile and contributors.
// Upstream: https://github.com/chthollyphile/folia-major/blob/1f2c32a5d91afd1446a9ca8e7d4305ca6f9f22ed/src/components/visualizer/diorama/cameraPath.ts
// See THIRD_PARTY_NOTICES.md and licenses/AGPL-3.0.txt.
// The lake and the camera that reads it.
//
// The lake is a place, not a road. Its surface (WATER_Y) is the baseline of everything: type, the music's own
// figures, drawings and the cover disc all stand on it or lie on it. At its middle the song's record lies for the
// title (title.js), stands up, and goes up to be the song's moon: a fixed light in one quarter of the sky, by which
// every turn of the camera can be felt. Around the middle the song's stanzas (score.js) stand, each somewhere else
// on the water and facing another way; none of them is there before its time (lyric.js lets it arrive).
//
// Flat and deep. The same lake is seen as a flat sheet and as a space, and the two take turns:
//   plan     from straight above: the water is a page, type lies on it (a stanza: score.js decides which; the title's
//            label; a figure of the music that is flat by nature)
//   flat     from far off through a long lens: everything lies on one plane, the water a band, the sky a backdrop,
//            type and its reflection one figure
//   deep     from close by through a wide lens: the lake opens up in depth, near things slide against far ones
// Between two of them the camera travels and its lens changes with it (what is read keeps its size while the
// space behind it closes or opens); up to a page and down from one the eye tilts; where the breath is too short
// for either, the picture blinks: it shuts on the waterline and opens on the next baseline (stage.js draws it).
// Never three stanzas running the same way.
//
// The outline of a whole song is one of six modes (genre.js: lake, orbit, strike, still, screen, flow); a mode is a
// taste among the ways below, and two of them have a way of their own:
//                         ring     (orbit) the next stanza stands further round a circle about the middle; the
//                                  camera travels round outside it
//                         cut      (strike) no move: the picture cuts on the beat to the far side or elsewhere
// Getting to a stanza    turn     the camera turns where it stands (a few steps of drift, so near things slide
//  (one way per breath,           against far ones); the further, the more time it has
//   never the same twice  cross    it travels sideways along the water to a panel angled toward it
//   running)              retreat  the last stanza has gone under; the next comes up nearer and the camera steps back
//                         flap     no move at all: on the spot the last line falls back and the next stands up
//                         over     a breath of 2–8 s is spent in the air: up over the lake, across, and down
//                                  somewhere else, never arriving along the line of sight
//                         rise     up over a page; pan: from page to page; surface: down again to the water
//                         blink    (a page, and too short a breath to climb or come down)
// Inside a stanza         flap     its lines replace one another on the spot
//  (lines sung without    screen   they unfold like the panels of a folding screen; the camera turns with them
//   a breath)             para     they build toward the viewer as a paragraph; the camera steps back and rises
//                         page     rows down a page
// While a stanza is sung  one composed move from a vocabulary of 13 (orbit, arc, push, crane…), chosen from what the
//                         stanza is and how it is seen, never the move of either stanza before
// Where nothing is sung   the stretch is cut into passages (at the song's measured sections); each passage is one
//                         scene of the music (figure.js), read in one to four views in turn, flat and deep
// The title               the record seen from above, lying on the lake like a label on a sheet; the camera comes
//                         down as it stands up; its own lens (long, widening)
//
// Being on time: a move lasts as long as the way and the turn between its two poses ask (on average the view turns
// no faster than 46°/s; 69°/s when the singing leaves no time) and lands 40 ms before the first note.
// The camera follows its target with a critically damped spring fed the target a moment ahead; one rotation
// low-pass is the only writer of its orientation; the horizon stays level. No audio input.
// The follower is stateful; after a seek it is warmed up over the 3 s before, so stills, seeks and playback agree.
import * as THREE from 'three';
import {ZS} from './score.js';
import {MODES} from './genre.js';
import {FIG, figureFor} from './figure.js';
const FORCE_FIG = new URLSearchParams(globalThis.location?.search || '').get('fig');   // (?fig=stroke: every passage that scene, to look at it)

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const ease3 = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const ease5 = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// weighted choice; u in [0, 1)
function pick(wt, u) { let tot = 0; for (const k in wt) tot += Math.max(0, wt[k]); let q = u * tot, last = null; for (const k in wt) { if (wt[k] <= 0) continue; last = k; q -= wt[k]; if (q <= 0) return k; } return last; }

export const KINDS = ['hold', 'pushIn', 'pullBack', 'orbit', 'track', 'crane', 'swell', 'spiral', 'pendulum', 'flyby', 'arc', 'float', 'glide'];
export const WATER_Y = -1.05;
export const PHRASE = {w: 6.6, h: 1.5, rowH: 1.5, z0: -1.15, z1: 1.15, rows: []};
export const DISC = 2;                                             // radius of the cover disc
export const LABEL = 1.7;                                          // the record's rings reach this far (disc radii)
export const MOON = {dist: 95, el: .15, half: .062};               // aloft: distance from the eye, elevation and angular radius (rad)
export const HOVER = DISC * 1.22;                                  // standing, the record hangs this high over the water (its centre): never in it
// How far the record has stood up (st: 0 lying, 1 standing) and how high its centre is over the water at t. From the
// sheet it lifts off the water first (its reflection parts from it), then turns up toward the eye while it rises, its
// lowest edge always clear of the water; a record that is not first seen lying is there already, hanging over it.
export function standOf(T, t) {
  if (!T.plan) return {st: 1, y: HOVER * (.86 + .14 * (1 - Math.pow(1 - clamp((t - T.a) / 1.6), 3)))};
  const D = T.s1 - T.s0, u = clamp((t - (T.s0 + .12 * D)) / (.88 * D)), st = ease3((u - .12) / .88);
  return {st, y: Math.max(.014 + (HOVER - .014) * ease(u / .78), DISC * 1.19 * Math.sin(st * Math.PI / 2) + .03)};
}
export const ENTRY_OF = {label: 1, drop: 1, turn: 1, scan: 1, stamp: 1, reflect: 1, develop: 1};
const ENTRY_BY_STYLE = {anime: 'label', rock: 'drop', pop: 'turn', electro: 'scan', hiphop: 'stamp', soft: 'reflect', indie: 'develop'};
const FORCE_ENTRY = new URLSearchParams(globalThis.location?.search || '').get('entry');   // (?entry=drop: look at another entrance)
export const LENS = {plan: .8, flat: .62, mid: 1, deep: 1.26};     // a view's lens: its angle of view over the song's own
const TITLE_LAY = {w: DISC * 3.3, h: DISC * 1.7, rowH: DISC * 1.7, z0: 0, z1: 0, rows: []};
const LEADIN = .75, TAIL = .4, AHEAD = .2, FLOOR = .08, RL = 34, UPV = new THREE.Vector3(0, 1, 0);
const TILT = .2, TITLE_TILT = .12;                                 // read from above: how far from straight down the eye looks (rad)

// a move as an offset (right, up, back) in the stanza's frame; e = progress through it, d = framing distance
function shotOffset(kind, e, dir, d) {
  const E = ease3(e), S = Math.sin(Math.PI * e);
  switch (kind) {
    case 'pushIn': return [dir * .06 * d * (1 - E), .1 * d * (1 - E), d * (1.22 - .3 * E)];
    case 'pullBack': return [0, .03 * d + .2 * d * E, d * (.92 + .5 * E)];
    case 'orbit': { const th = dir * .55 * (2 * E - 1); return [d * Math.sin(th), .08 * d, d * Math.cos(th) * 1.02]; }
    case 'track': return [dir * d * .26 * (2 * E - 1), .05 * d, d * 1.04];
    case 'crane': return [0, d * (dir > 0 ? .26 * E : .26 - .26 * E), d * 1.06];
    case 'swell': { const th = dir * .3 * E; return [d * Math.sin(th), .16 * d * E, d * (1 + .24 * E)]; }
    case 'spiral': { const th = dir * .6 * (2 * E - 1); return [d * Math.sin(th) * .9, d * .22 * E, d * (1.06 - .1 * E)]; }
    case 'pendulum': return [dir * d * .34 * (2 * E - 1), .14 * d - .1 * d * S, d * 1.03];
    case 'flyby': return [dir * d * (.5 - 1 * E), .03 * d, d * (.9 + .08 * S)];
    case 'arc': { const th = dir * .42 * S; return [d * Math.sin(th) * 1.1, .12 * d * S, d * (1.03 + .08 * (1 - Math.cos(th)))]; }
    case 'float': return [dir * d * .09 * Math.sin(e * Math.PI * 2), .1 * d * (.5 + .5 * Math.sin(e * Math.PI * 2 + 1)), d * 1.05];
    case 'glide': return [dir * d * .16 * E, .18 * d * E, d * (1.1 - .14 * E)];
    default: return [0, .04 * d * S, d];
  }
}

// critically damped spring toward a moving target (Unity's SmoothDamp)
const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _m = new THREE.Vector3(), _o = new THREE.Vector3();
function damp(cur, vel, target, T, dt, maxSpeed = 1e9) {
  const w = 2 / Math.max(1e-3, T), x = w * dt, k = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
  _c.subVectors(cur, target); const maxC = maxSpeed * T;
  if (_c.length() > maxC) _c.setLength(maxC);
  _t.subVectors(cur, _c);
  _m.copy(vel).addScaledVector(_c, w).multiplyScalar(dt);
  vel.addScaledVector(_m, -w).multiplyScalar(k);
  _o.copy(_c).add(_m).multiplyScalar(k).add(_t);
  if (_c.subVectors(target, cur).dot(_m.subVectors(_o, target)) > 0) { _o.copy(target); vel.set(0, 0, 0); }   // no overshoot
  cur.copy(_o);
}

// a heading th (rad) on the water: where the camera looks (f), its right (r), and back toward it (n)
const fwv = (th, o) => o.set(Math.sin(th), 0, -Math.cos(th));
const rtv = (th, o) => o.set(Math.cos(th), 0, Math.sin(th));
const nov = (th, o) => o.set(-Math.sin(th), 0, Math.cos(th));
const mkF = () => ({c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()});
export function frameOf(c, th, out = mkF()) { out.c.copy(c); rtv(th, out.r); out.u.set(0, 1, 0); nov(th, out.n); return out; }

export function createShots(track, sig, score, offset = 0, modeName = 'lake') {
  const seed = (track.vinyl?.seed || 7) >>> 0, T = track.duration, r = rng(seed ^ 0x9E3779B9), MD = MODES[modeName] || MODES.lake, SY = track.style || {};
  // stations: the title, one per lyric line (in audio time; the lyric offset moves lines, never the music), and
  // the views of the scenes wherever nothing is sung for a while. Groups: a stanza's lines; the title; one view.
  const lineSt = score.lines.map(L => ({L, a: L.start - offset, b: L.end - offset}));
  const first = lineSt.length ? lineSt[0].a : 1e9, late = first < 4.2;
  // the title sequence: the record is there at a and lifts off at `lift`; if the song starts singing at once, the
  // first stanza stands in front of the record and the title plays on behind it. Where the opening is long enough
  // the record is first seen from above, lying on the lake, and stands up between s0 and s1 as the camera comes down
  const lift = late ? 6.5 : lineSt.length ? clamp(first - 2.3, 1.9, 9) : 9, ta = Math.min(.8, lift * .25), flat = !late && lift - ta >= 5.6, s0 = ta + clamp((lift - ta) * .5, 2.6, 4.4);
  // how the record makes its entrance (title.js ENTRIES): by the style; the label seen from above only for anime
  const entry = ENTRY_OF[FORCE_ENTRY] ? FORCE_ENTRY : ENTRY_BY_STYLE[SY.name] || 'label';
  const title = {title: true, entry, a: ta, b: late ? Math.max(.6, first - .9) : lift, lift, late, plan: flat && entry === 'label', s0, s1: s0 + 2, c: new THREE.Vector3(0, WATER_Y, 0), th: 0, moonTh: 0, moonDir: new THREE.Vector3(0, .15, -1).normalize()};
  const groups = [{title: true, a: title.a, b: title.b, st: [title]}];
  // Where nothing is sung: passages (cut at the song's measured sections, 9–34 s each), each one scene of the music
  // (figure.js: never the scene before, and as many different ones as the song has room for), read in one to four
  // views in turn
  const scenes = [];
  const phrases = (t0, t1) => {
    if (t1 - t0 < 5.5) return;
    const cuts = [t0];
    for (const s of track.motion.sections || []) if (s.start - cuts[cuts.length - 1] >= 9 && t1 - s.start >= 9) cuts.push(s.start);
    cuts.push(t1);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const n = Math.ceil((cuts[i + 1] - cuts[i]) / 34);
      for (let j = 0; j < n; j++) {
        const a = cuts[i] + (cuts[i + 1] - cuts[i]) * j / n, b = cuts[i] + (cuts[i + 1] - cuts[i]) * (j + 1) / n, len = b - a;
        const kind = FIG[FORCE_FIG] ? FORCE_FIG : figureFor(track, sig, a, b, scenes.map(s => s.kind), r()), def = FIG[kind], nV = len < 11 ? 1 : len < 21 ? 2 : len < 30 ? 3 : 4, d = len / nV;
        const S = {i: scenes.length, kind, a: a + .3, b: b - .5, c: new THREE.Vector3(0, WATER_Y, 0), th: 0, side: 1, st: []}, turn = r() < .5 ? 1 : 0;
        for (let k = 0; k < nV; k++) {
          // (in MV mode a scene is not read from straight above: the MV stands on the horizon behind it)
          const VW = track.mv && def.views.some(v => v.k !== 'plan') ? def.views.filter(v => v.k !== 'plan') : def.views;
          const view = VW[(k + turn) % VW.length], x = {phantom: true, fig: kind, scene: S, view, a: a + k * d + .3, b: a + (k + 1) * d - (k === nV - 1 ? .5 : .15)};
          S.st.push(x); groups.push({phantom: true, scene: S, view, plan: view.k === 'plan', a: x.a, b: x.b, st: [x]});
        }
        scenes.push(S);
      }
    }
  };
  let cursor = title.lift + 2.5;
  for (const S of score.stanzas || []) { const xs = S.lines.map(i => lineSt[i]), a = xs[0].a, b = xs[xs.length - 1].b; phrases(cursor, a - 2.2); groups.push({S, plan: !!S.plan, a, b, st: xs}); cursor = b + 2.2; }
  phrases(cursor, T - 2.5);
  const st = groups.flatMap(G => G.st);
  st.forEach((x, i) => { x.i = i; });
  groups.forEach((G, gi) => { G.i = gi; for (const x of G.st) x.G = G; });
  const byLine = new Map(st.filter(x => x.L).map(x => [x.L.i, x]));

  // ---- measures ----------------------------------------------------------------------------------------
  let layout = () => ({w: 3, h: .6, rowH: .3, z0: 0, z1: 0, rows: []}), fit = {fov: 42, aspect: 16 / 9}, layKey = 0;
  const layOf = x => (x.L ? layout(x.L) : x.title ? TITLE_LAY : x.fig ? (x.view._lay ||= {...FIG[x.fig].lay, ...(x.view.lay || {})}) : PHRASE);
  const fovOf = G => fit.fov * (G.lens || 1), tanOf = G => Math.tan(fovOf(G) * Math.PI / 360);
  function metrics(G) {
    if (G.mKey === layKey) return G.m;
    const lays = G.st.map(layOf);
    G.mKey = layKey;
    return (G.m = {w: Math.max(...lays.map(l => l.w)), h: Math.max(...lays.map(l => l.h)), rowH: Math.max(...lays.map(l => l.rowH || l.h))});
  }
  function framing(w, h, fill, G) {
    const tv = tanOf(G), th = tv * fit.aspect;
    return clamp(Math.max((w / 2) / (fill * th), (h / 2) / (fill * .82 * tv)), 2.6, 15 / Math.min(1, G.lens || 1));
  }
  // the record and its rings fill two thirds of the frame's height at any lens
  const titleDist = fov => DISC * 1.7 / (.72 * Math.tan(fov * Math.PI / 360));
  // how far from a line the camera reads it (lines that replace one another on the spot share the widest one's)
  function distOf(x) {
    if (x.title) return titleDist(fit.fov);
    const G = x.G;
    if (G.plan) return G.page ? G.page.H : 8;
    const tall = x.L?.layout === 'column', ls = G.form === 'flap' ? G.st.map(layOf) : [layOf(x)];
    // (what stands nearer than the baseline must fit too)
    return Math.max(framing(Math.max(...ls.map(l => l.w)), Math.max(...ls.map(l => l.hf ?? l.h)) * (tall ? 1.3 : 1.2), G.fill, G), 3.8) + Math.max(...ls.map(l => l.near || 0));
  }
  // Read from above, a stanza is a page lying on the water: its lines are rows down the page. z: each row's
  // baseline down the page from the first; cz: the page's middle; W, D: its size; H: how high the eye must be
  function pageOf(G) {
    const lays = G.st.map(layOf), z = [0];
    for (let k = 1; k < lays.length; k++) z.push(z[k - 1] - (lays[k - 1].py0 || 0) + .4 * (lays[k].rowH || .4) + (lays[k].py1 ?? lays[k].h));
    const top = -(lays[0].py1 ?? lays[0].h), bot = z[z.length - 1] - (lays[lays.length - 1].py0 || 0), W = Math.max(...lays.map(l => l.w)), D = bot - top;
    const tvv = tanOf(G);
    // (the frame's head and foot carry the instrument's own readouts: a page keeps clear of them)
    return {z, cz: (top + bot) / 2, W, D, H: clamp(Math.max(W / 2 / (.6 * tvv * fit.aspect), D / 2 / (.5 * tvv)), 4.6, 15 / Math.min(1, G.lens || 1))};
  }
  // where over the water the camera is when it reads a station
  function eye(p, out) { nov(p.th, out); return p.G.plan && p.G.page ? out.multiplyScalar(p.G.page.H * Math.tan(TILT)).add(p.G.page.c) : out.multiplyScalar(distOf(p)).add(p.c); }

  // ---- the places: done once, when the lines can be measured --------------------------------------------
  // A stanza could be reached and stood in several ways (the way there, the side, how its lines stand among
  // themselves). They are tried in the song's own order of preference; the first is taken under which no word is
  // sung outside the frame, the view never whips round, the camera is there in time and stays over the lake.
  let placed = false;
  const tv3 = new THREE.Vector3();
  function order(wt, us) { const w = {...wt}, out = []; for (let i = 0; i < 12; i++) { const k = pick(w, us[i % us.length]); if (k == null) break; out.push(k); delete w[k]; } return out; }
  function place() {
    if (placed) return;
    placed = true;
    const E = new THREE.Vector3(), E2 = new THREE.Vector3(), v = new THREE.Vector3(), v2 = new THREE.Vector3();
    const vias = [], kinds = [], enters = [], seen = [];
    let lastForm = null;
    title.th = r() * 6.2832; title.dir = r() < .5 ? -1 : 1; title.hand = -10; title.arrive = -9;
    const ringR = 11 + 4 * r();                                        // (orbit) the circle the stanzas stand on
    const flipAt = (q, x) => { const lu = q.L.units[q.L.units.length - 1]; return Math.max(lu.s + Math.min(.22, (lu.e - lu.s) * .6), x.L.start - .5); };
    groups.forEach((G, gi) => {
      const rr = rng(seed ^ (gi * 2654435761 + 17)), Ls = G.st.map(x => x.L).filter(Boolean), L0 = Ls[0], pv = groups[gi - 1], x0 = G.st[0], mood = L0?.mood, nL = G.st.length;
      G.fill = (L0?.layout === 'poster' ? .72 : G.phantom ? .82 : .6 + .14 * rr()) * (track.mv ? .66 : 1);
      const dir0 = rr() < .5 ? -1 : 1, look0 = (rr() < .5 ? -1 : 1) * (.35 + .65 * rr());
      G.dir = dir0;
      G.look = look0;                                                  // the camera aims beside the text (rule of thirds)
      // (MV mode: the MV is the picture; the camera moves less and the lines are set smaller, under it)
      G.moveK = (mood === 'quiet' ? .6 : mood === 'loud' ? 1.25 : 1) * MD.moveK * (track.mv ? .55 : 1); G.smooth = mood === 'quiet' ? .4 : L0?.chorus ? .24 : .3;
      G.form = 'solo';
      const u = Array.from({length: 17}, rr), u3 = u[2], u4 = u[3], u5 = u[4];
      if (!pv) { G.via = 'title'; G.kind = 'title'; return; }
      const planG = !!G.plan, planP = !!pv.plan, sameScene = !!G.scene && pv.scene === G.scene;

      // ---- how it is seen: flat or deep (a page is the flattest; a scene's view says for itself) ----
      if (planG) G.see = 'plan';
      else if (G.view) G.see = G.view.k === 'front' ? 'flat' : 'deep';
      else {
        const depthy = L0 && (L0.layout === 'steps' || L0.layout === 'scatter' || L0.layout === 'relay' || nL > 1), ML = MD.lens || {};
        const sw = {flat: (mood === 'quiet' ? 1.5 : 1) * (depthy ? .4 : 1) * (ML.flat ?? 1), mid: .7 * (ML.mid ?? 1), deep: (mood === 'loud' || L0?.chorus ? 1.6 : 1) * (ML.deep ?? 1)};
        const l1 = seen[seen.length - 1], l2 = seen[seen.length - 2];
        if (l1 && l1 === l2) sw[l1] = 0; else if (l1 in sw) sw[l1] *= .45;
        if (planP) sw.flat *= .3;                                      // after a page: depth
        G.see = pick(sw, u[15]);
      }
      seen.push(G.see === 'plan' ? 'flat' : G.see);
      G.lens = G.view?.lens ?? LENS[G.see];

      // ---- the ways here: what the breath before it allows ----
      const p = pv.st[pv.st.length - 1], wp = layOf(p).w;
      const pl = p.L?.units?.length ? p.L.units[p.L.units.length - 1] : null;
      const free = pl ? pl.s - offset + Math.min(.25, (pl.e - pl.s) * .6) : p.b - .3, tau = x0.a - free;
      const canFlap = !!(pl && L0 && L0.layout === 'row' && p.L.layout === 'row' && tau >= .45 && tau < 1.6);
      // the line before is still standing when this one comes: it is given the water beside it or in front of it,
      // never the water the other stands on
      const tight = !!p.L && tau < 1.8;
      // a page is risen to and left again (or, in too short a breath, blinked to); from page to page the eye
      // travels over the water; a scene's next view is the same place seen another way
      let wt;
      if (sameScene) wt = {view: 1};
      else if (planG !== planP && tau < 1.15 && (L0 || p.L)) wt = {blink: 1};
      else if (planG) wt = planP ? {panD: 1.2, panR: 1, panQ: .8} : {rise: 1};
      else if (planP) wt = {surface: 1};
      else if (pv.title) wt = {[title.late ? 'front' : 'turn']: 1};
      else if (tau >= 3.2) wt = {over: 1};
      else if (tau >= 2.2) wt = {over: 1.4, cross: 1, turn: .8};
      else if (tau >= .9) wt = {turn: 1.4, cross: 1.1, retreat: .5, flap: canFlap ? .5 : 0};
      else wt = {turn: 1.3, cross: 1, flap: canFlap ? 1.1 : 0, retreat: .6};
      // (what is set large would stand in front of a line that has not gone yet)
      if (wt.retreat && tau < 1.3 && L0 && ['single', 'relay', 'poster', 'scatter'].includes(L0.layout)) wt.retreat *= .12;
      // the mode's own ways, and its taste among the common ones
      if (sameScene || wt.blink) { /* as it is */ }
      else if (planG || planP) { if (MD.via.cut && tau >= .3 && planG !== planP) wt.cut = .4; }
      else if (!pv.title) { if (MD.via.ring) wt.ring = 1; if (MD.via.cut && tau >= .3) wt.cut = 1; }
      for (const k in wt) wt[k] *= MD.via[k] ?? 1;
      const lastVia = vias[vias.length - 1];
      if (Object.keys(wt).filter(k => wt[k] > 0).length > 1 && lastVia in wt && lastVia !== 'ring' && lastVia !== 'cut') wt[lastVia] *= .15;
      const viaOrder = order(wt, [u[0], u[7], u[8], u[9]]);
      G.tau = tau;
      // ---- the ways its lines can stand among themselves ----
      let formOrder = ['solo'];
      const ws = G.st.map(x => layOf(x).w), W = Math.max(...ws), be = .8 + .25 * u[12];
      const off = k => { const sl = W - ws[k]; return G.S.align === 'left' ? -sl / 2 : G.S.align === 'diag' ? sl * (k / (nL - 1) - .5) : 0; };
      if (planG) formOrder = [nL > 1 ? 'page' : 'solo'];
      else if (nL > 1 && L0) {
        const slack = (q, x) => { const lu = q.L.units[q.L.units.length - 1]; return x.L.start - (lu.s + Math.min(.22, (lu.e - lu.s) * .6)); };
        const flapOK = G.st.every((x, k) => !k || slack(G.st[k - 1], x) >= .45), fast = (G.b - G.a) / nL < 2.4;
        const fwt = {screen: 1.2, para: mood === 'quiet' ? 1.6 : 1.2, flap: flapOK ? (fast ? 1.7 : 1) : 0};
        for (const k in fwt) fwt[k] *= MD.form[k] ?? 1;
        if (lastForm in fwt) fwt[lastForm] *= .2;
        formOrder = order(fwt, [u[5], u[10], u[11]]);
      }
      // ---- the move while it is sung: weighted by what the stanza is and how it is seen; never either of the two before ----
      const banned = kinds.slice(-2);
      const kindOf = (via, form) => {
        const wk = Object.fromEntries(KINDS.map(k => [k, 1]));
        const add = o => { for (const k in o) wk[k] = Math.max(.05, wk[k] + o[k]); };
        if (L0) {
          const U = Ls.flatMap(L => L.units), held = L0.approx ? 0 : Math.max(0, ...U.map(q => q.e - q.s)), nW = Ls.reduce((a, L) => a + new Set(L.units.map(q => q.word)).size, 0);
          if (L0.chorus) add({orbit: 2.2, pushIn: 1.8, spiral: 1.2, hold: -.8, float: -.6});
          if (nW >= 10) add({track: 1.4, pullBack: 1});
          if (nW <= 3) add({pushIn: 1.4});
          if (held >= 1.3) add({swell: 2.4, float: 1.2});
          if (U.length >= 4 && (G.b - G.a) / U.length <= .34) add({flyby: 1.2, track: 1.4, swell: -1.6});
          if (mood === 'quiet') add({hold: 1.6, float: 1.4, glide: .8, flyby: -.8, spiral: -.6});
          if (form === 'flap') add({orbit: 2.2, arc: 1.6, spiral: 1, hold: -.8, flyby: -.9, track: -.5});
          if (form === 'para' || L0.layout === 'steps') add({pullBack: 1.2, glide: 1, crane: .8, flyby: -.9, pendulum: -.6, orbit: -.3});
          if (form === 'screen') add({hold: .6, float: 1, pushIn: .6, flyby: -.9, orbit: -.6, track: -.5});
          if (L0.layout === 'poster') add({flyby: -.9, pendulum: -.6, orbit: .6});
          if (L0.layout === 'single' || L0.layout === 'relay') add({flyby: -.95, track: -.7, pendulum: -.6, pushIn: 1.2, hold: .6, swell: .6});
          if (L0.layout === 'column') add({crane: 2, swell: 1, track: -.6, flyby: -.9});
          if (via === 'over') add({pushIn: 1, orbit: .8});
          // a flat view is read square on and still or sliding; a deep one turns about what it reads
          if (G.see === 'flat') add({hold: 1.2, float: 1.4, track: 1.2, pendulum: .5, orbit: -.95, arc: -.7, spiral: -.95, flyby: -.9, swell: -.5});
          if (G.see === 'deep') add({orbit: 1.4, arc: 1, spiral: 1, pushIn: .8, crane: .5, hold: -.9, float: -.7});
        } else { for (const k in wk) wk[k] = .05; add(G.view?.kinds || {orbit: 2.6, arc: 1.6, spiral: 1.6, crane: 1, track: 1, glide: .8}); }
        for (const k in MD.kind) if (wk[k] != null && L0) wk[k] *= MD.kind[k];
        for (const k of banned) if (Object.keys(wk).filter(q => wk[q] > .06 && !banned.includes(q)).length) delete wk[k];
        return pick(wk, u[13]);
      };
      eye(p, E);                                                       // where the camera stands for the line before

      // one way of standing it; returns what is wrong with it (0: nothing)
      const stand = (via, s, form, hs) => {
        G.via = via; G.side = s; G.form = form;
        for (const x of G.st) { x.flipAt = x.hinge = x.hs = x.hb = x.behindTo = undefined; x.behind = 0; x.cut = x.blink = false; }
        G.kind = kindOf(via, form);
        const pg = planG ? pageOf(G) : null, pp = planP ? pv.page : null;
        if (planG) G.page = pg;
        const dp = distOf(p), dq = distOf(x0), wq = layOf(x0).w, c = new THREE.Vector3(); let th = p.th, hung = 0;
        // like the next panel of a folding screen: on the end of the line before, folded toward the viewer
        const hang = (be2, gap) => { rtv(p.th, v); c.copy(p.c).addScaledVector(v, s * (wp / 2 + gap / 2)); th = p.th + s * be2; rtv(th, v); c.addScaledVector(v, s * (wq / 2 + gap / 2)); hung = s; };
        const how = via === 'blink' ? (planG ? 'rise' : 'surface') : via;
        switch (how) {
          // the same scene from another side, or from above
          case 'view': th = G.scene.th + G.scene.side * (G.view.yaw || 0); c.copy(G.scene.c); break;
          // up, and down onto a page lying in front of where the camera stood
          case 'rise': th = p.th + s * (.1 + .3 * u3); fwv(p.th, v); c.copy(E).addScaledVector(v, dp * (.3 + .25 * u4)); break;
          // to the next page: below this one, beside it, or beside it and set a quarter-turn round
          case 'panD': nov(p.th, v); rtv(p.th, v2); c.copy(pp.c).addScaledVector(v, pp.D / 2 + pg.D / 2 + 1 + u4).addScaledVector(v2, s * (u5 - .3) * 1.5); break;
          case 'panR': th = p.th + s * (.05 + .1 * u3); rtv(p.th, v); c.copy(pp.c).addScaledVector(v, s * (pp.W / 2 + pg.W / 2 + 1.2 + u4)); break;
          case 'panQ': th = p.th + s * Math.PI / 2; rtv(p.th, v); c.copy(pp.c).addScaledVector(v, s * (pp.W / 2 + pg.D / 2 + 1.2 + u4)); break;
          // down again to the water: the next line stands beyond the head of the page
          case 'surface': th = p.th + s * (.2 + .5 * u3); fwv(th, v); c.copy(E).addScaledVector(v, dq); break;
          case 'flap': c.copy(p.c); break;
          case 'front': nov(p.th, v); c.copy(p.c).addScaledVector(v, Math.max(2.5, dp - dq)); break;
          case 'retreat': th = p.th + s * (.06 + .14 * u3); nov(p.th, v); rtv(p.th, v2); c.copy(p.c).addScaledVector(v, ZS * (1 + .25 * u4)).addScaledVector(v2, s * (.3 + 1.1 * u5)); break;
          case 'cross':
            if (tight) { hang(.28 + .24 * u3, .6 + .6 * u4); nov(p.th, v); c.addScaledVector(v, .9 * (u5 - .3)); break; }
            th = p.th + s * (.3 + .28 * u3); rtv(p.th, v); c.copy(p.c).addScaledVector(v, s * (wp / 2 + 1.2 + 2.6 * u4)); rtv(th, v); c.addScaledVector(v, s * wq / 2); nov(p.th, v); c.addScaledVector(v, 1.2 * (u5 - .3)); break;
          case 'ring': {
            // round the middle: the next stanza stands further round the same circle, the camera outside it looking in
            const O = title.c, a0 = Math.atan2(p.c.z - O.z, p.c.x - O.x), inTh = a => Math.atan2(-Math.cos(a), Math.sin(a));
            const onRing = Math.abs(Math.hypot(p.c.x - O.x, p.c.z - O.z) - ringR) < 1.5 && Math.abs(wrap(p.th - inTh(a0))) < .4;
            if (tight && !onRing) { hang(.72 + .4 * u3, .4 + .5 * u4); break; }
            const arc = (wp + wq) / 2 + (tight ? .6 + .6 * u4 : 2 + 5 * u4 + 2.2 * Math.min(tau, 3)), a1 = (onRing ? a0 : Math.atan2(E.z - O.z, E.x - O.x)) - s * arc / ringR;
            c.set(O.x + Math.cos(a1) * ringR, WATER_Y, O.z + Math.sin(a1) * ringR); th = inTh(a1);
            break;
          }
          case 'cut':
            // no way there at all: the picture cuts, to the far side of the stanza before (a reverse shot) or to
            // another part of the lake
            if (u3 < .45) { th = p.th + Math.PI + s * (.25 + .5 * u4); fwv(th, v); nov(p.th, v2); c.copy(E).addScaledVector(v, dq * (.9 + .5 * u5)).addScaledVector(v2, 2 + 3 * u4); }
            else { const a = u3 * 39.7 + gi, rad = RL * (.15 + .4 * u4); th = a + 1.9 + s * (.4 + .6 * u5); c.set(title.c.x + Math.cos(a) * rad, WATER_Y, title.c.z + Math.sin(a) * rad); }
            break;
          case 'over': {
            let phi = p.th + s * (1.7 + 1.2 * u3);
            if (Math.hypot(E.x, E.z) > RL * .55) phi = Math.atan2(-E.x, E.z) + s * (.25 + .5 * u3);       // far out: back over the middle
            fwv(phi, v); E2.copy(E).addScaledVector(v, clamp(8 + 3.4 * tau, 14, 30));
            th = phi + (u4 < .5 ? -1 : 1) * (.5 + .7 * u5);            // and never arriving along the line of sight
            fwv(th, v); c.copy(E2).addScaledVector(v, dq); break;
          }
          default: {                                                   // turn
            if (tight) { hang(.72 + .4 * u3, .4 + .5 * u4); break; }
            const de = pv.title ? 1.05 + .3 * u3 : clamp(.38 + .6 * tau, .38, 1.5) * (.85 + .3 * u3) * MD.turnK;
            th = p.th + s * de; rtv(p.th, v); fwv(p.th, v2);
            E2.copy(E).addScaledVector(v, s * (1 + 2.2 * u4)).addScaledVector(v2, (u5 - .35) * 3);
            fwv(th, v); c.copy(E2).addScaledVector(v, dq);
          }
        }
        c.y = WATER_Y; x0.c = c; x0.th = th;
        // (a page was placed by its middle; its first row's baseline lies above that)
        if (planG) { pg.c = c.clone(); nov(th, v); x0.c = c.clone().addScaledVector(v, -pg.cz); }
        // a scene is where its first view put it; its own axis is that view's, turned back by the view's angle
        if (G.scene && !sameScene) { G.scene.c.copy(c); G.scene.side = s; G.scene.th = th - s * (G.view.yaw || 0); }
        // hung on a line: the camera aims between the two
        G.look = hung ? hung * Math.max(.65, Math.abs(look0)) : form === 'screen' ? hs * Math.abs(look0) : G.phantom ? look0 * .4 : look0;
        if (via === 'flap') x0.flipAt = flipAt(p, x0);
        x0.cut = via === 'cut' || via === 'blink'; x0.blink = via === 'blink';
        // the stanza before is still standing when this one comes up in front of it: the camera rises until it has gone
        if (via === 'retreat' && tau < 1.3) { x0.behind = 1; x0.behindTo = pv.b + 1.1; }
        G.st.forEach((x, k) => {
          if (!k) return;
          const q = G.st[k - 1];
          if (form === 'page') { x.th = th; nov(th, v); rtv(th, v2); x.c = x0.c.clone().addScaledVector(v, pg.z[k]).addScaledVector(v2, off(k) - off(0)); }
          else if (form === 'flap') { x.c = q.c.clone(); x.th = q.th; x.flipAt = flipAt(q, x); }
          else if (form === 'para') { x.th = x0.th; nov(x0.th, v); rtv(x0.th, v2); x.c = x0.c.clone().addScaledVector(v, k * ZS).addScaledVector(v2, off(k) - off(0)); x.behind = 1; }
          else {                                                        // the next panel hangs on the end of this one, folded toward the viewer
            rtv(q.th, v); x.hinge = q.c.clone().addScaledVector(v, hs * (ws[k - 1] / 2 + .5)); x.hs = hs; x.hb = be;
            x.th = q.th + hs * be; rtv(x.th, v); x.c = x.hinge.clone().addScaledVector(v, hs * (ws[k] / 2 + .5));
          }
        });
        G.dir = via === 'turn' || via === 'cross' ? (G.kind === 'flyby' ? 1 : -1) * s * (via === 'cross' ? -1 : 1) : dir0;
        let pen = 0;
        for (const x of G.st) pen += planOne(x);
        for (const x of G.st) { nov(x.th, v); pen += Math.max(0, Math.hypot(x.c.x + v.x * dq, x.c.z + v.z * dq) - RL) * .5; }
        return pen;
      };
      const sides = u[1] < .5 ? [1, -1] : [-1, 1], hss = u[6] < .5 ? [-1, 1] : [1, -1];
      let best = null;
      search: for (const via of viaOrder) for (const s of (via === 'flap' || via === 'front' || via === 'view' ? [sides[0]] : sides)) for (const form of formOrder) for (const hs of (form === 'screen' ? hss : [hss[0]])) {
        const pen = stand(via, s, form, hs);
        if (!best || pen < best.pen - 1e-6) best = {via, s, form, hs, pen};
        if (pen < .02) break search;
      }
      G.pen = stand(best.via, best.s, best.form, best.hs);
      vias.push(G.via); kinds.push(G.kind);
      if (nL > 1 && L0) lastForm = G.form;

      // ---- how its lines arrive (lyric.js) ----
      G.st.forEach((x, k) => {
        if (!x.L) return;
        const lay = x.L.layout;
        // on a page the words come up out of the depth, drift in on the surface, or spread like ink
        if (planG) { const ew = {deep: 1.6, drift: .8, spread: .9, type: .45}, le = enters[enters.length - 1]; if (le in ew) ew[le] *= .2; x.enter = k ? 'deep' : pick(ew, u[14]); if (!k) enters.push(x.enter); return; }
        if (k) x.enter = G.form === 'flap' ? 'flap' : G.form === 'para' ? 'rise' : 'door';
        else if (G.via === 'flap') x.enter = 'flap';
        else if (lay === 'column') x.enter = 'rise';
        // coming down from a page, the next line stands up from the water as the eye comes down to it (lyric.js)
        else if (G.via === 'surface' && lay !== 'single' && lay !== 'relay' && lay !== 'scatter') x.enter = 'popup';
        else {
          const ew = {rise: G.via === 'retreat' ? 1.8 : G.via === 'surface' ? 2.2 : 1, fall: lay === 'poster' || x.L.chorus ? 1.7 : G.via === 'over' ? 1.3 : .6, turn: G.via === 'turn' || G.via === 'cross' ? 1.4 : .8, gather: lay === 'poster' ? .3 : .9,
            sprout: .8, slide: G.via === 'cross' ? 1.3 : .6, surf: G.via === 'over' || G.via === 'cut' ? 1.2 : .6, type: x.L.mood === 'loud' ? .6 : .3,
            pop: x.L.mood === 'loud' || x.L.chorus ? .35 : .12, drop: lay === 'poster' || x.L.mood === 'loud' ? .4 : .15};
          for (const k in ew) ew[k] *= (MD.enter[k] ?? 1) * (SY.enter?.[k] ?? 1);
          const le = enters[enters.length - 1]; if (le in ew) ew[le] *= .1;
          x.enter = pick(ew, u[14]); enters.push(x.enter);
        }
      });
    });
    // the moon: where the record goes when it leaves the lake. Beside the first stanza, so the eye that follows it
    // up arrives at the first line
    const g1 = groups[1];
    title.moonTh = g1 && g1.via === 'turn' ? g1.st[0].th - g1.side * (g1.phantom ? .62 : .33) : title.th + .3;
    title.moonDir.set(Math.sin(title.moonTh) * Math.cos(MOON.el), Math.sin(MOON.el), -Math.cos(title.moonTh) * Math.cos(MOON.el));
  }
  function stationFrame(x, out = mkF()) { place(); return frameOf(x.c, x.th, out); }
  const groupFrame = (G, out) => stationFrame(G.st[0], out);

  // ---- targets ----------------------------------------------------------------------------------------
  const sf = mkF();
  // where the singing (or, in a scene, the music) is across the width (0..1), moving smoothly
  function readHead(x, t) {
    if (!x.L) return x.phantom ? clamp((t - x.scene.a) / (x.scene.b - x.scene.a)) : .5;
    const L = x.L, lay = layout(L);
    if (!lay.unitX || !L.units.length) return .5;
    const lt = t + offset, Us = L.units, xs = lay.unitX;
    if (lt <= Us[0].s) return xs[0];
    if (lt >= Us[Us.length - 1].e) return xs[xs.length - 1];
    // the head leads: it travels to a unit in the moment before it is sung and is there when it starts
    let k = Us.findIndex(u => lt < u.s); if (k < 0) return xs[xs.length - 1];
    if (!k) return xs[0];
    const win = Math.min(.32, Us[k].s - Us[k - 1].s), p = clamp((lt - (Us[k].s - win)) / Math.max(.03, win));
    return xs[k - 1] + (xs[k] - xs[k - 1]) * ease(p);
  }
  // a line set in rows builds toward the viewer: how far the camera has stepped back for the row being sung
  function rowZ(x, t) {
    const L = x.L; if (!L || L.layout !== 'steps') return 0;
    const lay = layout(L), lt = t + offset; let z = 0;
    for (let j = 1; j < lay.rows.length; j++) z += (lay.rows[j].z - lay.rows[j - 1].z) * ease5((lt - rowGo(L, lay, j)) / .68);
    return z;
  }
  // when the camera makes room for row j (lyric time): in time for its first note, but not before the row before
  // has begun its last word
  const rowGo = (L, lay, j) => Math.min(Math.max(L.units[lay.rows[j].k0].s - .78, L.units[lay.rows[j - 1].k1].s - .25), L.units[lay.rows[j].k0].s - .72);
  // when the camera leaves a station for the next one (lyric time; Infinity: it does not)
  const leaveAt = x => (plan(), st[x.i + 1] ? st[x.i + 1].hand + offset : 1e9);

  const mk = () => ({pos: new THREE.Vector3(), look: new THREE.Vector3(), smooth: .46, fov: 42, turnK: 1});
  // ---- the title ----
  // Low, in front of the record hanging over the water: the waterline held low in the frame (the record's reflection
  // under it, cut by the frame's foot), the record a little above the middle; a long lens that widens while the
  // camera closes in. At lift-off the eye looks up after it.
  function titleLow(t, out) {
    const k = ease3(clamp(t / Math.max(1.2, title.b))), fov = fit.fov * (.58 + .42 * k), tv = Math.tan(fov * Math.PI / 360);
    // (scan: the camera pushes in on the record while it is scanned)
    const d = titleDist(fov) * (title.entry === 'scan' ? 1.22 - .22 * ease(clamp((t - title.a) / 2.6)) : 1);
    nov(title.th + title.dir * (.2 - .36 * k), tv3);
    out.pos.copy(title.c).addScaledVector(tv3, d); out.pos.y = WATER_Y + .42 + .3 * k;
    const up = title.late ? 0 : ease(clamp((t - title.lift) / 1.6)), hC = out.pos.y - WATER_Y;
    out.look.copy(title.c); out.look.y = out.pos.y + d * Math.tan(Math.atan(.36 * tv) - Math.atan2(hC, d)) + DISC * 1.5 * up;
    // (reflect: first only its reflection in the water, then the eye comes up to the record)
    if (title.entry === 'reflect') out.look.y -= (2 * HOVER + DISC * .9) * (1 - ease(clamp((t - title.a - .4) / Math.max(1.6, (title.lift - title.a) * .5))));
    out.smooth = .5; out.fov = fov;
    return out;
  }
  // From above: the record lies on the lake like a label on a sheet. A very long lens (the lake's rings round it
  // are its grooves, flat); the sheet turns slowly under the eye, and the eye sinks a little toward it.
  function titleTop(t, out) {
    const fov = fit.fov * .56, tv = Math.tan(fov * Math.PI / 360), e = ease(clamp((t - title.a) / Math.max(1, title.s0 - title.a))), H = DISC * LABEL / (.54 * tv) * (1 - .07 * e);
    nov(title.th + title.dir * .16 * (e - .5), tv3);
    out.look.copy(title.c).addScaledVector(tv3, .12 * H * tv);
    out.pos.copy(out.look).addScaledVector(tv3, H * Math.tan(TITLE_TILT)); out.pos.y = WATER_Y + H;
    out.smooth = .5; out.fov = fov;
    return out;
  }
  // Between the two the eye comes down on an arc about the record (which lifts off the water and turns up meanwhile)
  // and looks at it all the way: the record keeps its place in the frame while the lake tips up behind it into a horizon.
  const TP = mk(), ta3 = new THREE.Vector3(), tb3 = new THREE.Vector3(), tc3 = new THREE.Vector3();
  function titlePose(t, out) {
    if (!title.plan || t >= title.s1) return titleLow(t, out);
    titleTop(t, out);
    if (t <= title.s0) return out;
    const m = clamp(ease5((t - title.s0) / (title.s1 - title.s0))), lo = titleLow(t, TP), c = tc3.copy(title.c);
    c.y += standOf(title, t).y; out.look.y += c.y - title.c.y;       // (the eye keeps looking at the record as it rises)
    ta3.subVectors(out.pos, c); tb3.subVectors(lo.pos, c);
    const ra = ta3.length(), rb = tb3.length(), ea = Math.asin(clamp(ta3.y / ra, -1, 1)), eb = Math.asin(clamp(tb3.y / rb, -1, 1)), za = Math.atan2(ta3.x, ta3.z), zb = Math.atan2(tb3.x, tb3.z);
    const rr = ra + (rb - ra) * m, el = ea + (eb - ea) * m, az = za + wrap(zb - za) * m;
    out.pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(rr).add(c);
    out.look.lerp(lo.look, m); out.fov += (lo.fov - out.fov) * m; out.turnK = 3.4;   // (the view turns with the eye, not after it)
    return out;
  }
  // Reading a page: from high over its middle, looking almost straight down (the head of the page up the frame).
  // The whole frame is water; the page turns slowly under the eye, comes nearer or falls away, and the eye leans a
  // little toward the row and the word being sung.
  const TURNS = {orbit: 1, arc: 1, spiral: 1, pendulum: 1, track: .4, flyby: .4, glide: .4}, HEIGHTS = {pushIn: -1, glide: -1, spiral: -1, pullBack: 1, swell: 1, crane: 1};
  function pagePose(x, t, out) {
    const G = x.G, pg = G.page, k = Math.max(0, G.st.indexOf(x)), lay = layOf(x), x0 = G.st[0];
    const e = clamp((t - (G.a - LEADIN)) / (G.b + TAIL - (G.a - LEADIN))), E3 = ease3(e);
    const yaw = G.dir * .13 * (2 * E3 - 1) * (TURNS[G.kind] || 0) * Math.min(1.2, G.moveK), H = pg.H * (1 + .09 * (HEIGHTS[G.kind] || 0) * (2 * E3 - 1));
    const wp = x.L ? readHead(x, t) : .5, tt = t * .9, br = .012 * H;
    frameOf(x0.c, x0.th, sf);
    out.look.copy(pg.c).addScaledVector(sf.r, (wp - .5) * lay.w * .12).addScaledVector(sf.n, (pg.z[k] - pg.cz) * .22 + .07 * H * tanOf(G)); out.look.y = WATER_Y;
    nov(x0.th + yaw, tv3);
    out.pos.copy(out.look).addScaledVector(tv3, H * Math.tan(TILT)).addScaledVector(sf.r, br * (Math.sin(tt * .13 + 1.1) * .6 + Math.sin(tt * .047) * .4)); out.pos.y = WATER_Y + H + br * Math.sin(tt * .11 + 2.3);
    out.smooth = Math.max(G.smooth, .34); out.fov = fovOf(G);
    return out;
  }
  function stationPose(x, t, out) {
    place();
    if (x.title) return titlePose(t, out);
    if (x.G.plan && x.G.page) return pagePose(x, t, out);
    const G = x.G, lay = layOf(x), tall = x.L?.layout === 'column', flat = !x.L, poster = x.L?.layout === 'poster', d = distOf(x);
    const e = clamp((t - (G.a - LEADIN)) / (G.b + TAIL - (G.a - LEADIN)));
    let [Rr, Uu, Bb] = shotOffset(G.kind, e, G.dir, d);
    // A single row is read from low over the water (it stands against the sky, its reflection under it). When rows
    // stand behind the one being sung, from just high enough that each keeps its own water. What lies on the water
    // (a scene that is flat by nature) is read from higher still (eyeK).
    const zc = rowZ(x, t), beh = Math.max(lay.raise || 0, (x.behind || 0) * (x.behindTo == null ? 1 : 1 - ease((t - x.behindTo) / 1.6)), clamp(zc / ZS));
    const lo = lay.eyeK ? lay.eyeK * d : flat ? clamp(.5 * lay.h, .3, .7) : tall ? clamp(.5 * lay.h, .7, 1.6) : clamp(.35 + .6 * lay.rowH, .5, 1), e0 = lo + (clamp(lay.rowH * (1.2 + 1.5 * d / ZS), lo, Math.max(lo, 2.4)) - lo) * beh;
    Rr *= G.moveK * clamp(5.5 / lay.w, .4, 1) * (poster ? .6 : 1); Uu = e0 + .5 * clamp(Uu * Math.min(1, G.moveK), 0, .17 * d); Bb = d + (Bb - d) * G.moveK;
    Uu = Math.min(Uu, Math.max(.3, (lay.eyeK || 0) + .08) * Bb);       // never so high that the sky leaves the frame
    const follow = poster ? .25 : flat ? 0 : 1, wp = readHead(x, t), truck = Math.tanh((wp - .5) * 2.2) * lay.w * .13 * follow;
    const br = .04 * d, tt = t * .9;
    frameOf(x.c, x.th, sf);
    out.pos.copy(sf.c).addScaledVector(sf.r, Rr + truck + br * (Math.sin(tt * .13 + 1.1) * .6 + Math.sin(tt * .047) * .4))
      .addScaledVector(sf.u, Uu + br * .5 * (Math.sin(tt * .11 + 2.3) * .6 + Math.sin(tt * .071) * .4)).addScaledVector(sf.n, zc + Bb);
    out.pos.y = Math.max(out.pos.y, WATER_Y + FLOOR);
    const tv = tanOf(G), vis = 2 * d * tv * fit.aspect, room = Math.max(0, vis - lay.w) * .5;
    // Whatever the camera's height, the waterline under the sung row is held at one height of the frame: the sky
    // (and the rows already sung) above it, its reflection below it
    const hC = out.pos.y - WATER_Y, fy = track.mv ? (flat ? .74 : tall ? .8 : .77 + .04 * beh) : flat ? (lay.fy ?? .56) : tall ? .68 : .6 + .06 * beh, ang = Math.atan((fy - .5) * 2 * tv) - Math.atan2(hC, Bb);
    out.look.copy(sf.c).addScaledVector(sf.r, -G.look * room * .3 + (wp - .5) * lay.w * .24 * follow).addScaledVector(sf.n, zc)
      .addScaledVector(sf.u, hC + Bb * Math.tan(ang));
    out.smooth = G.smooth; out.fov = fovOf(G);
    return out;
  }
  const A = mk(), B = mk();
  const TAU = 6.2831853, wrap = a => ((a % TAU) + TAU * 1.5) % TAU - Math.PI;
  const yawOf = P => Math.atan2(P.look.x - P.pos.x, -(P.look.z - P.pos.z));
  // From one pose toward another: the eye travels, the view turns (yaw and pitch) and the lens changes with them,
  // so the look never passes through the eye however the two places lie. `sense`: the turn decided when the move
  // was planned.
  const dA = new THREE.Vector3(), dB = new THREE.Vector3();
  function blend(out, C, m, sense) {
    dA.subVectors(out.look, out.pos); dB.subVectors(C.look, C.pos);
    const la = dA.length(), lb = dB.length(), ya = Math.atan2(dA.x, -dA.z), yb = Math.atan2(dB.x, -dB.z), pa = Math.asin(clamp(dA.y / la, -1, 1)), pb = Math.asin(clamp(dB.y / lb, -1, 1));
    // (coming down from a page the eye comes up early, so the horizon is back long before the camera is down; going
    // up to one it stays on the horizon while the camera climbs, and looks down last)
    m = clamp(m);                                                      // (an eased value can overshoot 1 by a rounding error; a power of a negative is not a number)
    const mp = pa < -1 && pb > -1 ? 1 - Math.pow(1 - m, 2.2) : pb < -1 && pa > -1 ? Math.pow(m, 2.2) : m;
    const dy = sense == null ? wrap(yb - ya) : sense + wrap(yb - ya - sense), y = ya + dy * m, pp = pa + (pb - pa) * mp, l = la + (lb - la) * m;
    out.pos.lerp(C.pos, m); out.fov += (C.fov - out.fov) * m;
    out.look.set(Math.sin(y) * Math.cos(pp), Math.sin(pp), -Math.cos(y) * Math.cos(pp)).multiplyScalar(l).add(out.pos);
    return out;
  }
  // (2026-10-07) Up to a page and down from one, in two parts that overlap, so the frame is never empty water: going
  // up, the eye first rises on an arc over the stanza it leaves (which folds flat on the water under it: lyric.js
  // 'lay') until it reads it like a page, then slides across the water, as over a sheet, to the page; coming down,
  // it first slides across to above the line it comes down to (lying on the water: 'popup'), then comes down on an
  // arc about it while it stands up. p: the move's own progress 0..1.
  const TM = mk(), sfT = mkF(), dT = new THREE.Vector3(), oT = new THREE.Vector3();
  // (from above, the view turns while it slides, so what lies on the water under it always reads the right way up)
  const azOf = v => Math.atan2(v.x, v.z), rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a), x = v.x; v.x = x * c + v.z * s; v.z = v.z * c - x * s; return v; };
  const planMove = (x, pv) => x === x.G.st[0] && !!x.G.plan !== !!pv.G.plan && (x.G.via === 'rise' || x.G.via === 'surface') && !x.cut;
  function planTransit(out, C, x, pv, p) {
    const m1 = ease5(clamp(p / .62)), m2 = ease5(clamp((p - .38) / .62));
    if (x.G.plan) {
      stationFrame(pv, sfT); const P = sfT.c, oC = dT.subVectors(C.pos, C.look), dAz = wrap(azOf(oC) - azOf(oT.subVectors(out.pos, out.look)));
      TM.look.copy(P); TM.pos.copy(P).add(rotY(oT.copy(oC), -dAz)); TM.fov = C.fov;
      arcBlend(out, TM, m1, P);
      oT.subVectors(out.pos, out.look); rotY(oT, dAz * m2); dT.subVectors(C.look, P); out.look.addScaledVector(dT, m2); out.pos.copy(out.look).add(oT);
    } else {
      stationFrame(x, sfT); const P = sfT.c, dAz = wrap(azOf(dT.subVectors(C.pos, C.look)) - azOf(oT.subVectors(out.pos, out.look)));
      rotY(oT, dAz * m1); dT.subVectors(P, out.look); dT.y = 0; out.look.addScaledVector(dT, m1); out.pos.copy(out.look).add(oT);
      arcBlend(out, C, m2, P);
    }
    return out;
  }
  // Round one thing (a scene read from another side, from above, from the water): the eye goes on an arc about it
  // and looks at it all the way, so it keeps its place in the frame while the world turns behind it.
  function arcBlend(out, C, m, c) {
    m = clamp(m);
    ta3.subVectors(out.pos, c); tb3.subVectors(C.pos, c);
    const ra = Math.max(1e-3, ta3.length()), rb = Math.max(1e-3, tb3.length()), ea = Math.asin(clamp(ta3.y / ra, -1, 1)), eb = Math.asin(clamp(tb3.y / rb, -1, 1)), za = Math.atan2(ta3.x, ta3.z), zb = Math.atan2(tb3.x, tb3.z);
    const rr = ra + (rb - ra) * m, el = ea + (eb - ea) * m, az = za + wrap(zb - za) * m;
    out.pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(rr).add(c);
    out.look.lerp(C.look, m); out.fov += (C.fov - out.fov) * m;
    return out;
  }
  // ---- being on time, and never turning away from a word that is being sung ---------------------------
  // A move lasts as long as the way and the turn between the two poses ask and lands 40 ms before the line starts.
  // It waits for the line on stage to begin its last word when it can; when the singing leaves no time it sets
  // off earlier, and then the words still to come must stay in the frame while it goes (place() stands the next
  // line where they do). A flight over the lake takes the whole breath.
  const sf2 = mkF(), pt = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3(), d3 = new THREE.Vector3();
  const seenAt = q => q.s - offset + Math.min(.3, (q.e - q.s) * .6);
  function unitPt(x, k, edge, out) {
    const lay = layOf(x), col = x.L.layout === 'column', ux = col ? 0 : ((lay.unitX?.[k] ?? .5) - .5) * lay.w, hw = col ? lay.w / 2 : (lay.unitW?.[k] ?? 0) / 2, uy = lay.unitY?.[k] ?? (lay.rowH || .4) * .5;
    frameOf(x.c, x.th, sf2);
    out.copy(sf2.c).addScaledVector(sf2.r, ux + edge * hw);
    return x.G.plan ? out.addScaledVector(sf2.n, -uy) : out.addScaledVector(sf2.n, lay.unitZ?.[k] ?? 0).addScaledVector(sf2.u, uy);
  }
  const nd = {x: 0, y: 0}, d4 = new THREE.Vector3();
  function ndcOf(P, q) {
    d1.subVectors(P.look, P.pos).normalize(); d2.crossVectors(d1, UPV).normalize(); d4.crossVectors(d2, d1); d3.subVectors(q, P.pos);
    const z = d3.dot(d1), tvv = Math.tan(P.fov * Math.PI / 360);
    if (z < .2) { nd.x = nd.y = 9; return nd; }
    nd.x = d3.dot(d2) / z / (tvv * fit.aspect); nd.y = d3.dot(d4) / z / tvv;
    return nd;
  }
  // how far outside the frame the words of the line before are sung, if the camera goes to x as planned
  function lost(x, pv) {
    if (!pv.L || x.G.via === 'flap' && x === x.G.st[0] || x.flipAt != null) return 0;
    let pen = 0;
    const Us = pv.L.units, pp = !!pv.G.plan, change = pp !== !!x.G.plan;
    for (let k = 0; k < Us.length; k++) {
      const ts = seenAt(Us[k]); if (ts < x.hand) continue;
      stationPose(pv, Math.min(ts, pv.b + 3), A);
      const p = (ts + .05 - x.hand) / (x.arrive - x.hand), m = ease5(p);
      if (m > 0) { if (planMove(x, pv)) planTransit(A, stationPose(x, ts, B), x, pv, clamp(p)); else blend(A, stationPose(x, ts, B), m, x.turn); }
      // (a page cannot be read from beside it, nor a standing line from above it)
      let o = change ? (m - .3) * 1.2 : 0;
      for (const ed of [1, -1]) { const q = ndcOf(A, unitPt(pv, k, ed, pt)); o = Math.max(o, Math.abs(q.x) - .95, pp ? Math.abs(q.y) - .86 : 0); }
      pen += Math.min(1.5, Math.max(0, o));
    }
    return pen;
  }
  function planOne(x) {
    const pv = st[x.i - 1];
    if (!pv) { x.hand = -10; x.arrive = -9; return 0; }
    const pl = pv.L?.units?.length ? pv.L.units[pv.L.units.length - 1] : null, lastStart = pl ? pl.s - offset - .25 : pv.b - (!!pv.G.plan !== !!x.G.plan ? 1.9 : pv.scene && pv.scene === x.scene ? 1.5 : .3), due = x.a - .04;
    stationPose(pv, x.a, A); stationPose(x, x.a, B);
    const way = Math.max(A.pos.distanceTo(B.pos), A.look.distanceTo(B.look));
    x.turn = wrap(yawOf(B) - yawOf(A)); x.lift = 0; x.bow = 0;
    const dy = Math.abs(x.turn);
    if (x.cut) {
      // the cut: after the last word has been read, on the strongest low beat of the breath if it has one
      const seen = pl ? seenAt(pl) + .08 : pv.b, hits = seen < due - .08 ? sig.recent('low', due - .06, 4, .3, due - .06 - seen) : [];
      let at = Math.max(Math.min(seen, due), due - .12), best = 0;
      for (const [age, k] of hits) if (k > best) { best = k; at = due - .06 - age; }
      x.arrive = at; x.hand = at - .004;
      return lost(x, pv) * 4 + Math.max(0, x.arrive - due - .01) * 30;
    }
    if (x === x.G.st[0] && x.G.via === 'over') {
      const Tm = clamp(due - (pv.b + .35), 1.8, 7.5);
      x.hand = Math.max(pv.hand + .2, due - Tm); x.arrive = due; x.lift = clamp(1.6 + .75 * Tm, 3, 6.5); x.bow = (x.G.side || 1) * way * .14;
    } else {
      const slow = x.G.via === 'view' ? 1.5 : 1;                        // a scene's own change of view is unhurried
      // (2026-10-07: longer than before, so a move reads as a glide, not a jump; lost() still keeps the words in frame)
      let Tn = clamp(Math.max(Math.sqrt(way / 3), dy / .6) * MD.pace * slow, .75, 3.2 * slow), Tmin = clamp(Math.max(Math.sqrt(way / 8.5), dy / 1.15), .55, 1.6);
      if (planMove(x, pv)) { Tn = Math.max(Tn, 2.3); Tmin = Math.max(Tmin, 1.25); }   // (the two-part move to or from a page)
      const lo = Math.max(pv.hand + .2, Math.min(Math.max(lastStart, due - Tn), due - Tmin)), hi = Math.max(lo, due - Tmin);
      let bh = lo, bp = 1e9;
      for (let j = 0; j <= 6; j++) {
        x.hand = lo + (hi - lo) * j / 6; x.arrive = x.hand + clamp(due - x.hand, Tmin, Tn);
        const q = lost(x, pv);
        if (q < bp - 1e-9) { bp = q; bh = x.hand; }
        if (q <= 0 || hi - lo < 1e-3) break;
      }
      x.hand = bh; x.arrive = x.hand + clamp(due - x.hand, Tmin, Tn);
    }
    return lost(x, pv) * 4 + Math.max(0, 1.875 * dy / (x.arrive - x.hand) - 1.9) * 2 + Math.max(0, x.arrive - due - .01) * 30;
  }
  let planKey = -1, cuts = [], blinks = [];
  function plan() {
    place();
    if (planKey === layKey) return;
    planKey = layKey;
    for (const x of st) planOne(x);
    cuts = st.filter(x => x.cut).map(x => x.arrive);
    blinks = st.filter(x => x.blink);
  }
  // The move from one station to the next is one eased curve (smootherstep: no velocity and no acceleration at
  // either end) from the pose the camera holds to the next station's own pose, which keeps moving with its shot.
  // Moves that overlap (very short lines) chain into one another. A flight is the same curve with height and a bow.
  const CH = [mk(), mk(), mk(), mk()];
  function target(t, out = mk()) {
    plan();
    let k = 0;
    for (let i = 0; i < st.length; i++) { if (st[i].hand <= t) k = i; else break; }
    let j = k;
    while (j > 0 && k - j < 3 && t < st[j].arrive) j--;                  // j: the last station the camera has fully reached
    out.turnK = 1;
    stationPose(st[j], Math.min(t, st[j].b + 3), out);
    for (let i = j + 1; i <= k; i++) {
      const x = st[i], m = ease5((t - x.hand) / (x.arrive - x.hand)), C = stationPose(x, t, CH[i - j]);
      if (x.G.via === 'view') { arcBlend(out, C, m, x.scene.c); out.smooth = .16; out.turnK = 3.4; continue; }
      if (planMove(x, st[i - 1])) { planTransit(out, C, x, st[i - 1], clamp((t - x.hand) / (x.arrive - x.hand))); out.smooth = .18; out.turnK = 3; continue; }
      blend(out, C, m, x.turn); out.smooth = .16;
      if (!!x.G.plan !== !!st[i - 1].G.plan) out.turnK = 3;          // up to a page or down from one: the view turns with the eye
      // in the air the eye looks far out over the lake (so rising and bowing barely turn the view), not down at a near point
      if (x.lift) { const b = Math.pow(Math.max(0, Math.sin(Math.PI * m)), 1.4); dA.subVectors(out.look, out.pos).normalize(); out.look.addScaledVector(dA, 16 * b); out.pos.y += x.lift * b; rtv(x.th, tv3); out.pos.addScaledVector(tv3, x.bow * b); out.smooth = .3; }
    }
    return out;
  }
  // a blink at t: how far shut the picture is (0..1), and the station whose baseline the shutter closes on (the one
  // left before the cut, the one come to after it)
  function blinkAt(t) {
    plan();
    for (const x of blinks) { const d = t - x.arrive; if (Math.abs(d) < .15) return {k: 1 - ease(Math.abs(d) / .15), x: d < 0 ? st[x.i - 1] : x}; }
    return null;
  }

  // ---- the follower -----------------------------------------------------------------------------------
  const S = {t: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), look: new THREE.Vector3(), lvel: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 42, yaw: null, bank: 0};
  const tg = mk(), m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), pointer = new THREE.Vector2(), pv3 = new THREE.Vector3(), side = new THREE.Vector3();
  const snapTo = t => { S.pos.copy(tg.pos); S.look.copy(tg.look); S.vel.set(0, 0, 0); S.lvel.set(0, 0, 0); m4.lookAt(S.pos, S.look, UPV); S.q.setFromRotationMatrix(m4); S.fov = tg.fov; S.t = t; S.yaw = null; S.bank = 0; };
  const fwd3 = new THREE.Vector3(), qb = new THREE.Quaternion();
  // the spring trails its target by about its own time constant, so it is given the target a moment ahead
  function step(t, dt) {
    // a cut is not anticipated and not followed: until it the camera looks no further ahead than the cut, at it
    // the camera is simply there
    let ta = t + AHEAD, snap = false;
    for (const c of cuts) { if (c > t) { if (c <= ta) ta = c - .006; break; } if (c > t - dt) snap = true; }
    target(ta, tg);
    if (snap) return snapTo(t);
    // pointer parallax: a small orbit around the look point (smoothed by the same spring)
    if (pointer.lengthSq() > 0) { pv3.subVectors(tg.pos, tg.look); side.crossVectors(pv3, UPV).normalize(); tg.pos.addScaledVector(side, -pointer.x * .32).addScaledVector(UPV, pointer.y * .2); tg.pos.y = Math.max(tg.pos.y, WATER_Y + FLOOR); }
    damp(S.pos, S.vel, tg.pos, tg.smooth, dt, 40);
    damp(S.look, S.lvel, tg.look, tg.smooth * .8, dt, 40);
    m4.lookAt(S.pos, S.look, UPV); qd.setFromRotationMatrix(m4);
    // the bank: the camera leans into a turn like something carried through the air (a few degrees, as fast as it
    // turns, eased in and out by its own spring; never on a cut)
    fwd3.subVectors(S.look, S.pos); const yaw = Math.atan2(fwd3.x, -fwd3.z);
    if (S.yaw != null && dt > 0) { const rate = Math.atan2(Math.sin(yaw - S.yaw), Math.cos(yaw - S.yaw)) / dt, want = clamp(-rate * .05, -.06, .06); S.bank += (want - S.bank) * (1 - Math.exp(-dt / .35)); }
    S.yaw = yaw;
    if (Math.abs(S.bank) > 1e-4) { fwd3.normalize(); qd.premultiply(qb.setFromAxisAngle(fwd3, S.bank)); }
    S.q.slerp(qd, 1 - Math.exp(-5 * (tg.turnK || 1) * dt));
    S.fov += (tg.fov - S.fov) * (1 - Math.exp(-dt / Math.max(.06, tg.smooth * .5)));
    S.t = t;
  }
  function reset(t) { const t0 = t - 3; target(t0 + AHEAD, tg); snapTo(t0); }
  function camera(t, cam) {
    // A stall used to rewind three seconds and integrate every step on the main thread. A drum
    // section that already missed a frame would then miss the next one too, and the picture locked.
    const gap = S.t == null ? 0 : t - S.t;
    if (S.t === null || t < S.t - .05 || gap > .2 || !Number.isFinite(S.pos.x + S.look.x + S.q.w + S.fov)) {
      target(Math.max(0, t), tg); snapTo(t);
    } else {
      let steps = 0;
      while (S.t < t - 1e-6 && steps++ < 5) { const dt = Math.min(1 / 60, t - S.t); step(S.t + dt, dt); }
      if (S.t < t - 1e-6) snapTo(t);
    }
    cam.position.copy(S.pos); cam.quaternion.copy(S.q);
    if (cam.isPerspectiveCamera) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
    return cam;
  }
  // the station whose time it is (the latest one that has started, within its tail)
  function current(t) { let x = st[0]; for (const s2 of st) { if (s2.a - 1 <= t) x = s2; else break; } return x; }

  // the water a station needs kept clear (stage.js): half-widths at the type and at the far end, how far toward the
  // eye, how far behind
  const clearOf = x => {
    const lay = layOf(x), G = x.G;
    if (G.plan && G.page) { const w = G.page.W / 2 + 1.6; return {w, w2: w, d: G.page.D + 2.4, back: -(lay.py1 ?? 1) - 2.4}; }
    if (x.title) return {w: DISC * LABEL + 2, w2: DISC * LABEL + 2, d: distOf(x) * 1.3 + 1.5, back: -(DISC * LABEL + 2)};
    return {w: lay.w / 2 + 1.5, w2: Math.max(4, x.phantom ? lay.w / 2 + 1.5 : 0), d: distOf(x) * 1.3 + 1.5, back: (lay.z0 || 0) - 3.2};
  };
  return {T, mode: modeName, stations: st, groups, scenes, byLine, stationFrame, groupFrame, metrics, distOf, clearOf, unitPoint: (x, k, edge, out) => (place(), unitPt(x, k, edge, out)), camera, target, readHead, rowZ, rowGo, leaveAt, current, blinkAt, offset, waterY: WATER_Y,
    fovAt: () => S.fov, get baseFov() { return fit.fov; }, planned: () => plan(),
    get title() { place(); return title; },
    lineFrame: (L, out) => stationFrame(byLine.get(L.i), out), stationOf: L => byLine.get(L.i), layOf,
    setLayout: fn => { layout = fn; layKey++; }, setFit: (fov, aspect) => { fit = {fov, aspect}; layKey++; }, setPointer: (x, y) => pointer.set(x, y)};
}
