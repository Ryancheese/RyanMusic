// The stage: one WebGL scene in which the lyrics are the lead (lyric.js), read by a composed camera (shots.js),
// on a still lake under the song's own night sky (sky.js). The waterline is the baseline of the whole picture:
// type, drawings, the record and the spectral lines stand on it and their reflections start right under them.
// Nothing here drives the camera from audio: the music moves light, water, spectral lines and motes.
//   lake      one real water plane (shots.waterY). Everything above it is rendered a second time through the camera
//             mirrored in that plane, and the sky's finish pass lays that picture into the water
//   record    the lake is the song's record. At its middle the cover rises for the title and goes up to be the
//             moon (title.js); around that middle stand the
//   figures   where nothing is sung, the music stands on the lake as a drawing of itself (figure.js)
//   spectra   谱线: hairlines of light on the water in rings, the record's grooves. Along every ring the 32 bands
//             of the spectrum stand side by side, again and again; each line rises with its own band, and the
//             farther it stands from where the song is being sung, the later it answers: every sound runs out over
//             the water from the singer. Clearings are left where type stands and where the camera reads it from
//   motes     dust around every place (clear of the text); treble swells them, power brightens them, onsets send a
//             ripple through them from the line being sung; the pointer parts them
//   songs     a new song is flown into low over the water, and left forward into the haze
//   clocks    the picture is drawn for the moment it will be seen (app.js); the lyric clock runs LEAD ahead of it,
//             so a word's hit is on screen with its note, never after it
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createShots, rng, HOVER} from './shots.js';
import {createLyrics, LEAD} from './lyric.js';
import {createSky, skyFor} from './sky.js';
import {modeOf, MODES} from './genre.js';
import {createImagery} from './imagery.js';
import {createFigures, FIG_CHARS} from './figure.js';
import {createTitle} from './title.js';
import {createSheet} from './sheet.js';
import {createMvScreen, createMvStage} from './mv.js';
import {preparePrograms} from './prewarm.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const col = h => new THREE.Color(h);
const MEL_NAMES = Array.from({length: 32}, (_, i) => 'mel' + String(i).padStart(2, '0'));

const POST = {
  uniforms: {tDiffuse: {value: null}, uT: {value: 0}, uVig: {value: .3}, uAb: {value: .0012}, uGrain: {value: .014}, uLookA: {value: new THREE.Vector4(1, 1, 0, 0)}, uLookB: {value: new THREE.Vector4(0, 0, 0, 0)}, uSpeedC: {value: new THREE.Vector2(.5, .5)}, uPoolCol: {value: new THREE.Color()}, uAspect: {value: 16 / 9}, uBokehA: {value: new THREE.Color()}, uBokehB: {value: new THREE.Color()}, uLeakCol: {value: new THREE.Color()}, uOpen: {value: 1}, uBlink: {value: 0}, uBlinkY: {value: .4}, uBlinkCol: {value: new THREE.Color(0, 0, 0)}, uBlinkLine: {value: new THREE.Color(1, 1, 1)}},
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uVig, uAb, uGrain, uOpen, uBlink, uBlinkY, uAspect; uniform vec3 uBlinkCol, uBlinkLine, uBokehA, uBokehB, uLeakCol;
// the style's own finish (genre.js LOOKS): A = contrast, saturation, scanlines, halftone; B = light leak, bokeh, impact, speed lines
uniform vec4 uLookA, uLookB; uniform vec2 uSpeedC; uniform vec3 uPoolCol; varying vec2 vUv;
float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){ vec2 q = vUv - .5; float r2 = dot(q, q);
  vec3 c = vec3(texture2D(tDiffuse, vUv + q * uAb * r2 * 4.).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - q * uAb * r2 * 4.).b);
  c *= (1. - uVig * pow(r2 * 2.4, 1.5)) * uOpen;
  // (anime) a soft pool of light opens behind the hero word as it is sung, with a faint level streak through it
  if (uLookB.w > .003) { vec2 d = (vUv - uSpeedC) * vec2(uAspect, 1.); float rr = dot(d, d);
    c += uPoolCol * uLookB.w * (exp(-rr * 7.) * .2 + exp(-d.y * d.y * 90. - d.x * d.x * 1.6) * .06); }
  // (pop) soft discs of the song's colours drifting over the picture
  if (uLookB.y > 0.) for (int i = 0; i < 9; i++) { float fi = float(i);
    vec2 p = vec2(fract(.13 + fi * .618 + uT * (.004 + .002 * mod(fi, 3.))), fract(.37 + fi * .382 + .05 * sin(uT * .05 + fi)));
    float rad = .035 + .05 * fract(fi * .73), dd = length((vUv - p) * vec2(uAspect, 1.)), disc = smoothstep(rad, rad - .005, dd) * (.45 + .55 * smoothstep(rad * .55, rad, dd));
    c += mix(uBokehA, uBokehB, fract(fi * .41)) * disc * .045 * uLookB.y; }
  // (indie) warm light leaking in at the frame's edges
  if (uLookB.x > 0.) { vec2 q1 = (vUv - vec2(-.08 + .12 * sin(uT * .07), .78 + .2 * sin(uT * .05))) * vec2(uAspect, 1.), q2 = (vUv - vec2(1.08 + .08 * sin(uT * .06 + 2.), .22 + .25 * sin(uT * .045 + 1.))) * vec2(uAspect, 1.);
    c += uLeakCol * uLookB.x * (exp(-dot(q1, q1) * 3.2) * (.6 + .4 * sin(uT * .3)) + .8 * exp(-dot(q2, q2) * 4.5)) * .2; }
  // contrast (about middle grey) and colour
  float Lm = dot(c, vec3(.2126, .7152, .0722)); c = max(mix(vec3(Lm), c, uLookA.y), 0.); c = .18 * pow(c / .18, vec3(uLookA.x)); Lm = dot(c, vec3(.2126, .7152, .0722));
  // (hip-hop) halftone dots in the dark of the picture
  if (uLookA.w > 0.) { vec2 g = mat2(.7071, -.7071, .7071, .7071) * gl_FragCoord.xy / 5.; float rr = length(fract(g) - .5), dm = smoothstep(.05, -.05, rr - .62 * sqrt(clamp(Lm * 3.5, 0., 1.)));
    c = mix(c, c * dm * 1.7, uLookA.w * .8 * (1. - smoothstep(.1, .42, Lm))); }
  // (electro) scanlines
  if (uLookA.z > 0.) c *= 1. - uLookA.z * .2 * (.5 + .5 * cos(gl_FragCoord.y * 2.0944));
  // (rock) the impact frame: one bit, for a moment, on the hardest downbeats
  if (uLookB.z > .003) c = mix(c, vec3(step(.22, Lm)) * 1.3, uLookB.z);
  // the blink: the picture shuts on the waterline (a band growing from it both ways) and opens on the next baseline
  if (uBlink > 0.) { float h = abs(vUv.y - uBlinkY), reach = uBlink * uBlink * 1.05; c = mix(c, uBlinkCol, smoothstep(reach + .012, reach - .012, h)); c += uBlinkLine * exp(-h * h / 2e-6) * smoothstep(0., .25, uBlink) * .9; }
  c += (h(gl_FragCoord.xy + fract(uT) * 91.7) - .5) * uGrain; gl_FragColor = vec4(c, 1.); }`,
};

const MOTE_VS = `attribute vec4 aSeed; uniform float uT, uSize, uTreble, uPower, uWater, uLens; uniform vec2 uPointer; uniform float uAspect;
uniform vec4 uRip[9]; uniform vec3 uRipC; varying float vA, vDepth;
void main(){
  vec3 p = position;
  p += vec3(sin(uT * .13 + aSeed.x * 40.), sin(uT * .11 + aSeed.y * 40.) * .6, cos(uT * .09 + aSeed.z * 40.)) * .18;
  // ripple packets: exp(-dr²/w²)·sin(k·dr)·exp(-1.15 age)·exp(-0.35 r)
  float disp = 0.; vec3 rd = p - uRipC; float r = length(rd);
  for (int i = 0; i < 9; i++) {
    vec4 R = uRip[i]; if (R.x < 0.) continue;
    float band = float(i / 3), speed = band < .5 ? .9 : band < 1.5 ? 1.6 : 2.5, wid = band < .5 ? .66 : band < 1.5 ? .36 : .22, k = band < .5 ? 3.4 : band < 1.5 ? 5.5 : 9.;
    float front = R.x * speed * 3.2, dr = r - front;
    disp += R.y * (band < .5 ? 1.45 : band < 1.5 ? .9 : .5) * exp(-dr * dr / (wid * wid * 4.)) * sin(k * dr) * exp(-1.15 * R.x) * exp(-.35 * r * .3);
  }
  p += normalize(rd + 1e-4) * disp * .22;
  p.y = max(p.y, uWater + .04);
  vec4 mv = modelViewMatrix * vec4(p, 1.); vDepth = -mv.z;
  vec4 cp = projectionMatrix * mv;
  // the pointer parts the motes (screen space)
  vec2 sp = cp.xy / cp.w; vec2 d = sp - uPointer; d.x *= uAspect; float pd = length(d);
  if (uPointer.x > -5. && pd < .22) { vec2 push = normalize(d + 1e-5) * (.22 - pd) * .5; push.x /= uAspect; cp.xy += push * cp.w; }
  gl_Position = cp;
  // (through a long lens the eye is far off: what counts is how near a thing looks)
  float dl = vDepth * uLens;
  vA = (.2 + .22 * uPower + .5 * abs(disp)) * (.4 + .6 * aSeed.w) * smoothstep(1.2, 3., vDepth) * (1. - smoothstep(18., 34., dl));
  gl_PointSize = min(uSize * (.6 + aSeed.w) * (1. + .42 * uTreble + 1.2 * abs(disp)) / max(dl, .3), uSize * .5);
}`;
const MOTE_FS = `uniform vec3 uCol, uHot; varying float vA, vDepth;
void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, r); gl_FragColor = vec4(mix(uCol, uHot, clamp(vA - .3, 0., 1.)) * a * vA, 1.); }`;

// spectral lines. aReed: band (0..31), seed, end (0 foot, 1 tip). uMel: the spectrum now and 0.12, 0.24, 0.36 s ago.
const REED_VS = `attribute vec3 aReed; uniform float uMel[128]; uniform float uWater, uT, uK, uCalm, uLens, uQuiet, uQuant, uHgt, uWhite, uPx; uniform vec3 uLo, uHi, uOrigin; uniform vec4 uCalmC; varying vec3 vC; varying float vA;
void main(){
  int b = int(aReed.x + .5);
  // the sound runs out over the water from where it is sung
  float away = length(position.xz - uOrigin.xz), lag = clamp(away / 13., 0., 2.999); int i0 = int(floor(lag));
  float lv = mix(uMel[i0 * 32 + b], uMel[i0 * 32 + 32 + b], fract(lag));
  if (uQuant > 0.) lv = floor(lv * uQuant + .35) / uQuant;                // (electro, hip-hop) in steps
  float h = uHgt * (.04 + .16 * aReed.y + (1.35 + 1.1 * aReed.y) * pow(lv, 1.7)) * (1. - .3 * clamp(away / 40., 0., 1.)) * (1. - .88 * uQuiet);
  vec3 p = position; p.y = uWater + aReed.z * h;
  p.x += aReed.z * h * .025 * sin(uT * .7 + aReed.y * 40.);
  vec4 mv = modelViewMatrix * vec4(p, 1.); float d = -mv.z;
  gl_Position = projectionMatrix * mv;
#ifdef TIPS
  gl_PointSize = clamp(uPx * (.9 + 2.4 * lv) / max(d * uLens, .5), 0., uPx * .4);
#endif
  // light rising from the water: bright at the foot, fading to the tip; quieter behind the line being sung
  vec2 cz = (gl_Position.xy / gl_Position.w * .5 + .5 - uCalmC.xy) / max(uCalmC.zw, vec2(.02));
  vA = uK * (.14 + .9 * lv) * smoothstep(2.2, 5.5, d) * (1. - smoothstep(26., 46., d * uLens)) * mix(1., .1, aReed.z) * (1. - uCalm * exp(-dot(cz, cz) * .9)) * (1. - .85 * uQuiet);
  vC = mix(uLo, uHi, aReed.x / 31.) * (.55 + .9 * lv); vC = mix(vC, vec3(dot(vC, vec3(.3, .5, .2))) * 1.3, uWhite);
}`;
const REED_FS = `varying vec3 vC; varying float vA; void main(){
#ifdef TIPS
  float r = length(gl_PointCoord - .5); float k = smoothstep(.5, .05, r); gl_FragColor = vec4(vC * vA * k * 2.2, 1.);
#else
  gl_FragColor = vec4(vC * vA, 1.);
#endif
}`;

// ?prof: time every part of a frame, the GPU's share included (each part waits for the GPU with a one-pixel read)
const PROF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('prof');
const prof = PROF ? (window.__prof = {acc: {}, max: {}, n: 0, reset() { this.acc = {}; this.max = {}; this.n = 0; }}) : null;
let profT = 0, profGl = null;
const px1 = new Uint8Array(4);
function mark(k, sync) {
  if (!PROF) return;
  if (sync && profGl) profGl.readPixels(0, 0, 1, 1, profGl.RGBA, profGl.UNSIGNED_BYTE, px1);
  const n = performance.now(), d = n - profT; prof.acc[k] = (prof.acc[k] || 0) + d; prof.max[k] = Math.max(prof.max[k] || 0, d); profT = n;
}
export function createStage(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: typeof location !== 'undefined' && new URLSearchParams(location.search).has('capture')});
  renderer.outputColorSpace = THREE.SRGBColorSpace; profGl = renderer.getContext();
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 16 / 9, .05, 300), mirrorCam = new THREE.PerspectiveCamera(42, 16 / 9, .05, 300);
  // Layer 1 holds only objects whose existing fragment shader discards the entire mirror pass.
  // Main-target MSAA and mirror MSAA remain unchanged; no reflected content is removed.
  cam.layers.enable(1);
  scene.background = new THREE.Color('#050506');
  const rt = new THREE.WebGLRenderTarget(1600, 900, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, cam));
  // bloom only for what is truly brighter than white (HDR): the sky and resting type do not bloom, a sung flash does
  const bloom = new UnrealBloomPass(new THREE.Vector2(800, 450), .3, .45, 1.02);
  composer.addPass(bloom);
  const post = new ShaderPass(POST); composer.addPass(post);
  let bloomBase = .3;
  composer.addPass(new OutputPass());
  // the scene seen from below the waterline (mirrored camera), for the lake
  const reflRT = new THREE.WebGLRenderTarget(800, 450, {type: THREE.HalfFloatType, depthBuffer: true, samples: 4});
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), black = new THREE.Color(0, 0, 0);

  const lyrics = createLyrics(scene, renderer), imagery = createImagery(scene), phrases = createFigures(scene, lyrics.shared), title = createTitle(scene, lyrics.shared), sheet = createSheet(scene, lyrics.shared);
  const size = {w: 1600, h: 900};
  const mvScreen = createMvScreen(), mvStage = createMvStage(scene, lyrics.shared);
  let sky = null, skyP = null;
  // ?nosky: the sky's loops and the aurora are left out (a plain night over the same lake)
  // (loops: false on a phone: no 4K sky videos, the live aurora and haze stay)
  const skyReady = createSky(renderer, {layers: opts.sky !== false, loops: opts.loops ?? true}).then(s => { sky = s; sky.resize(size.w, size.h); sky.setAuroraLayers?.(Qt.aur || 32); if (track) applySky(); }).catch(e => console.warn('sky', e));
  let track = null, sig = null, score = null, shots = null, theme = null, world = null, flight = null, shift = 0, aspect = 16 / 9, baseFov = 42;
  const pointer = new THREE.Vector2(-9, -9), pointerSm = new THREE.Vector2(), ZERO2 = new THREE.Vector2(), OFF2 = new THREE.Vector2(-9, -9);

  function dispose(obj) { obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
  function buildWorld() {
    const g = new THREE.Group(), r = rng(track.vinyl.seed ^ 0x3C6E), wy = shots.waterY, G = shots.groups, q = new THREE.Vector3();
    const gf = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()};
    // motes around every place: from the water up into the sky, clear of the text
    // (a scene is one place, however many views read it)
    const GM = G.filter(x => !x.scene || x.scene.st[0].G === x), per = 70, N = GM.length * per, pos = new Float32Array(N * 3), seeds = new Float32Array(N * 4);
    GM.forEach((x, si) => {
      shots.groupFrame(x, gf);
      for (let j = 0; j < per; j++) {
        const i = si * per + j, golden = j * 2.39996 + si, rad = 2.4 + 9 * Math.sqrt((j * .6180339) % 1), turn = j * 1.3247 + si * .7;
        q.set(gf.c.x + Math.cos(turn) * rad, wy + .1 + Math.abs(Math.sin(golden)) * rad * .62 + .25 * r(), gf.c.z + Math.sin(turn) * rad);
        q.toArray(pos, i * 3); seeds.set([r(), r(), r(), r()], i * 4);
      }
    });
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const rip = Array.from({length: 9}, () => new THREE.Vector4(-1, 0, 0, 0));
    const moteMat = new THREE.ShaderMaterial({vertexShader: MOTE_VS, fragmentShader: MOTE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uT: {value: 0}, uSize: {value: 30}, uTreble: {value: 0}, uPower: {value: 0}, uWater: {value: wy}, uLens: {value: 1}, uPointer: {value: new THREE.Vector2(-9, -9)}, uAspect: {value: 1.78}, uRip: {value: rip}, uRipC: {value: new THREE.Vector3()},
        uCol: {value: col(theme.star).lerp(col(track.pal.emit), .35).multiplyScalar(.8)}, uHot: {value: col(track.pal.emit)}}});
    const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; g.add(motes);

    // spectral lines: rings around the middle of the lake. Clearings: a wedge from every line of type to where the
    // camera reads it from (wide at the type, wide enough for the camera's own move at the other end)
    const clear = shots.stations.map(x => {
      shots.stationFrame(x, gf);
      return {cx: gf.c.x, cz: gf.c.z, rx: gf.r.x, rz: gf.r.z, nx: gf.n.x, nz: gf.n.z, ...shots.clearOf(x)};
    });
    const open = (x, z) => { for (const c of clear) { const dx = x - c.cx, dz = z - c.cz, v = dx * c.nx + dz * c.nz; if (v < c.back || v > c.d) continue; if (Math.abs(dx * c.rx + dz * c.rz) < c.w + (c.w2 - c.w) * clamp(v / c.d)) return true; } return false; };
    // (2026-10-07) laid out as a design, by style, and denser (genre.js LOOKS reeds.layout):
    //   sunflower  a Fermat spiral at the golden angle; each of its 34 arms is one band, so the arms light in turn
    //   rays       lines of reeds running out from the middle like stage lights; a band per ray
    //   grid       a square grid over the lake (it lines up with electro's lit grid); a band per column, like an equaliser seen in depth
    //   grooves    close rings like a record's grooves; a band per ring
    //   drift      clusters scattered over the water, each one band
    const rp = [], ra = [], tp = [], ta = [], O = shots.title.c, R0 = 5.6, R1 = 74, LY = track.style?.look?.reeds?.layout || 'sunflower';
    const put = (x, z, band, seed) => { x += O.x; z += O.z; if (open(x, z)) return; for (const end of [0, 1]) { rp.push(x, wy, z); ra.push(band, seed, end); } tp.push(x, wy, z); ta.push(band, seed, 1); };
    if (LY === 'rays') {
      const NR = 96;
      for (let i = 0; i < NR; i++) { const a = i / NR * 6.2832 + r() * .01, band = Math.round(Math.abs(((i % 32) + .5) - 16) * 2) % 32; for (let rad = R0 + (i % 3) * .3; rad < R1; rad += .55 + rad * .006) put(Math.cos(a) * rad, Math.sin(a) * rad, band, r()); }
    } else if (LY === 'grid') {
      const S = 1.6;
      for (let gx = -R1; gx <= R1; gx += S) for (let gz = -R1; gz <= R1; gz += S) { const d = Math.hypot(gx, gz); if (d < R0 || d > R1) continue; put(gx, gz, Math.floor(((gx / S) % 32 + 32) % 32), r()); }
    } else if (LY === 'grooves') {
      for (let ring = 0, rad = R0; rad < R1; ring++, rad += .75 + rad * .012) { const n = Math.round(rad * 6.2832 / .45), ph = r() * 6.2832; for (let i = 0; i < n; i++) { if ((i * 7 + ring * 3) % 23 === 0) continue; const a = ph + i / n * 6.2832; put(Math.cos(a) * rad, Math.sin(a) * rad, ring % 32, r()); } }
    } else if (LY === 'drift') {
      for (let c = 0; c < 340; c++) { const a = r() * 6.2832, d = R0 + Math.sqrt(r()) * (R1 - R0), band = Math.floor(r() * 32), m = 6 + Math.floor(r() * 20), sp = .5 + r() * 1.6; for (let j = 0; j < m; j++) { const b = r() * 6.2832, e = Math.sqrt(r()) * sp; put(Math.cos(a) * d + Math.cos(b) * e, Math.sin(a) * d + Math.sin(b) * e, band, r()); } }
    } else {
      const N = 15000, A = (R1 * R1 - R0 * R0) / N, ph = r() * 6.2832;
      for (let n = 0; n < N; n++) { const rad = Math.sqrt(R0 * R0 + n * A), a = ph + n * 2.3999632; put(Math.cos(a) * rad, Math.sin(a) * rad, Math.floor((n % 34) * 32 / 34), r()); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('aReed', new THREE.Float32BufferAttribute(ra, 3));
    const P = track.pal, lo = col(P.emit), hi = col(P.second || P.ramp[2] || P.light).lerp(col(theme.star), .35);
    const reedMat = new THREE.ShaderMaterial({vertexShader: REED_VS, fragmentShader: REED_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {uMel: {value: new Float32Array(128)}, uWater: {value: wy}, uT: {value: 0}, uK: {value: 1}, uLens: {value: 1}, uLo: {value: lo}, uHi: {value: hi}, uOrigin: {value: O.clone()}, uQuiet: {value: 0}, uQuant: {value: 0}, uHgt: {value: 1}, uWhite: {value: 0}, uPx: {value: 30}, uCalm: {value: 0}, uCalmC: {value: new THREE.Vector4(.5, .5, .4, .25)}}});
    const reeds = new THREE.LineSegments(rg, reedMat); reeds.frustumCulled = false; reeds.renderOrder = 2; g.add(reeds);
    // a point of light at every tip (the same uniforms: they move with the lines)
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('aReed', new THREE.Float32BufferAttribute(ta, 3));
    const tipMat = new THREE.ShaderMaterial({vertexShader: REED_VS, fragmentShader: REED_FS, defines: {TIPS: 1}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: reedMat.uniforms});
    const tips = new THREE.Points(tg, tipMat); tips.frustumCulled = false; tips.renderOrder = 2; g.add(tips);
    scene.add(g);
    return {g, motes, moteMat, reedMat, reeds: rp.length / 6};
  }
  function applySky() {
    if (!sky || !track) return;
    skyP?.spec.dispose();
    skyP = skyFor(track, sig, shots, theme, opts.skyName);
    // with an MV on the horizon the sky keeps only its field: no arch, no nebula or black hole over the picture
    const P = track.mv ? {...skyP.params, feat: null, arch: {...skyP.params.arch, k: 0}} : skyP.params;
    sky.set(P, skyP.spec, track.duration, skyP.fwd);
    const pal = track.pal, c = h => new THREE.Color(h);
    mvStage.set(track.mv ? mvScreen.tex : null, c(theme.night).lerp(c(pal.deep), .5).lerp(c(pal.emit), .12).multiplyScalar(.5), mvScreen.el);
    scene.background = sky.texture;
  }
  function rebuild() {
    shots = createShots(track, sig, score, shift, modeOf(track, sig.character, opts.modeName));
    shots.setFit(baseFov, aspect); shots.setLayout(lyrics.layoutOf);
    lyrics.setShots(shots); imagery.setShots(shots); title.setShots(shots);
    clipPlane.constant = -shots.waterY;
  }
  function setTrack(t, signal, th, sc, {fly = true} = {}) {
    if (world) { scene.remove(world.g); dispose(world.g); }
    track = t; sig = signal; score = sc; theme = th;
    lookStar.set(th.star); lookEmit.set(t.pal.emit); lookNight.set(th.night);
    mvScreen.set(t.mv?.video || null);
    // (the shut shutter is a field of the song's colour, not black)
    blinkCol.copy(col(th.night)).lerp(col(t.pal.night), .6).lerp(col(t.pal.emit), .38).multiplyScalar(.42);
    // the style's finish over the whole picture (genre.js STYLES)
    post.uniforms.uBokehA.value.copy(col(t.pal.emit)); post.uniforms.uBokehB.value.copy(col(t.pal.second || t.pal.light)); post.uniforms.uLeakCol.value.set(1, .52, .26).lerp(col(t.pal.emit), .25);
    const PS = t.style?.post || {}; post.uniforms.uVig.value = PS.vig ?? .3; post.uniforms.uAb.value = PS.ab ?? .0012; post.uniforms.uGrain.value = PS.grain ?? .014; bloomBase = PS.bloom ?? .3;
    lyrics.setTrack(t, th, sc, aspect);
    rebuild();
    imagery.setTrack(t, th, sc, sig, lyrics); phrases.setTrack(t, th, sig, shots); title.setTrack(t, th, shots); sheet.setTrack(t, th, shots);
    world = buildWorld();
    applySky();
    flight = fly ? {start: performance.now(), dur: 3200, dir: 'in'} : null;
    warmed = warm();
  }
  // Prepare both reflected and main-scene variants, including first-use uniform/attribute metadata.
  // The final frame is the same t=0 capture through the existing full render chain.
  let warmed = Promise.resolve(), warmGeneration = 0;
  const emptyWarmScene = new THREE.Scene();
  async function warm() {
    const generation = ++warmGeneration, song = track;
    const current = () => generation === warmGeneration && track === song;
    while (current()) {
      const preparedWorld = world, active = () => current() && world === preparedWorld;
      try {
        await preparePrograms(renderer, scene, emptyWarmScene, [
          {target: reflRT, camera: mirrorCam, planes: [clipPlane]},
          {target: rt, camera: cam, planes: []},
        ], {active});
      } catch (e) { if (active()) console.warn('warm', e); }
      if (!current()) return;
      // A lyric reading can arrive during preparation and rebuild this song's world. Keep the
      // same warmed promise pending until that replacement, too, is prepared; do not delay its score.
      if (!active()) continue;
      await skyReady;
      if (!current()) return;
      if (!active()) continue;
      if (track && sig) { try { render(sig.at(0), {capture: true}); } catch (e) { console.warn('warm frame', e); } }
      return;
    }
  }
  // a new score for the same song (the lyric offset changed, or the model's reading arrived)
  function setScore(sc, sh = shift) {
    score = sc; shift = sh;
    lyrics.setTrack(track, theme, sc, aspect); rebuild(); imagery.setTrack(track, theme, sc, sig, lyrics); phrases.setTrack(track, theme, sig, shots); sheet.setTrack(track, theme, shots);
    if (world) { scene.remove(world.g); dispose(world.g); } world = buildWorld();
  }
  function setShift(s) { shift = s; }
  function flyOut(ms = 900) { flight = {start: performance.now(), dur: ms, dir: 'out'}; return new Promise(r => setTimeout(r, ms)); }
  // the picture's tier (app.js TIERS): main MSAA, the mirror's size and how often it is drawn. High is the picture
  // as it was (main 4x, mirror half size 4x, every frame); mid and low lose only these
  const Qt = {mirror: .5, every: 1, ratio: 1, n: 0};
  // 0 draws the reflection every frame, 1 every other, 2 keeps the last one. A late frame (the electro
  // grid lit by a drum section) must not paint that scene twice, or the next frame is later still.
  let frameAt = 0, mirrorLoad = 0, mirrorTick = 0;
  function setQuality(T) {
    if (!T) return;
    const ms = T.msaa ?? 4, mm = ms >= 4 ? 4 : 0;
    if (rt.samples !== ms) { for (const r of new Set([rt, composer.renderTarget1, composer.renderTarget2])) { r.samples = ms; r.dispose(); } }
    if (reflRT.samples !== mm) { reflRT.samples = mm; reflRT.dispose(); }
    Qt.mirror = T.mirror ?? .5; Qt.every = Math.max(1, T.every || 1); Qt.aur = T.aur || 32; sky?.setAuroraLayers?.(Qt.aur);
    reflRT.setSize(Math.round(size.w * Qt.ratio * Qt.mirror), Math.round(size.h * Qt.ratio * Qt.mirror));
  }
  function resize(w, h, ratio) {
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); composer.setPixelRatio(ratio); composer.setSize(w, h);
    size.w = w; size.h = h; Qt.ratio = ratio; sky?.resize(w, h); reflRT.setSize(Math.round(w * ratio * Qt.mirror), Math.round(h * ratio * Qt.mirror));
    aspect = w / h; cam.aspect = aspect; baseFov = aspect < 1 ? 62 : aspect < 1.4 ? 50 : 42; cam.fov = baseFov; cam.updateProjectionMatrix();
    if (track) { lyrics.setAspect(aspect); shots.setFit(baseFov, aspect); }
  }
  function setPointer(x, y) { pointer.set(x, y); }
  function click(x, y, t) { if (track) imagery.click(x, y, cam, t + shift + LEAD); }

  const sf = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()}, tf = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()};
  const tmpV = new THREE.Vector3(), eul = new THREE.Euler(), calmC = new THREE.Vector4(.5, .5, .4, .25), calmT = new THREE.Vector4(.5, .5, .4, .25), hitCol = new THREE.Color(), origin = new THREE.Vector3(), hitsAll = [];
  const TAPS = [0, .12, .24, .36];
  let calmK = 0, quietK = 0, focusD = 8;
  const blinkCol = new THREE.Color();
  // the style's elements in the sky and on the water, this frame
  const LF = {shafts: [], shaftCol: new THREE.Color(), beamDir: new THREE.Vector3(), beamCol: new THREE.Color(), gridCol: new THREE.Color(), mistCol: new THREE.Color()}, fwdV = new THREE.Vector3();
  const lookStar = new THREE.Color(), lookEmit = new THREE.Color(), lookNight = new THREE.Color();
  function lookFrame(F, t, LK) {
    const star = lookStar, emit = lookEmit;
    LF.shafts.length = 0;
    if (LK.shafts) { cam.getWorldDirection(fwdV); const yaw = Math.atan2(fwdV.x, -fwdV.z);
      for (const [age, k] of sig.recent('low', t, 3, .55, .32)) { const t0 = t - age, hs = Math.sin(t0 * 91.7) * 43758.5453 % 1; LF.shafts.push([yaw + (Math.abs(hs) - .5) * 1.2, .012 + .02 * k, LK.shafts * k * Math.exp(-age / .075) * 1.5]); } }
    LF.shaftCol.copy(star).lerp(emit, .15);
    LF.beams = (LK.beams || 0) * (.3 + .35 * F.slow); LF.beamDir.copy(shots.title.moonDir); LF.beamCol.copy(emit).lerp(star, .5).multiplyScalar(.4);
    LF.grid = LK.grid || 0; LF.gridCol.copy(emit).lerp(star, .35).multiplyScalar(.5);
    const rk = sig.recent('low', t, 1, .5, 1.3); LF.gridPulse = rk.length ? rk[0][0] / 1.3 : -1;
    LF.mist = LK.mist || 0; LF.mistCol.copy(lookNight).lerp(star, .22).lerp(emit, .1);
    return LF;
  }
  function render(F, {clock = 0, live = 1, capture = false} = {}) {
    if (!track) return;
    const wall = performance.now();
    const gapMs = frameAt ? wall - frameAt : 16;
    frameAt = wall;
    if (!capture) {
      if (gapMs > 48) mirrorLoad = 2;
      else if (gapMs > 32) mirrorLoad = Math.max(mirrorLoad, 1);
      else if (gapMs < 22) mirrorLoad = 0;
    }
    if (PROF) { profT = wall; prof.n++; }
    const t = F.t, lt = t + shift + LEAD;
    // pointer: smoothed, and only in live mode (stills stay deterministic)
    const pIn = !capture && pointer.x > -5;
    pointerSm.lerp(pIn ? pointer : ZERO2, .06);
    shots.setPointer(pIn ? pointerSm.x : 0, pIn ? pointerSm.y : 0);
    shots.camera(t, cam); mark('camera');                              // (place, direction and lens)
    const lensK = cam.userData.lens = Math.tan(cam.fov * Math.PI / 360) / Math.tan(baseFov * Math.PI / 360);
    cam.userData.res = [size.w * renderer.getPixelRatio(), size.h * renderer.getPixelRatio()];
    // song flights (wall clock): arrive low over the water on a bowed path; leave forward into the haze
    let open = 1;
    if (flight && !capture) {
      const k = Math.min(1, (performance.now() - flight.start) / flight.dur), seed = track.vinyl.seed, side = (seed & 1) ? 1 : -1;
      shots.stationFrame(shots.stations[0], tf);
      if (flight.dir === 'in') {
        const e = 1 - ease(k), bow = Math.pow(Math.sin(Math.PI * k), 2);
        cam.position.addScaledVector(tf.u, 2.2 * e + .4 * bow).addScaledVector(tf.n, 14 * e).addScaledVector(tf.r, side * (5 * e + 2.2 * bow));
        open = ease(Math.min(1, k * 1.4)); if (k >= 1) flight = null;
      } else {
        const e = ease(k); tmpV.set(0, 0, -1).applyQuaternion(cam.quaternion);
        cam.position.addScaledVector(tmpV, 9 * e).addScaledVector(tf.u, 1.5 * e); open = 1 - e;
      }
    }
    cam.position.y = Math.max(cam.position.y, shots.waterY + .08);
    cam.updateMatrixWorld();
    const cur = shots.current(t);
    shots.stationFrame(cur, sf); sf.c.addScaledVector(sf.n, shots.rowZ(cur, t));
    // motes
    const u = world.moteMat.uniforms;
    u.uT.value = t; u.uTreble.value = F.high; u.uPower.value = F.rms; u.uSize.value = 34 * renderer.getPixelRatio() * (size.h / 900);
    u.uAspect.value = aspect; u.uPointer.value.copy(pIn ? pointerSm : OFF2); u.uLens.value = lensK;
    ['low', 'mid', 'high'].forEach((band, b) => { const rec = sig.recent(band, t, 3, .3, 3); for (let j = 0; j < 3; j++) { const R = rec[j]; u.uRip.value[b * 3 + j].set(R ? R[0] : -1, R ? R[1] : 0, 0, 0); } });
    u.uRipC.value.copy(sf.c);
    // spectral lines: the spectrum now and a moment, two, three ago; the sound starts where the song is sung
    const ru = world.reedMat.uniforms;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 32; i++) ru.uMel.value[k * 32 + i] = k ? sig.level(MEL_NAMES[i], Math.max(0, t - TAPS[k]), .03, .22) : F.mel[i];
    origin.lerp(sf.c, capture ? 1 : .06); ru.uOrigin.value.copy(origin);
    const LK = track.style?.look || {}, RK = LK.reeds || {};
    ru.uT.value = t; ru.uK.value = (.8 + .3 * F.slow) * (RK.k ?? 1); ru.uLens.value = lensK; ru.uQuant.value = RK.quant || 0; ru.uPx.value = 26 * renderer.getPixelRatio() * (size.h / 900); ru.uHgt.value = RK.h ?? 1; ru.uWhite.value = RK.white || 0;
    world.motes.visible = (LK.motes ?? 1) > .05; u.uSize.value *= Math.sqrt(LK.motes ?? 1);
    cam.userData.pxScale = renderer.getPixelRatio() * (size.h / 900);
    mark('world');
    lyrics.update(F, lt, cam, {capture}); mark('lyrics');
    imagery.update(F, lt, cam, {pointer: pIn ? pointerSm : null}); mark('imagery');
    phrases.update(F, t, cam); mark('figures');
    title.update(F, t, cam);
    sheet.update(t); mark('title+sheet');
    // behind what is being sung the sky and the spectral lines step back: an ellipse around its place on screen
    let want = 0;
    {
      const lay = shots.layOf(cur), th = Math.tan(cam.fov * Math.PI / 360);
      tmpV.copy(sf.c).sub(cam.position); tmpV.y = 0;
      focusD += (Math.max(2, tmpV.length()) - focusD) * (capture ? 1 : .08);
      if (cur.G.plan && cur.G.page) {
        // a page: the water steps back under the whole of it
        const pg = cur.G.page, d = Math.max(.5, cam.position.distanceTo(pg.c));
        tmpV.copy(pg.c).project(cam);
        if (tmpV.z < 1) { calmT.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5, (pg.W / 2 + 1.2) / (d * th * aspect) * .5, (pg.D / 2 + 1) / (d * th) * .5); want = t < cur.b + 1.2 ? 1 : 0; }
      } else if (cur.phantom) {
        // a scene: the sky steps back behind the whole figure
        const d = Math.max(.5, cam.position.distanceTo(sf.c)), hf = lay.hf || lay.h;
        tmpV.copy(cur.scene.c).addScaledVector(sf.u, hf * .45).project(cam);
        if (tmpV.z < 1) { calmT.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5, (lay.w / 2 + 1) / (d * th * aspect) * .5, (hf / 2 + .8) / (d * th) * .5); want = .8; }
      } else if (cur.L || cur.title) {
        const d = Math.max(.5, cam.position.distanceTo(sf.c));
        tmpV.copy(sf.c).addScaledVector(sf.u, cur.title ? HOVER : lay.h * .5).project(cam);
        if (tmpV.z < 1) { calmT.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5, (lay.w / 2 + .9) / (d * th * aspect) * .5, (lay.h / 2 + .7) / (d * th) * .5); want = t < cur.b + 1.2 ? 1 : 0; }
      }
    }
    const kk = capture ? 1 : .08; calmC.lerp(calmT, kk); calmK += (want - calmK) * (capture ? 1 : .05);
    ru.uCalm.value = .6 * calmK; ru.uCalmC.value.copy(calmC);
    // where the music itself is the scene the spectral lines stand down: the figure is the subject
    quietK += ((cur.phantom ? 1 : 0) - quietK) * (capture ? 1 : .035); ru.uQuiet.value = quietK;
    // the MV's screen (mv.js): placed before the mirror pass so it is in the water's picture
    if (track.mv) {
      mvScreen.follow(t, live > 0, capture);
      mvStage.update(cam, {t, ready: mvScreen.ready, aspect: mvScreen.aspect, capture, calm: Math.min(.85, .75 * calmK), calmC, res: [size.w * renderer.getPixelRatio(), size.h * renderer.getPixelRatio()], waterY: shots.waterY, baseFov});
      const MR = mvStage.rect; sky?.tweak({mvRefl: {k: MR.on ? MR.a : 0, tex: mvScreen.tex, rect: MR, hz: MR.horizon}, mvWash: {k: MR.on ? MR.a : 0, grid: mvStage.gridTex, rect: MR}});
    } else sky?.tweak({mvRefl: {k: 0}, mvWash: {k: 0}});
    if (sky && skyP) {
      // the scene's reflection: the same scene through the camera mirrored in the water plane, cut at the waterline
      const wy = shots.waterY, bg = scene.background;
      mirrorCam.fov = cam.fov; mirrorCam.aspect = cam.aspect; mirrorCam.updateProjectionMatrix();
      mirrorCam.position.copy(cam.position); mirrorCam.position.y = 2 * wy - cam.position.y;
      eul.setFromQuaternion(cam.quaternion, 'YXZ'); eul.x = -eul.x; eul.z = -eul.z; mirrorCam.quaternion.setFromEuler(eul);
      mirrorCam.updateMatrixWorld();
      scene.background = black; renderer.clippingPlanes = [clipPlane]; lyrics.shared.uMirror.value = 1; imagery.mirror.value = 1;
      const prevRT = renderer.getRenderTarget();
      // (the low tier draws the reflection every second frame; the water keeps the last one between)
      mirrorTick++;
      const skipMirror = !capture && (mirrorLoad > 1 || (mirrorLoad === 1 && (mirrorTick & 1) === 1));
      if (!skipMirror && (capture || Qt.every < 2 || Qt.n++ % Qt.every === 0)) { renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, mirrorCam); }
      renderer.setRenderTarget(prevRT); renderer.clippingPlanes = []; scene.background = bg; lyrics.shared.uMirror.value = 0; imagery.mirror.value = 0; mark('mirror', true);
      // sky: the song's grade and play mode, breathing with the music; the lake below it
      skyP.tick(F, t, capture);
      const rip = [...sig.recent('low', t, 3, .3, 3), null, null, null].slice(0, 3).concat([...sig.recent('mid', t, 3, .35, 2), null, null, null].slice(0, 3));
      hitCol.copy(lyrics.tone(cur.L?.tone || 'calm').lit);
      hitsAll.length = 0; for (const h of title.hits) hitsAll.push(h); for (const h of lyrics.hits) if (hitsAll.length < 4) hitsAll.push(h); for (const h of phrases.hits) if (hitsAll.length < 4) hitsAll.push(h);
      sky.tweak({look: lookFrame(F, t, LK)});
      sky.tweak({...skyP.live, aurora: skyP.live.aurora * (LK.aurora ?? 1), calm: Math.min(.85, (track.mv ? .75 : .5) * calmK * skyP.live.calmGain), calmC, ripC: sf.c, rip, scene: reflRT.texture, sceneK: .85, hits: hitsAll, hitCol, focusD});
      sky.render(cam, t, t / track.duration, mirrorCam, capture, t); mark('sky', true);
    }
    post.uniforms.uT.value = capture ? t : clock; post.uniforms.uOpen.value = .1 + .9 * open;
    // the blink: shut on the baseline of what is left, open on the baseline of what is come to
    const bk = shots.blinkAt(t);
    post.uniforms.uBlink.value = bk ? bk.k : 0;
    if (bk) { tmpV.copy(bk.x.c).project(cam); post.uniforms.uBlinkY.value = clamp(tmpV.y * .5 + .5, .08, .92); post.uniforms.uBlinkCol.value.copy(blinkCol); post.uniforms.uBlinkLine.value.copy(hitCol); }
    bloom.strength = bloomBase + .14 * F.drive;
    // the style's own finish
    {
      const P = post.uniforms; P.uAspect.value = aspect;
      P.uLookA.value.set(LK.contrast ?? 1, LK.sat ?? 1, LK.scan || 0, LK.halftone || 0);
      let impact = 0, speed = 0;
      if (LK.impact) {
        // the latest hard low beat, if it is the first in its three seconds and the passage is loud
        const rec = sig.recent('low', t, 8, .72, 3.2);
        if (rec.length && rec[0][0] < .12) { const t0 = t - rec[0][0], bk = Math.floor(t0 / 3); if (!rec.slice(1).some(r => Math.floor((t - r[0]) / 3) === bk)) impact = LK.impact * clamp((F.drive - .35) / .3) * (rec[0][0] < .045 ? 1 : .35); }
      }
      const hh = lyrics.heroHit;
      if (LK.pool && hh && hh.p) { const age = t + shift + LEAD - hh.t; if (age >= 0 && age < 1.8) { tmpV.copy(hh.p).project(cam); if (tmpV.z < 1) { P.uSpeedC.value.set(tmpV.x * .5 + .5, tmpV.y * .5 + .5); speed = LK.pool * sm(0, .1, age) * Math.exp(-age / .5); P.uPoolCol.value.copy(col(track.pal.emit)).lerp(col(theme.star), .55); } } }
      P.uLookB.value.set(LK.leak || 0, LK.bokeh || 0, capture ? impact : impact, speed);
      // (MV mode: the finish is laid over the MV too, so it keeps out of the picture's way: no overlays, its colour
      // nearly as it is)
      if (track.mv) { P.uLookA.value.set(1 + ((LK.contrast ?? 1) - 1) * .25, 1 + ((LK.sat ?? 1) - 1) * .25, 0, 0); P.uLookB.value.set(0, 0, 0, speed); }
    }
    composer.render(); mark('composer', true);
  }
  async function prepare(t) { await Promise.all([lyrics.prepareFonts(t, FIG_CHARS), skyReady, imagery.prepare(t)]); }
  // (2026-10-07, v16) Before a song is shown: draw its opening once, unseen, so that what its first seconds need is
  // made now and not on the frames the listener watches: every lyric line of the first `ahead` seconds is set and
  // uploaded, every image and program those frames use is linked; then the sky's loops run live until their
  // decoders deliver, and a few live frames settle the smoothed values. The picture of the song is unchanged: the
  // last frame drawn here is the opening frame itself. Returns early if `current()` turns false.
  async function preroll(at, {onProgress = () => {}, current = () => true, ahead = 8, maxMs = 7000} = {}) {
    if (!track || !sig) return;
    const t0 = performance.now(), next = () => new Promise(r => requestAnimationFrame(r)), end = track.duration - .1;
    const N = Math.ceil(ahead / .5);
    for (let k = 0; k <= N && performance.now() - t0 < maxMs * .6; k++) {
      try { render(sig.at(Math.min(end, at + k * .5)), {capture: true}); } catch (e) { console.warn('preroll', e); }
      onProgress(.6 * k / N); await next(); if (!current()) return;
    }
    try { render(sig.at(at), {capture: true}); } catch {}
    for (let i = 0; performance.now() - t0 < maxMs; i++) {
      render(sig.at(at), {clock: performance.now() / 1000, live: 1});
      onProgress(.6 + .35 * Math.min(1, i / 40)); await next(); if (!current()) return;
      if (i > 12 && !sky?.busy() && !(track.mv && mvScreen.busy())) break;
    }
    // then, until the picture runs smooth: live frames at the opening until 45 in a row come under 22 ms (the
    // decoders are up to speed, nothing is being made any more), or 9 s in all. Loading a little longer is better
    // than a picture that stutters once the song is heard
    let calm = 0, last = performance.now();
    while (calm < 45 && performance.now() - t0 < maxMs + 2000) {
      render(sig.at(at), {clock: performance.now() / 1000, live: 1});
      await next(); if (!current()) return;
      const now = performance.now(), d = now - last; last = now;
      calm = d < 22 ? calm + 1 : 0; onProgress(.95 + .05 * calm / 45);
    }
    if (flight?.dir === 'in') flight.start = performance.now();          // a flight in starts when the song is seen
    onProgress(1);
  }
  return {setQuality, preroll, suspendVisuals() { sky?.suspend(); mvScreen.el.pause(); }, get warmed() { return warmed; }, renderer, scene, cam, setTrack, setScore, setShift, flyOut, render, resize, setPointer, click, prepare, get shots() { return shots; }, get score() { return score; }, get sky() { return skyP; }, get mode() { return shots ? {name: shots.mode, zh: MODES[shots.mode].zh} : null; }, skyBusy: () => !!sky?.busy() || (!!track?.mv && mvScreen.busy()), mvScreen, get mvRect() { return track?.mv ? mvStage.rect : null; }, get flying() { return !!flight; }, get world() { return world; }, lyrics, imagery, phrases, title, sheet};
}
