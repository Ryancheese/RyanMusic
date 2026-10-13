// Lyric imagery drawn around the words (learned from Folia's Lumiere / Sonnet: the theme's images become line
// art drawn on with a stagger, kept clear of the text; keyword colours light up as they are sung). Ours:
//   emblem    when a line carrying an image is sung, that image's flat line drawing (F.S.C. hairline) draws on
//             in the free side of the frame: things of the sky (moon, star, rain…) hang in the sky behind the
//             stanza, things of the ground (flower, door, city, heart…) stand on the lake beside it with their
//             reflection under them; half drawn when the word is sung, it flares on the note
//   motes     each image has particle behaviours of its own (stars twinkle or shoot across the sky, rain falls,
//             petals spiral, embers rise, hearts rise or ring out, butterflies wander, a bolt strikes, a bow is
//             drawn…), released from the word at the moment it is sung; one of them each time, never the same
//             twice running, and so with the drawings (five stars, five hearts, four moons…)
//   motif     the song's recurring images stand as constellations round the lake's horizon, fixed, so that every
//             turn of the camera is felt against them; every time a line with that image is sung they answer
//   pointer   drawings near the pointer brighten and turn toward it; a click releases the current image's
//             particles where you clicked (or the song's motif between lines)
// Scheduled particles are a pure function of song time (deterministic, seekable); clicked ones live in song time too.
// The drawings (2026-10-07) are Codex's: two sets of native Bézier centre lines (tools/motifs_bundle.mjs), the cute
// one (v3) for pop and the soft families, the anime line art (v4) for the others; one set per song, so a song keeps
// one hand. They are drawn as lines with a width on the screen, on at a steady pen speed (each stroke in its turn,
// the time shared out by the strokes' real lengths), and the pen is the style's: a fine line, a round one, a
// trembling one (rock), a lit tube (electro), an ink line swelling and tapering (soft), a bold one (hip-hop).
// ?motifs=cute|anime|lines (lines: the old procedural hairlines below, also the fallback while a set loads).
import * as THREE from 'three';
import {imageColour, EM} from './lyric.js';
import {styleOf} from './genre.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const TAU = Math.PI * 2;

// ---- the drawings: polylines in a unit box ([-1, 1]²). Every image has several drawings; a song never shows
// the same drawing of an image twice running ----------------------------------------------------------------
const circle = (cx, cy, r, a0 = 0, a1 = TAU, n = 48, sx = 1) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r]; });
const ell = (cx, cy, rx, ry, a0 = 0, a1 = TAU, n = 40) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const line = (...p) => p;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]];
const mirrorX = p => p.map(([x, y]) => [-x, y]);
const turned = (p, a) => p.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
function star4(cx, cy, r, inner = .22) { const out = []; for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * inner : r; out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return out; }
const star5 = (cx, cy, r, inner = .4, rot = 0) => Array.from({length: 11}, (_, i) => { const a = Math.PI / 2 + rot + i * Math.PI / 5, rr = i % 2 ? r * inner : r; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
const heartP = (cx, cy, s, n = 64) => Array.from({length: n + 1}, (_, i) => { const a = i / n * TAU, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [cx + x / 17 * s, cy + (y / 17 + .1) * s]; });
const wave = (y, amp, f, ph = 0, x0 = -1, x1 = 1, n = 40) => Array.from({length: n + 1}, (_, i) => { const x = x0 + (x1 - x0) * i / n; return [x, y + amp * Math.sin(x * f + ph)]; });
// n rays round (cx, cy) from r0 out to r1 (odd ones to r2), over the angles a0..a1
const rays = (cx, cy, n, r0, r1, r2 = r1, a0 = 0, a1 = TAU) => Array.from({length: n}, (_, i) => { const a = a0 + (a1 - a0) * i / (a1 - a0 >= TAU - 1e-6 ? n : n - 1), rr = i % 2 ? r2 : r1; return line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); });
// a leaf shape from (cx, cy), `len` long toward angle `ang`
const petal = (cx, cy, len, wid, ang, n = 16) => Array.from({length: n + 1}, (_, i) => { const t = i / n * TAU, px = len * (.5 - .5 * Math.cos(t)), py = wid * Math.sin(t) * Math.sin(t / 2), c = Math.cos(ang), s = Math.sin(ang); return [cx + px * c - py * s, cy + px * s + py * c]; });
const crescent = (cx, cy, r) => [...circle(cx, cy, r, Math.PI * .28, Math.PI * 1.72, 40), ...circle(cx + r * .4, cy, r * .8, Math.PI * 1.62, Math.PI * .38, 36, 1)];
const drop = (cx, cy, s) => [[0, .9], [.32, .2], [.42, -.2], [.32, -.55], [0, -.72], [-.32, -.55], [-.42, -.2], [-.32, .2], [0, .9]].map(([x, y]) => [cx + x * s, cy + y * s]);
const flame = (cx, cy, s) => [[0, 1], [.25, .55], [.45, .2], [.42, -.3], [.2, -.62], [0, -.7], [-.2, -.62], [-.42, -.3], [-.45, .1], [-.3, .4], [-.18, .25], [-.05, .55], [0, 1]].map(([x, y]) => [cx + x * s, cy + y * s]);
const flake = (cx, cy, r) => [0, 1, 2].map(i => { const a = i / 3 * Math.PI + .2; return line([cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx - Math.cos(a) * r, cy - Math.sin(a) * r]); });
const DRAW = {
  star: [
    () => [star4(0, 0, 1, .16), star4(.72, .62, .26, .2), star4(-.66, -.58, .18, .2)],
    () => [star5(0, 0, 1, .4), star5(0, 0, .4, .4, Math.PI / 5)],
    () => { const p = [[-1, .25], [-.55, .48], [-.12, .3], [.2, .08], [.28, -.45], [.86, -.5], [.96, .02], [.2, .08]]; return [p, ...p.slice(0, 7).map(([x, y], i) => star4(x, y, i % 3 ? .1 : .16, .2))]; },
    () => [star4(.55, .55, .45, .18), line([.3, .34], [-1, -.72]), line([.18, .52], [-.7, -.1]), line([.5, .2], [-.45, -.62]), star4(-.7, .6, .1, .2)],
    () => [...rays(0, 0, 16, .16, 1, .52), circle(0, 0, .09, 0, TAU, 12)],
  ],
  moon: [
    () => [crescent(0, 0, .9), circle(0, 0, 1.12, 0, TAU, 64).filter((_, i) => i % 4 < 2)],
    () => [circle(0, 0, .92, 0, TAU, 56), circle(-.3, .28, .2, 0, TAU, 18), circle(.26, -.2, .27, 0, TAU, 22), circle(.38, .42, .1, 0, TAU, 12), circle(-.2, -.5, .12, 0, TAU, 12)],
    () => [circle(0, -.1, .8, 0, Math.PI, 36), line([-1, -.1], [1, -.1]), line([-.55, -.32], [.55, -.32]), line([-.32, -.52], [.32, -.52]), line([-.14, -.7], [.14, -.7])],
    () => [crescent(-.1, 0, .85), star4(.5, .25, .26, .2)],
  ],
  sun: [
    () => [circle(0, 0, .46), ...rays(0, 0, 12, .62, 1, .86)],
    () => [circle(0, -.3, .5, 0, Math.PI, 28), ...rays(0, -.3, 9, .66, 1.05, .86, .12, Math.PI - .12), line([-1.1, -.3], [1.1, -.3]), line([-.6, -.52], [.6, -.52]), line([-.3, -.72], [.3, -.72])],
    () => [circle(0, 0, .34), circle(0, 0, .52, 0, TAU, 48), ...rays(0, 0, 24, .66, .82, .98)],
  ],
  sky: [
    () => [circle(-.35, -.2, .38, 0, Math.PI, 20), circle(.18, -.2, .52, 0, Math.PI, 24), circle(.68, -.2, .3, 0, Math.PI, 16), [[-.8, -.5], [.95, -.5]], [[-.4, -.72], [.6, -.72]]],
    () => [ell(0, .1, .7, .32, 0, Math.PI, 28), ell(-.5, .1, .34, .2, Math.PI * .4, Math.PI, 14), ell(.52, .1, .36, .22, 0, Math.PI * .6, 14), line([-.84, .1], [.88, .1]), [[-.5, -.5], [-.35, -.38], [-.2, -.5]], [[.15, -.3], [.32, -.16], [.5, -.3]]],
  ],
  night: [
    () => [circle(0, -.2, 1, Math.PI * .05, Math.PI * .95, 40).filter((_, i) => i % 3 !== 2), star4(-.4, .35, .14), star4(.3, .55, .1), star4(.62, .2, .08), [[-1, -.2], [1, -.2]]],
    () => [crescent(-.4, .35, .42), star4(.35, .6, .14, .2), star4(.7, .15, .1, .2), star4(.1, .05, .08, .2), star4(.55, -.2, .07, .2), wave(-.55, .06, 7, 0), wave(-.8, .05, 8, 1)],
  ],
  light: [
    () => Array.from({length: 9}, (_, i) => { const a = -Math.PI / 2 + (i - 4) * .2, r1 = .6 + .4 * ((i * 7) % 3) / 2; return line([0, 1], [Math.sin(a) * r1 * 1.4, 1 - Math.cos(a) * r1 * 2]); }),
    () => [...rays(0, 0, 24, .14, 1, .45), circle(0, 0, .08, 0, TAU, 10)],
    () => [[[-.12, -1], [-.08, .3], [.08, .3], [.12, -1]], rect(-.12, .3, .12, .5), [[.1, .44], [1.1, .8], [1.1, .1], [.1, .36]], [[-.1, .44], [-1.1, .68], [-1.1, .2], [-.1, .36]], line([-.5, -1], [.5, -1])],
  ],
  sea: [
    () => [0, 1, 2].map(j => Array.from({length: 41}, (_, i) => { const x = -1 + i / 20; return [x, .45 - j * .45 + .12 * Math.sin(x * 6 + j * 1.3) * (1 - .25 * j)]; })),
    () => [ell(0, 0, 1, .5), ell(0, 0, .7, .34), ell(0, 0, .42, .2), ell(0, 0, .16, .08)],
    () => [wave(.4, .16, 5, 0), wave(0, .12, 6, 1.2), wave(-.4, .08, 7, 2.2), [[-.2, .56], [0, .78], [.25, .62], [.12, .5]]],
  ],
  rain: [
    () => Array.from({length: 11}, (_, i) => { const x = -.9 + (i % 4) * .55 + (i % 2) * .1, y = .8 - Math.floor(i / 4) * .65; return line([x, y], [x - .12, y - .42]); }),
    () => [ell(-.25, .5, .4, .28, 0, Math.PI, 16), ell(.25, .5, .5, .36, 0, Math.PI, 20), line([-.65, .5], [.75, .5]), ...[-.5, -.15, .2, .55].map((x, i) => line([x, .3 - (i % 2) * .08], [x - .14, -.25 - (i % 2) * .08])), ...[-.32, .04, .4].map(x => line([x, -.4], [x - .12, -.85]))],
  ],
  snow: [
    () => [...Array.from({length: 3}, (_, i) => { const a = i / 3 * Math.PI; return line([Math.cos(a), Math.sin(a)], [-Math.cos(a), -Math.sin(a)]); }), ...Array.from({length: 6}, (_, i) => { const a = i / 6 * TAU, c = [Math.cos(a) * .6, Math.sin(a) * .6]; return line([c[0] + Math.cos(a + .7) * .25, c[1] + Math.sin(a + .7) * .25], c, [c[0] + Math.cos(a - .7) * .25, c[1] + Math.sin(a - .7) * .25]); })],
    () => [...flake(-.4, .3, .5), ...flake(.5, -.1, .34), ...flake(-.1, -.65, .22), ...flake(.6, .7, .16)],
  ],
  wind: [
    () => [0, 1, 2].map(j => Array.from({length: 33}, (_, i) => { const x = -1 + i / 16, y = .5 - j * .45; const curl = i > 24 ? (i - 24) / 8 : 0; return [x - curl * .1, y + .1 * Math.sin(x * 3 + j) + curl * .25 * Math.sin(curl * 3)]; })),
    () => [Array.from({length: 61}, (_, i) => { const a = i / 60 * 3.2 * Math.PI, r = .08 + .26 * a / Math.PI; return [.15 + Math.cos(a) * r, Math.sin(a) * r * .8]; }), wave(-.72, .07, 5, 0, -1, .5), wave(.82, .05, 6, 1, -.5, 1)],
  ],
  flower: [
    () => [Array.from({length: 121}, (_, i) => { const a = i / 120 * TAU, r = .95 * Math.abs(Math.cos(2.5 * a)); return [Math.cos(a) * r, Math.sin(a) * r]; }), circle(0, 0, .14, 0, TAU, 16)],
    () => [...Array.from({length: 5}, (_, i) => petal(0, 0, .98, .42, Math.PI / 2 + i * TAU / 5)), circle(0, 0, .1, 0, TAU, 12), ...rays(0, 0, 5, .12, .3, .3, Math.PI / 2 + .63, Math.PI / 2 + .63 + TAU * .8)],
    () => [[[-.38, .95], [-.42, .45], [-.2, .2], [0, .15], [.2, .2], [.42, .45], [.38, .95], [.18, .62], [0, .98], [-.18, .62], [-.38, .95]], line([0, .15], [0, -1]), petal(0, -.55, .6, .2, .5), petal(0, -.75, .55, .18, Math.PI - .6)],
    () => [petal(-.6, .3, .5, .2, .4), petal(.2, .6, .42, .18, 2.2), petal(.5, -.1, .5, .2, -.6), petal(-.2, -.5, .4, .16, 3.6), petal(-.75, -.6, .3, .12, 1.2)],
  ],
  fire: [
    () => [flame(0, 0, 1), [[0, .35], [.18, 0], [.15, -.35], [0, -.48], [-.15, -.35], [-.18, -.05], [0, .35]]],
    () => [flame(0, .1, .8), flame(-.48, -.3, .45), flame(.5, -.25, .5), line([-.85, -.98], [.6, -.66]), line([.85, -.98], [-.6, -.66])],
  ],
  heart: [
    () => [heartP(0, 0, 1, 80)],
    () => [heartP(-.28, .08, .72), heartP(.34, -.12, .56)],
    () => [[[-1, 0], [-.6, 0], [-.48, .22], [-.36, -.18], [-.2, .9], [-.04, -.8], [.08, .18], [.2, 0], [.48, 0], [.58, .16], [.7, 0], [1, 0]], heartP(.62, .5, .3, 40)],
    () => [heartP(0, 0, 1, 80), heartP(0, .02, .64), heartP(0, .04, .3, 40)],
    () => [heartP(0, 0, .82), line([-1.05, -.7], [-.38, -.22]), line([.3, .28], [1.05, .82]), [[.8, .82], [1.05, .82], [1.02, .57]]],
  ],
  wing: [
    () => Array.from({length: 6}, (_, j) => { const k = j / 5; return Array.from({length: 21}, (_, i) => { const u = i / 20; return [-.9 + u * (1.7 - .5 * k), -.3 + k * .8 * u + .45 * Math.sin(u * Math.PI) * (1 - .6 * k) - k * .15]; }); }),
    () => { const half = Array.from({length: 4}, (_, j) => { const k = j / 3; return Array.from({length: 17}, (_, i) => { const u = i / 16; return [.08 + u * (.95 - .3 * k), -.2 + k * .5 * u + .55 * Math.sin(u * Math.PI) * (1 - .55 * k) - k * .12]; }); }); return [...half, ...half.map(mirrorX)]; },
    () => { const sp = t => [-.7 + 1.3 * t + .12 * Math.sin(t * Math.PI), -.9 + 1.8 * t]; return [Array.from({length: 21}, (_, i) => sp(i / 20)), ...Array.from({length: 9}, (_, i) => { const t = .15 + i * .09, [x, y] = sp(t), l = .34 * Math.sin((t + .05) * Math.PI); return [[x - l, y + l * .5], [x, y], [x + l * .8, y + l * .9]]; })]; },
  ],
  road: [
    () => [line([-1, -1], [-.06, .55]), line([1, -1], [.06, .55]), ...[0, 1, 2, 3].map(i => { const a = -1 + i * .42, b = a + .2; return line([0, a], [0, b]); }), line([-1, .55], [1, .55])],
    () => [-1, 1].map(sd => Array.from({length: 31}, (_, i) => { const y = -1 + i / 15, k = (y + 1) / 2; return [.4 * Math.sin(y * 2.4) * (1 - k * .5) + sd * .34 * (1 - k * .82), y]; })),
  ],
  time: [
    () => [circle(0, 0, 1, 0, TAU, 64), ...Array.from({length: 12}, (_, i) => { const a = i / 12 * TAU, r0 = i % 3 ? .88 : .78; return line([Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * .97, Math.sin(a) * .97]); }), line([0, 0], [0, .62]), line([0, 0], [.42, -.18])],
    () => [[[-.6, 1], [.6, 1], [.06, 0], [.6, -1], [-.6, -1], [-.06, 0], [-.6, 1]], line([-.75, 1], [.75, 1]), line([-.75, -1], [.75, -1]), line([0, -.05], [0, -.6]), [[-.36, -1], [0, -.66], [.36, -1]], [[-.3, .6], [.3, .6]]],
    () => [Array.from({length: 81}, (_, i) => { const a = i / 80 * TAU, d = 1 + Math.sin(a) ** 2; return [Math.cos(a) / d, Math.sin(a) * Math.cos(a) / d * 1.5]; }), circle(.62, 0, .07, 0, TAU, 10)],
  ],
  dream: [
    () => [circle(-.25, -.1, .62, 0, TAU, 48), circle(.42, .32, .34, 0, TAU, 32), circle(.55, -.52, .16, 0, TAU, 20), circle(-.7, .62, .1, 0, TAU, 14)],
    () => [ell(.1, .3, .8, .45, 0, TAU, 40), circle(-.5, -.35, .16, 0, TAU, 16), circle(-.72, -.68, .09, 0, TAU, 12), star4(.1, .32, .2, .2)],
    () => [crescent(-.3, -.1, .6), [[.2, .3], [.5, .3], [.2, 0], [.5, 0]], [[.6, .78], [.82, .78], [.6, .56], [.82, .56]]],
  ],
  city: [
    () => [[[-1, -.8], [-1, .1], [-.7, .1], [-.7, .55], [-.45, .55], [-.45, -.1], [-.2, -.1], [-.2, .85], [.05, .85], [.05, .25], [.3, .25], [.3, .5], [.55, .5], [.55, -.2], [.75, -.2], [.75, .3], [1, .3], [1, -.8]], [[-1.1, -.8], [1.1, -.8]]],
    () => [[[-1, -.8], [-1, .3], [-.72, .3], [-.72, -.8]], [[-.6, -.8], [-.6, .75], [-.48, .92], [-.36, .75], [-.36, -.8]], [[-.22, -.8], [-.22, .1], [.1, .1], [.1, -.8]], [[.22, -.8], [.22, .5], [.5, .5], [.5, -.8]], [[.62, -.8], [.62, -.1], [.95, -.1], [.95, -.8]], line([-1.1, -.8], [1.1, -.8]), line([-.48, .92], [-.48, 1.12]), ...[-.1, .2].flatMap(y => [line([-.92, y], [-.8, y]), line([.3, y], [.42, y])]), circle(.74, .72, .14, 0, TAU, 16)],
  ],
  tears: [
    () => [drop(0, 0, 1), [[.48, -.1], [.6, -.35], [.52, -.5], [.4, -.38], [.48, -.1]]],
    () => [drop(-.5, .45, .4), drop(.05, .12, .5), drop(.55, .5, .32), ell(.05, -.8, .6, .12), ell(.05, -.8, .3, .06)],
  ],
  door: [
    () => [[[-.55, -1], [-.55, 1], [.55, 1], [.55, -1]], [[-.55, -1], [.15, -.86], [.15, .86], [-.55, 1]], line([.02, -.05], [.08, -.05]), line([-1, -1], [1, -1])],
    () => [rect(-.7, -.8, .7, .9), line([0, -.8], [0, .9]), line([-.7, .05], [.7, .05]), [[-.7, .9], [-.5, .3], [-.7, -.3]], [[.7, .9], [.5, .3], [.7, -.3]], line([-.85, -.8], [.85, -.8])],
    () => [circle(-.55, 0, .34, 0, TAU, 28), circle(-.55, 0, .14, 0, TAU, 14), line([-.21, 0], [.95, 0]), [[.55, 0], [.55, -.3]], [[.78, 0], [.78, -.22]], [[.95, 0], [.95, -.3]]],
  ],
  world: [
    () => [circle(0, 0, 1, 0, TAU, 64), circle(0, 0, 1, 0, TAU, 48, .45), circle(0, 0, 1, 0, TAU, 48, .82).filter((_, i) => i % 2 === 0), line([-1, 0], [1, 0]), circle(0, .55, .84, Math.PI, TAU, 24, 1).map(([x, y]) => [x, .5 + (y - .55) * .2])],
    () => [circle(0, 0, .62, 0, TAU, 48), turned(ell(0, 0, 1.1, .3, 0, TAU, 56), .35), circle(.82, .62, .1, 0, TAU, 12), circle(0, 0, .62, 0, TAU, 32, .5)],
  ],
  galaxy: [
    () => [0, 1].map(arm => Array.from({length: 70}, (_, i) => { const a = i / 69 * 3.6 + arm * Math.PI, r = .08 * Math.exp(.3 * (i / 69 * 3.6) * 2.4); return [Math.cos(a) * r, Math.sin(a) * r * .62]; })),
    () => [ell(0, 0, 1, .36), ell(0, 0, .7, .25), ell(0, 0, .4, .14), circle(0, 0, .1, 0, TAU, 12), circle(.92, .14, .07, 0, TAU, 10), circle(-.5, -.17, .05, 0, TAU, 8), circle(.2, .12, .04, 0, TAU, 8)],
    () => [0, 1, 2].map(arm => Array.from({length: 50}, (_, i) => { const a = i / 49 * 2.8 + arm * TAU / 3, r = .1 * Math.exp(.34 * (i / 49 * 2.8) * 2.3); return [Math.cos(a) * r, Math.sin(a) * r * .7]; })).concat([circle(0, 0, .08, 0, TAU, 10)]),
  ],
  fireworks: [
    () => [...rays(0, 0, 14, .25, .8, 1), ...Array.from({length: 14}, (_, i) => { const a = (i + .5) / 14 * TAU; return star4(Math.cos(a) * 1, Math.sin(a) * 1, .05); })],
    () => [...rays(-.3, .3, 12, .12, .62, .5), ...rays(.55, -.1, 10, .08, .4, .3), wave(0, .03, 9, 0, -1, -.1).map(([x, y]) => [-.3 + y, x]), star4(.55, -.1, .06)],
  ],
  song: [
    () => [...[0, 1, 2, 3, 4].map(j => line([-1, -.4 + j * .2], [1, -.4 + j * .2])), Array.from({length: 41}, (_, i) => { const x = -1 + i / 20; return [x, .1 * Math.sin(x * 5) + .35 * Math.sin(x * 1.7 + 1) * .5]; }), circle(.4, .12, .09, 0, TAU, 12), line([.49, .12], [.49, .7])],
    () => [ell(-.45, -.55, .2, .15, 0, TAU, 16), ell(.4, -.35, .2, .15, 0, TAU, 16), line([-.26, -.52], [-.26, .7]), line([.59, -.32], [.59, .9]), line([-.26, .7], [.59, .9]), line([-.26, .5], [.59, .7])],
    () => Array.from({length: 13}, (_, i) => { const x = -.9 + i * .15, h = .12 + .8 * Math.abs(Math.sin(i * 1.7 + .6)) * (1 - Math.abs(i - 6) / 9); return line([x, -h], [x, h]); }),
  ],
  eye: [
    () => [[...Array.from({length: 25}, (_, i) => { const x = -1 + i / 12; return [x, .5 * (1 - x * x)]; }), ...Array.from({length: 25}, (_, i) => { const x = 1 - i / 12; return [x, -.5 * (1 - x * x)]; })], circle(0, 0, .36, 0, TAU, 32), circle(0, 0, .14, 0, TAU, 16)],
    () => [Array.from({length: 25}, (_, i) => { const x = -1 + i / 12; return [x, -.35 * (1 - x * x)]; }), ...[-.7, -.35, 0, .35, .7].map(x => line([x, -.35 * (1 - x * x) - .02], [x * 1.18, -.35 * (1 - x * x) - .3]))],
  ],
  hand: [
    () => [ell(0, -.4, .44, .52, Math.PI, TAU, 18), ...[-.33, -.11, .11, .33].map((x, i) => [[x - .09, -.4], [x - .09, [.55, .85, .92, .7][i]], [x + .09, [.55, .85, .92, .7][i]], [x + .09, -.4]]), [[.44, -.42], [.8, -.05], [.68, .1], [.44, -.12]]],
    // two hands reaching for each other across a gap, a spark between the fingertips
    () => { const h = [[-1.1, -.28], [-.5, -.3], [-.2, -.12], [-.08, .02], [-.2, .08], [-.45, -.02], [-.5, .1], [-.15, .3], [-.22, .4], [-.62, .28], [-1.1, .3]]; return [h, mirrorX(h).map(([x, y]) => [x, -y + .06]), star4(0, .06, .13, .2)]; },
    // an open palm: five lines with round tips, a spiral in the middle
    () => [...[[-.5, .25, -.75, .62], [-.25, .45, -.32, .98], [0, .5, .05, 1.05], [.25, .42, .4, .9], [.48, .05, .92, .3]].flatMap(([a, b, c, d]) => [line([a, b], [c, d]), circle(c, d, .06, 0, TAU, 8)]), ell(0, -.2, .56, .7, 0, TAU, 40), Array.from({length: 40}, (_, i) => { const a = i / 39 * 2.6 * Math.PI, r = .04 + .1 * a / Math.PI; return [Math.cos(a) * r, -.2 + Math.sin(a) * r]; })],
  ],
  butterfly: [() => { const up = [[0, .05], [.35, .75], [.85, .8], [.95, .35], [.55, .05], [0, .05]], lo = [[0, -.05], [.5, -.15], [.7, -.55], [.4, -.8], [.12, -.5], [0, -.05]]; return [up, lo, mirrorX(up), mirrorX(lo), line([0, .3], [0, -.5]), [[0, .3], [.2, .62], [.3, .6]], [[0, .3], [-.2, .62], [-.3, .6]]]; }],
  tree: [
    () => [[[0, 1], [-.4, .4], [-.2, .4], [-.6, -.1], [-.3, -.1], [-.75, -.6], [.75, -.6], [.3, -.1], [.6, -.1], [.2, .4], [.4, .4], [0, 1]], [[-.1, -.6], [-.1, -1], [.1, -1], [.1, -.6]]],
    () => [circle(0, .3, .62, 0, TAU, 36), circle(-.35, .05, .3, Math.PI * .5, Math.PI * 1.6, 12), line([0, -.32], [0, -1]), [[0, -.6], [.25, -.3]], [[0, -.75], [-.2, -.5]], line([-.4, -1], [.4, -1])],
  ],
  mountain: [() => [[[-1.1, -1], [-.4, .55], [-.1, -.05], [.32, 1], [1.1, -1]], [[-.58, .15], [-.44, .28], [-.3, .12], [-.2, .2]], [[.1, .46], [.24, .62], [.36, .44], [.5, .58]], line([-1.2, -1], [1.2, -1])]],
  home: [() => [[[-.8, -1], [-.8, .1], [0, .9], [.8, .1], [.8, -1], [-.8, -1]], rect(-.15, -1, .2, -.35), rect(-.6, -.3, -.3, 0), [[.45, .45], [.45, .85], [.62, .85], [.62, .28]], line([-1, .1], [-.8, .1]), line([.8, .1], [1, .1])]],
  mirror: [() => [ell(0, .2, .58, .76, 0, TAU, 48), ell(0, .2, .48, .66, 0, TAU, 44), line([0, -.56], [0, -1]), line([-.3, -1], [.3, -1]), line([-.2, .5], [.12, .82]), line([-.28, .2], [-.06, .42])]],
  shadow: [() => [ell(0, 0, 1, .34, 0, TAU, 44), ell(.1, 0, .66, .2, 0, TAU, 36), ell(.2, 0, .3, .08, 0, TAU, 20)]],
  smoke: [() => [0, 1, 2].map(j => Array.from({length: 31}, (_, i) => { const y = -1 + i / 15, k = (y + 1) / 2; return [(j - 1) * .4 + (.08 + .3 * k) * Math.sin(y * 4.2 + j * 1.7), y]; }))],
  ring: [() => [circle(0, -.25, .62, 0, TAU, 48), circle(0, -.25, .5, 0, TAU, 44), [[-.2, .37], [0, .75], [.2, .37], [0, .22], [-.2, .37]], line([-.2, .37], [.2, .37]), star4(.55, .7, .16, .2)]],
  crown: [() => [[[-.9, -.5], [-.9, .4], [-.45, -.05], [0, .75], [.45, -.05], [.9, .4], [.9, -.5], [-.9, -.5]], line([-.9, -.72], [.9, -.72]), circle(-.9, .52, .1, 0, TAU, 10), circle(0, .88, .1, 0, TAU, 10), circle(.9, .52, .1, 0, TAU, 10)]],
  letter: [() => [rect(-.9, -.6, .9, .6), [[-.9, .6], [0, -.05], [.9, .6]], [[-.9, -.6], [-.25, .08]], [[.9, -.6], [.25, .08]]]],
  train: [() => [[[-1, -.45], [-1, .5], [.7, .5], [1, .1], [1, -.45], [-1, -.45]], rect(-.8, 0, -.45, .32), rect(-.3, 0, .05, .32), rect(.2, 0, .55, .32), circle(-.6, -.6, .15, 0, TAU, 14), circle(0, -.6, .15, 0, TAU, 14), circle(.6, -.6, .15, 0, TAU, 14), line([-1.2, -.78], [1.2, -.78])]],
  ship: [() => [[[-.9, -.5], [-.6, -.85], [.6, -.85], [.9, -.5], [-.9, -.5]], line([0, -.5], [0, 1]), [[0, .95], [.7, -.3], [0, -.3]], [[-.08, .7], [-.6, -.3], [-.08, -.3]], wave(-.98, .05, 9, 0)]],
  candle: [() => [rect(-.16, -.9, .16, .15), line([0, .15], [0, .3]), [[0, .95], [.16, .6], [.12, .4], [0, .32], [-.12, .4], [-.16, .6], [0, .95]], line([-.45, -.9], [.45, -.9]), circle(0, .58, .5, 0, TAU, 28).filter((_, i) => i % 2 === 0)]],
  glass: [() => [[[-.5, .9], [-.42, .3], [-.2, -.02], [0, -.1], [.2, -.02], [.42, .3], [.5, .9]], line([-.5, .9], [.5, .9]), line([0, -.1], [0, -.85]), line([-.34, -.9], [.34, -.9]), line([-.45, .5], [.45, .5]), circle(.1, .25, .05, 0, TAU, 8), circle(-.12, .12, .04, 0, TAU, 8)]],
  diamond: [() => [[[-.9, .35], [-.5, .85], [.5, .85], [.9, .35], [0, -.95], [-.9, .35]], line([-.9, .35], [.9, .35]), [[-.5, .85], [-.3, .35], [0, -.95]], [[.5, .85], [.3, .35], [0, -.95]], [[-.3, .35], [0, .85], [.3, .35]]]],
  lightning: [() => [[[.2, 1], [-.42, .08], [.02, .08], [-.3, -1], [.52, .22], [.1, .22], [.48, 1], [.2, 1]], line([-.8, .5], [-.62, .3]), line([.75, -.3], [.92, -.5])]],
  rainbow: [() => [0, 1, 2, 3].map(j => circle(0, -.6, 1 - j * .16, 0, Math.PI, 36)).concat([ell(-.9, -.6, .28, .16, 0, Math.PI, 10), ell(.9, -.6, .28, .16, 0, Math.PI, 10)])],
  phone: [() => [rect(-.42, -.95, .42, .95), rect(-.34, -.7, .34, .72), line([-.1, .84], [.1, .84]), circle(.62, .6, .2, -.6, .6, 8), circle(.62, .6, .38, -.6, .6, 10), circle(.62, .6, .56, -.6, .6, 12)]],
  car: [() => [[[-1, -.5], [-1, -.1], [-.6, -.05], [-.35, .4], [.35, .4], [.62, -.05], [1, -.12], [1, -.5], [-1, -.5]], [[-.28, .3], [-.48, -.05], [.5, -.05], [.3, .3], [-.28, .3]], circle(-.55, -.55, .2, 0, TAU, 16), circle(.55, -.55, .2, 0, TAU, 16), line([-1.3, -.2], [-1.1, -.2]), line([-1.4, -.38], [-1.1, -.38])]],
};
// the particle behaviours an image can have (shader kind id, how many per release); one of them per release,
// never the same twice running
const BEHAVIOUR = {star: [[0, 26], [15, 9], [23, 22], [19, 16]], moon: [[0, 14], [19, 12], [7, 16]], sun: [[8, 30], [3, 24]], sky: [[6, 18], [16, 10]], night: [[0, 22], [15, 7]], light: [[8, 26], [19, 18]], sea: [[9, 34]], rain: [[1, 44]], snow: [[2, 34], [19, 14]], wind: [[6, 30], [24, 16]],
  flower: [[4, 30], [24, 22], [5, 26]], fire: [[3, 34], [8, 22]], heart: [[10, 22], [18, 14], [18, 9]], wing: [[11, 20], [21, 14]], road: [[12, 26]], time: [[7, 24], [19, 12]], dream: [[13, 18], [0, 18], [16, 9]], city: [[12, 22], [19, 14]], tears: [[1, 14], [13, 8]], door: [[8, 16], [19, 10]],
  world: [[7, 30]], galaxy: [[7, 44], [15, 10]], fireworks: [[5, 56], [5, 38]], song: [[9, 30], [22, 12]], eye: [[7, 18], [19, 10]],
  hand: [[8, 14], [0, 14]], butterfly: [[14, 10]], tree: [[24, 18]], mountain: [[6, 20]], home: [[19, 12], [3, 14]], mirror: [[19, 16]], shadow: [[16, 8]], smoke: [[16, 12]], ring: [[10, 14], [19, 12]], crown: [[19, 16], [21, 18]], letter: [[21, 12]], train: [[12, 24]],
  ship: [[9, 26]], candle: [[3, 16]], glass: [[13, 16]], diamond: [[19, 20]], lightning: [[17, 40]], rainbow: [[20, 44]], phone: [[10, 12]], car: [[12, 24]]};
const mostOf = img => Math.max(...(BEHAVIOUR[img] || [[0, 20]]).map(b => b[1]));
// how long a particle of each kind lives (s), and which kinds are released over a moment instead of at once
const LIFE = {1: 1.6, 5: 2.2, 6: 5, 9: 5, 11: 5, 12: 4, 14: 5.5, 15: 3.4, 16: 4.6, 17: .75, 18: 4.2, 19: 3, 20: 4.4, 21: 4.2, 22: 4.6, 24: 5.2};
const SPREAD = new Set([1, 6, 9, 11, 12, 14, 16, 18, 21, 22, 24]);

// images that belong to the sky hang in it; the others stand on the water
const SKY = new Set(['star', 'moon', 'sun', 'sky', 'night', 'light', 'rain', 'snow', 'wind', 'wing', 'dream', 'galaxy', 'fireworks', 'time', 'world', 'butterfly', 'smoke', 'lightning', 'rainbow', 'diamond', 'ring', 'hand', 'letter']);
// and a few are drawn on the water itself, lying flat
const FLAT = new Set(['sea', 'road', 'shadow']);
// what a drawing does while it stands: hearts beat with the kick, flames flicker, wings beat, lights twinkle, wheels turn
const ANIM = {heart: 'beat', fire: 'flicker', candle: 'flicker', butterfly: 'flap', star: 'twinkle', diamond: 'twinkle', light: 'twinkle', sun: 'turn', galaxy: 'turn', world: 'turn', snow: 'turn', fireworks: 'beat', song: 'beat', smoke: 'sway', flower: 'sway', tree: 'sway', ship: 'sway', glass: 'sway'};
function polyGeometry(polys) {
  const pos = [], len = [];
  for (const p of polys) {
    if (!p || p.length < 2) continue;
    let total = 0; const acc = [0];
    for (let i = 1; i < p.length; i++) { total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); acc.push(total); }
    for (let i = 1; i < p.length; i++) { pos.push(p[i - 1][0], p[i - 1][1], 0, p[i][0], p[i][1], 0); len.push(acc[i - 1] / Math.max(1e-6, total), acc[i] / Math.max(1e-6, total)); }
  }
  // each polyline's own progress (0..1), offset by its order so strokes draw one after another with overlap
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const order = [], nP = polys.filter(p => p && p.length >= 2).length;
  let pi = -1;
  for (const p of polys) { if (!p || p.length < 2) continue; pi++; for (let i = 1; i < p.length; i++) order.push(pi / Math.max(1, nP), pi / Math.max(1, nP)); }
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(len, 1));
  g.setAttribute('aOrder', new THREE.Float32BufferAttribute(order, 1));
  let lowest = 1; for (let i = 1; i < pos.length; i += 3) lowest = Math.min(lowest, pos[i]);
  g.userData.foot = lowest;                                         // the drawing's lowest point (it stands on that)
  return g;
}
const MIRROR = {value: 0};                                           // 1 while the lake's mirrored picture is drawn

// ---- Codex's drawings -----------------------------------------------------------------------------------------
const QS = new URLSearchParams(globalThis.location?.search || ''), FORCE_SET = QS.get('motifs');
const SET_OF = {pop: 'cute', soft: 'cute', rock: 'anime', hiphop: 'anime', electro: 'anime', anime: 'anime', indie: 'anime'};
const PEN_OF = {rock: 'jitter', pop: 'round', electro: 'tube', hiphop: 'bold', anime: 'fine', soft: 'ink', indie: 'fine'};
const PEN = {fine: [0, 1.6], round: [1, 2.3], jitter: [2, 1.8], tube: [3, 4.8], ink: [4, 2.7], bold: [5, 3.1]};   // shader mode, width (px at 900 high)
const sets = {}, loaded = {};
const loadSet = name => (sets[name] ||= fetch(`/p/gen/motifs-${name}.json`).then(r => r.json()).then(j => (loaded[name] = j)).catch(e => { console.warn('motifs', name, e); return null; }));
// (2026-10-07) the style pack (Codex, assets/imagery-style-pack-20261007: 72 drawings in eight families, each with
// the words it may stand for). A song draws from the families that suit its style: a word of the line that one of
// them stands for gets that drawing (in place of the plain one); a song with no recurring image (an instrumental,
// or lyrics without one) gets two of them as its far constellations, answering at its sections. Abstract words
// (love, free, hope…) never trigger a drawing: only things that can be drawn.
const PACK_FAMS = {rock: ['rock', 'nocturne'], pop: ['kawaii', 'groove', 'dreamy'], electro: ['electronic', 'dreamy'], hiphop: ['groove', 'rock', 'nocturne'],
  anime: ['cinematic', 'dreamy', 'kawaii'], soft: ['quiet', 'dreamy', 'groove'], indie: ['nocturne', 'quiet', 'dreamy']};
const PACK_STOP = new Set(['wish', 'sweet', 'love', 'dance', 'music', 'memory', 'warm', 'fight', 'break', 'strong', 'rise', 'burn', 'free', 'escape', 'shatter', 'impact', 'wake',
  'direction', 'float', 'message', 'bloom', 'loop', 'color', 'pulse', 'beat', 'run', 'through', 'connection', 'grow', 'move', 'flow', 'sing', 'sway', 'slow', 'life', 'away', 'wait',
  'story', 'safe', 'return', 'guide', 'hope', 'way', 'open', 'step', 'beyond', 'journey', 'far', 'together', 'future', 'fly', 'hurt', 'secret', 'fall', 'truth', 'fade', 'alone',
  'remember', 'song', 'green', 'shelter', 'charm', 'roar', 'jazz', 'orbit', 'through', 'signal', 'neon']);
// the same things in Japanese and Chinese lyrics
const PACK_CJK = {'月': 'moon', '星': 'star', '雨': 'rain', '夢': 'dream', '梦': 'dream', '光': 'light', '夜': 'night', '空': 'sky', '花': 'flower', '窓': 'window', '窗': 'window', '鍵': 'key', '钥': 'key',
  '薔薇': 'rose', 'バラ': 'rose', '玫瑰': 'rose', '鏡': 'mirror', '镜': 'mirror', '涙': 'tear', '泪': 'tear', '羽': 'feather', '翼': 'wing', '炎': 'fire', '火': 'fire', '鎖': 'chain', '锁链': 'chain',
  '鐘': 'bell', '钟': 'bell', '嵐': 'storm', '波': 'wave', '雲': 'cloud', '云': 'cloud', '手紙': 'letter', '信': 'letter', '船': 'boat', '舟': 'boat', '橋': 'bridge', '桥': 'bridge', '列車': 'train', '電車': 'train', '列车': 'train',
  '帆': 'sail', '風': 'wind', '风': 'wind', '心': 'heart', '王冠': 'crown', '蝶': 'butterfly', '仮面': 'mask', '面具': 'mask', '時計': 'time', '时钟': 'time', '鯨': 'whale', '鲸': 'whale', '泡': 'bubble',
  '川': 'river', '河': 'river', '種': 'seed', '种子': 'seed', '巣': 'nest', '珈琲': 'coffee', 'コーヒー': 'coffee', '咖啡': 'coffee', '魚': 'fish', '鱼': 'fish', '山': 'mountain', '門': 'gate', '门': 'gate',
  '太陽': 'sun', '太阳': 'sun', '水': 'water', '朝': 'dawn', '夜明け': 'dawn', '黎明': 'dawn', '盾': 'shield', '茶': 'tea', '兎': 'rabbit', 'うさぎ': 'rabbit', '兔': 'rabbit', '瓶': 'bottle', '傘': 'rain', '伞': 'rain'};
const setNameOf = t => (['cute', 'anime', 'lines'].includes(FORCE_SET) ? FORCE_SET : SET_OF[(t.style || styleOf(t)).name] || 'anime');
// a drawing's paths (1024 box, y down; [x0, y0, then six numbers per cubic]) → polylines in the unit box, y up
function sampled(em) {
  const strokes = [];
  for (const [g, w] of [['line', 1], ['accent', .72]]) for (const P of em[g] || []) {
    const pts = [(P[0] - 512) / 512, (512 - P[1]) / 512];
    for (let i = 2; i + 5 < P.length; i += 6) {
      const x0 = P[i - 2], y0 = P[i - 1], [ax, ay, bx, by, x1, y1] = P.slice(i, i + 6);
      const len = Math.hypot(ax - x0, ay - y0) + Math.hypot(bx - ax, by - ay) + Math.hypot(x1 - bx, y1 - by), n = Math.max(1, Math.min(40, Math.ceil(len / 7)));
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t, x = u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x1, y = u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y1; pts.push((x - 512) / 512, (512 - y) / 512); }
    }
    if (pts.length >= 4) strokes.push({pts, w});
  }
  return strokes;
}
// one quad per piece of line. position: this end, aB: the other; aE: side, which end (0 start, 1 end), the pen's
// distance along the whole drawing (0..1) at the piece's start and end; aW: weight, place along its own stroke, seed
function ribbonGeometry(em) {
  const strokes = sampled(em);
  let total = 0; for (const s of strokes) for (let i = 2; i < s.pts.length; i += 2) total += Math.hypot(s.pts[i] - s.pts[i - 2], s.pts[i + 1] - s.pts[i - 1]);
  const pos = [], oth = [], E = [], Wt = [], idx = [];
  let acc = 0, v = 0, foot = 1;
  strokes.forEach((s, si) => {
    const p = s.pts, n = p.length / 2; let own = 0, ownT = 0; for (let i = 1; i < n; i++) ownT += Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    for (let i = 0; i + 1 < n; i++) {
      const x0 = p[2 * i], y0 = p[2 * i + 1], x1 = p[2 * i + 2], y1 = p[2 * i + 3], l = Math.hypot(x1 - x0, y1 - y0), s0 = acc / total, s1 = (acc + l) / total, t0 = own / ownT, t1 = (own + l) / ownT;
      foot = Math.min(foot, y0, y1);
      for (const [end, side] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
        if (end) { pos.push(x1, y1, 0); oth.push(x0, y0, 0); } else { pos.push(x0, y0, 0); oth.push(x1, y1, 0); }
        E.push(side, end, s0, s1); Wt.push(s.w, end ? t1 : t0, si * .618 % 1);
      }
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4; acc += l; own += l;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aB', new THREE.Float32BufferAttribute(oth, 3));
  g.setAttribute('aE', new THREE.Float32BufferAttribute(E, 4)); g.setAttribute('aW', new THREE.Float32BufferAttribute(Wt, 3)); g.setIndex(idx);
  // (total in units of the 1024 box: a long drawing takes a little longer, at most 2.2 s)
  g.userData = {foot, ribbon: true, dur: Math.min(2.2, Math.max(.8, .6 + total * 512 / 11000))};
  return g;
}
const RIB = {uT: {value: 0}, uPx: {value: 1.4}, uRes: {value: new THREE.Vector2(1600, 900)}, uMode: {value: 0}};
const EMB2_VS = `attribute vec3 aB; attribute vec4 aE; attribute vec3 aW; uniform vec2 uRes; uniform float uDraw, uPx, uT, uMode; varying float vX, vVis, vTip, vDepth;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 J(vec3 p){ if (uMode < 1.5 || uMode > 2.5) return p; float k = floor(uT * 12.); return p + vec3(h(p.xy * 91.3 + k) - .5, h(p.yx * 57.1 + k + 3.) - .5, 0.) * .022; }
void main(){
  // the pen: the piece it is on is drawn up to it, the pieces after it are not there yet
  vec3 p0 = J(aE.y < .5 ? position : aB), p1 = J(aE.y < .5 ? aB : position);
  float g = clamp((uDraw - aE.z) / max(aE.w - aE.z, 1e-6), 0., 1.), sv = mix(aE.z, aE.w, aE.y * g);
  vec3 pe = mix(p0, p1, max(g, .002)), me = aE.y < .5 ? p0 : pe, ot = aE.y < .5 ? pe : p0;
  vVis = step(aE.z, uDraw - 1e-5); vTip = exp(-max(uDraw - sv, 0.) / .025) * step(uDraw, .999); vX = aE.x;
  float w = uPx * (.55 + .45 * aW.x);
  if (uMode > 3.5 && uMode < 4.5) w *= .35 + 1.1 * sin(3.1416 * clamp(aW.y, 0., 1.));         // ink: swells and tapers
  vec4 wa = modelMatrix * vec4(me, 1.), wb = modelMatrix * vec4(ot, 1.);
  vDepth = -(viewMatrix * wa).z;
  vec4 a = projectionMatrix * viewMatrix * wa, b = projectionMatrix * viewMatrix * wb;
  vec2 d = (b.xy / max(b.w, 1e-3) - a.xy / max(a.w, 1e-3)) * uRes; float l = length(d); d = l > 1e-4 ? d / l : vec2(1., 0.);
  a.xy += vec2(-d.y, d.x) * aE.x * (aE.y < .5 ? 1. : -1.) * w / uRes * 2. * a.w; gl_Position = a; }`;
const EMB2_FS = `uniform vec3 uCol; uniform float uA, uMirror, uDim, uMode; varying float vX, vVis, vTip, vDepth;
void main(){ if (vVis < .5) discard;
  float x = abs(vX), a = uMode > 2.5 && uMode < 3.5 ? exp(-x * x * 18.) * 1.7 + exp(-x * x * 2.6) * .4 : smoothstep(1., uMode > .5 && uMode < 1.5 ? .1 : .4, x);
  gl_FragColor = vec4(uCol * (1. + 1.6 * vTip), a * uA * smoothstep(.3, 1.2, vDepth) * mix(1., uDim, uMirror)); }`;
const EMB_VS = `attribute float aLen, aOrder; varying float vLen, vOrder, vDepth; void main(){ vLen = aLen; vOrder = aOrder; vec4 mv = modelViewMatrix * vec4(position, 1.); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const EMB_FS = `uniform vec3 uCol; uniform float uA, uDraw, uMirror, uDim; varying float vLen, vOrder, vDepth;
void main(){
  float p = clamp(uDraw * 1.6 - vOrder * .6, 0., 1.);            // strokes start one after another, overlapping
  if (vLen > p) discard;
  float tip = exp(-(p - vLen) / .04) * step(p, .999);
  gl_FragColor = vec4(uCol * (1. + 1.5 * tip), uA * smoothstep(.3, 1.2, vDepth) * mix(1., uDim, uMirror));
}`;

// ---- particles: one pool, motion in the shader as a function of age -------------------------------------
const PART_VS = `attribute vec3 aR, aU; attribute vec4 aB; attribute vec4 aS; attribute vec3 aC;
// aB: birth (song s), life (s), kind, size;  aS: four random numbers;  position: origin (world)
uniform float uT, uScale, uWater; uniform vec2 uPointer; uniform float uAspect; varying float vA, vKind, vRot, vAge, vFlap, vBand; varying vec3 vC;
float hs(float x){ return fract(sin(x * 91.3458) * 47453.5453); }
void main(){
  float age = uT - aB.x, life = aB.y, k = aB.z; vKind = k; vC = aC; vAge = age / life; vFlap = 1.; vBand = 0.;
  if (age < 0. || age > life) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  float x = age / life, s1 = aS.x, s2 = aS.y, s3 = aS.z, s4 = aS.w;
  vec3 R = aR, U = aU, N = normalize(cross(R, U)), p = position;
  float a = 1. - smoothstep(.65, 1., x); a *= smoothstep(0., .06, x); float sz = 1.; vRot = 0.;
  float ang = s1 * 6.2832;
  if (k < .5 || k > 22.5 && k < 23.5) {        // twinkle: a cloud around the word, flickering (23: as five-point stars)
    p += (R * cos(ang) + U * sin(ang)) * (.35 + 1.4 * s2) + N * (s3 - .5) * .8 + U * x * .15;
    a *= .55 + .45 * sin(age * (6. + 9. * s4) + s3 * 9.); sz = .8 + .9 * s4;
    if (k > 1.) { vRot = 12.; sz *= 1.5; }
  } else if (k < 1.5) { // fall (rain, tears)
    p += R * (s2 - .5) * 2.4 + N * (s3 - .5) * .9 + U * (1.1 - age * (1.6 + 1.2 * s4) * (aB.w < .9 ? .6 : 1.4));
    sz = .55 + .4 * s4; vRot = 1.;
  } else if (k < 2.5) { // snow
    p += R * ((s2 - .5) * 2.6 + .15 * sin(age * 1.3 + s3 * 6.)) + N * (s3 - .5) + U * (1.1 - age * (.28 + .2 * s4));
    sz = .6 + .6 * s4;
  } else if (k < 3.5) { // embers rise
    p += R * ((s2 - .5) * .9 + .12 * sin(age * 4. + s3 * 6.) * x) + N * (s3 - .5) * .5 + U * (age * (.5 + .5 * s4) - .2);
    a *= .6 + .4 * sin(age * 13. + s4 * 7.); sz = .5 + .5 * (1. - x);
  } else if (k < 4.5) { // petals spiral out and down
    float r = .3 + 1.6 * x * (.6 + .6 * s2), th = ang + x * 2.4 * (s3 < .5 ? -1. : 1.);
    p += R * cos(th) * r + U * (sin(th) * r * .5 - .6 * x * x) + N * (s4 - .5) * .6; vRot = 2.; sz = .9 + .6 * s4;
  } else if (k < 5.5) { // burst with gravity
    vec3 d = normalize(R * cos(ang) * sin(s2 * 3.1416) + U * sin(ang) * sin(s2 * 3.1416) + N * cos(s2 * 3.1416) * .6);
    float e = 1. - exp(-age * 3.2); p += d * e * (1.2 + .8 * s3) - U * age * age * .25; a *= 1. - x * x; sz = 1. - .6 * x;
  } else if (k < 6.5) { // drift: a curving stream across the frame
    p += R * (-1.8 + age * (.7 + .5 * s4)) + U * ((s2 - .5) * 1.4 + .25 * sin(age * 1.4 + s3 * 6.)) + N * (s3 - .5) * .7; sz = .6 + .5 * s4;
  } else if (k < 7.5) { // orbit in a tilted disc
    float r = .5 + 1.5 * s2, th = ang + age * (.9 / (r + .3)) * (s4 < .5 ? 1. : -1.);
    p += R * cos(th) * r + (U * .35 + N * .9) * sin(th) * r; sz = .5 + .7 * s3;
  } else if (k < 8.5) { // rays outward from the word
    vec3 d = R * cos(ang) + U * sin(ang); p += d * (.25 + age * (1.2 + 1.2 * s2)) + N * (s3 - .5) * .3; sz = .6 + .6 * (1. - x); vRot = 3.;
  } else if (k < 9.5) { // waves: along sinusoidal lines
    float row = floor(s2 * 4.), xx = -2. + age * (.8 + .4 * s4) + s3 * 1.4;
    p += R * xx + U * (-.55 - row * .22 + .1 * sin(xx * 3.4 + row + uT * 1.6)) + N * (row * .25 - .3); sz = .55 + .3 * s3;
  } else if (k < 10.5) { // pulse rings (heart): points on rings that expand
    float r = .2 + x * (1.4 + .4 * s2); p += (R * cos(ang) + U * sin(ang) * .9) * r; a *= 1. - x; sz = .7;
  } else if (k < 11.5) { // flight: points in V formations drifting up and across
    float v = (s2 - .5) * 2., grp = floor(s3 * 3.);
    p += R * (-1.4 + age * .55 + abs(v) * .25 + grp * .5) + U * (.2 + age * .18 - abs(v) * .2 + grp * .3 + .05 * sin(age * 7. + s4 * 6.)) + N * (grp - 1.) * .4 + R * v * .5;
    sz = .6;
  } else if (k < 12.5) { // perspective: points flowing toward a vanishing point behind the word
    float z = fract(s2 + age * .25); p += (R * (s3 - .5) * 3. + U * (s4 - .5) * 1.6) * (1. - z) - N * z * 4.; a *= sin(z * 3.1416); sz = .5 + (1. - z);
  } else if (k < 13.5) { // bubbles: rise slowly, wobble, pop
    p += R * ((s2 - .5) * 2. + .1 * sin(age * 2. + s3 * 6.)) + U * (-.5 + age * (.22 + .2 * s4)) + N * (s3 - .5) * .6; vRot = 4.; sz = 1. + 1.4 * s4;
  } else if (k < 14.5 || k > 23.5) { // flutter: butterflies (14) or leaves and petals (24) wander on looping paths
    float th = ang + age * (1.1 + .8 * s4);
    p += R * ((s2 - .5) * 1.6 + .5 * sin(th) + .25 * sin(th * 2.3 + s3 * 6.)) + U * (-.1 + age * (k > 23.5 ? -.12 : .2) * (.6 + s3) + .28 * sin(th * 1.7) + (k > 23.5 ? .8 : 0.)) + N * ((s3 - .5) * .9 + .3 * cos(th));
    vRot = k > 23.5 ? 2. : 6.; sz = (k > 23.5 ? 1. : 1.5) + .9 * s4; vFlap = sin(age * (11. + 6. * s2) + s1 * 6.);
  } else if (k < 15.5) { // shooting stars: each crosses the sky above the word once, a moment after the other
    float d0 = s2 * 1.7, tt = max(age - d0, 0.), sp = 2.6 + 2.2 * s4;
    p += R * ((s3 - .5) * 5. - 1.2 + tt * sp * .86) + U * (2.2 + 1.4 * s1 - tt * sp * .5) + N * (-2. - 3. * s4);
    a = step(d0, age) * exp(-tt * 1.5) * smoothstep(0., .05, tt); vRot = 10.; sz = 2.6 + 1.6 * s3;
  } else if (k < 16.5) { // smoke: rises, spreads, thins
    p += R * ((s2 - .5) * .5 + (.3 + .5 * s3) * x * sin(ang + age * .8)) + U * (age * (.3 + .25 * s4)) + N * (s3 - .5) * .5;
    a *= .5 * (1. - x); vRot = 9.; sz = 2. + 5. * x;
  } else if (k < 17.5) { // a bolt: a zigzag from the sky down to the word, there at once, flickering, gone
    float seed = floor(position.x * 13.7 + position.z * 7.3), y = s2, sg = y * 9., i0 = floor(sg), f = fract(sg);
    float off = mix(hs(i0 + seed), hs(i0 + 1. + seed), f) - .5, br = s1 < .22 ? (s3 - .5) * 1.2 * y : 0.;
    p += R * (off * 1.1 * (1. - .5 * y) + br + .3) + U * (3.4 * (1. - y) + .1) + N * -.3;
    a = (1. - x) * (.35 + .65 * step(.45, fract(age * 11. + seed * .37))); sz = .7 + .5 * s4;
  } else if (k < 18.5) { // hearts rise, swaying
    p += R * ((s2 - .5) * 1.8 + .22 * sin(age * 2.2 + s3 * 6.)) + U * (-.1 + age * (.3 + .3 * s4)) + N * (s3 - .5) * .6; vRot = 5.; sz = 1.3 + 1.1 * s4;
  } else if (k < 19.5) { // glints: crosses of light that open and close where they are
    p += (R * cos(ang) + U * abs(sin(ang)) * .8) * (.3 + 1.5 * s2) + N * (s3 - .5) * .6;
    float ph = fract(age * (.5 + .5 * s4) + s3); a *= pow(sin(ph * 3.1416), 6.); vRot = 8.; sz = 1.6 + 1.6 * s4;
  } else if (k < 20.5) { // a bow: points run along concentric arcs
    float band = floor(s2 * 5.), rr = 1.5 + band * .13, th = 3.1416 * clamp(age * (.25 + .05 * s4) + s3 * .3, 0., 1.);
    p += R * (-cos(th) * rr) + U * (sin(th) * rr - .3) + N * -.6; sz = .75; vBand = band - 2.;
  } else if (k < 21.5) { // paper, feathers: tumbling down in a zigzag
    p += R * ((s2 - .5) * 2.4 + .3 * sin(age * 3. + s3 * 6.)) + U * (1.3 - age * (.5 + .4 * s4)) + N * (s3 - .5) * .9; vRot = 11.; sz = .9 + .7 * s4; vFlap = sin(age * (7. + 5. * s1));
  } else {             // notes rise in a row, bobbing
    p += R * (-1.2 + s2 * 2.4 + .1 * sin(age * 3.)) + U * (.1 + age * (.28 + .2 * s4) + .12 * sin(age * 4. + s3 * 6.)) + N * (s3 - .5) * .5; vRot = 7.; sz = 1.6 + .8 * s4;
  }
  a *= smoothstep(uWater, uWater + .12, p.y);                           // what falls into the lake is gone
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vec4 cp = projectionMatrix * mv;
  vec2 sp = cp.xy / cp.w, dd = sp - uPointer; dd.x *= uAspect;
  float pd = length(dd); if (uPointer.x > -5. && pd < .16) a *= 1. + 1.5 * (1. - pd / .16);
  gl_Position = cp;
  vA = a * smoothstep(1.6, 3.4, -mv.z);                                  // nothing drifts into the lens
  gl_PointSize = min(uScale * aB.w * sz / max(-mv.z, .3), uScale * .32);
}`;
const PART_FS = `varying float vA, vKind, vRot, vAge, vFlap, vBand; varying vec3 vC;
vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1. - ca); }
void main(){
  vec2 q = gl_PointCoord - .5; float r = length(q), a;
  if (vRot > 11.5) { float an = atan(q.x, -q.y), R5 = .47 * (.42 + .58 * pow(abs(cos(2.5 * an)), 1.6)); a = smoothstep(R5, R5 - .07, r) + .3 * smoothstep(.2, 0., r); }   // five-point star
  else if (vRot > 10.5) { float w = .12 + .88 * abs(vFlap); a = step(abs(q.x), .3) * step(abs(q.y), .3 * w) * .8; }                                              // paper
  else if (vRot > 9.5) { vec2 d = vec2(.866, .5); float u = dot(q, d), v = dot(q, vec2(-.5, .866)); a = exp(-v * v * 700.) * smoothstep(-.5, .38, u) * smoothstep(.5, .4, u) + smoothstep(.07, 0., length(q - d * .4)); }   // shooting star
  else if (vRot > 8.5) a = exp(-r * r * 11.) * .5;                                                                                                               // smoke
  else if (vRot > 7.5) a = exp(-abs(q.x) * 46.) * smoothstep(.5, 0., abs(q.y)) + exp(-abs(q.y) * 46.) * smoothstep(.5, 0., abs(q.x)) + smoothstep(.1, 0., r);       // glint
  else if (vRot > 6.5) { vec2 h = q - vec2(-.1, .2); a = max(smoothstep(.15, .1, length(h * vec2(1., 1.35))), step(abs(q.x - .03), .022) * step(-.36, q.y) * step(q.y, .2)); a = max(a, step(abs(q.y + .33 - (q.x - .03) * .7), .03) * step(.03, q.x) * step(q.x, .26)); }   // note
  else if (vRot > 5.5) { float w = .25 + .75 * abs(vFlap), ex = abs(q.x) / w; a = smoothstep(.21, .15, length(vec2(ex - .22, (q.y + .06) * 1.2))) + smoothstep(.15, .1, length(vec2(ex - .16, (q.y - .2) * 1.5))) + step(abs(q.x), .02) * step(abs(q.y), .26); }   // butterfly
  else if (vRot > 4.5) { vec2 h = vec2(q.x, -q.y) * 2.7 + vec2(0., .25); float f = pow(h.x * h.x + h.y * h.y - 1., 3.) - h.x * h.x * h.y * h.y * h.y; a = smoothstep(.03, -.08, f); }   // heart
  else if (vRot > 3.5) a = smoothstep(.5, .42, r) * smoothstep(.3, .4, r) + .15 * smoothstep(.5, .2, r);           // bubble ring
  else if (vRot > 2.5) a = smoothstep(.5, 0., r) * (.4 + .6 * smoothstep(.08, 0., abs(q.x * q.y) * 6.));       // ray spark
  else if (vRot > 1.5) { float w = .3 + .7 * abs(vFlap); vec2 e = vec2(q.x * 1.8 / w, q.y * .9); a = smoothstep(.5, .35, length(e)); }            // petal, leaf
  else if (vRot > .5) a = smoothstep(.09, 0., abs(q.x)) * smoothstep(.5, .1, abs(q.y));                        // streak
  else if (vKind < .5) { float s = min(abs(q.x), abs(q.y)); a = smoothstep(.07, 0., s) * smoothstep(.5, .0, r) + smoothstep(.16, 0., r); }  // star
  else a = smoothstep(.5, 0., r) * smoothstep(.5, .1, r) + smoothstep(.12, 0., r);
  vec3 c = vBand != 0. ? max(hueRot(vC, vBand * .9), 0.) : vC;       // the bow: each arc a step round the hue circle
  gl_FragColor = vec4(c * min(a, 1.) * vA, 1.);
}`;

export function createImagery(scene) {
  const group = new THREE.Group(); scene.add(group);
  let track = null, score = null, shots = null, sig = null, lyrics = null, theme = null, C = {};
  let emblems = [], motifs = [], pool = null, clickPool = null, penW = 1.25;
  const geos = new Map();
  let SET = 'lines', lib = null;
  // a drawing of an image: the song's set if it has that image, else the procedural one
  const geoOf = (name, v = 0) => {
    const K = lib?.kinds?.[name];
    if (K?.emblems.length) { const i = v % K.emblems.length, k = SET + '/' + name + '/' + i; return geos.get(k) || geos.set(k, ribbonGeometry(K.emblems[i])).get(k); }
    const D = DRAW[name], k = name + '/' + (v % D.length); return geos.get(k) || geos.set(k, polyGeometry(D[v % D.length]())).get(k);
  };
  const variants = name => lib?.kinds?.[name]?.emblems.length || DRAW[name]?.length || 1;
  const embMat = c => new THREE.ShaderMaterial({vertexShader: EMB_VS, fragmentShader: EMB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uCol: {value: c.clone()}, uA: {value: 0}, uDraw: {value: 0}, uDim: {value: 1}, uMirror: MIRROR}});
  const ribMat = c => new THREE.ShaderMaterial({vertexShader: EMB2_VS, fragmentShader: EMB2_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uCol: {value: c.clone()}, uA: {value: 0}, uDraw: {value: 0}, uDim: {value: 1}, uMirror: MIRROR, ...RIB}});
  const meshOf = (geo, c) => (geo.userData.ribbon ? new THREE.Mesh(geo, ribMat(c)) : new THREE.LineSegments(geo, embMat(c)));
  // one of each kind, never shown, so their programs are compiled while a song loads (stage.warm)
  { const g0 = new THREE.BufferGeometry(); for (const [k, d] of [['position', 3], ['aB', 3], ['aE', 4], ['aW', 3]]) g0.setAttribute(k, new THREE.Float32BufferAttribute(new Float32Array(d * 3), d)); g0.userData.ribbon = true; const m = meshOf(g0, new THREE.Color()); m.frustumCulled = false; m.material.uniforms.uA.value = 0; m.visible = true; m.scale.setScalar(1e-4); group.add(m); }
  /** the song's set of drawings, loaded before the song opens (stage.prepare) */
  const prepare = t => { const n = setNameOf(t); return Promise.all([n === 'lines' ? null : loadSet(n), loadSet('stylepack')]); };
  const packGeo = id => geos.get('sp/' + id) || geos.set('sp/' + id, ribbonGeometry(loaded.stylepack.assets[id])).get('sp/' + id);
  const lf = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()}, basis = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();

  function clear() {
    for (const e of [...emblems, ...motifs]) { group.remove(e.mesh); e.mesh.material.dispose(); }
    emblems = []; motifs = [];
    for (const p of [pool, clickPool]) if (p) { group.remove(p.points); p.points.geometry.dispose(); p.points.material.dispose(); }
    pool = clickPool = null;
  }
  function makePool(n) {
    const g = new THREE.BufferGeometry();
    const A = {position: 3, aR: 3, aU: 3, aB: 4, aS: 4, aC: 3};
    for (const [k, d] of Object.entries(A)) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * d), d));
    const mat = new THREE.ShaderMaterial({vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uT: {value: 0}, uScale: {value: 40}, uWater: {value: -1.05}, uPointer: {value: new THREE.Vector2(-9, -9)}, uAspect: {value: 1.78}}});
    const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 3; group.add(points);
    return {points, g, n, i: 0};
  }
  function emit(P, img, origin, R, U, birth, count, seed, colour, size = 1, variant = 0) {
    const opts = BEHAVIOUR[img] || [[0, 20]], [kind, base] = opts[variant % opts.length], n = Math.min(P.n, Math.round(count ?? base)), a = P.g.attributes, life = LIFE[kind] ?? 3.6;
    for (let j = 0; j < n; j++) {
      const i = P.i % P.n; P.i++;
      a.position.setXYZ(i, origin.x, origin.y, origin.z); a.aR.setXYZ(i, R.x, R.y, R.z); a.aU.setXYZ(i, U.x, U.y, U.z);
      const jitter = SPREAD.has(kind) ? hash(seed, j * 3.1) * 1.4 : kind === 17 ? hash(seed, j * 3.1) * .04 : hash(seed, j * 3.1) * .25;
      a.aB.setXYZ(i, birth + jitter, life * (.75 + .5 * hash(seed + 1, j)), kind); a.aB.setW(i, size * (img === 'tears' ? .8 : 1));
      a.aS.setXYZW(i, hash(seed + 2, j), hash(seed + 3, j), hash(seed + 4, j), hash(seed + 5, j));
      const c = colour.clone().lerp(C.star, .35 * hash(seed + 6, j));
      a.aC.setXYZ(i, c.r, c.g, c.b);
    }
    for (const k in a) a[k].needsUpdate = true;
  }

  function setTrack(t, th, sc, signal, lyr) {
    clear();
    track = t; score = sc; sig = signal; lyrics = lyr; theme = th;
    SET = setNameOf(t); lib = SET === 'lines' ? null : loaded[SET] || null; RIB.uMode.value = PEN[PEN_OF[(t.style || styleOf(t)).name] || 'fine'][0]; penW = PEN[PEN_OF[(t.style || styleOf(t)).name] || 'fine'][1];
    C = {star: new THREE.Color(th.star), emit: new THREE.Color(t.pal.emit), img: name => imageColour(name, t.pal, new THREE.Color(th.star), sc.colors?.[name])};
    if (!shots) return;
    // scheduled particles and emblems for every image hit in the score
    let total = 0;
    for (const L of sc.lines) for (const h of L.imageAt || []) total += mostOf(h.img);
    pool = makePool(Math.max(64, Math.min(9000, total + 64)));
    clickPool = makePool(600);
    const fr = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()}, slots = new Map();
    // which drawing and which particles an image gets this time: another than the time before
    const lastD = {}, lastB = {}, seenAt = {};
    // the style pack: which of its drawings this song may use, and which word calls which
    const PK = loaded.stylepack?.assets || {}, fams = PACK_FAMS[(t.style || styleOf(t)).name] || PACK_FAMS.pop, byWord = new Map();
    for (const [id, A] of Object.entries(PK)) if (fams.includes(A.family)) for (const w of A.keywords) if (!PACK_STOP.has(w.toLowerCase())) (byWord.get(w.toLowerCase()) || byWord.set(w.toLowerCase(), []).get(w.toLowerCase())).push(id);
    const packUsed = {};
    // the first word of a line one of the drawings stands for: [id, unit index]
    const packOf = L => {
      const tx = L.text, low = tx.toLowerCase(), found = [];
      for (const m of low.matchAll(/[a-z]+/g)) { const ids = byWord.get(m[0]) || byWord.get(m[0].replace(/s$/, '')); if (ids) found.push([m.index, ids]); }
      for (const [w, ids] of byWord) if (/[^\x00-\x7f]/.test(w)) { const i = tx.indexOf(w); if (i >= 0) found.push([i, ids]); }
      for (const [c, w] of Object.entries(PACK_CJK)) { const i = tx.indexOf(c), ids = byWord.get(w); if (i >= 0 && ids) found.push([i, ids]); }
      found.sort((a, b) => a[0] - b[0]);
      for (const [i, ids] of found) {
        const fresh = ids.filter(id => packUsed[id] == null || L.i - packUsed[id] >= 6); if (!fresh.length) continue;
        const id = fresh[Math.floor(hash(L.i, i + 61) * fresh.length)], k = Math.max(0, L.units.findIndex(u => u.b > i));
        packUsed[id] = L.i; return [id, k];
      }
      return null;
    };
    const next = (last, img, len, u) => (last[img] = len < 2 ? 0 : last[img] == null ? Math.floor(u * len) : (last[img] + 1 + Math.floor(u * (len - 1))) % len);
    sc.lines.forEach(L => {
      const st = shots.stationOf(L); if (!st) return;
      shots.stationFrame(st, fr);
      const lay = lyrics.layoutOf(L);
      const G = st.G, pk = packOf(L);
      // (a drawing of the pack, called by a word of a line that has no plain image of its own)
      const imgs = (L.imageAt || []).length || !pk ? L.imageAt || [] : [{img: null, units: [pk[1]], pack: pk[0]}];
      imgs.forEach((h, j) => {
        const k = h.units[0], u = L.units[k], P = lay.P[k];
        // (on a page everything lies in the water's plane: up is up the page)
        const page = !!L.plan, upV = page ? fr.n.clone().negate() : fr.u;
        const origin = page ? fr.c.clone().addScaledVector(fr.r, P.x * EM).addScaledVector(fr.n, -(P.y + P.size * .45) * EM).addScaledVector(fr.u, .2)
          : fr.c.clone().addScaledVector(fr.r, P.x * EM).addScaledVector(fr.n, P.z - .15).addScaledVector(fr.u, (P.y + P.size * .45) * EM);
        // the line's first image is drawn as the pack's drawing when the line has one
        const packId = j === 0 && pk ? pk[0] : null;
        if (!packId && !DRAW[h.img] && !lib?.kinds?.[h.img]) return;
        if (h.img) emit(pool, h.img, origin, fr.r, upV, u.s - shots.offset, null, L.i * 31 + j * 7 + 1, C.img(h.img), 1, next(lastB, h.img, BEHAVIOUR[h.img].length, hash(L.i, j + 23)));
        if (j > 1) return;
        // an image sung again within a few lines is not drawn again (its particles answer; its drawing would repeat)
        if (!packId && seenAt[h.img] != null && L.i - seenAt[h.img] < 4 && hash(L.i, j + 53) < .8) return;
        if (h.img) seenAt[h.img] = L.i;
        // the camera aims beside the stanza (shots.js): the emblem takes the free side; a second one the other
        const cls = packId ? PK[packId].cls : lib?.kinds?.[h.img]?.cls, sky = !page && (cls ? cls === 'sky' : SKY.has(h.img)), flat = page || (cls ? cls === 'water' : FLAT.has(h.img)), geo = packId ? packGeo(packId) : geoOf(h.img, next(lastD, h.img, variants(h.img), hash(L.i, j + 29))), size = (page ? 1.3 : sky ? 2.1 : flat ? 1.8 : lib || packId ? .95 : .55) * (.85 + .3 * hash(L.i, j + 11)) * (packId ? 1.12 : 1);
        const tint = h.img ? C.img(h.img) : C.emit.clone().lerp(C.star, .4);
        // a stanza's drawings in the sky stand side by side (never over one another): free side first, then the other
        const slot = sky ? slots.get(st) || 0 : 0;
        if (sky) { if (slot >= 4) return; slots.set(st, slot + 1); }
        const free = (G.look > 0 ? -1 : 1) * (sky ? (slot % 2 ? -1 : 1) : j ? -1 : 1);
        // in the sky: far behind the line, over the horizon; on the lake: beside the line
        const pos = sky ? fr.c.clone().addScaledVector(fr.r, free * (lay.w * .3 + 2.2 + Math.floor(slot / 2) * 4)).addScaledVector(fr.n, -16 - 3 * (slot % 2)).addScaledVector(fr.u, 2 + size + .9 * (slot % 3))
          : page ? fr.c.clone().addScaledVector(fr.r, free * (lay.w / 2 + size + .9)).addScaledVector(fr.n, -(lay.py1 + lay.py0) / 2).addScaledVector(fr.u, .012)
          : flat ? fr.c.clone().addScaledVector(fr.r, free * (lay.w / 2 + size + .5)).addScaledVector(fr.n, .4).addScaledVector(fr.u, .012)
          : fr.c.clone().addScaledVector(fr.r, free * (lay.w / 2 + size + .8 + .8 * hash(L.i, j + 3))).addScaledVector(fr.n, -.6 - 1.2 * hash(L.i, j + 5)).addScaledVector(fr.u, -geo.userData.foot * size + .01);
        const mesh = meshOf(geo, tint);
        mesh.renderOrder = 4; mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
        mesh.material.uniforms.uDim.value = sky ? .3 : flat ? 0 : 1;  // what hangs in the sky is only faintly in the water; what lies on it, not at all
        emblems.push({mesh, L, G, pos, fr: {r: fr.r.clone(), u: fr.u.clone(), n: fr.n.clone()}, img: packId || h.img, size, sky, flat, start: u.s, spin: sky ? (hash(L.i, j) - .5) * .5 : 0, anim: ANIM[h.img], ph: hash(L.i, j + 41) * TAU});
      });
    });
    // motifs: the song's recurring images, huge and faint in the far sky, recurring along the route
    let motifNames = (sc.motifs || []).filter(m => DRAW[m] || lib?.kinds?.[m]).slice(0, 2);
    // (no recurring image: two of the pack's drawings, chosen by the song's own number; they answer at its sections)
    const packIds = Object.keys(PK).filter(id => fams.includes(PK[id].family)), seed = (t.vinyl?.seed || 7) % 9973;
    const instr = !motifNames.length && packIds.length;
    if (instr) motifNames = [packIds[seed % packIds.length], packIds[(seed * 7 + 3) % packIds.length]].filter((x, i, a) => a.indexOf(x) === i);
    motifNames.forEach((name, mi) => {
      const isPack = !!PK[name], hits = isPack ? (t.motion?.sections || []).map(s => s.start).filter(x => x > shots.title.lift) : sc.lines.filter(L => L.images.includes(name)).map(L => L.units.find(u => u.img === name)?.s).filter(x => x != null);
      // (an image the reading names for the whole song but no line carries: it is there from the first line on)
      const first = isPack ? shots.title.lift + 1 : hits[0] ?? sc.lines[0]?.start ?? 0, O = shots.title.c, K = 5;
      // (a plain recurring image the pack has a drawing for: drawn as that)
      const alt = !isPack ? Object.keys(PK).find(id => fams.includes(PK[id].family) && PK[id].keywords.includes(name)) : null;
      for (let j = 0; j < K; j++) {
        const a = (j + mi * .5 + hash(mi, 3)) / K * TAU, rad = 50 + 10 * hash(j, mi), size = 5 + 2.5 * hash(j + 1, mi);
        const pos = new THREE.Vector3(O.x + Math.cos(a) * rad, shots.waterY + 9 + 5 * hash(j + 2, mi), O.z + Math.sin(a) * rad);
        const mesh = isPack ? meshOf(packGeo(name), C.emit.clone().lerp(C.star, .45)) : alt && j % 2 ? meshOf(packGeo(alt), C.img(name)) : meshOf(geoOf(name, j), C.img(name));
        mesh.renderOrder = 1; mesh.frustumCulled = false; group.add(mesh);
        mesh.position.copy(pos); mesh.scale.setScalar(size); mesh.material.uniforms.uDim.value = .3;
        mesh.lookAt(O.x, pos.y, O.z);
        motifs.push({mesh, name, first, hits, base: mesh.quaternion.clone(), floor: isPack ? .2 : .12});
      }
    });
  }

  const v2 = new THREE.Vector3(), ndc = new THREE.Vector3(), qq = new THREE.Quaternion(), AZ = new THREE.Vector3(0, 0, 1);
  function update(F, lt, cam, {pointer} = {}) {
    if (!pool || !shots) return;
    const t = F.t;
    RIB.uT.value = t; RIB.uPx.value = penW * (cam.userData.pxScale || 1); if (cam.userData.res) RIB.uRes.value.set(cam.userData.res[0], cam.userData.res[1]);
    for (const P of [pool, clickPool]) { const u = P.points.material.uniforms; u.uT.value = t; u.uWater.value = shots.waterY; u.uScale.value = 64 * (cam.userData.pxScale || 1) / (cam.userData.lens || 1); u.uAspect.value = cam.aspect; u.uPointer.value.set(pointer ? pointer.x : -9, pointer ? pointer.y : -9); }
    for (const e of emblems) {
      // an emblem stays for its stanza; one on the lake beside a line that is replaced on the spot leaves with that line
      const L = e.L, S = score.stanzas[L.st], nxS = score.stanzas[L.st + 1], nxL = !e.sky && !L.last && e.G.form === 'flap' ? score.lines[L.i + 1] : null, end = S ? S.end : L.end, show = lt > e.start - .7 && lt < end + 3;
      e.mesh.visible = show; if (!show) continue;
      lf.r.copy(e.fr.r); lf.u.copy(e.fr.u); lf.n.copy(e.fr.n);
      const gone = Math.max(sm(end + .4, end + 3, lt), nxS ? sm(nxS.start - .2, nxS.start + 1, lt) : 0, nxL ? sm(nxL.start + .1, nxL.start + .9, lt) : 0), age = lt - e.start;
      v.copy(e.pos); if (e.sky) v.addScaledVector(lf.u, .25 * gone).addScaledVector(lf.n, -1.5 * gone);
      e.mesh.position.copy(v);
      if (e.flat) basis.makeBasis(lf.r, v2.copy(lf.n).negate(), lf.u); else basis.makeBasis(lf.r, lf.u, lf.n);
      q.setFromRotationMatrix(basis);
      // pointer: drawings near the pointer brighten and (in the sky) turn toward it
      ndc.copy(v).project(cam);
      let near = 0;
      if (pointer) { const dx = (ndc.x - pointer.x) * cam.aspect, dy = ndc.y - pointer.y; near = clamp(1 - Math.hypot(dx, dy) / .35); }
      qq.setFromAxisAngle(AZ, e.sky ? e.spin * age * .2 + near * .35 * Math.sign(pointer ? pointer.x - ndc.x : 1) : 0);
      e.mesh.quaternion.copy(q).multiply(qq);
      // half drawn when the word begins; on the note it flares and swells from its foot
      const hit = age >= 0 ? Math.exp(-age / .28) : 0, sc2 = e.size * (1 + .07 * hit + .1 * near);
      e.mesh.scale.setScalar(sc2);
      // what it does while it stands
      let tw = 1;
      switch (e.anim) {
        case 'beat': e.mesh.scale.multiplyScalar(1 + .09 * F.kick); break;
        case 'flicker': e.mesh.scale.y *= 1 + .07 * Math.sin(t * 17 + e.ph) + .04 * Math.sin(t * 29 + e.ph * 2); e.mesh.scale.x *= 1 + .03 * Math.sin(t * 13 + e.ph); break;
        case 'flap': e.mesh.scale.x *= .5 + .5 * Math.abs(Math.sin(t * 5.5 + e.ph)); break;
        case 'twinkle': tw = .72 + .28 * Math.sin(t * 4.6 + e.ph) * Math.sin(t * 1.7 + e.ph * 2); break;
        case 'turn': e.mesh.quaternion.multiply(qq.setFromAxisAngle(AZ, t * .22 + e.ph)); break;
        case 'sway': e.mesh.quaternion.multiply(qq.setFromAxisAngle(AZ, .07 * Math.sin(t * 1.3 + e.ph))); break;
      }
      if (!e.sky && !e.flat) e.mesh.position.y += (sc2 - e.size) * -e.mesh.geometry.userData.foot;
      const u = e.mesh.material.uniforms;
      const dd = e.mesh.geometry.userData.dur || 1.2; u.uDraw.value = clamp((lt - (e.start - dd / 2)) / dd);
      u.uA.value = (.8 + .6 * hit + .5 * near) * sm(e.start - .7, e.start - .2, lt) * (1 - gone) * (.85 + .3 * F.rms) * tw * (e.sky && track.mv ? .35 : 1);   // (MV mode: faint over the screen)
    }
    for (const m of motifs) {
      const age = lt - m.first, u = m.mesh.material.uniforms;
      let answer = 0; for (const h of m.hits) { const a = lt - h; if (a >= 0 && a < 3) answer = Math.max(answer, Math.exp(-a / .9)); }
      u.uDraw.value = clamp(age / 6);
      // constellations of the way ahead: seen far off over the horizon, gone before the camera reaches them
      u.uA.value = (m.floor + .32 * answer) * sm(0, 2, age) * sm(13, 24, m.mesh.position.distanceTo(cam.position));
      m.mesh.quaternion.copy(m.base).multiply(qq.setFromAxisAngle(AZ, .02 * Math.sin(t * .05) + .12 * answer));
    }
  }

  // a click: release the current line's image (or the motif, or a star) where the pointer meets the line's plane
  function click(ndcX, ndcY, cam, lt) {
    if (!clickPool || !shots || !score) return;
    let L = null; for (const x of score.lines) { if (x.start - 1 <= lt) L = x; else break; }
    const img = (L && L.end + 3 > lt && L.images[0]) || score.motifs[0] || 'star';
    const st = L ? shots.stationOf(L) : shots.stations[0];
    shots.stationFrame(st, lf);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(lf.n, lf.c), hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit) || hit.distanceTo(cam.position) > 40) hit.copy(lf.c).addScaledVector(lf.u, .8);
    hit.y = Math.max(hit.y, shots.waterY + .15);
    emit(clickPool, img, hit, lf.r, lf.u, lt - shots.offset, mostOf(img) * 1.2, Math.floor(lt * 1000) % 9973, C.img(img), 1.2, Math.floor(lt * 7));
    return img;
  }
  // (tests) release one image's particles, in a given behaviour, at a point of the screen
  function demo(img, variant, ndcX, ndcY, cam, lt, depth = 9) {
    const p = new THREE.Vector3(ndcX, ndcY, .5).unproject(cam).sub(cam.position).normalize().multiplyScalar(depth).add(cam.position);
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0);
    emit(clickPool, img, p, r, u, lt - shots.offset, mostOf(img), Math.floor(ndcX * 977 + ndcY * 131 + 500), C.img(img), 1.2, variant);
    return (BEHAVIOUR[img] || [[0]])[variant % (BEHAVIOUR[img] || [[0]]).length][0];
  }
  return {setTrack, prepare, setShots: s => { shots = s; }, update, click, demo, images: Object.keys(DRAW), mirror: MIRROR, get emblems() { return emblems; }, get motifs() { return motifs; }};
}
