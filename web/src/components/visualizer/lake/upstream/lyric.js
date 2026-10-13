// Lyrics as the lead of the picture. The lake's waterline is the baseline of the type: every word stands on the
// water with its foot on that line, so its reflection always starts right under it (shots.js sets every stanza
// somewhere else on the lake and reads it with a composed shot; score.js stages it).
//   compositions  row      one baseline; words a little nearer or farther (parallax)
//                 steps    a line too long for one baseline: 2–3 rows, each next one rising nearer the viewer
//                 column   vertical CJK: pillars standing in the water, their reflection continuing them downward
//                 poster   one hero word huge on the waterline, the others small beside it
//   word by word  a line is not always set whole (score.js cuts it into beats: a word with the small words that
//                 lead to it):
//                 single   one beat at a time, large, on the same spot; each makes way for the next
//                 relay    each new beat stands in front while the one before steps back and aside, and the one
//                          before that leaves
//                 scatter  the beats stand all over the water, near and far; none is there before its own note
//   the page      some paragraphs are laid on the water and read from straight above (shots.js). There the type
//                 lies flat, the water is the sheet, and "under the line" is under the surface: a line comes up
//                 from the depth (blurred, bent and dimmed by the water over it), its words wait just under the
//                 surface, and each breaks the surface on its own note
//   arriving      nothing stands waiting down a road: a line is not there until about a second before it is sung.
//                 Then it arrives in one of ten ways, word after word, and is at rest before its first note:
//                   rise    out of the water, its reflection growing downward with it
//                   fall    out of the sky as a streak that lands on its own reflection
//                   turn    edge-on, turning to face the eye like a row of louvres
//                   gather  drawn together along the waterline from both sides and from behind
//                   sprout  drawn up out of the waterline itself, from nothing to its height
//                   slide   in along the waterline from one side
//                   surf    from far out over the water to its place
//                   type    set down letter by letter, each one there at once
//                   flap    standing up from flat on the water, while the line before falls back onto it
//                   door    the next panel of a screen, swinging round on the end of the line before
//                 on a page: up from the depth, drifting in on the surface, spreading like a drop of ink, or typed
//   waiting       then it stands still in its waiting face (2026-10-07: no swaying, no bobbing, no wake moves; the
//                 user found the side-to-side and up-and-down motion tiresome). A word moves on its note only
//   the hit       everything visible about a sung word is finished ON its note (the lyric clock runs LEAD s ahead
//                 of the sound, never behind): an anticipation in the tenth of a second before, then in one frame
//                 the pop (from the foot), the flash and a ring on the water. The typeface changes in one of two
//                 ways: different faces swap by collapsing into the waterline and springing out of it as the sung
//                 face (standing at the note); the same face in outline or hairline is filled from the waterline up
//                 while the note lasts
//   guessed times where the lyric file gives only the line's time (score.js: `soft`), the words' own times are a guess
//                 that is wrong by about a word. There nothing strikes on a word's time: each word turns from its
//                 waiting face to its sung one slowly, over the time its guess could be wrong by, so the light passes
//                 through the line as a wide soft front; and the pop, the flash and the ring fall on the measured
//                 onsets of the music, on whichever word the light is on then
//   the gesture   a word whose meaning asks for it does what it says, on its note and on the water (read by the
//                 model or the lexicon, score.js): it trembles, sways, goes under and comes back, swells, turns once
//                 on its foot, tips over and stays tipped, falls back, beats, darts along the waterline, stops
//                 dead, burns brighter, or rings out again and again. At most two words of a line.
//   the music     how hard the note is struck sets the weight of the hit; where the sound is bright the word is
//                 lit whiter, where it is dark, warmer and dimmer
//   the note's motion  each style has its own few (HITS): rock slams, punches or cuts in; pop bounces, flips up or
//                 blooms; electro stretches, strobes or slips; hip-hop stamps (and stays askew), drops or punches;
//                 anime zooms, flips or swivels in; soft blooms, rises or stays still; indie types, rises or flips.
//                 A line keeps one (never the line before's); its hero word takes the style's strongest
//   leaving       a stanza leaves by the water too, in one of eight ways: it sinks, parts along the waterline, folds
//                 down, lifts off into the sky, shuts like louvres, melts into the waterline, recedes over the
//                 water, or is blown off it. A page sinks back, drifts apart, or is washed out by the water.
//   translation   a flat subtitle at the foot of the frame (ink.js), not an object in the scene
// No copies of glyphs (no ghosts, no echoes). Positions are functions of song time: stills, seeks and playback agree.
// The song's title is not a lyric: it has its own staging (title.js).
import * as THREE from 'three';
import {HUE} from './sense.js';
import {WATER_Y} from './shots.js';
import {ZS} from './score.js';

const FS = 112, PAD = .28;
export const EM = .36;                                             // world units per em at size 1
export const LEAD = .06;                                           // s the lyric clock runs ahead of the sound
const FOOT = .3, CJK_LIFT = .085;                                  // baseline below a glyph plane's centre (em); CJK ink foot below the baseline
const DW = .42;                                                    // on a page: how deep under the surface a word waits
const SERIF = `'Instrument Serif','Noto Serif JP','Noto Serif SC',serif`, JP = `'Noto Serif JP','Noto Serif SC','Instrument Serif',serif`, GROT = `'Archivo','MiSans',sans-serif`;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const outCubic = x => 1 - Math.pow(1 - clamp(x), 3), inCubic = x => Math.pow(clamp(x), 3);
const outBack = (x, k = 1.2) => { x = clamp(x) - 1; return 1 + (k + 1) * x * x * x + k * x * x; };
const inOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// vY: how high a point is along the type's own "up" (the world's up for standing type, up the page for type lying
// on the water); vW: its height in the world; vP: where it is over the water
const GLYPH_VS = `uniform vec3 uUp; varying vec2 vUv, vP; varying float vY, vW;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vY = dot(wp.xyz, uUp); vW = wp.y; vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
// uSide: 0 whole glyph, +1 only above the fill line (the waiting face), -1 only below it (the sung face).
// Standing: under the waterline a descender may dip (dimmer, by uDip); the mirrored picture is cut exactly at the
// line. Lying on the water (uFlat): what is under the surface is seen through the water: the deeper, the more the
// surface bends it, blurs it and takes its light; it is not in the water's mirror picture.
const GLYPH_FS = `uniform sampler2D map; uniform vec3 uCol, uEdgeCol, uDeep; uniform float uA, uFill, uSide, uEdge, uDip, uMirror, uWater, uFlat, uWob, uT, uHalo; varying vec2 vUv, vP; varying float vY, vW;
// a halo's blur leaves a faint floor over its whole box: cut it, and let it fade before the box's edges
float glyphA(vec2 uv, float lod){ float v = texture2D(map, uv, lod).a; if (uHalo > .5) v = max(0., v - .0392) * 1.0408 * clamp(min(min(uv.x, 1. - uv.x) / .12, min(uv.y, 1. - uv.y) / .2), 0., 1.); return v; }
void main(){
  float a; vec3 col = uCol;
  if (uFlat > .5) {
    if (uMirror > .5) discard;
    float d = max(0., uWater - vW), k = (.002 + .02 * d) * uWob;
    vec2 uv = vUv + k * vec2(sin(vP.x * 3.3 + vP.y * 1.7 + uT * 1.4), cos(vP.y * 2.9 - vP.x * 1.3 + uT * 1.1));
    a = glyphA(uv, min(d * 1.8, 4.5)) * uA * exp(-d * .5);
    col = mix(uCol, uDeep, 1. - exp(-d * .7));
  } else {
    if (vW < uWater - uDip * (1. - uMirror)) discard;
    a = glyphA(vUv, 0.) * uA * (vW < uWater ? .4 : 1.);
  }
  if (uSide != 0.) a *= smoothstep(-.006, .006, (vY - uFill) * uSide);
  if (a < .003) discard;
  gl_FragColor = vec4(col + uEdgeCol * uEdge * exp(-abs(vY - uFill) / .018), a);
}`;

// ---- arriving and leaving: what a word does on the way in (en 0 → 1) and on the way out (xk 0 → 1) ---------
// x, y in em (along the waterline, above it), z in world units toward the eye, rotations in radians, scales about
// the foot. On a page y is up the page and z up out of the water (so -z is depth).
const mkT = () => ({x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, a: 1, wob: 1, hot: 0});
const zero = o => { o.x = o.y = o.z = o.rx = o.ry = o.rz = o.hot = 0; o.sx = o.sy = o.a = o.wob = 1; return o; };
const PAGE_IN = new Set(['deep', 'drift', 'spread', 'type']), PAGE_OUT = new Set(['sink', 'adrift', 'wash', 'part', 'back', 'pass', 'side']);
const SPLASH = new Set(['rise', 'fall', 'flap', 'unfold', 'sprout', 'drop']);
function arrive(A, kind, en, L, k, P, u, column, layH, flat, quick) {
  zero(A);
  if (en >= 1) return A;
  const h = hash(k, L.i + 9), side = L.seed < .5 ? -1 : 1;
  if (flat && !PAGE_IN.has(kind)) kind = 'deep';
  if (!flat && (kind === 'deep' || kind === 'drift' || kind === 'spread')) kind = 'rise';
  switch (kind) {
    case 'rise': A.y = -(column ? layH / EM + .3 : P.size * (u.cjk ? 1.05 : .85) + .3) * (1 - (column ? outCubic(en) : outBack(en))); break;
    case 'fall': { const d = 1 - outCubic(en); A.y = (5 + 4 * h) * d; A.sy = 1 + 1.5 * d; A.a = sm(0, .3, en); break; }
    case 'drop': { const d = 1 - outCubic(en); A.y = 2.2 * P.size * d; A.sy = 1 + .6 * d; A.a = sm(0, .35, en); break; }
    case 'turn': A.ry = side * 1.5708 * (1 - outCubic(en)); A.a = sm(0, .2, en); break;
    case 'gather': { const d = 1 - outCubic(en); A.x = P.x * .5 * d; A.z = -1.4 * d; A.a = sm(0, .55, en); break; }
    case 'flap': A.rx = 1.45 * (1 - outBack(en, 1)); A.a = sm(0, .25, en); break;
    case 'unfold': A.rx = -1.5 * (1 - outBack(en, 1)); A.a = sm(0, .2, en); break;   // (pop-up: lying with its head away, so it reads from above)
    case 'sprout': A.sy = Math.max(.02, outBack(en, 1.5)); A.a = sm(0, .12, en); break;
    case 'slide': A.x = side * (5 + 5 * h) * (1 - outCubic(en)); A.a = sm(0, .45, en); break;
    case 'surf': A.z = -8 * (1 - outCubic(en)); A.a = sm(0, .5, en); break;
    case 'type': A.a = en > .4 ? 1 : 0; A.sx = A.sy = 1 + .12 * (1 - sm(.4, 1, en)); break;
    case 'pop': A.sx = A.sy = .55 + .45 * outBack(en, 2); A.a = sm(0, .3, en); break;
    case 'deep': { const d = 1 - outCubic(en); A.z = -(quick ? 1.7 : 4.2) * d; A.rz = (h - .5) * .5 * d; break; }
    case 'drift': { const d = 1 - outCubic(en); A.x = side * (4 + 4 * h) * d; A.rz = side * .3 * d; A.a = sm(0, .5, en); break; }
    case 'spread': A.sx = A.sy = .35 + .65 * outCubic(en); A.wob = 1 + 9 * (1 - en); A.a = sm(0, .6, en); break;
    default: A.a = sm(.1, .7, en);                                   // door: the whole panel swings (updateLine)
  }
  return A;
}
function leave(V, kind, xk, L, k, P, column, layH, flat) {
  zero(V);
  if (xk <= 0) return V;
  const h = hash(k + 3, L.i + 21), side = L.seed < .5 ? -1 : 1;
  if (flat && !PAGE_OUT.has(kind)) kind = 'sink';
  if (!flat && (kind === 'adrift' || kind === 'wash')) kind = 'sink';
  switch (kind) {
    case 'sink': if (flat) { V.z = -5 * inCubic(xk); V.a = 1 - sm(.45, 1, xk); } else { V.y = -(column ? layH / EM + .3 : 1.2 * P.size) * inCubic(xk); V.a = 1 - .35 * xk; } break;
    case 'part': V.x = (P.x >= 0 ? 1 : -1) * (1.2 + Math.abs(P.x) * .35) * outCubic(xk); V.a = 1 - inOut(xk); break;
    case 'lift': { const q = inCubic(xk); V.y = (4 + 4 * h) * q; V.sy = 1 + 1.4 * q; V.a = 1 - sm(.25, 1, xk); break; }
    case 'shut': V.ry = -side * 1.5708 * inCubic(xk); V.a = 1 - sm(.7, 1, xk); break;
    case 'melt': V.sy = Math.max(.015, 1 - outCubic(xk)); V.hot = Math.sin(Math.PI * Math.min(1, xk * 1.6)); V.a = 1 - sm(.75, 1, xk); break;
    case 'recede': V.z = -10 * inOut(xk); V.a = 1 - sm(.35, 1, xk); break;
    case 'blow': { const q = inCubic(xk); V.x = side * (3 + 6 * h) * q; V.y = (.3 + 1.2 * h) * q; V.rz = -side * (.4 + .8 * h) * q; V.a = 1 - sm(.3, 1, xk); break; }
    case 'adrift': { const an = h * 6.2832, q = outCubic(xk); V.x = Math.cos(an) * 2.2 * q; V.y = Math.sin(an) * 2.2 * q; V.rz = (h - .5) * 1.6 * q; V.a = 1 - inOut(xk); break; }
    case 'wash': V.wob = 1 + 16 * xk; V.z = -.8 * xk; V.a = 1 - sm(.25, 1, xk); break;
    case 'lay': V.rx = -1.5708 * inOut(xk / .3); V.a = 1 - .25 * sm(.3, .6, xk) - .75 * sm(.82, 1, xk); break;   // folds flat, stays, then goes
    // one beat making way for the next
    case 'back': V.z = -3.2 * inOut(xk); V.sx = V.sy = 1 - .25 * xk; V.a = 1 - sm(.2, 1, xk); break;
    case 'pass': V.z = (flat ? 1.2 : 2.6) * inCubic(xk); V.sx = V.sy = 1 + .5 * xk; V.a = 1 - sm(.15, .9, xk); break;
    case 'side': V.x = -side * 5 * inCubic(xk); V.a = 1 - sm(.2, 1, xk); break;
    default: V.rx = -1.5 * inOut(xk); V.a = 1 - .9 * inCubic(xk);        // fold
  }
  return V;
}
const EXIT_DUR = {lift: .6, recede: .8, blow: .7, melt: .36, shut: .45, adrift: .9, wash: .8};

// ---- what a word does on its note, by style (weights; the first is the hero's) --------------------------------
const HITS = {rock: {slam: .4, punch: .35, cut: .25}, pop: {bounce: .35, flip: .3, bloom: .35}, electro: {stretch: .45, slip: .3, bloom: .25},
  hiphop: {stamp: .45, drop: .35, punch: .2}, anime: {zoom: .4, flip: .3, swivel: .3}, soft: {bloom: .4, rise: .4, still: .2}, indie: {type: .3, rise: .35, flip: .35}};
const mkH = () => ({x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, fl: 0, a: 1, wa: 1});
// tau: s since the note; as: the eased approach to it (0..1); x, y in em, z in world units; wa: the waiting word's
// alpha; a: the sung word's. One move each, eased, never swinging back and forth.
function hitMotion(H, kind, tau, as, sung, amp, seed) {
  H.x = H.y = H.z = H.rx = H.ry = H.rz = H.fl = 0; H.sx = H.sy = H.a = H.wa = 1;
  const e = d => Math.exp(-Math.max(0, tau) / d), q = x => 1 - clamp(x);
  switch (kind) {
    case 'slam': if (!sung) H.y = .16 * as; else { const k = e(.07) * Math.min(1.2, amp); H.sy = 1 - .22 * k; H.sx = 1 + .1 * k; H.fl = .06 * e(.1); } break;
    case 'punch': if (sung) { const k = e(.16) * Math.min(1.2, amp); H.z = .4 * k; H.sx = H.sy = 1 + .08 * k; H.fl = .06 * e(.12); } break;
    case 'cut': if (!sung) H.wa = .3; else H.fl = .08 * e(.12); break;
    case 'stretch': if (sung) { const k = q(tau / .2) ** 3; H.sx = 1 + .6 * k * amp; H.sy = 1 - .16 * k; } break;
    case 'slip': if (sung && tau < .085) { H.x = (seed < .5 ? -1 : 1) * .16; H.sx = 1.08; } else if (sung) H.fl = .25 * e(.1); break;
    case 'stamp': if (sung) { const k = q(tau / .08) ** 2; H.sx = H.sy = 1 + .2 * k * Math.min(1.2, amp); H.rz = (seed - .5) * .13 * (1 - k); H.fl = .04 * e(.1); } break;
    case 'drop': if (!sung) { H.y = .3; H.wa = .6; } else { const k = q(tau / .06); H.y = .3 * k; H.sy = 1 - .16 * e(.06) * (1 - k); } break;
    case 'flip': if (!sung) H.rx = -.55; else H.rx = -.55 * (1 - outBack(tau / .24, 1.4)); break;
    case 'bloom': if (sung) { const s = .05 * Math.min(1.3, amp) * Math.sin(Math.PI * clamp(tau / .6)); H.sx = H.sy = 1 + s; H.fl = .1 * e(.35); } break;
    case 'rise': if (!sung) { H.y = -.12 * (1 - as); H.wa = .7 + .3 * as; } break;
    case 'zoom': if (sung) { const k = q(tau / .22); H.sx = H.sy = 1 + .2 * (1 - outCubic(1 - k)) * Math.min(1.2, amp); H.fl = .05 * e(.2); } break;
    case 'swivel': H.ry = sung ? -.5 * (1 - outBack(tau / .3, 1.2)) : -.5; break;
    case 'type': if (!sung) H.wa = 0; else H.y = -.05 * q(tau / .1); break;
    case 'still': break;
    default: if (!sung) H.sy = 1 - .07 * as * as; else { const p = Math.exp(-tau / .12) * Math.cos(tau * 17); H.sx = 1 + .05 * amp * p; H.sy = 1 + .13 * amp * p; }   // bounce
  }
  return H;
}

export function createLyrics(scene, renderer = null) {
  const group = new THREE.Group(); scene.add(group);
  const mc = document.createElement('canvas').getContext('2d');
  const SHARED = {uMirror: {value: 0}, uWater: {value: WATER_Y}, uT: {value: 0}, uDeep: {value: new THREE.Color(.02, .03, .05)}};
  let track = null, score = null, shots = null, aspect = 16 / 9, C = {}, live = new Map(), layouts = new Map(), lensK = 1, hitOf = new Map(), heroKind = 'bounce';
  const HM = mkH(), heroHit = {p: new THREE.Vector3(), t: -9};
  const hits = [], splash = [];
  let probe = null;                                                  // (tests) called the first frame a word is drawn as sung
  // motes of light shed by a sung hero or image word (styles with emph 'motes'): a pool of points filled every frame
  // from the words sung in the last few seconds, each mote a function of song time (stills and seeks agree)
  const MOTE_N = 720, mPos = new Float32Array(MOTE_N * 3), mCol = new Float32Array(MOTE_N * 3), mAS = new Float32Array(MOTE_N * 2);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3)); moteGeo.setAttribute('aC', new THREE.BufferAttribute(mCol, 3)); moteGeo.setAttribute('aAS', new THREE.BufferAttribute(mAS, 2));
  const moteMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uPx: {value: 40}, uShape: {value: 0}, uMirror: SHARED.uMirror},
    vertexShader: `attribute vec3 aC; attribute vec2 aAS; uniform float uPx; varying vec3 vC; varying float vA; void main(){ vC = aC; vA = aAS.x; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * aAS.y / max(-mv.z, .5), 0., 26.); }`,
    fragmentShader: `uniform float uMirror, uShape; varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float r = dot(q, q) * 4.; float a = exp(-r * 3.2) * .85 + exp(-r * 18.) * .5;
      if (uShape > .5) { vec2 b = abs(q); a = (1. - smoothstep(.16, .22, max(b.x, b.y))) * .9 + exp(-r * 4.) * .25; }   // (electro) a square pixel of light
      gl_FragColor = vec4(vC * a * vA * (uMirror > .5 ? .45 : 1.), 1.); }`});
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; motes.renderOrder = 8; group.add(motes);
  const emitters = [], EMIT = Array.from({length: 48}, () => ({p: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Color()}));
  function fillMotes(lt, cam) {
    let m = 0;
    for (const E of emitters) {
      for (let j = 0; j < E.count && m < MOTE_N; j++) {
        const h1 = hash(j, E.seed), h2 = hash(j + 3.1, E.seed), h3 = hash(j + 7.7, E.seed), h4 = hash(j + 11.3, E.seed);
        // they peel off the word from one end to the other, then rise, slowing, and drift aside, turning a little
        const K = E.mk, age = E.age - h1 * .4, life = (1.5 + 1.3 * h2) * (K.life ?? 1); if (age <= 0 || age > life) continue;
        // (electro) it moves in steps, like a pixel crossing a display
        const ta = K.quant ? Math.floor(age * 12) / 12 : age;
        const x = (h1 - .5) * E.w, y = (h3 - .2) * E.h, up = (.55 + .9 * h4) * E.h * (1 - Math.exp(-ta / 1.1)) * 1.6 * (K.rise ?? 1), side = ((h2 - .5) * E.h * 1.4 * (1 - Math.exp(-ta / 1.4)) + .08 * E.h * Math.sin(ta * (1.6 + h3) + h1 * 9)) * (K.side ?? 1);
        const f = age / life, fl = K.flicker ? (hash(Math.floor(age * 18), j + E.seed) > .3 ? 1 : .2) : 1, a = sm(0, .12, age) * (1 - f) * (1 - f) * (.55 + .45 * Math.sin(age * (5 + 6 * h4) + h2 * 9) ** 2) * E.a * fl;
        tmpV.copy(E.p).addScaledVector(E.r, x + side).addScaledVector(E.u, y + up).addScaledVector(E.n, (h3 - .5) * .25 * E.h);
        tmpV.toArray(mPos, m * 3); col.copy(E.c).lerp(K.warm ? EMBER : WHITE, K.warm ? K.warm + .3 * f : .35 + .3 * h3); col.toArray(mCol, m * 3);
        mAS[m * 2] = a; mAS[m * 2 + 1] = (.6 + 1.3 * h2 * h2) * (.7 + .3 * E.h) * (K.size ?? 1); m++;
      }
    }
    for (let i = m; i < MOTE_N; i++) mAS[i * 2] = 0;
    moteGeo.setDrawRange(0, Math.max(1, m)); moteGeo.attributes.position.needsUpdate = moteGeo.attributes.aC.needsUpdate = moteGeo.attributes.aAS.needsUpdate = true;
    moteMat.uniforms.uPx.value = 64 * (cam.userData.pxScale || 1) / (cam.userData.lens || 1); moteMat.uniforms.uShape.value = track?.style?.motes?.shape || 0;
    motes.visible = m > 0;
  }
  const WHITE = new THREE.Color(1, 1, 1), EMBER = new THREE.Color(1, .55, .25);

  // ---- typefaces ----------------------------------------------------------------------------------------
  const F = {
    serif: {pre: '400', fam: SERIF}, serifI: {pre: 'italic 400', fam: SERIF},
    jp4: {pre: '400', fam: JP}, jp6: {pre: '600', fam: JP}, jp9: {pre: '900', fam: JP},
    thin: {pre: '200', fam: GROT, stretch: 'expanded', upper: true, track: .12}, light: {pre: '300', fam: GROT, stretch: 'semi-expanded', upper: true, track: .14},
    hair: {pre: '200', fam: GROT, stretch: 'extra-condensed', upper: true}, black: {pre: '900', fam: GROT, stretch: 'extra-condensed', upper: true},
    sans: {pre: '300', fam: `'MiSans','Noto Sans SC','PingFang SC',sans-serif`}, sans6: {pre: '600', fam: `'MiSans','Noto Sans SC','PingFang SC',sans-serif`},
    wide: {pre: '800', fam: GROT, stretch: 'expanded', upper: true, track: .06}, mono: {pre: '500', fam: `'IBM Plex Mono',ui-monospace,monospace`, upper: true, track: .08},
  };
  // a style's face by name ('~' after it: the same face in outline)
  const FC = {}, fc = n => FC[n] ||= (n.endsWith('~') ? {...F[n.slice(0, -1)], outline: true} : F[n]) || F.serif;
  const NOSTYLE = {flash: .6, pop: 1, glow: .9, emph: 'motes', motes: {}};
  // [waiting face, sung face] of a unit, from the line's type pair (score.js) and the unit's role
  function facesOf(L, u) {
    const small = L.layout === 'poster' && !u.hero, S = track?.style;
    if (S) return styledFaces(S, L, u, small);
    if (u.cjk) {
      if (small) return [F.sans, F.jp4];
      const f = u.hero ? F.jp9 : F.jp6;
      switch (L.type) {
        case 'whisper': return [F.sans, f];
        case 'outline': case 'mass': return [F.jp4, F.jp9];
        default: return [F.jp4, f];
      }
    }
    if (small) return [F.serifI, F.serifI];
    switch (L.type) {
      case 'whisper': return [F.hair, u.fn ? F.serifI : F.serif];
      case 'outline': { const f = u.fn ? F.serifI : F.serif; return [{...f, outline: true}, f]; }
      case 'mass': return [F.hair, F.black];
      default: return u.fn ? [F.serifI, F.serifI] : [F.serifI, F.serif];
    }
  }
  // the style's pair for the line's type; a poster's small words stay small and quiet, a function word sung in a
  // serif is sung in its italic, a whispered CJK line waits in the sans
  function styledFaces(S, L, u, small) {
    if (u.cjk) {
      if (small) return [F.sans, fc(S.cjk.wait)];
      const strong = u.hero || L.type === 'mass' || L.type === 'outline';
      return [L.type === 'whisper' && S.cjk.wait !== S.cjk.sung ? F.sans : fc(S.cjk.wait), fc(strong ? S.cjk.hero : S.cjk.sung)];
    }
    const [a, b] = S.latin[L.type] || S.latin.wire;
    if (small) { const q = fc(b).fam === SERIF ? F.serifI : fc(a.replace('~', '')); return [q, q]; }
    const sb = u.fn && b === 'serif' ? F.serifI : fc(b);
    return [fc(a), sb];
  }
  const sameFace = (a, b) => a.pre === b.pre && a.fam === b.fam && a.stretch === b.stretch && !!a.outline === !!b.outline;
  const italic = f => /italic/.test(f.pre);
  // how the waiting face becomes the sung one: the same skeleton is filled from the waterline, another face swaps through it
  const modeOf = (a, b) => (sameFace(a, b) ? 'tint' : a.fam === b.fam && a.stretch === b.stretch && !!a.upper === !!b.upper && italic(a) === italic(b) ? 'fill' : 'swap');
  const setFont = (c, f, px = FS) => { c.font = `${f.pre} ${px}px ${f.fam}`; c.fontStretch = f.stretch || 'normal'; c.letterSpacing = f.track ? `${f.track * px}px` : '0px'; };
  const label = (u, f) => (f.upper ? u.t.toUpperCase() : u.t);
  function measure(u, f) { setFont(mc, f); return mc.measureText(label(u, f)).width / FS + (f.track || 0) * .2; }

  // ---- compositions: x in em along the waterline, z in world units toward the lens, y in em above the water
  // (on a page: up the page; there rows go down the page instead of toward the lens) --------------------------
  function layoutOf(L) {
    if (!L) return {w: 3, h: .8, z0: 0, z1: 0, P: [], rows: [], unitX: [], py0: 0, py1: .8};
    const key = L.i + '|' + aspect.toFixed(2);
    if (layouts.has(key)) return layouts.get(key);
    const U = L.units, n = U.length, wideK = clamp(aspect / 1.78, .7, 1.15), r = k => hash((L.seed || .3) * 991 + L.i, k), plan = !!L.plan;
    const faces = U.map(u => facesOf(L, u)), fonts = faces.map(f => f[1]), widths = U.map((u, k) => measure(u, fonts[k]));
    const sp = k => (U[k].space ? .36 + (fonts[k].track || 0) * 2.4 : U[k].cjk ? .05 : .02);
    const zj = k => (plan ? 0 : U[k].hero ? .08 : (hash(U[k].word, L.i + 5) - .5) * .1);
    const P = U.map(() => ({x: 0, y: 0, z: 0, size: 1, w: 0, row: 0}));
    const rows = [], all = U.map((u, k) => k), extra = {};
    // of a line's own rows the earlier ones stand farther back: set a little larger, so the line reads as one text
    const far = j => 1 + .1 * (L.layout === 'steps' && !plan ? Math.max(0, (L.rows || 2) - 1 - j) : 0);
    const rowW = (ks, sizes) => ks.reduce((s, k, i) => s + widths[k] * sizes[k] + (i < ks.length - 1 ? sp(k) * sizes[k] : 0), 0);
    // set units ks on one baseline from x0 at depth z; returns the row's width
    const setRow = (ks, sizes, x0, z, row) => {
      let x = x0;
      ks.forEach((k, i) => { const s = sizes[k]; if (U[k].sub && i) x += .45 * sizes[ks[i - 1]]; P[k] = {x: x + widths[k] * s / 2, y: 0, z: z + (U[k].sub ? 0 : zj(k)), size: s, w: widths[k] * s, row}; x += widths[k] * s + (i < ks.length - 1 ? sp(k) * s : 0); });
      rows.push({k0: ks[0], k1: ks[ks.length - 1], z});
      return x - x0;
    };
    const beatKs = b => all.slice(b.k0, b.k1 + 1), B = L.beats || [];
    if (L.layout === 'column') {
      // pillars: characters top to bottom, columns right to left, split at a word boundary near the middle; every
      // pillar stands in the water, the second a step behind
      const split = n > 9 ? (() => { let best = Math.ceil(n / 2); for (let k = 1; k < n; k++) if (U[k].word !== U[k - 1].word && Math.abs(k - n / 2) < Math.abs(best - n / 2)) best = k; return best; })() : n;
      const cols = split < n ? [[0, split], [split, n]] : [[0, n]];
      cols.forEach(([a, b], ci) => {
        let y = 0;
        for (let k = b - 1; k >= a; k--) { const s = U[k].size * (U[k].hero ? 1.3 : 1.06); P[k] = {x: -ci * 1.75, y, z: plan ? 0 : -ci * .7, size: s, w: U[k].cjk ? s : widths[k] * s, row: ci}; y += (U[k].cjk ? 1.06 : .8) * s + (k > a && U[k - 1].space ? .16 : .03); }
        rows.push({k0: a, k1: b - 1, z: plan ? 0 : -ci * .7, vertical: true});
      });
    } else if (L.layout === 'poster') {
      const hk = all.filter(k => U[k].hero), h0 = hk[0] ?? 0, h1 = hk[hk.length - 1] ?? 0, heroKs = all.slice(h0, h1 + 1);
      const heroW = heroKs.reduce((s, k) => s + widths[k] + (k < h1 ? sp(k) : 0), 0) || 1;
      const H = clamp(9.5 * wideK / heroW, 2.2, 4.6), s2 = clamp(H * .24, .7, 1), sizes = U.map((u, k) => (k >= h0 && k <= h1 ? H : s2));
      if (plan) {
        // on a page: the small words over the hero's left shoulder and under its right foot
        const wH = setRow(heroKs, sizes, 0, 0, 1); rows[rows.length - 1].hero = true;
        if (h0 > 0) { const ks = all.slice(0, h0); setRow(ks, sizes, 0, 0, 0); for (const k of ks) P[k].y = H * (U[h0].cjk ? 1.08 : .9); }
        if (h1 < n - 1) { const ks = all.slice(h1 + 1), wA = rowW(ks, sizes); setRow(ks, sizes, wH - wA, 0, 2); for (const k of ks) P[k].y = -s2 * 1.3; }
      } else {
        // [before] HERO [after] on one waterline: the hero huge, the others small, a step behind it on the left and a
        // step nearer on the right
        let x = 0;
        if (h0 > 0) x += setRow(all.slice(0, h0), sizes, x, -.8, 0) + .3 * H;
        x += setRow(heroKs, sizes, x, 0, 1) + .3 * H; rows[rows.length - 1].hero = true;
        if (h1 < n - 1) setRow(all.slice(h1 + 1), sizes, x, .5, 2);
      }
    } else if (L.layout === 'steps') {
      // a line too long for one baseline: 2–3 rows, the first farthest, each next one a step nearer the viewer and
      // a little to the right (the line builds toward the eye like a paragraph); on a page, rows down the page
      const words = [...new Set(U.map(u => u.word))], nR = clamp(L.rows || 2, 2, Math.min(3, words.length));
      const total = rowW(all, U.map(u => u.size)), bounds = [0];
      let acc = 0, wi = 0, yAcc = 0;
      for (let j = 1; j < nR; j++) { while (wi < words.length - (nR - j) && acc < total * j / nR) { acc += rowW(all.filter(k => U[k].word === words[wi]), U.map(u => u.size)) + .3; wi++; } bounds.push(Math.max(wi, bounds[j - 1] + 1)); }
      bounds.push(words.length);
      for (let j = 0; j < nR; j++) {
        const lo = words[bounds[j]], hi = words[bounds[j + 1]] ?? 1e9, ks = all.filter(k => U[k].word >= lo && U[k].word < hi);
        if (!ks.length) continue;
        const sizes = U.map(u => u.size * (u.hero ? 1.3 : 1) * far(j));
        if (plan && j) yAcc -= 1.2 * Math.max(...ks.map(k => sizes[k])) + .22;
        setRow(ks, sizes, j * 1.3, plan ? 0 : j * ZS, j);
        if (plan) for (const k of ks) P[k].y = yAcc;
      }
    } else if ((L.layout === 'single' || L.layout === 'relay') && B.length) {
      // one beat at a time on the same spot, each set as large as the spot allows
      const target = (L.layout === 'single' ? 8.6 : 6.4) * wideK, base = U.map(u => u.size * (u.hero ? 1.2 : 1));
      let maxW = 0;
      for (const b of B) {
        const ks = beatKs(b), f = clamp(target / Math.max(.5, rowW(ks, base)), 1.15, 3.3), sizes = base.map(s => s * f), w = rowW(ks, sizes);
        setRow(ks, sizes, -w / 2, 0, 0); rows.pop(); maxW = Math.max(maxW, w);
      }
      rows.push({k0: 0, k1: n - 1, z: 0});
      // (relay) how far a beat steps aside and back each time a new one takes the front
      // (to the left: what was sung earlier stands earlier in the line)
      if (L.layout === 'relay') { extra.relay = {dir: -1, stepX: maxW * .52, stepZ: 1.6, maxW}; extra.raise = .6; }
    } else if (L.layout === 'scatter' && B.length) {
      // the beats all over the water: left to right, but each on one of three depths, larger where it matters
      const pat = [0, 1, -1, 1, 0, -1, 0, 1], o = Math.floor(r(3) * 8), rowEnd = {};
      let x = 0;
      B.forEach((b, bi) => {
        const ks = beatKs(b), heroB = ks.some(k => U[k].hero), f = heroB ? 1.85 : 1.1 + .5 * r(20 + bi), sizes = U.map(u => u.size * f);
        const w = rowW(ks, sizes), rj = bi ? pat[(bi + o) % 8] : 0, x0 = Math.max(x, (rowEnd[rj] ?? -1e9) + .5);
        setRow(ks, sizes, x0, plan ? 0 : rj * 2, rj + 1); rows.pop();
        if (plan) for (const k of ks) P[k].y = -rj * 2.3;
        rowEnd[rj] = x0 + w; x = x0 + w * .7;
      });
      rows.push({k0: 0, k1: n - 1, z: 0}); extra.raise = .85;
    } else {
      // row: one baseline, sizes in hierarchy
      const sizes = U.map(u => u.size * (u.hero ? (u.cjk ? 1.3 : 1.4) : 1));
      setRow(all, sizes, 0, 0, 0);
    }
    // bounds; x centred
    let x0 = 1e9, x1 = -1e9, top = -1e9, bot = 1e9, z0 = 1e9, z1 = -1e9;
    P.forEach((p, k) => { x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2); top = Math.max(top, p.y + p.size * (U[k].cjk ? 1 : .8)); bot = Math.min(bot, p.y - p.size * .22); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
    const cx = (x0 + x1) / 2;
    P.forEach(p => { p.x -= cx; });
    let w = (x1 - x0) * EM;
    // (relay) the front beat stands off-centre, so that with the ones stepping back the whole is centred
    if (extra.relay) { const R = extra.relay; P.forEach(p => { p.x -= R.dir * R.stepX; }); w = (R.maxW + 2 * R.stepX) * EM; }
    // the tallest row that has another row behind it, and the spacing of the rows (for the camera's height)
    const lay = {P, fonts, faces, widths, rows, w, h: Math.max(.2, top) * EM, z0, z1, rowH: Math.max(...P.map((p, k) => p.size * (U[k].cjk ? 1 : .8))) * EM,
      unitX: P.map((p, k) => (L.layout === 'column' ? k / Math.max(1, n - 1) : clamp((p.x * EM + w / 2) / Math.max(.01, w)))), unitW: P.map(p => p.w * EM), unitZ: P.map(p => p.z), unitY: P.map(p => (p.y + p.size * .4) * EM),
      py0: bot * EM, py1: top * EM, raise: extra.raise || 0, relay: extra.relay || null, near: plan || L.layout === 'steps' ? 0 : Math.max(0, z1 - .2), plan};
    layouts.set(key, lay);
    return lay;
  }

  // ---- meshes ---------------------------------------------------------------------------------------------
  const texCache = new Map();
  // Work is split at texture / mesh boundaries, preserving the exact Canvas drawing below. A single Canvas
  // operation cannot be preempted, so this is a soft budget. Captures and the actual entrance deadline finish
  // synchronously: a slow device or a seek must never change when a word appears.
  const BUILD_BUDGET_MS = 4;
  const buildStats = {steps: 0, frames: 0, maxSliceMs: 0, deadlineFinishes: 0, uploadFallbacks: 0};
  // a unit's texture: alpha only; the baseline is FOOT em under the centre whatever the face; px per em grows with
  // the size it will be seen at
  function glyph(txt, f, kind, res = 1) {
    const px = Math.round(FS * clamp(res, 1, kind === 'outline' ? 2.2 : 3.2) / 8) * 8;
    if (f.outline && kind === 'fill') kind = 'outline';
    const key = kind + '|' + f.pre + f.fam + '|' + (f.stretch || '') + '|' + (f.track || 0) + '|' + px + '|' + txt;
    if (texCache.has(key)) { const v = texCache.get(key); v.refs++; return v; }
    setFont(mc, f, px);
    const halo = kind === 'halo', tw = Math.ceil(mc.measureText(txt).width), pad = Math.round(px * (halo ? .7 : PAD)), scale = halo ? .4 : 1, hh = halo ? 2.6 : 1.6;
    const cw = Math.max(2, Math.ceil((tw + pad * 2) * scale)), ch = Math.ceil(px * hh * scale);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d'); c.scale(scale, scale); setFont(c, f, px); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const cx = (tw + pad * 2) / 2, cy = px * hh / 2 + FOOT * px;
    if (halo) {
      // (canvas filters are not scaled by the transform: radii are given in this canvas' own pixels)
      c.fillStyle = '#fff'; c.filter = `blur(${px * scale * .05}px)`; c.fillText(txt, cx, cy); c.filter = `blur(${px * scale * .15}px)`; c.fillText(txt, cx, cy);
      // the blur leaves a faint floor over the whole box; cut it so the halo has no edge
      // (the faint floor the blur leaves over the box is cut in the shader: uHalo)
    }
    else if (kind === 'outline') {
      c.strokeStyle = c.fillStyle = '#fff'; c.lineJoin = 'round'; c.lineWidth = Math.max(2.6, px * .034); c.strokeText(txt, cx, cy);
      c.globalCompositeOperation = 'destination-out'; c.fillText(txt, cx, cy); c.globalCompositeOperation = 'source-over';
    }
    else { c.fillStyle = '#fff'; c.fillText(txt, cx, cy); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const v = {tex, w: (tw + pad * 2) / px, h: hh, refs: 1, key, halo};
    texCache.set(key, v);
    return v;
  }
  function release(g) { if (--g.refs <= 0) { g.tex.dispose(); texCache.delete(g.key); } }
  const geo = new THREE.PlaneGeometry(1, 1);
  function plane(g, additive = false, order = 6, flat = false) {
    const mat = new THREE.ShaderMaterial({vertexShader: GLYPH_VS, fragmentShader: GLYPH_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {map: {value: g.tex}, uCol: {value: new THREE.Color(1, 1, 1)}, uEdgeCol: {value: new THREE.Color(1, 1, 1)}, uA: {value: 0}, uFill: {value: 0}, uSide: {value: 0}, uEdge: {value: 0}, uDip: {value: .012},
        uUp: {value: new THREE.Vector3(0, 1, 0)}, uFlat: {value: flat ? 1 : 0}, uWob: {value: 1}, uHalo: {value: g.halo ? 1 : 0}, ...SHARED}});
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = order; m.visible = false; m.frustumCulled = false; if (flat) m.layers.set(1); group.add(m);
    return m;
  }
  const lineMat = () => new THREE.LineBasicMaterial({transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending});
  // one of each kind, never shown, so their programs are compiled with everything else while a song loads (stage.warm)
  { const dt = new THREE.DataTexture(new Uint8Array(4), 1, 1); dt.needsUpdate = true; plane({tex: dt, halo: false});
    const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), lineMat()); m.visible = false; group.add(m); }
  const DESC = /[gjpqy,;()QJ[\]{}|_]/;

  function* acquireGlyph(e, txt, f, kind, res = 1) {
    const g = glyph(txt, f, kind, res); e.textures.push(g); yield;
    // Upload while still hidden, one texture at a time, so its first visible frame does not upload a whole line.
    // initTexture is optional: older/custom renderers keep Three's normal first-use path.
    if (!g.uploadAttempted && renderer?.initTexture) {
      g.uploadAttempted = true;
      try { renderer.initTexture(g.tex); g.uploaded = true; }
      catch { buildStats.uploadFallbacks++; } // context loss / custom renderer: retain Three's first-use path
      yield;
    }
    return g;
  }
  function* buildUnits(e, lay) {
    const L = e.L, U = L.units, flat = e.flat;
    for (let k = 0; k < U.length; k++) {
      const u = U[k];
      const [fa, fb] = lay.faces[k], txt = label(u, fb), res = lay.P[k].size;
      const g = yield* acquireGlyph(e, txt, fb, 'fill', res), h = yield* acquireGlyph(e, txt, fb, 'halo');
      const o = {g, h, main: plane(g, false, 7, flat), halo: plane(h, true, 6, flat), mode: modeOf(fa, fb)};
      e.units.push(o);
      yield;
      const dip = !u.cjk && DESC.test(txt) ? .27 * res * EM : .012;
      o.main.material.uniforms.uDip.value = dip;
      // the waiting face: its own texture, fitted to the sung face's width so the line keeps its shape
      if (o.mode !== 'tint') {
        const ta = label(u, fa), ga = yield* acquireGlyph(e, ta, fa, 'fill', res), k2 = lay.widths[k] / Math.max(.05, measure(u, fa));
        o.ga = ga; o.wait = plane(ga, false, 7, flat); o.wait.material.uniforms.uDip.value = !u.cjk && DESC.test(ta) ? dip : .012;
        o.fit = clamp(k2, .42, 1.25); o.fitX = clamp(k2, .5, 1.7);
      }
      // the hit's weight (the music's own accent on that note included), and the anticipation window before it
      // (never longer than the note before allows; a guessed time is met by a longer, softer approach)
      o.amp = (u.hero ? 1.5 : u.fn ? .55 : 1) * (L.approx ? .75 : 1) * (L.mood === 'quiet' ? .75 : 1) * (.78 + .5 * (u.acc ?? .5));
      o.pre = L.approx ? clamp((u.s - (k ? U[k - 1].s : -9)) * .9, .16, .32) : clamp((u.s - (k ? U[k - 1].s : -9)) * .8, .08, .2);
      yield;
    }
    e.star = (L.chorus || L.images.length) ? starMesh(L.images[0]) : null;
  }
  function advanceBuild(e, until = Infinity) {
    while (e.job && performance.now() < until) {
      const step = e.job.next(); buildStats.steps++;
      if (step.done) e.job = null;
    }
  }
  function build(L) {
    const lay = layoutOf(L), U = L.units, flat = !!L.plan;
    // arriving: word after word, every word in place and at rest before the first note (a later row of the line
    // before that row's own first note)
    const stn = shots.stationOf(L), enter = stn.enter || (flat ? 'deep' : 'rise'), n = U.length, tin = new Float32Array(n), tdur = new Float32Array(n), bout = new Float32Array(n).fill(1e9), bdur = new Float32Array(n).fill(.24);
    const lead = L.mood === 'quiet' ? 1.35 : L.mood === 'loud' ? .95 : 1.15, pvS = shots.stations[stn.i - 1];
    // where the stanza before stood in the same view (the camera only steps back), it has to be gone first
    const clearAt = stn.G.via === 'retreat' && !stn.behind && stn === stn.G.st[0] && pvS?.L ? exitOf(pvS).at + .25 : -1e9;
    const B = L.beats || [], beatLay = (L.layout === 'single' || L.layout === 'relay' || L.layout === 'scatter') && B.length > 0;
    let ek, t0 = 1e9, t1 = -1e9;
    if (enter === 'popup') {
      // coming down from a page: the line lies on the water where the eye will come down to it, and stands up as it
      // comes (the page before it folds flat as the eye goes up: the lake opens and shuts like a pop-up book)
      shots.planned();
      const h = stn.hand + shots.offset, ar = Math.min(stn.arrive + shots.offset, L.start - .1), a = h + .3 * (ar - h), b = ar - .04, d = Math.max(.25, (b - a) * .8), stg = n > 1 ? Math.max(0, b - a - d) / (n - 1) : 0;
      ek = U.map(() => 'unfold');
      U.forEach((u, k) => { tin[k] = a + k * stg; tdur[k] = d; });
      t0 = a; t1 = b;
    } else if (beatLay) {
      // word by word: the first beat arrives like any line and waits; every later one is not there until its note
      const b0 = L.start - .12, a0 = Math.min(b0 - .3, Math.max(stn.flipAt ?? L.start - lead, clearAt));
      ek = new Array(n);
      B.forEach((b, bi) => {
        const d = bi ? clamp((b.s - B[bi - 1].s) * .5, .1, .26) : Math.min(.5, Math.max(.2, (b0 - a0) * .8)), a = bi ? b.s - d - .02 : a0, cnt = b.k1 - b.k0 + 1;
        for (let k = b.k0; k <= b.k1; k++) {
          tin[k] = a + (bi ? 0 : (k - b.k0) * Math.min(.06, Math.max(0, b0 - a0 - d) / Math.max(1, cnt - 1))); tdur[k] = d; ek[k] = bi ? (flat ? 'deep' : L.beatIn || 'pop') : enter;
          // (one at a time) it makes way while the next one arrives
          if (L.layout === 'single' && bi < B.length - 1) { const dn = clamp((B[bi + 1].s - b.s) * .5, .1, .26); bout[k] = B[bi + 1].s - dn - .04; bdur[k] = dn + .02; }
        }
      });
      t0 = a0; t1 = b0;
    } else {
      const order = enter === 'fall' ? (i, m) => (i * 7 + 3) % m : enter === 'gather' || enter === 'spread' || L.layout === 'column' ? () => 0 : (enter === 'rise' || enter === 'sprout' || enter === 'deep') && L.seed < .4 ? (i, m) => Math.abs(i - (m - 1) / 2) * 1.6 : i => i;
      ek = U.map((u, k) => (L.layout === 'steps' && lay.P[k].row > 0 ? (flat ? 'deep' : 'rise') : L.layout === 'poster' && enter === 'fall' && !u.hero ? 'rise' : enter));
      [...new Set(lay.P.map(P => P.row))].forEach((rid, j) => {
        const ks = U.map((u, k) => k).filter(k => lay.P[k].row === rid), later = L.layout === 'steps' && j > 0;
        const b = (later ? U[ks[0]].s : L.start) - .12, a = later ? b - .85 : Math.min(b - .3, Math.max(stn.flipAt ?? L.start - lead, clearAt));
        const d = Math.min(enter === 'flap' ? .4 : .55, Math.max(.2, (b - a) * .8)), stg = ks.length > 1 ? Math.min(.085, Math.max(0, b - a - d) / (ks.length - 1)) : 0;
        ks.forEach((k, i) => { tin[k] = a + Math.min(order(i, ks.length), ks.length - 1) * stg; tdur[k] = d; });
        if (!j) { t0 = a; t1 = b; }
      });
    }
    const e = {L, units: [], textures: [], star: null, stn, enter, ek, tin, tdur, bout, bdur, beatLay, flat, t0, t1};
    e.job = buildUnits(e, lay);
    return e;
  }
  function starMesh(img) {
    // a hairline glint on a sung hero or image word: the F.S.C. four-point star, or the shape of the line's image
    const pts = [], N = 8, T2 = Math.PI * 2, V = (x, y) => pts.push(new THREE.Vector3(x, y, 0));
    if (img === 'heart') for (let i = 0; i <= 48; i++) { const a = i / 48 * T2; V(16 * Math.sin(a) ** 3 / 17, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 + .1); }
    else if (img === 'star' || img === 'fireworks' || img === 'crown') for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .4 : 1; V(Math.cos(a) * rr, Math.sin(a) * rr); }
    else if (img === 'moon' || img === 'world' || img === 'ring' || img === 'time' || img === 'dream') for (let i = 0; i <= 40; i++) { const a = i / 40 * T2 * 1.86, rr = .35 + .65 * i / 40; V(Math.cos(a) * rr, Math.sin(a) * rr); }
    else if (img === 'diamond' || img === 'mirror' || img === 'glass' || img === 'snow') { V(0, 1); V(.62, 0); V(0, -1); V(-.62, 0); V(0, 1); V(0, -1); }
    else for (let i = 0; i <= N * 2; i++) { const a = i / (N * 2) * Math.PI * 2, rr = i % 4 === 0 ? 1 : i % 2 ? .16 : .34; V(Math.cos(a) * rr, Math.sin(a) * rr); }
    const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat()); m.renderOrder = 9; m.visible = false; group.add(m);
    return m;
  }
  function drop(e) {
    e.job?.return(); e.job = null;
    for (const o of e.units) for (const m of [o.main, o.halo, o.wait].filter(Boolean)) { group.remove(m); m.material.dispose(); }
    for (const g of e.textures) release(g);
    e.textures.length = 0;
    if (e.star) { group.remove(e.star); e.star.geometry.dispose(); e.star.material.dispose(); }
  }

  // ---- per frame ------------------------------------------------------------------------------------------
  const lf = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()};
  const basis = new THREE.Matrix4(), qLine = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), q = new THREE.Quaternion();
  const base = new THREE.Vector3(), camPos = new THREE.Vector3(), tmpV = new THREE.Vector3(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), col = new THREE.Color();
  const TA = mkT(), TV = mkT(), TB = mkT();
  // stand a glyph plane on `base` (a point on the waterline): lifted, scaled from its foot, turned about its foot by q
  function place(m, g, S, sx, sy, lift, wob) { m.position.set(0, lift + FOOT * S * sy, 0).applyQuaternion(q).add(base); m.quaternion.copy(q); m.scale.set(g.w * S * sx, g.h * S * sy, 1); const u = m.material.uniforms; u.uUp.value.copy(lf.u); u.uWob.value = wob; }
  const hideAll = e => { for (const o of e.units) { o.main.visible = o.halo.visible = false; if (o.wait) o.wait.visible = false; } if (e.star) e.star.visible = false; };
  const hideUnit = o => { o.main.visible = o.halo.visible = false; if (o.wait) o.wait.visible = false; };

  // waking: just before its phrase a waiting word makes one move that keeps to the water and is back in place,
  // at rest, before the phrase's first note. g = progress; offsets in em (dz in world units) and radians
  const swing = g => (g <= 0 || g >= 1 ? 0 : Math.sin(Math.PI * Math.pow(g, .6)) * (1 - g) * 1.6);
  const W = {dx: 0, dy: 0, dz: 0, rx: 0, ry: 0};
  function wake(style, L, k, g, flat) {
    const mag = .6 + .8 * hash(k, L.i * 5 + 2), side = hash(k + 7, L.i) < .5 ? -1 : 1, A = swing(g) * mag;
    W.dx = W.dy = W.dz = W.rx = W.ry = 0;
    switch (style) {
      case 'bob': if (flat) W.dz = -.5 * A; else W.dy = -.34 * A; break;      // dips into the water and comes back up
      case 'surge': W.dz = (flat ? .3 : .7) * A; break;                       // toward the eye and back
      case 'swing': if (flat) W.dx = side * .3 * A; else W.ry = side * .95 * A; break;   // turns on its foot
      case 'slide': W.dx = side * .55 * A; break;                             // along the waterline
      case 'stand': if (flat) W.dz = -.4 * A; else W.rx = -.95 * A; break;    // tips back toward the water and stands up
      default: { const a = Math.PI * 2 * g * side; W.dx = Math.cos(a) * .4 * A; W.dz = Math.sin(a) * (flat ? .25 : .5) * A; }   // gather: a small circle on the water
    }
  }

  // Leaving. A line that is replaced on the spot falls back as the next one stands up; a panel of a screen folds
  // away once the next panel is being read. Otherwise a stanza leaves together: a moment after its last note, and
  // always just before the camera leaves for what follows.
  const exits = new Map();
  function exitOf(stn) {
    let X = exits.get(stn.i);
    if (X) return X;
    const L = stn.L, G = stn.G, nx = shots.stations[stn.i + 1], after = u => u.s + Math.min(.22, (u.e - u.s) * .6), own = L.units[L.units.length - 1];
    if (nx && nx.flipAt != null) X = {at: Math.max(after(own), nx.flipAt - .05), kind: 'fold', dur: .42};
    else if (G.form === 'screen' && nx && nx.G === G) X = {at: Math.max(after(own), nx.L.start + .25), kind: 'fold', dur: .5};
    else {
      // (the eye is going up to a page: the stanza folds flat under it)
      // (the eye is going up to a page: the stanza folds flat on the water and stays there, read from above, until the
      // eye has slid across to the page: shots.js planTransit)
      const last = G.st[G.st.length - 1], lu = last.L.units[last.L.units.length - 1], end = G.S ? G.S.end : L.end, nG = shots.groups[G.i + 1], kind = nG?.via === 'rise' ? 'lay' : L.exit || 'sink';
      const at = Math.max(after(lu), Math.min(end + .5, shots.leaveAt(last) + .1)) + .06 * G.st.indexOf(stn);
      X = {at, kind, dur: kind === 'lay' ? Math.max(.7, nG.st[0].arrive + shots.offset + .35 - at) : EXIT_DUR[kind] ?? (L.plan ? .8 : .5)};
    }
    exits.set(stn.i, X);
    return X;
  }

  function updateLine(e, F, lt) {
    const L = e.L, lay = layoutOf(L), st = e.stn, flat = e.flat, SY = track.style || NOSTYLE;
    shots.stationFrame(st, lf);
    // a panel of a screen swings round on the end of the line before it
    if (e.enter === 'door' && st.hinge && lt < e.t1) {
      const th = st.th - st.hs * st.hb * .92 * (1 - outCubic((lt - e.t0) / (e.t1 - e.t0)));
      lf.r.set(Math.cos(th), 0, Math.sin(th)); lf.n.set(-Math.sin(th), 0, Math.cos(th));
      lf.c.copy(st.hinge).addScaledVector(lf.r, st.hs * (lay.w / 2 + .5));
    }
    // a line on a page lies on the water: its "up" is up the page, and "toward the eye" is up out of the water
    if (flat) { tmpV.copy(lf.n); lf.n.copy(lf.u); lf.u.copy(tmpV).negate(); }
    const X = exitOf(st), Sx = clamp((lt - X.at) / X.dur), dist = camPos.distanceTo(lf.c), vis = sm(34, 15, dist * lensK) * sm(1, 2.4, dist);
    if (vis < .004 || Sx >= 1 || lt <= e.t0) { hideAll(e); return; }
    basis.makeBasis(lf.r, lf.u, lf.n); qLine.setFromRotationMatrix(basis);
    const T = C.tone(L.tone), power = F.rms, U = L.units, upDot = lf.c.dot(lf.u), tt = F.t, column = L.layout === 'column', R = lay.relay, B = L.beats || [];
    // a line that has arrived steps back a little while the line before it is still being sung; a sung line that
    // stays (a paragraph, a screen, a page) steps back when the next one begins
    const prev = L.i > 0 && score.lines[L.i - 1], nxl = !L.last && score.lines[L.i + 1];
    const focus = prev && lt < L.start ? 1 - .4 * (1 - sm(prev.end - .3, prev.end + .15, lt)) : 1, older = nxl ? 1 - .48 * sm(nxl.start - .1, nxl.start + .5, lt) : 1;
    const gDur = L.mood === 'quiet' ? 1 : L.mood === 'loud' ? .55 : .75;
    const soft = L.soft || 0;
    U.forEach((u, k) => {
      const o = e.units[k], P = lay.P[k], size = P.size * EM, quick = e.beatLay && u.beat > 0;
      // arriving; (one beat at a time) making way for the next
      const en = clamp((lt - e.tin[k]) / e.tdur[k]), bx = e.bout[k] < 1e8 ? clamp((lt - e.bout[k]) / e.bdur[k]) : 0;
      if (en <= 0 || bx >= 1) { hideUnit(o); return; }
      // (relay) how many beats have taken the front since this one: it steps aside and back, then goes
      let rs = 0;
      if (R) { for (let i = u.beat + 1; i < B.length && i <= u.beat + 3; i++) rs += inOut((lt - (B[i].s - .36)) / .32); if (rs >= 2.8) { hideUnit(o); return; } }
      const A = arrive(TA, e.ek[k], en, L, k, P, u, column, lay.h, flat, quick);
      if (en >= 1 && !flat && !quick && SPLASH.has(e.ek[k])) { const age = lt - e.tin[k] - e.tdur[k]; if (age < .9) splash.push({x: 0, z: 0, age, k: .32 * vis, o}); }
      // waking: the phrase's words move one after another and are at rest a tenth of a second before its first note
      const sl = L.slices[Math.max(0, u.slice)] || L.slices[0], cnt = sl.k1 - sl.k0 + 1, ge = sl.start - .1 - (sl.k1 - k) * Math.min(.06, .3 / cnt), g = clamp((lt - (ge - gDur)) / gDur);
      W.dx = W.dy = W.dz = W.rx = W.ry = 0;
      // the note: tau = time since it began; a = the anticipation before it (0 → 1 at the note)
      // (a guessed time: the turn takes `soft` s either side of the guess and has no moment of its own)
      const tau = lt - u.s - soft, sung = tau >= 0, a = sung ? 1 : clamp(1 + tau / (soft ? 2 * soft : o.pre)), as = a * a * (3 - 2 * a), dur = Math.max(.08, u.e - u.s);
      if (probe && !soft && sung && !o.seen && tau < .5) { o.seen = true; probe(u.s, L.i, k, vis); }
      // what the word does: one gesture from its note on, about its foot on the water
      let gx = 0, gy = 0, gz = 0, grx = 0, gry = 0, grz = 0, gs = 1, gfl = 0, calmK = 1;
      if (u.fx && sung) {
        const rel = sm(u.e + .2, u.e + 1.1, lt), on = sm(0, .14, tau), ringing = lt < u.e ? 1 : 0;
        switch (u.fx) {
          // (no shaking, swaying or bobbing: a trembling word burns instead, a swaying one swells while it is held,
          // one that dips settles a little lower and stays there)
          case 'shake': gfl = Math.exp(-tau / .5) + .35 * ringing; break;
          case 'sway': gs = 1 + .07 * sm(0, Math.max(.4, dur), tau) * (1 - rel); break;
          case 'dip': if (flat) gz = -.6 * outCubic(tau / .4); else gy = -.2 * P.size * outCubic(tau / .4); break;
          case 'grow': gs = 1 + .3 * outBack(tau / .22, 1.6) * (1 - .75 * rel); break;
          case 'spin': if (flat) grz = Math.PI * 2 * outCubic(tau / .62); else gry = Math.PI * 2 * outCubic(tau / .62); break;
          case 'lean': grz = -.21 * outBack(tau / .4, 2.2); break;
          case 'topple': if (flat) grz = .5 * outCubic(tau / .28) * (1 - .7 * sm(.9, 2.2, tau)); else grx = -.95 * outCubic(tau / .28) * (1 - .7 * sm(.9, 2.2, tau)); break;
          case 'beat': { const ph = (tau * 1.9) % 1, b2 = Math.exp(-ph / .09) + .6 * Math.exp(-Math.abs(ph - .28) / .07); gs = 1 + .13 * b2 * (1 - rel); break; }
          case 'dash': gs = 1 + .3 * outBack(tau / .18, 1.6) * (1 - .75 * rel); break;
          case 'still': calmK = 0; gs = 1 - .04 * on; break;
          case 'flare': gfl = Math.exp(-tau / .5) + .35 * ringing; break;
          default: for (const d of [.34, .68]) if (tau > d) gs += .05 * Math.exp(-(tau - d) / .1) * Math.cos((tau - d) * 17);     // echo
        }
      }
      let pop = sung ? Math.exp(-tau / .12) * Math.cos(tau * 17) * calmK : 0, flash = sung ? Math.exp(-tau / .11) : 0;
      if (soft) { pop = flash = 0; for (const h of u.hits) { const x = lt - h[0]; if (x >= 0 && x < 1.2) { pop += Math.exp(-x / .12) * Math.cos(x * 17) * h[1] * calmK; flash += Math.exp(-x / .11) * h[1]; } } }
      // (motes: a soft swell, not a spike)
      // (every style: a light that comes up and goes, never a spike; a guessed time: the same on its onsets)
      { const [fa, fd] = SY.flashEnv || [.06, .3];
        if (soft) { flash = 0; for (const h of u.hits) { const x = lt - h[0]; if (x >= 0 && x < 2) flash += sm(0, fa, x) * Math.exp(-x / fd) * h[1]; } }
        else if (sung) flash = sm(0, fa, tau) * Math.exp(-tau / fd); }
      pop *= SY.pop; flash *= SY.flash;
      // the note's motion (a guessed time: on the measured onsets that fall on the word, never waiting)
      let ht = tau, hs = sung;
      if (soft) { ht = 9; for (const h of u.hits) { const x = lt - h[0]; if (x >= 0 && x < ht) ht = x; } hs = true; }
      const H = hitMotion(HM, u.hero ? heroKind : hitOf.get(L.i) || 'bounce', ht, soft ? 0 : as, hs, o.amp * SY.pop, hash(k, L.i + 13));
      const held = sung ? sm(.3, 1.3, Math.min(tau, dur)) * (1 - sm(u.e, u.e + .5, lt)) : 0, after = sm(u.e, u.e + .6, lt);
      // leaving, by the water (the whole stanza), or making way (one beat)
      const xk = clamp(Sx * 1.3 - (X.kind === 'part' || column ? 0 : X.kind === 'adrift' || X.kind === 'wash' ? hash(k, L.i + 31) * .3 : lay.unitX[k] * .3));
      const V = leave(TV, X.kind, Sx > 0 ? xk : 0, L, k, P, column, lay.h, flat), Bv = leave(TB, L.beatOut, bx, L, k, P, column, lay.h, flat);
      Bv.a *= 1 - sm(.15, .8, bx);
      // (relay) stepped aside and back
      const relS = R ? 1 - .17 * Math.min(rs, 2.5) : 1, relA = R ? (1 - .3 * Math.min(rs, 2)) * (1 - sm(2, 2.8, rs)) : 1, relX = R ? R.dir * R.stepX * rs : 0;
      const kx = gs * A.sx * V.sx * Bv.sx * relS, ky = gs * A.sy * V.sy * Bv.sy * relS;
      const sx = H.sx * kx, sy = H.sy * (1 + (sung || soft ? .07 * held : 0)) * ky;
      // (still on the water: no swell, no neighbour's ring moves it)
      const px = (P.x + A.x + V.x + Bv.x + (gx + H.x) * P.size + relX) * EM;
      let pz = P.z + A.z + V.z + Bv.z + gz + H.z + (R ? (flat ? -.45 : -R.stepZ) * rs : 0);
      base.copy(lf.c).addScaledVector(lf.r, px);
      // on a page a word waits just under the surface and is at the surface on its note
      if (flat) pz -= sung ? 0 : DW * (1 - a * a);
      base.addScaledVector(lf.n, pz);
      const lift = (P.y + A.y + V.y + Bv.y + gy + H.y * P.size + (R && flat ? .9 * P.size * rs : 0)) * EM + (u.cjk ? CJK_LIFT * size : 0);
      qa.setFromAxisAngle(AY, A.ry + V.ry + Bv.ry + gry + H.ry); qb.setFromAxisAngle(AX, A.rx + V.rx + Bv.rx + grx + H.rx); q.copy(qLine).multiply(qa).multiply(qb);
      qa.setFromAxisAngle(AZ, grz + A.rz + V.rz + Bv.rz + H.rz); q.multiply(qa);
      const wob = A.wob * V.wob;
      // colour: the waiting colour, a little toward the sung one in the anticipation; the sung colour from the first frame of the note
      const lit = u.img ? C.img(u.img) : u.hero ? T.hero : T.lit;
      col.copy(T.wait).lerp(lit, sung ? 1 : soft ? as : .3 * a * a);
      const ready = (.44 + .18 * sm(0, .6, g)) * focus, lit1 = (1 - .14 * after) * older, Al = (sung ? lit1 * H.a : soft ? ready + (lit1 - ready) * as : ready * (1 + .2 * a * a) * H.wa) * vis * A.a * V.a * Bv.a * relA;
      const bright1 = (1 + .42 * o.amp * flash + .1 * held + .3 * gfl + .6 * V.hot + H.fl * SY.flash) * (.94 + .12 * (u.br ?? .5)), bright = sung ? bright1 : soft ? .92 + (bright1 - .92) * as : .92;
      const m = o.main, mu = m.material.uniforms, capH = size * (u.cjk ? 1 : .8);
      if (o.mode === 'swap') {
        // the waiting face goes down into the waterline and the sung face comes up out of it, standing at the note
        const down = sung ? 0 : soft ? 1 - sm(.05, .62, a) : 1 - inCubic(a / .8), up = sung ? sy : (soft ? sm(.38, 1, a) : Math.pow(clamp((a - .45) / .55), 2)) * sy, wm = o.wait, wu = wm.material.uniforms;
        wm.visible = down > .01 && Al > .004;
        if (wm.visible) { place(wm, o.ga, size * o.fit, kx, down * ky, lift, wob); wu.uCol.value.copy(col).multiplyScalar(.92); wu.uA.value = clamp(Al); }
        m.visible = up > .01 && Al > .004;
        if (m.visible) { place(m, o.g, size, sx, up, lift, wob); mu.uCol.value.copy(col).multiplyScalar(bright); mu.uA.value = clamp(Al); mu.uSide.value = 0; mu.uEdge.value = 0; }
      } else if (o.mode === 'fill') {
        // the same skeleton: the sung face fills it from the waterline up while the note lasts
        const f = sung ? (soft ? 1 : .2 + .8 * (1 - Math.exp(-tau / clamp(dur * .3, .05, .22)))) : soft ? as : .2 * a * a * a, full = f > .985, fy = upDot + lift + f * capH * sy;
        const wm = o.wait, wu = wm.material.uniforms;
        wm.visible = !full && Al > .004;
        if (wm.visible) { place(wm, o.ga, size, sx * o.fitX, sy, lift, wob); wu.uCol.value.copy(col).multiplyScalar(sung ? bright : .92); wu.uA.value = clamp(Al); wu.uSide.value = f > .004 ? 1 : 0; wu.uFill.value = fy; }
        m.visible = f > .004 && Al > .004;
        if (m.visible) { place(m, o.g, size, sx, sy, lift, wob); mu.uCol.value.copy(sung ? lit : col.copy(T.wait).lerp(lit, .6)).multiplyScalar(bright); mu.uA.value = clamp(sung ? Al : Al * 1.3); mu.uSide.value = full ? 0 : -1; mu.uFill.value = fy; mu.uEdge.value = full ? 0 : .9; mu.uEdgeCol.value.copy(lit); }
      } else {
        m.visible = Al > .004;
        if (m.visible) { place(m, o.g, size, sx, sy, lift, wob); mu.uCol.value.copy(col).multiplyScalar(bright); mu.uA.value = clamp(Al); mu.uSide.value = 0; mu.uEdge.value = 0; }
      }
      // glow: there from the first frame of the note, held while it sounds, released after
      const glow = sung || soft ? Math.max(flash, (lt < u.e + soft ? .6 : .6 * Math.exp(-(lt - u.e - soft) / .35)) * as) : 0;
      const gk = clamp(glow * (.4 + .45 * power) * (u.img ? 1.2 : u.hero ? 1.05 : .75) * (.85 + .3 * (u.br ?? .5)) * SY.glow + .25 * gfl, 0, (.42 + .2 * gfl) * Math.max(1, SY.glow)) * vis * V.a * Bv.a * relA;
      const h = o.halo; h.visible = gk > .01;
      if (h.visible) { place(h, o.h, size, sx, sy, lift, wob); h.position.addScaledVector(lf.n, -.01); h.material.uniforms.uCol.value.copy(lit).multiplyScalar(.7); h.material.uniforms.uA.value = gk; }
      // the note touches the water
      { const sp = splash[splash.length - 1]; if (sp && sp.o === o) { sp.x = base.x; sp.z = base.z; } }
      if (soft) { if (vis > .2 && Sx <= 0) for (const h of u.hits) { const x = lt - h[0]; if (x >= 0 && x < 1.3) hits.push({x: base.x, z: base.z, age: x, k: o.amp * h[1] * (L.chorus ? 1.15 : 1) * vis}); } }
      else if (sung && tau < 1.3 && vis > .2 && Sx <= 0 && bx <= 0 && rs < .5) hits.push({x: base.x, z: base.z, age: tau, k: o.amp * (L.chorus ? 1.15 : 1) * vis});
      if (u.fx === 'echo' && sung && vis > .2 && Sx <= 0) for (const d of [.34, .68]) if (tau > d && tau - d < 1.3) hits.push({x: base.x, z: base.z, age: tau - d, k: o.amp * .7 * vis});
      (u._v ||= new THREE.Vector3()).copy(base).addScaledVector(lf.u, lift + capH * .5); u._size = size; u._a = Al;
      if (u.hero && sung && !soft && tau < .45 && vis > .3 && Al > .2) { heroHit.p.copy(u._v); heroHit.t = u.s; }
    });
    // (motes) a sung hero or image word sheds motes of light
    if (SY.emph === 'motes') {
      if (e.star) e.star.visible = false;
      if (Sx <= 0) U.forEach((u, k) => {
        if (!(u.hero || u.img) || !u._v || emitters.length >= EMIT.length) return;
        const age = lt - u.s; if (age < 0 || age > 3.2) return;
        const E = EMIT[emitters.length], big = (u.hero && L.chorus) || u.img;
        E.p.copy(u._v); E.r.copy(lf.r); E.u.copy(lf.u); E.n.copy(lf.n); E.c.copy(u.img ? C.img(u.img) : T.hero);
        E.w = lay.P[k].w * EM; E.h = Math.min(.9, u._size); E.age = age; E.seed = L.i * 37.1 + k * 3.3; E.a = vis * (big ? 1.25 : .75);
        E.mk = SY.motes || {}; E.count = Math.round((big ? 22 : 9) * (u.cjk ? .6 : 1) * Math.min(1.6, .6 + E.w / Math.max(.2, E.h) * .25) * (E.mk.n ?? 1));
        emitters.push(E);
      });
    }
    // a glint on a sung hero / image word
    else if (e.star) {
      let best = -1, bestAge = 9;
      U.forEach((u, k) => { if ((u.hero && L.chorus) || u.img) { const a = lt - u.s; if (a >= 0 && a < .7 && a < bestAge) { bestAge = a; best = k; } } });
      e.star.visible = best >= 0 && Sx <= 0 && !!U[best]._v;
      if (e.star.visible) {
        const u = U[best], P = lay.P[best], k2 = bestAge / .7, size = u._size;
        e.star.position.copy(u._v).addScaledVector(lf.r, P.w * EM * .5 + Math.min(size, .55) * .1).addScaledVector(lf.u, size * .4).addScaledVector(lf.n, .05);
        e.star.quaternion.copy(qLine).multiply(qa.setFromAxisAngle(AZ, k2 * 1.2));
        e.star.scale.setScalar(Math.min(size, .55) * (.5 * Math.exp(-bestAge / .25) + .12));
        e.star.material.color.copy(u.img ? C.img(u.img) : T.hero); e.star.material.opacity = (1 - k2) * vis;
      }
    }
  }

  function update(F, lt, cam, {capture = false} = {}) {
    hits.length = 0; splash.length = 0; emitters.length = 0;
    if (!score || !shots) { motes.visible = false; return; }
    camPos.copy(cam.position); SHARED.uT.value = F.t; lensK = cam.userData.lens || 1;
    const keep = new Set();
    let built = 0, buildMs = 0;
    for (const L of score.lines) {
      const S = score.stanzas[L.st];
      if (!(lt > L.start - 6 && lt < (S ? S.end : L.end) + 3.5)) continue;
      let e = live.get(L.i);
      if (!e) { if (built && lt < L.start - 1) continue; e = build(L); live.set(L.i, e); built++; }   // at most one line ahead is built per frame
      keep.add(L.i);
      if (e.job) {
        const due = capture || lt >= e.t0;
        if (due && !capture) buildStats.deadlineFinishes++;
        const sliceStart = performance.now();
        advanceBuild(e, due ? Infinity : sliceStart + Math.max(0, BUILD_BUDGET_MS - buildMs));
        buildMs += performance.now() - sliceStart;
      }
      // Partial lines remain invisible. t0 and every word's timing are computed before starting the job.
      if (!e.job) updateLine(e, F, lt);
    }
    buildStats.frames++; buildStats.maxSliceMs = Math.max(buildStats.maxSliceMs, buildMs);
    for (const [i, e] of live) if (!keep.has(i)) { drop(e); live.delete(i); }
    fillMotes(lt, cam);
    // rings on the water: the notes first, then the words that have just landed
    hits.sort((a, b) => a.age - b.age); splash.sort((a, b) => a.age - b.age);
    for (const sp of splash) if (hits.length < 4) hits.push(sp);
    hits.length = Math.min(hits.length, 4);
  }

  function unitAt(L, k) { const u = L.units[k]; return u && u._v ? {p: u._v, size: u._size, a: u._a} : null; }

  function setTrack(t, theme, sc, asp) {
    for (const e of live.values()) drop(e);
    for (const key in buildStats) buildStats[key] = 0;
    live = new Map(); layouts = new Map(); track = t; score = sc; aspect = asp; hits.length = 0;
    const star = new THREE.Color(theme.star), emit = new THREE.Color(t.pal.emit), light = new THREE.Color(t.pal.light), second = new THREE.Color(t.pal.second || t.pal.ramp[0]), deep = new THREE.Color(t.pal.deep);
    // what the water makes of type that lies deep in it
    SHARED.uDeep.value.copy(new THREE.Color(theme.night).lerp(deep, .5).lerp(emit, .12).multiplyScalar(.9));
    const imgCache = {}, toneCache = {};
    // a hue kept, made light enough to read as type on the night
    const readable = (c, l = .74, s = .8) => { const h = {}; c.getHSL(h); return new THREE.Color().setHSL(h.h, Math.min(s, h.s * 1.15), Math.max(l, Math.min(.86, h.l))); };
    const A1 = readable(emit), A2 = readable(second), mix = (a, b, k) => a.clone().lerp(b, k), paper = mix(star, light, .35), dusk = mix(readable(deep, .5, .5), star, .35);
    // a tone's colours, all from the cover: waiting (unlit), sung, hero
    const tone = name => toneCache[name] ||= treat(baseTone(name));
    // the style's colour treatment over a tone: stark (harder contrast), duo (two colours apart), ink (one colour),
    // wash (faded), bloom (as it is)
    const lum = c => .2126 * c.r + .7152 * c.g + .0722 * c.b, grey = (c, k) => c.clone().lerp(new THREE.Color(lum(c), lum(c), lum(c)), k);
    const B2 = (() => { const h = {}; A1.getHSL(h); const c2 = new THREE.Color().setHSL((h.h + .5) % 1, Math.min(.7, h.s), .72); return c2; })();
    const treat = T => {
      switch (t.style?.tone) {
        case 'stark': return {wait: grey(T.wait, .35).multiplyScalar(.82), lit: mix(T.lit, star, .45).multiplyScalar(1.06), hero: mix(T.hero, A1, .35)};
        case 'duo': return {wait: mix(grey(T.wait, .4), B2, .3).multiplyScalar(.8), lit: mix(T.lit, B2, .18), hero: mix(A1, star, .12)};
        case 'ink': return {wait: grey(T.wait, .85).multiplyScalar(.9), lit: grey(T.lit, .8), hero: mix(grey(T.hero, .7), A1, .2)};
        case 'wash': return {wait: grey(T.wait, .5), lit: grey(T.lit, .45), hero: grey(T.hero, .4)};
        default: return T;
      }
    };
    const baseTone = name => (() => {
      switch (name) {
        case 'tender': return {wait: mix(dusk, A1, .35).multiplyScalar(.78), lit: mix(paper, A1, .16), hero: mix(A1, star, .2)};
        case 'bright': return {wait: mix(dusk, A2, .25).multiplyScalar(.8), lit: star.clone(), hero: mix(A2, star, .25)};
        case 'euphoric': return {wait: mix(dusk, A1, .5).multiplyScalar(.8), lit: mix(star, A1, .1), hero: A1.clone()};
        case 'dark': return {wait: mix(dusk, A2, .5).multiplyScalar(.62), lit: mix(paper, A2, .3).multiplyScalar(.94), hero: mix(A2, star, .15)};
        case 'tense': return {wait: mix(dusk, A2, .4).multiplyScalar(.72), lit: mix(paper, A2, .12), hero: mix(A1, star, .1)};
        case 'defiant': return {wait: mix(dusk, A1, .55).multiplyScalar(.74), lit: star.clone(), hero: A1.clone()};
        case 'wistful': return {wait: mix(dusk, A2, .45).multiplyScalar(.74), lit: mix(paper, A2, .2), hero: mix(A2, star, .25)};
        default: return {wait: mix(dusk, A1, .2).multiplyScalar(.76), lit: mix(paper, star, .6), hero: mix(A1, star, .35)};
      }
    })();
    C = {star, emit, img: name => imgCache[name] ||= imageColour(name, t.pal, star, sc.colors?.[name]), tone};
    // each line's motion: from the style's few, never the one the line before had
    hitOf = new Map(); const HT = HITS[t.style?.name] || {bounce: 1}, ks = Object.keys(HT); let prev = null;
    for (const L of sc.lines) { const w = {}; for (const k of ks) w[k] = k === prev && ks.length > 1 ? 0 : HT[k]; let tot = 0; for (const k in w) tot += w[k]; let u = hash(L.i, 77.7) * tot, pk = ks[0]; for (const k of ks) { if (!w[k]) continue; pk = k; u -= w[k]; if (u <= 0) break; } hitOf.set(L.i, pk); prev = pk; }
    heroKind = ks[0];
    for (const L of sc.lines) layoutOf(L);
  }
  function setShots(s) { shots = s; exits.clear(); }
  function setAspect(a) { if (Math.abs(a - aspect) < .01) return; aspect = a; layouts = new Map(); exits.clear(); for (const e of live.values()) drop(e); live = new Map(); if (score) for (const L of score.lines) layoutOf(L); }
  async function prepareFonts(t, extra = '') {
    const text = (extra + 'FIG.0123456789·—§#:PL/' + t.lyrics.map(L => L.text + (L.tr || '')).join('') + t.title + t.artist + (t.album || '')).slice(0, 6000);
    const specs = [`800 ${FS}px ${GROT}`, `600 ${FS}px 'MiSans'`, `400 ${FS}px ${SERIF}`, `italic 400 ${FS}px ${SERIF}`, `400 ${FS}px ${JP}`, `600 ${FS}px ${JP}`, `900 ${FS}px ${JP}`, `200 ${FS}px ${GROT}`, `300 ${FS}px ${GROT}`, `900 ${FS}px ${GROT}`, `300 ${FS}px 'MiSans'`, `400 ${FS}px 'IBM Plex Mono'`, `500 ${FS}px 'IBM Plex Mono'`, `600 ${FS}px 'Noto Serif SC'`, `900 ${FS}px 'Archivo'`];
    await Promise.all(specs.map(s => document.fonts.load(s, text).catch(() => {})));
  }
  return {setTrack, setShots, setAspect, update, layoutOf, unitAt, prepareFonts, shared: SHARED, hits, heroHit, buildStats, setProbe: f => { probe = f; }, tone: n => C.tone(n), get live() { return live; }};
}

// OKLCh helpers
function hueChroma(hex) {
  const c = new THREE.Color(hex), R = c.r, G = c.g, B = c.b;       // (a THREE.Color set from hex is already linear)
  const l = Math.cbrt(.4122214708 * R + .5363325363 * G + .0514459929 * B), m = Math.cbrt(.2119034982 * R + .6806995451 * G + .1073969566 * B), s = Math.cbrt(.0883024619 * R + .2817188376 * G + .6299787005 * B);
  const A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, Bb = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return [(Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360, Math.hypot(A, Bb)];
}
// An image's colour in this song: its own hue (the table's, or the one the model chose for this song) pulled toward
// the nearest colour of the cover, so the words stay in the cover's harmony; a hue foreign to the cover is muted
// instead of shouting. Always light enough to read.
export function imageColour(name, pal, star, given) {
  let [h, c] = HUE[name] || [80, .06];
  if (given) { const hc = hueChroma(given); h = hc[0]; c = Math.min(.12, Math.max(.05, hc[1])); }
  const cl = (pal.clusters || []).filter(x => x.C > .04);
  let hue = h, chroma = Math.min(c, .04);
  if (cl.length) {
    const near = cl.reduce((a, x) => (Math.abs(((x.h - h + 540) % 360) - 180) < Math.abs(((a.h - h + 540) % 360) - 180) ? x : a), cl[0]);
    const dh = ((near.h - h + 540) % 360) - 180;
    if (Math.abs(dh) < 100) { hue = h + dh * .8; chroma = Math.min(.1, Math.max(c * .7, near.C * .85)); }
  }
  // OKLCh → sRGB
  const L = .84, a = chroma * Math.cos(hue * Math.PI / 180), b = chroma * Math.sin(hue * Math.PI / 180);
  const l_ = L + .3963377774 * a + .2158037573 * b, m_ = L - .1055613458 * a - .0638541728 * b, s_ = L - .0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, bb = -.0041960863 * l - .7034186147 * m + 1.707614701 * s;
  return new THREE.Color().setRGB(clamp(r), clamp(g), clamp(bb), THREE.LinearSRGBColorSpace);
}
