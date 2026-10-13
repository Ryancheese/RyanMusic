// Where nothing is sung (an intro, a long gap, an outro, a whole instrumental) the music itself is the picture: one
// passage, one scene, large in the frame and lit from inside (what is struck goes brighter than white and blooms), made
// of what was measured in that passage and moving the way the thing it is would move. No charts: no frames, scales,
// captions or playheads; the measurement is in the motion. No two passages running get the same scene. Every scene has
// a flat side and a deep side, and the camera (shots.js) reads it in both in turn:
//   涟 rings    a shower of light passing over the lake. Every onset falls as a drop out of the dark and strikes the
//              water, and a ring runs out from it; the shower wanders, turned by the melody (as the stars' walk is), its
//              low drops falling wide round it, slow and broad, its high ones close in, quick and fine. From above:
//              a trail of crossing rings on black water. From the water: drops, splashes, rings toward the horizon
//   弦 strings  seven threads of light fanned out over the water from one point, low to high. Whatever sounds in a
//              thread's band plucks it: the wave runs both ways, comes back from the ends, and the place it was struck
//              flares. Square on: a fan of light. Along it: a harp in depth
//   岭 range    hills pushed up out of the lake: five sheets of cut paper one behind the other (the low band the far
//              high ridges, the high band the near small ones). Every rise of a band throws up a peak on its own sheet,
//              on its note and somewhere the sheet has none yet, so the range is built where it is, not along a time
//              axis; a new peak's rim flares; the rims stay alive with their bands
//   笔 stroke   one brush stroke once round (an ensō), standing in the air over its reflection: the brush moves as the
//              music presses on (fast where it is loud, lingering where it is quiet), broad where it is loud, dry at its
//              end; strong beats fling ink off it that stays where it lands
//   摆 swing    a pendulum of light hanging from the dark draws in the air: its pen swings at the song's pace and its
//              two rates are the interval between the two strongest pitch classes (a fifth 3:2, a third 5:4…), so the
//              figure it draws turns slowly into the next as the harmony moves. Only its last few swings are left
//              behind it, as a ribbon thinning out; a strong low beat leaves a bead of light where the pen was
//   轮 wheel    an armillary of light: six rings for six bands, each on its own slowly precessing axis, each turning
//              as fast as its band is loud (the low one wide and slow, the high one small and quick). Every rise of a
//              band sets a bead of light on its ring that rides round with it, so the passage fills the rings
//   星 stars    constellations hanging in the air over the lake. Every strong onset is a star, struck on its note;
//              the stars of a run of notes make one constellation somewhere else in the sky, each new star joined
//              to its nearest by a line drawn on the beat. The sky fills as the passage goes on; the old figures stay,
//              dimmer, twinkling, and all of it lies again in the lake
// The scenes are functions of song time (stills, seeks and playback agree). Pitch classes and intervals are the
// analysis' estimates. No audio is analysed here.
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const pad2 = i => String(i).padStart(2, '0'), TAU = Math.PI * 2;

// lay: what the camera frames (w wide, hf high for a standing view; py0…py1 down the page from above; fy: where the
// waterline is held, from the top of the frame); views: how the scene is read (k: plan | front | deep; yaw: from which
// side; lens; the moves that suit it)
export const FIG = {
  rings: {zh: '涟', en: 'RINGS', lay: {w: 12, h: .4, hf: 2.6, rowH: .4, z0: -6, z1: 6, rows: [], py0: -6.2, py1: 6.2, fy: .58},
    views: [{k: 'plan', lens: .8, kinds: {orbit: 2, spiral: 1.5, pushIn: 1.2, glide: 1}}, {k: 'deep', yaw: .5, lens: 1.15, kinds: {arc: 2, orbit: 2, glide: 1.4, crane: 1}, lay: {eyeK: .2, hf: 3.2, w: 12}}]},
  strings: {zh: '弦', en: 'STRINGS', lay: {w: 13, h: 4, hf: 4.2, rowH: 4, z0: -1.6, z1: 1.6, rows: [], py0: 0, py1: 4, fy: .74},
    views: [{k: 'front', lens: .62, kinds: {float: 2, track: 1.4, hold: 1}}, {k: 'deep', yaw: 1.05, lens: 1.25, kinds: {pushIn: 2, glide: 1.6, crane: 1, arc: 1}, lay: {w: 8, hf: 4.4}}]},
  range: {zh: '岭', en: 'RANGE', lay: {w: 15, h: 3.8, hf: 3.6, rowH: 3.8, z0: -8, z1: 0, rows: [], py0: 0, py1: 3.8, fy: .72},
    views: [{k: 'front', lens: .58, kinds: {track: 2, float: 1.6, pendulum: 1}}, {k: 'deep', yaw: .62, lens: 1.2, kinds: {track: 2, arc: 1.6, glide: 1.3, crane: 1}, lay: {w: 13, hf: 4}}]},
  stroke: {zh: '笔', en: 'STROKE', lay: {w: 7.2, h: 5.2, hf: 5.2, rowH: 5.2, z0: -1.2, z1: 1.2, rows: [], py0: 0, py1: 7, fy: .9},
    views: [{k: 'front', lens: .62, kinds: {float: 2, hold: 1.4, track: 1}}, {k: 'deep', yaw: .55, lens: 1.15, kinds: {arc: 2, orbit: 1.6, glide: 1.2}, lay: {w: 7.6, hf: 5.4}}]},
  swing: {zh: '摆', en: 'SWING', lay: {w: 8.2, h: 4.4, hf: 4.3, rowH: 4.4, z0: -1.6, z1: 1.6, rows: [], py0: 0, py1: 4.4, fy: .8},
    views: [{k: 'front', lens: .62, kinds: {hold: 1.5, float: 2, glide: 1}}, {k: 'deep', yaw: .8, lens: 1.15, kinds: {orbit: 3, arc: 2, spiral: 1.6}, lay: {w: 8, hf: 4.6}}]},
  wheel: {zh: '轮', en: 'WHEEL', lay: {w: 7.2, h: 5.2, hf: 5.2, rowH: 5.2, z0: -3.4, z1: 3.4, rows: [], py0: 0, py1: 7.2, fy: .9},
    views: [{k: 'front', lens: .62, kinds: {float: 2, hold: 1.3, track: 1}}, {k: 'deep', yaw: .6, lens: 1.15, kinds: {orbit: 2.6, arc: 2, glide: 1.2}, lay: {w: 7.8, hf: 5.4}}]},
  stars: {zh: '星', en: 'STARS', lay: {w: 12.6, h: 5.2, hf: 5.6, rowH: 5.2, z0: -2.5, z1: 2.5, rows: [], py0: 0, py1: 5.2, fy: .86},
    views: [{k: 'front', lens: .62, kinds: {float: 2, track: 1.4, hold: 1}}, {k: 'deep', yaw: .7, lens: 1.15, kinds: {orbit: 3, arc: 2, glide: 1.2}, lay: {w: 11, hf: 5.8}}]},
};
export const FIG_CHARS = Object.values(FIG).map(f => f.zh).join('');

/** which scene a passage gets: from what it is (loud, percussive, tonal), and what the song has had already */
export function figureFor(track, sig, a, b, used, u) {
  let rms = 0, harm = 0, perc = 0, n = 0;
  for (let t = a; t <= b; t += .25) { rms += sig.level('rms', t); harm += sig.level('harm', t); perc += sig.level('perc', t); n++; }
  rms /= n; const tonal = harm / Math.max(1e-3, harm + perc);
  const on = track.motion.onsets || {}, hits = [...(on.mid || []), ...(on.high || []), ...(on.low || [])].filter(o => o[0] >= a && o[0] <= b && o[1] >= .3).length / Math.max(1, b - a);
  const w = {rings: (.9 + 1.1 * (1 - rms)) * (hits < .6 ? .4 : 1), strings: .7 + .9 * tonal + .5 * clamp(hits / 6), range: .6 + 1.5 * rms, stroke: .8 + .9 * tonal * (1 - .5 * clamp(hits / 8)), swing: .6 + 1.1 * tonal, wheel: .8 + .4 * (1 - rms), stars: (.8 + .5 * tonal + .6 * clamp(hits / 5)) * (hits < .5 ? .3 : 1)};
  // (the record has just been a circle: not a circle again straight after the title)
  if (!used.length) { w.wheel *= .2; w.stroke *= .5; }
  // never the one before; rather one the song has not had yet
  const count = {}; for (const k of used) count[k] = (count[k] || 0) + 1;
  for (const k in w) w[k] *= Math.pow(.02, count[k] || 0);
  const l1 = used[used.length - 1], l2 = used[used.length - 2];
  if (l1) w[l1] = 0; if (l2) w[l2] *= .25;
  let tot = 0; for (const k in w) tot += w[k];
  let q = u * tot, pick = 'range'; for (const k in w) { if (w[k] <= 0) continue; pick = k; q -= w[k]; if (q <= 0) break; }
  return pick;
}

// ---- shaders ----------------------------------------------------------------------------------------------
// every scene is drawn in its own frame: x to the right, y up from the water, z toward the front
const FRAME = `uniform vec3 uC, uR, uN; vec3 W(float x, float y, float z){ return uC + uR * x + vec3(0., y, 0.) + uN * z; }`;
// a line with a width: the point p0 pushed sideways on the screen, across the direction to p1
const FAT = `uniform vec2 uRes;
vec4 fat(vec3 p0, vec3 p1, float side, float px){
  vec4 a = projectionMatrix * viewMatrix * vec4(p0, 1.), b = projectionMatrix * viewMatrix * vec4(p1, 1.);
  vec2 d = (b.xy / max(b.w, 1e-3) - a.xy / max(a.w, 1e-3)) * uRes; float l = length(d); d = l > 1e-4 ? d / l : vec2(1., 0.);
  a.xy += vec2(-d.y, d.x) * side * px / uRes * 2. * a.w; return a; }`;
const SPIN = `uniform float uSpin; vec3 P(vec3 q){ float c = cos(uSpin), s = sin(uSpin); return W(q.x * c + q.z * s, q.y, -q.x * s + q.z * c); }`;

// Lines with a width (a quad per segment). position: this end, aB: the other; aD: side, the moment of the passage the
// segment belongs to (0..1; < 0 always lit), its birth (song s; < -5 none), its weight; aW: width, which end (1, -1).
// A line with a birth is drawn on from its first end to its second over uGrow s, flares and settles to uDim over uFade s
const RIB_VS = `attribute vec3 aB; attribute vec4 aD; attribute vec2 aW; uniform float uT, uPx, uGrow; varying float vX, vU, vS, vK, vDepth; ${FRAME} ${FAT} ${SPIN}
void main(){ vX = aD.x * aW.y; vU = aD.y; vS = aD.z; vK = aD.w;
  vec3 a = P(position), b = P(aB);
  if (uGrow > 0. && aD.z > -5.) { float g = clamp((uT - aD.z) / uGrow, 0., 1.); if (aW.y < 0.) a = mix(b, a, g); else b = mix(a, b, max(g, .002)); }
  vec4 mv = viewMatrix * vec4(a, 1.); vDepth = -mv.z; gl_Position = fat(a, b, aD.x, uPx * aW.x); }`;
const RIB_FS = `uniform vec3 uCol, uHot; uniform float uT, uNow, uA, uDim, uFade, uMirror, uFlat, uGain; varying float vX, vU, vS, vK, vDepth;
void main(){ if (uMirror > .5 && uFlat > .5) discard;
  float age = uT - vS, born = vS > -5. ? step(0., age) : 1., tip = vS > -5. ? exp(-max(age, 0.) / .25) * born : 0.;
  float rest = vS > -5. && uFade > 0. ? mix(uDim, 1., exp(-max(age, 0.) / uFade)) : mix(uDim, 1., vU < 0. ? 1. : step(vU, uNow));
  float a = smoothstep(1., .15, abs(vX)) * (rest * vK + 2.4 * tip) * born * uA * uGain * smoothstep(.5, 1.6, vDepth);
  gl_FragColor = vec4(mix(uCol, uHot, clamp(tip, 0., 1.)) * a, 1.); }`;

// Points of light, facing the eye: aP where (scene frame), aQ the corner, aG: birth (song s), weight, seed, size (world).
// Each flares when it is born; held ones stay and twinkle, the others fade; a strong low beat brightens them all
const GLOW_VS = `attribute vec3 aP; attribute vec2 aQ; attribute vec4 aG; uniform float uT; varying vec2 vQ; varying vec4 vG; ${FRAME} ${SPIN}
void main(){ vQ = aQ; vG = aG; vec4 mv = viewMatrix * vec4(P(aP), 1.);
  float age = uT - aG.x; mv.xy += aQ * aG.w * (1. + 1.1 * exp(-max(age, 0.) / .3) * step(0., age)); gl_Position = projectionMatrix * mv; }`;
const GLOW_FS = `uniform vec3 uCol, uHot; uniform float uT, uA, uTw, uHold, uPulse; varying vec2 vQ; varying vec4 vG;
void main(){ float age = uT - vG.x; if (age < 0.) discard;
  float r = length(vQ), core = exp(-r * r * 55.), halo = exp(-r * r * 8.) * .28;
  float spike = (exp(-abs(vQ.x) * 30.) * exp(-vQ.y * vQ.y * 2.2) + exp(-abs(vQ.y) * 30.) * exp(-vQ.x * vQ.x * 2.2)) * smoothstep(.4, .9, vG.y);
  float flare = exp(-age / .28), tw = 1. - uTw * (.5 + .5 * sin(uT * (1.1 + 2.3 * vG.z) + vG.z * 61.)), life = uHold > .5 ? 1. : exp(-age / 1.1);
  float a = (core * 1.7 + halo + spike * (.3 + 1.3 * flare)) * smoothstep(0., .05, age) * (.3 + .7 * vG.y) * (tw * life * (1. + .7 * uPulse) + 2.4 * flare) * smoothstep(1., .72, r);
  if (a < .003) discard;
  gl_FragColor = vec4(mix(uCol, uHot, clamp(flare * 1.2 + core * .35, 0., 1.)) * a * uA, 1.); }`;

// 涟: the rings that are spreading now (uRing: x, z, age, weight + 2·band), on one sheet lying on the water; where a
// drop has just struck, a flash
const RING_VS = `varying vec2 vP; uniform float uS; ${FRAME} void main(){ vP = position.xy * uS; gl_Position = projectionMatrix * viewMatrix * vec4(W(vP.x, .006, vP.y), 1.); }`;
const RING_FS = `uniform vec4 uRing[24]; uniform vec3 uCol, uHot; uniform float uA, uMirror, uS; varying vec2 vP;
void main(){ if (uMirror > .5) discard; float a = 0., hot = 0.;
  for (int i = 0; i < 24; i++) { vec4 R = uRing[i]; if (R.z < 0.) continue; float band = floor(R.w / 2.), k = R.w - band * 2.;
    float sp = band < .5 ? 1.5 : band < 1.5 ? 1.95 : 2.4, life = band < .5 ? 3.4 : band < 1.5 ? 2.2 : 1.4, w = band < .5 ? .09 : band < 1.5 ? .06 : .04;
    float d0 = length(vP - R.xy), d = d0 - (.04 + R.z * sp), e = max(0., 1. - R.z / life); e *= e;
    float lead = exp(-d * d / (w * w)), wake = .35 * exp(-(d + 3.5 * w) * (d + 3.5 * w) / (w * w * 1.6)) * step(.18, R.z), flash = exp(-d0 * d0 / .025) * exp(-R.z / .1);
    a += k * (e * (lead + wake) + 2. * flash); hot += k * (e * lead * exp(-R.z * 3.) + flash); }
  a *= smoothstep(uS, uS - 1.4, length(vP)); if (a < .004) discard;
  gl_FragColor = vec4(mix(uCol, uHot, clamp(hot, 0., 1.)) * a * uA * 1.3, 1.); }`;
// 涟: the drops, falling out of the dark onto the water at their onsets (aE: when, how hard, which end, side)
const DROP_VS = `attribute vec4 aE; uniform float uT, uPx; varying float vA, vX; ${FRAME} ${FAT}
void main(){ float dt = aE.x - uT, fall = .46, f = clamp(dt / fall, 0., 1.), hd = 4.8 * f * f, tl = hd + .3 + 1.1 * aE.y * clamp(f * 3., 0., 1.);
  vec3 h = W(position.x, hd, position.z), t = W(position.x, tl, position.z), me = aE.z < .5 ? h : t, ot = aE.z < .5 ? t : h;
  vA = step(0., dt) * step(dt, fall) * (.45 + .55 * aE.y) * (1. - aE.z * .92); vX = aE.w * (aE.z < .5 ? 1. : -1.);
  gl_Position = fat(me, ot, aE.w, uPx * (.8 + 1.1 * aE.y)); }`;
const DROP_FS = `uniform vec3 uCol; uniform float uA; varying float vA, vX; void main(){ gl_FragColor = vec4(uCol * vA * smoothstep(1., .2, abs(vX)) * uA * 1.7, 1.); }`;
// 涟: where a drop struck, a splash stands up for a moment (seen from the water, not from above)
const SPLASH_VS = `attribute vec3 aP; attribute float aB, aK; uniform float uT; varying float vA; ${FRAME}
void main(){ float age = uT - aB, h = (.3 + .9 * aK), y0 = h * .8 * smoothstep(.1, .62, age), y1 = h * min(1., age / .13);
  vA = step(0., age) * (1. - smoothstep(.22, .7, age)) * (.35 + .65 * aK); gl_Position = projectionMatrix * viewMatrix * vec4(W(aP.x, mix(y0, y1, aP.y), aP.z), 1.); }`;
const SPLASH_FS = `uniform vec3 uCol; uniform float uA, uLift; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA * uA * uLift * 1.4, 1.); }`;

// 弦: aI which thread, aS where along it (0..1), aSide which edge. Each thread runs from uE0[i] to uE1[i]; uPl: the last
// three plucks of every thread (where along it, when, how hard); uLv: how loud each thread's band is now
const STR_VS = `attribute float aI, aS, aSide; uniform vec3 uPl[21], uE0[7], uE1[7]; uniform float uLv[7]; uniform float uT, uL, uPx; varying float vSide, vK; ${FRAME} ${FAT}
float pulse(float x, float p){ float m = mod(p, 2. * uL), q = m > uL ? 2. * uL - m : m, sg = mod(floor(p / uL), 2.) < .5 ? 1. : -1.; float d = (x - q) / .34; return sg * exp(-d * d); }
float disp(float x, float i){ float y = 0.; int b = int(i + .5) * 3;
  for (int k = 0; k < 3; k++) { vec3 p = uPl[b + k]; float tau = uT - p.y; if (p.z <= 0. || tau < 0.) continue; y += p.z * exp(-tau * 2.1) * smoothstep(0., .035, tau) * (pulse(x, p.x + 10. * tau) + pulse(x, p.x - 10. * tau)); }
  y += .02 * uLv[int(i + .5)] * sin(3.14159 * x / 13. * (2. + i)) * sin(uT * (7. + 2.3 * i));
  return y * smoothstep(0., .6, x) * smoothstep(uL, uL - .6, x); }
vec3 at(float s, float i){ int k = int(i + .5); vec3 p = mix(uE0[k], uE1[k], s); return W(p.x, p.y + disp(s * uL, i), p.z); }
void main(){ float d0 = disp(aS * uL, aI); vSide = aSide; vK = (.4 + .8 * uLv[int(aI + .5)] + min(1.8, abs(d0) * 9.) - .25 * (1. - smoothstep(0., .25, aS))) * smoothstep(1., .6, aS);
  gl_Position = fat(at(aS, aI), at(aS + .004, aI), aSide, uPx * (1.1 + 1.6 * min(1., abs(d0) * 6.))); }`;
const STR_FS = `uniform vec3 uCol, uHot; uniform float uA; varying float vSide, vK; void main(){ float a = smoothstep(1., .3, abs(vSide)); gl_FragColor = vec4(mix(uCol, uHot, clamp(vK - .9, 0., 1.)) * a * vK * uA * 1.2, 1.); }`;

// 岭: one sheet of the range. aX along it (time, 0..1), aTop 0 at the water, 1 on the ridge, aH the ridge's height
// uPk: the sheet's peaks (where along it 0..1, born when, how high, how wide); a peak comes up out of the water on its
// note (a little past its height, then back) and its rim flares; aJ: a jag of the ridge line
const RANGE_VS = `attribute float aX, aTop, aJ; uniform float uZ, uW, uUp, uLv, uSl, uBase, uT; uniform vec4 uPk[24]; varying float vX, vV, vH, vF; ${FRAME}
void main(){ float h = uBase * (.6 + .4 * sin(aX * 7.3 + uZ) * sin(aX * 3.1 - uZ * .7)), fl = 0.;
  for (int i = 0; i < 24; i++) { vec4 p = uPk[i]; float age = uT - p.y; if (p.w <= 0. || age < 0.) continue;
    float g = clamp(age / .45, 0., 1.), up = 1. - pow(1. - g, 3.) + .14 * sin(3.1416 * g), d = abs(aX - p.x) / p.w;
    h = max(h, p.z * up * pow(max(0., 1. - d), 1.7) * (1. + .12 * aJ * (1. - d))); fl += exp(-age / .4) * max(0., 1. - d * 1.3); }
  h *= .3 + .7 * pow(sin(3.1416 * clamp(aX * 1.04 - .02, 0., 1.)), .35);
  vX = aX; vV = aTop; vH = h * uUp; vF = fl;
  gl_Position = projectionMatrix * viewMatrix * vec4(W((aX - .5) * uW + uSl, aTop * h * uUp * (1. + .09 * uLv), uZ), 1.); }`;
const RANGE_FS = `uniform vec3 uFill, uLit, uRim, uHaze; uniform float uA, uLv; varying float vX, vV, vH, vF;
void main(){ float y = vV * vH, e = (1. - vV) * vH, f = clamp(vF, 0., 1.);
  vec3 col = mix(uFill, uLit, f * (.35 + .5 * vV)); col = mix(uHaze, col, smoothstep(-.05, .6, y));
  float rim = smoothstep(.04, .0, e);
  gl_FragColor = vec4((col + uRim * rim * (.3 + 1.6 * f) * (1. + 1.6 * uLv)) * uA, 1.); }`;

// 笔: the stroke, standing in the air. aU: when along the passage (0..1), aV across (-1..1); aD: its radius, half its
// breadth, its angle (the brush goes round as fast as the music presses on)
const BRUSH_VS = `attribute float aU, aV; attribute vec3 aD; uniform float uYc; varying float vU, vV, vW; ${FRAME}
void main(){ vU = aU; vV = aV; vW = aD.y; float r = aD.x + aV * aD.y; gl_Position = projectionMatrix * viewMatrix * vec4(W(sin(aD.z) * r, uYc + cos(aD.z) * r, 0.), 1.); }`;
const BRUSH_FS = `uniform vec3 uCol, uHot; uniform float uNow, uA, uSeed; varying float vU, vV, vW;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
void main(){ if (vU > uNow) discard;
  // bristles: streaks along the stroke; it runs dry toward its end and at its edges
  float streak = vn(vec2(vV * 11. + uSeed, vU * 26.)) * .65 + vn(vec2(vV * 31. + uSeed * 3., vU * 9.)) * .35;
  float dry = .12 + .62 * pow(max(vU, 0.), 1.6) + .34 * vV * vV - .25 * smoothstep(.0, .16, vW);
  float edge = smoothstep(1., .8, abs(vV));
  float ink = edge * (1. - .92 * smoothstep(dry - .2, dry + .22, 1. - streak));
  // single hairs of the brush catch the light
  float fine = smoothstep(.6, .9, vn(vec2(vV * 46. + uSeed * 5., vU * 7.)));
  float tip = exp(-(uNow - vU) * 46.);
  float a = ink * (.55 + .5 * fine + 2.6 * tip) * 1.6 * smoothstep(0., .012, uNow - vU);
  if (a < .006) discard; gl_FragColor = vec4(mix(uCol, uHot, clamp(tip + fine * .45, 0., 1.)) * a * uA, 1.); }`;

// 摆: the ribbon the pen leaves, computed where it is drawn. aS along it (0 the pen now, 1 the oldest of it). The pen
// swings at uOm (rad/s) along x; up and down at uRat times that (uTh2: the phase it has reached, the rate integrated over
// the song so a change of interval bends the figure instead of jumping it); in depth at uR3 times it
const SWING_VS = `attribute float aS, aSide; uniform float uOm, uTh1, uTh2, uTh3, uRat, uRat3, uAx, uAy, uAz, uY0, uTr, uPx; varying float vSide, vS; ${FRAME} ${FAT}
vec3 at(float q){ float tau = q * uTr, e = exp(-.35 * q);
  return W(sin(uTh1 - uOm * tau) * uAx * e, uY0 + sin(uTh2 - uRat * uOm * tau) * uAy * e, sin(uTh3 - uRat3 * uOm * tau) * uAz * e); }
void main(){ vSide = aSide; vS = aS; gl_Position = fat(at(aS), at(aS + .004), aSide, uPx * (3.6 * pow(1. - aS, 1.3) + .45)); }`;
const SWING_FS = `uniform vec3 uCol, uHot; uniform float uA; varying float vSide, vS;
void main(){ float a = smoothstep(1., .25, abs(vSide)) * pow(max(1. - vS, 0.), 1.5); gl_FragColor = vec4(mix(uCol, uHot, exp(-vS * 8.)) * a * uA * (1. + 1.8 * exp(-vS * 14.)), 1.); }`;
// 摆: the thread it hangs from (aE: 0 at the pivot, 1 at the pen)
const THREAD_VS = `attribute vec2 aE; uniform vec3 uPiv, uPen; uniform float uPx; varying float vE, vX; ${FRAME} ${FAT}
void main(){ vE = aE.x; vX = aE.y * (aE.x < .5 ? 1. : -1.); vec3 a = W(uPiv.x, uPiv.y, uPiv.z), b = W(uPen.x, uPen.y, uPen.z); gl_Position = aE.x < .5 ? fat(a, b, aE.y, uPx) : fat(b, a, aE.y, uPx); }`;
const THREAD_FS = `uniform vec3 uCol; uniform float uA; varying float vE, vX; void main(){ gl_FragColor = vec4(uCol * smoothstep(1., .2, abs(vX)) * (.06 + .3 * vE * vE) * uA, 1.); }`;

// 轮: the armillary. Ring b lies in the plane of uE1[b], uE2[b] (its axis precessing), radius uRr, turned by uPh;
// aRing, aA (angle on it), aSide. Its light is uneven round it (so its turning is seen) and as strong as its band
const ARM = `uniform vec3 uE1[6], uE2[6]; uniform float uRr[6], uPh[6], uLvR[6], uYc;
vec3 ringAt(int b, float a){ float r = uRr[b]; return uE1[b] * cos(a + uPh[b]) * r + uE2[b] * sin(a + uPh[b]) * r; }`;
const ARM_VS = `attribute float aRing, aA, aSide; uniform float uPx, uT; varying float vX, vK, vDepth; ${FRAME} ${FAT} ${ARM}
void main(){ int b = int(aRing + .5); vec3 q0 = ringAt(b, aA), q1 = ringAt(b, aA + .01), a = W(q0.x, uYc + q0.y, q0.z), c = W(q1.x, uYc + q1.y, q1.z);
  vX = aSide; vK = (.3 + 1.1 * uLvR[b]) * (.55 + .45 * pow(.5 + .5 * sin(aA * 3. + float(b) * 1.7), 2.)); vDepth = -(viewMatrix * vec4(a, 1.)).z;
  gl_Position = fat(a, c, aSide, uPx * (.8 + 1.1 * uLvR[b])); }`;
const ARM_FS = `uniform vec3 uCol, uHot; uniform float uA; varying float vX, vK, vDepth;
void main(){ gl_FragColor = vec4(mix(uCol, uHot, clamp(vK - .9, 0., 1.)) * smoothstep(1., .25, abs(vX)) * vK * uA * smoothstep(.5, 1.6, vDepth), 1.); }`;
// 轮: a bead riding its ring (aRA: ring, angle on it); drawn like the points of light
const BEAD_VS = `attribute vec2 aQ, aRA; attribute vec4 aG; uniform float uT; varying vec2 vQ; varying vec4 vG; ${FRAME} ${ARM}
void main(){ vQ = aQ; vG = aG; vec3 q = ringAt(int(aRA.x + .5), aRA.y); vec4 mv = viewMatrix * vec4(W(q.x, uYc + q.y, q.z), 1.);
  float age = uT - aG.x; mv.xy += aQ * aG.w * (1. + 1.1 * exp(-max(age, 0.) / .3) * step(0., age)); gl_Position = projectionMatrix * mv; }`;
const GROUPS6 = [[0, 3], [4, 8], [9, 13], [14, 18], [19, 24], [25, 31]];

const GROUPS = [[0, 4], [5, 10], [11, 16], [17, 23], [24, 31]];        // the five bands of the range (mel band indices)
const GROUPS7 = [[0, 3], [4, 7], [8, 11], [12, 15], [16, 20], [21, 25], [26, 31]];   // the seven threads
const RAT = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [7, 5], [3, 2], [8, 5], [5, 3], [9, 5], [15, 8]];

export function createFigures(scene, shared) {
  const group = new THREE.Group(); scene.add(group);
  let items = [], shots = null, sig = null, C = {}, mvDim = 1;
  const hits = [];
  const v = new THREE.Vector3();
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
  function clear() {
    for (const it of items) for (const m of it.meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    items = [];
  }
  const add = (o, m, order = 5) => { m.frustumCulled = false; m.visible = false; m.renderOrder = order; group.add(m); o.meshes.push(m); return m; };
  const mat = (o, vs, fs, uniforms, opt = {}) => new THREE.ShaderMaterial({vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...opt, uniforms: {...o.U, ...uniforms}});
  // lines with a width in the scene's frame: seg([x,y,z], [x,y,z], moment, birth, weight, width)
  function ribbons(o) {
    const P = [], B = [], D = [], Wd = [], idx = [];
    return {
      seg(a, b, u = -1, s = -9, k = 1, w = 1) {
        const i = P.length / 3;
        for (const [p, q, sd, end] of [[a, b, 1, 1], [a, b, -1, 1], [b, a, -1, -1], [b, a, 1, -1]]) { P.push(p[0], p[1], p[2]); B.push(q[0], q[1], q[2]); D.push(sd, u, s, k); Wd.push(w, end); }
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      },
      mesh(col, hot, {vs = RIB_VS, dim = 1, fade = 0, grow = 0, flat = 0, gain = 1, order = 5, extra = {}} = {}) {
        const g = new THREE.BufferGeometry(); attr(g, 'position', P, 3); attr(g, 'aB', B, 3); attr(g, 'aD', D, 4); attr(g, 'aW', Wd, 2); g.setIndex(idx);
        return add(o, new THREE.Mesh(g, mat(o, vs, RIB_FS, {uCol: {value: col.clone()}, uHot: {value: (hot || col).clone()}, uDim: {value: dim}, uFade: {value: fade}, uGrow: {value: grow}, uFlat: {value: flat}, uGain: {value: gain}, uSpin: {value: 0}, ...extra})), order);
      },
    };
  }
  // points of light: put(x, y, z, birth, weight, seed, size)
  function glows(o) {
    const aP = [], aQ = [], aG = [], idx = [];
    return {
      put(x, y, z, b, k, seed, size) { const i = aP.length / 3; for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { aP.push(x, y, z); aQ.push(qx, qy); aG.push(b, k, seed, size); } idx.push(i, i + 1, i + 2, i, i + 2, i + 3); },
      mesh(col, hot, {tw = .3, hold = 1, order = 6} = {}) {
        const g = new THREE.BufferGeometry(); attr(g, 'position', aP, 3); attr(g, 'aP', aP, 3); attr(g, 'aQ', aQ, 2); attr(g, 'aG', aG, 4); g.setIndex(idx);
        return add(o, new THREE.Mesh(g, mat(o, GLOW_VS, GLOW_FS, {uCol: {value: col.clone()}, uHot: {value: hot.clone()}, uTw: {value: tw}, uHold: {value: hold}, uSpin: {value: 0}})), order);
      },
    };
  }

  function setTrack(t, theme, signal, sh) {
    clear(); shots = sh; sig = signal; mvDim = t.mv ? .45 : 1;   // (MV mode: the scenes stand back from the screen)
    const M = t.motion, D = M.data, St = M.stride, FPS = M.fps, wy = sh.waterY, on = M.onsets || {};
    const star = new THREE.Color(theme.star), emit = new THREE.Color(t.pal.emit), second = new THREE.Color(t.pal.second || t.pal.ramp[0]), light = new THREE.Color(t.pal.light);
    const night = new THREE.Color(theme.night).lerp(new THREE.Color(t.pal.night), .6);
    C = {star, emit, second, night, lineA: emit.clone().lerp(star, .25), lineB: second.clone().lerp(star, .3), hot: emit.clone().lerp(star, .7), white: star.clone().lerp(emit, .12)};
    const mel = Array.from({length: 32}, (_, i) => M.channels['mel' + pad2(i)]);
    const at = (c, time) => { let s = 0; const f = Math.round(time * FPS); for (let j = -1; j <= 1; j++) s += D[Math.min(M.frames - 1, Math.max(0, f + j)) * St + c]; return s / 765; };
    const bandOf = (G, g, time) => { let s = 0; for (let b = G[g][0]; b <= G[g][1]; b++) s += at(mel[b], time); return s / (G[g][1] - G[g][0] + 1); };
    sh.planned();                                                       // (the scenes are placed with the stanzas)
    for (const S of sh.scenes) {
      const kind = S.kind, dur = S.b - S.a, fr = {c: S.c.clone().setY(wy), r: new THREE.Vector3(Math.cos(S.th), 0, Math.sin(S.th)), n: new THREE.Vector3(-Math.sin(S.th), 0, Math.cos(S.th))};
      const o = {S, kind, fr, meshes: [], dyn: {}};
      // uniforms every mesh of the scene shares
      o.U = {uC: {value: fr.c}, uR: {value: fr.r}, uN: {value: fr.n}, uT: {value: 0}, uNow: {value: 0}, uA: {value: 0}, uLift: {value: 0}, uBass: {value: 0}, uPulse: {value: 0}, uRes: {value: new THREE.Vector2(1600, 900)}, uPx: {value: 2}, uMirror: shared.uMirror};
      // the onsets of a band in this passage, the strongest of any that crowd
      const thin = (list, floor, gap, lead = 0, tail = 0) => { const out = []; for (const q of list || []) { if (q[0] < S.a - lead || q[0] > S.b + tail || q[1] < floor) continue; const l = out[out.length - 1]; if (l && q[0] - l[0] < gap) { if (q[1] > l[1]) out[out.length - 1] = q; continue; } out.push(q); } return out; };
      // a scene the song has had already comes back the other way round and in the song's other colour
      const alt = sh.scenes.slice(0, S.i).filter(q => q.kind === kind).length % 2 === 1, cA = alt ? C.lineB : C.lineA, cB = alt ? C.lineA : C.lineB, dirn = alt ? -1 : 1; o.dirn = dirn;
      const U = tt => (tt - S.a) / dur;

      if (kind === 'rings') {
        // the shower: its centre walks over the water, turned by the melody; low drops fall wide round it, high close
        const ev = [], pitch = tt => { let i = 0, m = -1; for (let k = 0; k < 12; k++) { const q = sig.level('chroma' + pad2(k), tt, .1, .5); if (q > m) { m = q; i = k; } } return i; };
        [['low', .3, .34], ['mid', .4, .3], ['high', .5, .26]].forEach(([b, floor, gap], bi) => { for (const q of thin(on[b], floor, gap, .1, .2)) ev.push({t: q[0], k: q[1], b: bi}); });
        ev.sort((a, b) => a.t - b.t);
        let cx = (hash(S.i, .7) - .5) * 2, cz = (hash(S.i, 1.3) - .5) * 2, head = hash(S.i, 1.9) * TAU, prevP = null, lastT = S.a;
        for (const e of ev) {
          const p = pitch(e.t), dtt = Math.max(0, e.t - lastT); lastT = e.t;
          if (prevP != null) head += (((p - prevP + 18) % 12) - 6) * .2 + (hash(e.t, 2.1) - .5) * .35;
          prevP = p; cx += Math.cos(head) * dtt * .85; cz += Math.sin(head) * dtt * .85;
          const rr = Math.hypot(cx, cz); if (rr > 3.4) { cx *= 3.4 / rr; cz *= 3.4 / rr; head += Math.PI * .7; }
          const spread = [1.7, 1.05, .55][e.b], a = hash(e.t * 7.1, e.b) * TAU, d = spread * Math.sqrt(hash(e.t * 3.3, e.b + 5));
          e.x = (cx + Math.cos(a) * d) * dirn; e.z = cz + Math.sin(a) * d;
        }
        o.ev = ev;
        o.rings = add(o, new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat(o, RING_VS, RING_FS, {uRing: {value: Array.from({length: 24}, () => new THREE.Vector4(0, 0, -1, 0))}, uCol: {value: cA.clone()}, uHot: {value: C.hot.clone()}, uS: {value: 7.4}})), 4);
        const dp = [], de = [], di = [];
        for (const e of ev) { const i = dp.length / 3; for (const [end, sd] of [[0, 1], [0, -1], [1, -1], [1, 1]]) { dp.push(e.x, 0, e.z); de.push(e.t, e.k * (e.b ? .8 : 1), end, sd); } di.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
        const dg = new THREE.BufferGeometry(); attr(dg, 'position', dp, 3); attr(dg, 'aE', de, 4); dg.setIndex(di);
        add(o, new THREE.Mesh(dg, mat(o, DROP_VS, DROP_FS, {uCol: {value: C.white.clone()}})), 5);
        const sp = [], sb = [], sk = []; for (const e of ev) for (const top of [0, 1]) { sp.push(e.x, top, e.z); sb.push(e.t); sk.push(e.k); }
        const sg = new THREE.BufferGeometry(); attr(sg, 'position', sp, 3); attr(sg, 'aP', sp, 3); attr(sg, 'aB', sb, 1); attr(sg, 'aK', sk, 1);
        add(o, new THREE.LineSegments(sg, mat(o, SPLASH_VS, SPLASH_FS, {uCol: {value: C.white.clone()}})), 5);
      } else if (kind === 'strings') {
        // seven threads fanned out from a point far out of the frame (the low ones lowest), across the whole frame and on
        // past its other edge and on past the eye, a little into depth (2026-10-08: they no longer end in the picture;
        // they fill it, seen square on or along). Each runs 60 units from its point (15 out of the frame); the lowest
        // lies level over the water, the others open upward: inside the frame from 0.95-2.0 high to 0.95-3.65
        const L = 60, NS = 7, NP = 640, E0 = [], E1 = [], aI = [], aS = [], aSide = [], idx = [];
        for (let s = 0; s < NS; s++) {
          const y0 = .95 + .02 * (s - 3), b = .45 * s / 21.5;
          E0.push(new THREE.Vector3(-15 * dirn, y0, 0)); E1.push(new THREE.Vector3(45 * dirn, y0 + 60 * b, (s - 3) * 2.2));
        }
        for (let s = 0; s < NS; s++) for (let i = 0; i <= NP; i++) { for (const sd of [-1, 1]) { aI.push(s); aS.push(i / NP); aSide.push(sd); } if (i < NP) { const b = (s * (NP + 1) + i) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
        const g = new THREE.BufferGeometry(); attr(g, 'position', new Array(aI.length * 3).fill(0), 3); attr(g, 'aI', aI, 1); attr(g, 'aS', aS, 1); attr(g, 'aSide', aSide, 1); g.setIndex(idx);
        o.dyn.pl = Array.from({length: 21}, () => new THREE.Vector3(0, -99, 0)); o.dyn.lv = new Array(NS).fill(0);
        add(o, new THREE.Mesh(g, mat(o, STR_VS, STR_FS, {uPl: {value: o.dyn.pl}, uLv: {value: o.dyn.lv}, uE0: {value: E0}, uE1: {value: E1}, uL: {value: L}, uCol: {value: cA.clone()}, uHot: {value: C.hot.clone()}})), 5);
        // what plucks each thread: the rises of its own band; where: anywhere along it, and the place flares
        o.pl = []; const fl = glows(o), gapS = Math.max(.16, dur * .1 / L);
        for (let s = 0; s < NS; s++) {
          const list = []; let last = -9, prev2 = bandOf(GROUPS7, s, S.a - .08), prev1 = bandOf(GROUPS7, s, S.a - .04);
          for (let tt = S.a; tt <= S.b; tt += .04) { const cur = bandOf(GROUPS7, s, tt), rise = cur - prev2; if (rise > .075 && tt - last > gapS) { const k = clamp(rise / .28), u = .15 + .2 * hash(tt * 3.7, s); list.push({t: tt - .04, x: u * L, k}); last = tt; const p = E0[s].clone().lerp(E1[s], u); fl.put(p.x, p.y, p.z, tt - .04, .3 + .55 * k, hash(tt, s), .13 + .2 * k); } prev2 = prev1; prev1 = cur; }
          o.pl.push(list);
        }
        fl.mesh(C.white, C.hot, {hold: 0, tw: 0});
        // where the fan opens from: a point of light
        const kn = glows(o); kn.put(E0[3].x, E0[3].y, 0, S.a - 3, .8, .3, .32); kn.mesh(C.hot, C.white, {tw: .15});
      } else if (kind === 'range') {
        const Wd = 26, NX = 520, VIS = 15 / Wd; o.layers = [];           // (2026-10-08) sheets past the frame; peaks inside it
        for (let k = 4; k >= 0; k--) {                                   // far to near: the low band far and high, the high band near and small
          const g2 = 4 - k, kk = k / 4, base = .12 + .3 * kk, amp = .7 + 1.5 * kk;
          // the rises of the band: each one a peak, on its note, where the sheet has none yet
          let ev = [], last = -9, p2 = bandOf(GROUPS, g2, S.a - .08), p1 = bandOf(GROUPS, g2, S.a - .04);
          for (let tt = S.a; tt <= S.b; tt += .04) { const cur = bandOf(GROUPS, g2, tt), rise = cur - p2; if (rise > .06 && tt - last > .35) { ev.push({t: tt - .04, k: clamp(rise / .26)}); last = tt; } p2 = p1; p1 = cur; }
          const cap = 5 + 2 * k; if (ev.length > cap) { const keep = new Set([...ev].sort((a, b) => b.k - a.k).slice(0, cap)); ev = ev.filter(e => keep.has(e)); }
          const pk = Array.from({length: 24}, () => new THREE.Vector4(0, 0, 0, 0)), xs = [];
          ev.forEach((e, i) => {
            let bx = .5, bd = -1;
            for (let c = 0; c < 7; c++) { const x = .07 + .86 * hash(i * 7 + c, S.i + k * 3.1); let d = 9; for (const q of xs.slice(-5)) d = Math.min(d, Math.abs(x - q)); if (d > bd) { bd = d; bx = x; } }
            xs.push(bx);
            const vx = .5 + (bx - .5) * VIS;
            pk[i].set(dirn > 0 ? vx : 1 - vx, e.t, base * 1.3 + amp * (.45 + .55 * e.k), (.1 + .12 * kk + .06 * hash(i, k)) * VIS);
          });
          const aX = [], aTop = [], aJ = [], idx = [];
          for (let i = 0; i <= NX; i++) {
            const u = i / NX, jag = (hash(i * .37 + k, 7.7) - .5) * .5 + Math.sin(i * .45 + k) * .35 + Math.sin(i * .13 + 2 * k) * .3;
            for (const top of [0, 1]) { aX.push(u); aTop.push(top); aJ.push(jag); }
            if (i < NX) { const b = i * 2; idx.push(b, b + 2, b + 3, b, b + 3, b + 1); }
          }
          const g = new THREE.BufferGeometry(); attr(g, 'position', new Array(aX.length * 3).fill(0), 3); attr(g, 'aX', aX, 1); attr(g, 'aTop', aTop, 1); attr(g, 'aJ', aJ, 1); g.setIndex(idx);
          const fill = night.clone().lerp(k > 2 ? light : emit, .2 + .16 * kk).multiplyScalar(.5 + .5 * kk), lit = fill.clone().lerp(k > 2 ? light : emit, .32).multiplyScalar(1.22);
          const u2 = {uZ: {value: -2 * k}, uW: {value: Wd}, uUp: {value: 0}, uLv: {value: 0}, uSl: {value: 0}, uBase: {value: base}, uPk: {value: pk}, uFill: {value: fill}, uLit: {value: lit}, uRim: {value: C.hot.clone()}, uHaze: {value: night.clone().lerp(emit, .1).multiplyScalar(.5)}};
          o.layers.push({m: add(o, new THREE.Mesh(g, mat(o, RANGE_VS, RANGE_FS, u2, {transparent: false, depthWrite: true, blending: THREE.NormalBlending})), 1), k, g2});
        }
      } else if (kind === 'stroke') {
        const N = 460, R0 = 2.9, Yc = R0 + .55, aU = [], aV = [], aD = [], idx = [];
        let rmx = 0; const lv = []; for (let i = 0; i <= N; i++) { const tt = S.a + dur * i / N; let s = 0; for (let j = -3; j <= 3; j++) s += sig.level('rms', tt + j * .12); lv.push(s / 7); rmx = Math.max(rmx, s / 7); }
        // where the brush is at each moment: it goes round as fast as the music presses on
        const press = lv.map(x => .3 + Math.pow(x / Math.max(.15, rmx), 1.4)), cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + (press[i - 1] + press[i]) / 2);
        const th0 = -2.35 * dirn, span = TAU * .93 * dirn, thAt = i => th0 + span * cum[i] / cum[N];
        for (let i = 0; i <= N; i++) {
          const u = i / N, tt = S.a + dur * u, w = (.09 + .5 * Math.pow(lv[i] / Math.max(.15, rmx), 1.5)) * sm(0, .012, u) * (1 - .55 * sm(.9, 1, u));
          const rad = R0 * (1 + .045 * Math.sin(u * 9 + S.i) + .05 * (sig.level('low', tt, .3, .6) - .5));
          for (const sd of [-1, 1]) { aU.push(u); aV.push(sd); aD.push(rad, w, thAt(i)); }
          if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
        }
        const g = new THREE.BufferGeometry(); attr(g, 'position', new Array(aU.length * 3).fill(0), 3); attr(g, 'aU', aU, 1); attr(g, 'aV', aV, 1); attr(g, 'aD', aD, 3); g.setIndex(idx);
        add(o, new THREE.Mesh(g, mat(o, BRUSH_VS, BRUSH_FS, {uYc: {value: Yc}, uSeed: {value: S.i * 3.7 + 1}, uCol: {value: cA.clone()}, uHot: {value: C.hot.clone()}})), 5);
        // ink flung off the brush on the strong beats: it flies outward and stays where it lands
        const ink = glows(o); let nI = 0;
        for (const q of thin([...(on.low || []), ...(on.mid || [])].sort((a, b) => a[0] - b[0]), .55, .3)) {
          const i = clamp(Math.round((q[0] - S.a) / dur * N), 0, N), th = thAt(i);
          for (let j = 0; j < 3 + Math.round(4 * q[1]) && nI < 160; j++, nI++) {
            const out = R0 + .25 + (.3 + 1.1 * hash(q[0], j)) * (hash(q[0], j + 9) < .3 ? -1 : 1) * (.5 + q[1]), a = th + (hash(q[0], j + 3) - .5) * .5;
            ink.put(Math.sin(a) * out, Yc + Math.cos(a) * out, (hash(q[0], j + 5) - .5) * .5, q[0] + .05 * j, .4 + .5 * q[1], hash(q[0], j + 7), .05 + .07 * hash(q[0], j + 1) * q[1]);
          }
        }
        ink.mesh(cB, C.hot, {tw: .1});
      } else if (kind === 'swing') {
        // the pace: one swing across every two beats (as the analysis estimates the tempo)
        const tempo = clamp(M.tempo_candidate || 110, 60, 190), per = clamp(120 / tempo, 1.4, 3.2), om = TAU / per;
        // the interval, slowly (a mean over 2.5 s), and the phases it drives, integrated along the passage
        const dt = .1, a0 = S.a - 4, n = Math.ceil((S.b + 4 - a0) / dt) + 2, raw = new Float32Array(n), R = new Float32Array(n), PH = new Float32Array(n), PH3 = new Float32Array(n);
        for (let i = 0; i < n; i++) raw[i] = Math.log(ratioAt(a0 + i * dt));
        for (let i = 0; i < n; i++) { let s = 0, w = 0; for (let j = -12; j <= 12; j++) { const q = raw[Math.min(n - 1, Math.max(0, i + j))], wj = 13 - Math.abs(j); s += q * wj; w += wj; } R[i] = Math.exp(s / w); }
        for (let i = 1; i < n; i++) { PH[i] = PH[i - 1] + om * dt * (R[i - 1] + R[i]) / 2; PH3[i] = PH3[i - 1] + om * dt * (1 + (R[i - 1] + R[i]) / 2) / 2; }
        o.sw = {a0, dt, n, R, PH, PH3, om, per, p2: hash(S.i, 1.3) * TAU, p3: hash(S.i, 2.9) * TAU, Y0: 2.55, E: .85};
        const NQ = 300, aS = [], aSide = [], idx = [];
        for (let i = 0; i <= NQ; i++) { for (const sd of [-1, 1]) { aS.push(i / NQ); aSide.push(sd); } if (i < NQ) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
        const g = new THREE.BufferGeometry(); attr(g, 'position', new Array(aS.length * 3).fill(0), 3); attr(g, 'aS', aS, 1); attr(g, 'aSide', aSide, 1); g.setIndex(idx);
        o.dyn.u = {uOm: {value: om}, uTh1: {value: 0}, uTh2: {value: 0}, uTh3: {value: 0}, uRat: {value: 1.5}, uRat3: {value: 1.25}, uAx: {value: 3.6}, uAy: {value: 1.9}, uAz: {value: 1.6}, uY0: {value: 2.55}, uTr: {value: per * 2.6}};
        add(o, new THREE.Mesh(g, mat(o, SWING_VS, SWING_FS, {...o.dyn.u, uCol: {value: cA.clone()}, uHot: {value: C.white.clone()}})), 6);
        // the thread it hangs from, out of the dark above
        const tg = new THREE.BufferGeometry(); attr(tg, 'position', new Array(12).fill(0), 3); attr(tg, 'aE', [0, 1, 0, -1, 1, -1, 1, 1], 2); tg.setIndex([0, 1, 2, 1, 3, 2]);
        o.dyn.piv = new THREE.Vector3(0, 11, 0); o.dyn.pen = new THREE.Vector3(0, 2.7, 0);
        add(o, new THREE.Mesh(tg, mat(o, THREAD_VS, THREAD_FS, {uPiv: {value: o.dyn.piv}, uPen: {value: o.dyn.pen}, uCol: {value: C.white.clone()}})), 5);
        // the pen, and beads of light where it was on the strong low beats
        const pn = glows(o); pn.put(0, 2.7, 0, -1e4, 1, .5, .42); o.pen = pn.mesh(C.hot, C.white, {tw: 0});
        const bd = glows(o); for (let j = 0; j < 8; j++) bd.put(0, -9, 0, -1e4, .6, hash(j, 9.1), .18); o.beads = bd.mesh(cB, C.white, {hold: 0, tw: 0});
      } else if (kind === 'stars') {
        const pitch = tt => { let i = 0, m = -1; for (let k = 0; k < 12; k++) { const q = sig.level('chroma' + pad2(k), tt, .1, .5); if (q > m) { m = q; i = k; } } return i; };
        let ev = [];
        [['low', .3, .34, -1], ['mid', .38, .2, 0], ['high', .45, .2, 1]].forEach(([b, floor, gap, zb]) => { for (const q of thin(on[b], floor, gap)) ev.push({t: q[0], k: q[1], zb, p: pitch(q[0])}); });
        ev.sort((a, b) => a.t - b.t);
        // not every onset is a star: at most about 2.4 a second, the strongest
        const cap = Math.max(12, Math.round(dur * 2.4));
        if (ev.length > cap) { const keep = new Set([...ev].sort((a, b) => b.k - a.k).slice(0, cap)); ev = ev.filter(e => keep.has(e)); }
        // constellations: runs of stars that belong together (a breath ends one; four to eight stars each)
        const groups = []; let G = null;
        for (const e of ev) { if (!G || e.t - G.last > 1.1 || G.st.length >= G.max) { G = {st: [], max: 4 + Math.floor(hash(e.t, 3.3) * 5), last: e.t}; groups.push(G); } G.st.push(e); G.last = e.t; }
        // each somewhere else in the sky in front, away from the last few; its stars a walk that turns with the melody
        const Wd = 11.6, centres = [], ln = ribbons(o), gl = glows(o);
        groups.forEach((G2, gi) => {
          let best = null, bd = -1;
          for (let c = 0; c < 10; c++) {
            const x = (hash(gi * 10 + c, S.i + 1.7) - .5) * Wd * .82, y = 2.1 + hash(gi * 10 + c, S.i + 4.1) * 3.1, z = (hash(gi * 10 + c, S.i + 8.9) - .5) * 2.6;
            let dmin = 99; for (const q of centres.slice(-5)) dmin = Math.min(dmin, Math.hypot(x - q[0], (y - q[1]) * 1.4));
            if (dmin > bd) { bd = dmin; best = [x, y, z]; }
          }
          centres.push(best);
          let px = best[0], py = best[1], pz = best[2], head = hash(gi, 2.2) * TAU, prevP = null;
          G2.st.forEach((e, j) => {
            if (j) {
              const dp = e.p - prevP, turn = (dp > 0 ? .75 : dp < 0 ? -.75 : 0) * (Math.abs(dp) > 6 ? -1 : 1) + (hash(e.t, 5.5) - .5) * 1.1, step = .6 + .55 * hash(e.t, 6.6);
              head += turn; px += Math.cos(head) * step; py += Math.sin(head) * step * .85; pz += (hash(e.t, 7.7) - .5) * .9;
              const dx = px - best[0], dy = py - best[1], rr = Math.hypot(dx, dy); if (rr > 1.8) { px = best[0] + dx / rr * 1.8; py = best[1] + dy / rr * 1.8; head += Math.PI * .6; }
              py = Math.max(1.1, py);
            }
            e.x = px * dirn; e.y = py; e.z = pz + e.zb * .4; prevP = e.p;
            gl.put(e.x, e.y, e.z, e.t, clamp(e.k), hash(e.t, 1.1), .2 + .3 * clamp(e.k));
            // joined, on its note, to the nearest star of its figure already lit
            if (j) {
              let nb = null, nd = 1e9; for (let i2 = 0; i2 < j; i2++) { const q = G2.st[i2], d = Math.hypot(q.x - e.x, q.y - e.y, q.z - e.z); if (d < nd) { nd = d; nb = q; } }
              ln.seg([nb.x, nb.y, nb.z], [e.x, e.y, e.z], -1, e.t - .18, .5 + .45 * clamp(e.k), 1.1 + .6 * clamp(e.k));
            }
          });
          // (now and then a figure closes on itself)
          const n = G2.st.length; if (n >= 5 && hash(gi, 4.4) < .35) { const a = G2.st[n - 1], b = G2.st[0]; ln.seg([a.x, a.y, a.z], [b.x, b.y, b.z], -1, a.t + .25, .5, .9); }
        });
        // and the dust of fainter stars the figures hang among, there from the start
        for (let j = 0; j < 150; j++) gl.put((hash(j, S.i + .3) - .5) * Wd * 1.25, .5 + hash(j, S.i + .7) * 4.8, (hash(j, S.i + .9) - .5) * 5, S.a - 2 + hash(j, 3.3) * 1.6, .06 + .14 * hash(j, 5.5), hash(j, 7.7), .08 + .05 * hash(j, 8.8));
        ln.mesh(cA, C.hot, {dim: .38, fade: 6, grow: .2, gain: 1.15});
        gl.mesh(C.white, C.hot, {tw: .45});
      } else {
        // wheel: the armillary. Each ring turns as fast as its band is loud: the turning, integrated along the passage
        const NB = 6, Rr = Array.from({length: NB}, (_, b) => 3.3 - .42 * b), Yc = 3.75, dt = .1, a0 = S.a - 3, n = Math.ceil((S.b + 3 - a0) / dt) + 2;
        const ph = Array.from({length: NB}, () => new Float32Array(n));
        for (let b = 0; b < NB; b++) { let prev = 0; for (let i = 0; i < n; i++) { const lvb = bandOf(GROUPS6, b, a0 + i * dt), rate = (.08 + .22 * b / NB + (1.1 + .5 * b / NB) * Math.pow(lvb, 1.5)) * dirn * (b % 2 ? -1 : 1); ph[b][i] = i ? ph[b][i - 1] + (prev + rate) / 2 * dt : hash(S.i, b) * TAU; prev = rate; } }
        o.arm = {NB, Rr, Yc, dt, a0, n, ph, tilt: Array.from({length: NB}, (_, b) => .3 + 1.05 * hash(S.i + b, 3.7)), az: Array.from({length: NB}, (_, b) => hash(S.i + b, 5.1) * TAU), prec: Array.from({length: NB}, (_, b) => (.04 + .08 * hash(S.i + b, 6.3)) * (b % 2 ? 1 : -1)),
          E1: Array.from({length: NB}, () => new THREE.Vector3(1, 0, 0)), E2: Array.from({length: NB}, () => new THREE.Vector3(0, 1, 0)), PH: new Array(NB).fill(0), LV: new Array(NB).fill(0)};
        const AU = {uE1: {value: o.arm.E1}, uE2: {value: o.arm.E2}, uRr: {value: Rr}, uPh: {value: o.arm.PH}, uLvR: {value: o.arm.LV}, uYc: {value: Yc}};
        const NA = 200, aRing = [], aA = [], aSide = [], idx = [];
        for (let b = 0; b < NB; b++) for (let i = 0; i <= NA; i++) { for (const sd of [-1, 1]) { aRing.push(b); aA.push(i / NA * TAU); aSide.push(sd); } if (i < NA) { const v0 = (b * (NA + 1) + i) * 2; idx.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2); } }
        const g = new THREE.BufferGeometry(); attr(g, 'position', new Array(aRing.length * 3).fill(0), 3); attr(g, 'aRing', aRing, 1); attr(g, 'aA', aA, 1); attr(g, 'aSide', aSide, 1); g.setIndex(idx);
        o.wheel = add(o, new THREE.Mesh(g, mat(o, ARM_VS, ARM_FS, {...AU, uCol: {value: cA.clone()}, uHot: {value: C.hot.clone()}})), 4);
        // the beads: the rises of each band, set where on the ring the eye is not yet crowded
        const bQ = [], bRA = [], bG = [], bI = []; let nb = 0;
        for (let b = 0; b < NB; b++) {
          let last = -9, p2 = bandOf(GROUPS6, b, S.a - .08), p1 = bandOf(GROUPS6, b, S.a - .04), j = 0;
          for (let tt = S.a; tt <= S.b && nb < 150; tt += .04) { const cur = bandOf(GROUPS6, b, tt), rise = cur - p2; if (rise > .07 && tt - last > .3) { const k2 = clamp(rise / .26), ang = (j * 2.39996 + b) % TAU; for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { bQ.push(qx, qy); bRA.push(b, ang); bG.push(tt - .04, .35 + .6 * k2, hash(tt, b), .1 + .12 * k2); } const v0 = nb * 4; bI.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); nb++; j++; last = tt; } p2 = p1; p1 = cur; }
        }
        const bg = new THREE.BufferGeometry(); attr(bg, 'position', new Array(bQ.length / 2 * 3).fill(0), 3); attr(bg, 'aQ', bQ, 2); attr(bg, 'aRA', bRA, 2); attr(bg, 'aG', bG, 4); bg.setIndex(bI);
        add(o, new THREE.Mesh(bg, mat(o, BEAD_VS, GLOW_FS, {...AU, uCol: {value: C.white.clone()}, uHot: {value: C.hot.clone()}, uTw: {value: .25}, uHold: {value: 1}})), 6);
      }
      items.push(o);
    }
  }

  // flat or deep at this moment: 0 while the scene is read from above, 1 from the water, easing with the camera
  function liftOf(S, t) {
    shots.planned();
    let val = S.st[0].view.k === 'plan' ? 0 : 1;
    for (const x of S.st) { const tgt = x.view.k === 'plan' ? 0 : 1; if (t >= x.arrive) val = tgt; else { if (t > x.hand) val += (tgt - val) * sm(0, 1, (t - x.hand) / Math.max(.01, x.arrive - x.hand)); break; } }
    return val;
  }
  // the interval between the two strongest pitch classes around a moment, as a rate (5/4, 3/2…)
  const lv12 = new Float32Array(12);
  function ratioAt(t) {
    for (let k = 0; k < 12; k++) lv12[k] = sig.level('chroma' + pad2(k), Math.max(0, t), .25, 1.2);
    let i = 0; for (let k = 1; k < 12; k++) if (lv12[k] > lv12[i]) i = k;
    let i2 = i ? 0 : 1; for (let k = 0; k < 12; k++) if (k !== i && lv12[k] > lv12[i2]) i2 = k;
    const [p, q] = RAT[(i2 - i + 12) % 12];
    return p / q;
  }
  // the pen of the swing at song time t (scene frame)
  function penAt(o, t, out) {
    const s = o.sw, f = clamp((t - s.a0) / s.dt, 0, s.n - 1.001), i = Math.floor(f), fr = f - i, E = s.E;
    const th2 = s.PH[i] + (s.PH[i + 1] - s.PH[i]) * fr + s.p2, th3 = s.PH3[i] + (s.PH3[i + 1] - s.PH3[i]) * fr + s.p3;
    out.set(Math.sin(s.om * (t - s.a0)) * 3.6 * E, s.Y0 + Math.sin(th2) * 1.9 * E, Math.sin(th3) * 1.6 * E);
    return {th1: s.om * (t - s.a0), th2, th3, r: s.R[i] + (s.R[i + 1] - s.R[i]) * fr};
  }
  const pv = new THREE.Vector3();
  function update(F, t, cam) {
    hits.length = 0;
    const res = cam.userData.res || [1600, 900], px = cam.userData.pxScale || 1;
    for (const o of items) {
      const S = o.S, show = t > S.a - 2.4 && t < S.b + 2.2;
      for (const m of o.meshes) m.visible = show;
      if (!show) continue;
      const now = (t - S.a) / (S.b - S.a), A = sm(S.a - 2, S.a - .6, t) * (1 - sm(S.b + .5, S.b + 2, t)), live = .85 + .35 * F.rms, lift = liftOf(S, t), U = o.U;
      U.uT.value = t; U.uNow.value = now; U.uA.value = A * live * mvDim; U.uLift.value = lift; U.uRes.value.set(res[0], res[1]); U.uPx.value = 1.9 * px; U.uPulse.value = F.kick || 0;
      if (o.kind === 'rings') {
        const R = o.rings.material.uniforms.uRing.value, ev = o.ev; let n = 0;
        for (let i = ev.length - 1; i >= 0 && n < 24; i--) {
          const e = ev[i], age = t - e.t; if (age < 0) continue; if (age > 3.4) break;
          R[n++].set(e.x, e.z, age, clamp(e.k, .05, .99) + 2 * e.b);
          if (hits.length < 3 && age < 1.3 && e.k > .45) { v.copy(o.fr.c).addScaledVector(o.fr.r, e.x).addScaledVector(o.fr.n, e.z); hits.push({x: v.x, z: v.z, age, k: e.k * A * (e.b ? .5 : .9)}); }
        }
        for (; n < 24; n++) R[n].set(0, 0, -1, 0);
      } else if (o.kind === 'strings') {
        for (let s = 0; s < 7; s++) {
          const list = o.pl[s]; let k = list.length - 1; while (k >= 0 && list[k].t > t) k--;
          for (let j = 0; j < 3; j++) { const e = list[k - j]; if (e) o.dyn.pl[s * 3 + j].set(e.x, e.t, .12 + .24 * e.k); else o.dyn.pl[s * 3 + j].set(0, -99, 0); }
          let lv = 0; for (let b = GROUPS7[s][0]; b <= GROUPS7[s][1]; b++) lv += F.mel[b]; o.dyn.lv[s] = lv / (GROUPS7[s][1] - GROUPS7[s][0] + 1);
        }
      } else if (o.kind === 'range') {
        for (const {m, k, g2} of o.layers) {
          const u = m.material.uniforms; let lv = 0; for (let b = GROUPS[g2][0]; b <= GROUPS[g2][1]; b++) lv += F.mel[b];
          u.uLv.value = lv / (GROUPS[g2][1] - GROUPS[g2][0] + 1); u.uSl.value = (k - 2) * .16 * Math.sin(t * .21 + S.i * 1.7);
          // the far ridges come up first, the near ones last; they go down the other way round
          u.uUp.value = sm(S.a - 2 + .22 * (4 - k), S.a - .7 + .22 * (4 - k), t) * (1 - sm(S.b + .4 + .2 * k, S.b + 1.7 + .2 * k, t));
        }
        U.uA.value = (.8 + .2 * F.rms) * mvDim;
      } else if (o.kind === 'swing') {
        const s = o.sw, d = o.dyn.u; s.E = .78 + .22 * F.slow;
        const ph = penAt(o, t, o.dyn.pen);
        d.uTh1.value = ph.th1; d.uTh2.value = ph.th2; d.uTh3.value = ph.th3; d.uRat.value = ph.r; d.uRat3.value = (1 + ph.r) / 2;
        d.uAx.value = 3.6 * s.E; d.uAy.value = 1.9 * s.E; d.uAz.value = 1.6 * s.E;
        const pa = o.pen.geometry.attributes.aP; for (let j = 0; j < 4; j++) pa.setXYZ(j, o.dyn.pen.x, o.dyn.pen.y, o.dyn.pen.z); pa.needsUpdate = true;
        // beads where the pen was on the last strong low beats
        const rec = sig.recent('low', t, 8, .42, 3), ba = o.beads.geometry.attributes.aP, bg = o.beads.geometry.attributes.aG;
        for (let j = 0; j < 8; j++) {
          const r = rec[j], te = r ? t - r[0] : -1e4; if (r) penAt(o, te, pv); else pv.set(0, -9, 0);
          for (let c = 0; c < 4; c++) { ba.setXYZ(j * 4 + c, pv.x, pv.y, pv.z); bg.setX(j * 4 + c, te); bg.setY(j * 4 + c, r ? .4 + .6 * r[1] : 0); }
        }
        ba.needsUpdate = bg.needsUpdate = true;
      } else if (o.kind === 'wheel') {
        const W2 = o.arm, f = clamp((t - W2.a0) / W2.dt, 0, W2.n - 1.001), i = Math.floor(f), fr = f - i;
        for (let b = 0; b < W2.NB; b++) {
          const az = W2.az[b] + t * W2.prec[b], ax = new THREE.Vector3(Math.sin(W2.tilt[b]) * Math.cos(az), Math.cos(W2.tilt[b]), Math.sin(W2.tilt[b]) * Math.sin(az));
          W2.E1[b].crossVectors(ax, Math.abs(ax.z) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)).normalize(); W2.E2[b].crossVectors(ax, W2.E1[b]).normalize();
          W2.PH[b] = W2.ph[b][i] + (W2.ph[b][i + 1] - W2.ph[b][i]) * fr;
          let lv = 0; for (let m = GROUPS6[b][0]; m <= GROUPS6[b][1]; m++) lv += F.mel[m]; W2.LV[b] = lv / (GROUPS6[b][1] - GROUPS6[b][0] + 1);
        }
        U.uA.value = A * live * mvDim;
      }
    }
  }
  return {setTrack, update, clear, hits, get count() { return items.length; }, get items() { return items; }};
}
