// The song's title is not a lyric, and it is not staged like one. It is staged as what the song is in this
// instrument: a record.
//   the label    where the song's opening is long enough, the record is first seen from straight above, lying on the
//                lake in the middle of a sheet (sheet.js) like the label of a pressing: the cover cut round, the
//                song's loudness as a ring of ticks, the title on an arc, the artist as a legend all the way round.
//                The lake's own rings of spectral lines lie round it: its grooves. Flat, a piece of print
//   drawn on     one sweep clockwise draws it: the ticks, the legend, and the title's letters as outlines; then a
//                light runs along the title and fills them. While it lies there the title nods to the kick
//   standing up  the camera comes down in front of it while the record lifts off the water (its reflection parts from
//                it) and turns up toward the eye as it rises: it ends hanging over the lake, whole, its lowest edge
//                clear of the water, its reflection under it. The legend, which belonged to the label, is let go
//                (a song that starts singing at once begins here: the record is already hanging there)
//   lift-off     it goes up to be the song's moon: an arc on the sky as the eye sees it (up first, then across to its
//                quarter, receding), never darting sideways while it is near. The title goes with it and is gone
//                when it is too small to read; the ring of ticks stays: the played part lit, the record is the
//                song's clock for the rest of the song, in one quarter of the sky
// (2026-10-07) Each style has its own entrance (shots.js picks it; ?entry= to try one):
//   label    (anime) the label from above, as described: drawn on, stands up
//   drop     (rock) falls out of the dark and stops dead over the water on a hard beat: a ring, a flash; the title
//            stamped in at once
//   turn     (pop) comes in edge on and turns to face the eye like a coin, its label spinning once
//   scan     (electro) scanned in from the top by a bright line while it spins down like a deck stopping; the
//            camera pushes in; the title typed on
//   stamp    (hip-hop) slammed on, large and askew, on the first strong beat; the title stamped on in parts, on beats
//   reflect  (soft) first only its reflection in the stirred water; the eye comes up to it; the title fades in
//   develop  (indie) the cover comes up out of grain like a photograph in the tray
// The camera has a lens of its own here (shots.js). Everything is a function of song time.
import * as THREE from 'three';
import {DISC, MOON, standOf} from './shots.js';
import {coverDisc as styledDisc} from './discface.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const outCubic = x => 1 - Math.pow(1 - clamp(x), 3), inCubic = x => Math.pow(clamp(x), 3);
const outBack = (x, k = 1.2) => { x = clamp(x) - 1; return 1 + (k + 1) * x * x * x + k * x * x; };
const inOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, k) => a + (b - a) * k;
const wrapA = a => ((a % 6.2831853) + 6.2831853 * 1.5) % 6.2831853 - Math.PI;
const CJK = /[぀-ヿ㐀-鿿豈-﫿＀-￯]/;

// ring radii, in disc radii
const R_TICK = 1.04, R_TITLE = 1.24, CAP_TITLE = .27, R_ART = 1.585, CAP_ART = .062, R_MAX = 1.7, SZ = 2048, TN = 1024, CN = 1024;

const VS = `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`;
// while the record stands in the lake nothing of it shows under the waterline (uClip): the lake supplies that half
// (aloft, the moon is only half as bright in the water as in the sky)
const DISC_FS = `uniform sampler2D map; uniform float uA, uGain, uWater, uClip, uMirror, uLie, uScan, uDev, uSpinA; uniform vec3 uScanCol; varying vec2 vUv; varying float vY;
void main(){ if (uClip > .5 && vY < uWater) discard; vec4 c = texture2D(map, vUv); vec3 rgb = c.rgb; float edge = 0.;
  if (uScan < 1.5) { vec2 q = vUv - .5; float y = .5 - (q.y * cos(uSpinA) - q.x * sin(uSpinA)); if (y > uScan) discard; edge = exp(-(uScan - y) * 70.) * step(uScan, .999); }
  if (uDev < .999) { float L = dot(rgb, vec3(.3, .59, .11)), n = fract(sin(dot(floor(vUv * 220.), vec2(12.9898, 78.233))) * 43758.5453);
    float d = smoothstep(0., .7, uDev + (n - .5) * .35 - (1. - L) * .15); rgb = mix(vec3(.05 + .5 * L * L + .12 * n) * vec3(1., .93, .84), mix(vec3(L), rgb, smoothstep(.55, 1., uDev)), d); }
  float a = c.a * uA * (1. - .5 * uMirror * (1. - uClip)) * (1. - uMirror * uLie); if (a < .004) discard; gl_FragColor = vec4(rgb * uGain + uScanCol * edge * 1.6, a); }`;
// (uSweep: drawn on clockwise from the top, 0..1 of the way round)
const RING_FS = `uniform sampler2D map; uniform vec3 uCol; uniform float uA, uWater, uClip, uMirror, uLie, uSweep; varying vec2 vUv; varying float vY;
void main(){ if (uClip > .5 && vY < uWater) discard; vec2 q = vUv - .5; float ang = fract(atan(q.x, q.y) / 6.2831853 + 1.);
  float a = texture2D(map, vUv).a * uA * (1. - .5 * uMirror * (1. - uClip)) * (1. - uMirror * uLie) * smoothstep(0., .03, uSweep - ang); if (a < .004) discard; gl_FragColor = vec4(uCol, a); }`;
// the title: hollow (map2) until the light (at ring angle uFill, 0 = top, clockwise) has passed, then solid (map)
// (uWipe: the angle up to which its outlines have been drawn)
const TITLE_FS = `uniform sampler2D map, map2; uniform vec3 uCol, uHot; uniform float uA, uWater, uClip, uMirror, uLie, uFill, uWipe; varying vec2 vUv; varying float vY;
void main(){ if (uClip > .5 && vY < uWater) discard; vec2 q = vUv - .5; float ang = atan(q.x, q.y);
  float f = smoothstep(-.012, .012, uFill - ang), edge = exp(-abs(ang - uFill) * 30.) + .6 * exp(-abs(ang - uWipe) * 40.) * step(uWipe, 3.);
  float a = mix(texture2D(map2, vUv).a, texture2D(map, vUv).a, f) * uA * smoothstep(-.015, .015, uWipe - ang) * (1. - .5 * uMirror * (1. - uClip)) * (1. - uMirror * uLie); if (a < .004) discard;
  gl_FragColor = vec4(mix(uCol * .86, uCol, f) + uHot * edge * 1.1, a); }`;
// the ticks: angle 0 at the top, clockwise = the song's time; drawn on up to uSweep, lit up to uNow
const TICK_FS = `uniform sampler2D map; uniform vec3 uCol, uHot; uniform float uA, uWater, uClip, uNow, uSweep, uMirror, uLie; varying vec2 vUv; varying float vY;
void main(){ if (uClip > .5 && vY < uWater) discard; vec2 q = vUv - .5; float ang = fract(atan(q.x, q.y) / 6.2831853 + 1.);
  float a = texture2D(map, vUv).a * step(ang, uSweep), played = step(ang, uNow), head = exp(-abs(ang - uNow) * 300.) + exp(-abs(ang - uSweep) * 200.) * step(uSweep, .999);
  a *= uA * (.3 + .55 * played + head) * (1. - .5 * uMirror * (1. - uClip)) * (1. - uMirror * uLie); if (a < .004) discard; gl_FragColor = vec4(mix(uCol, uHot, clamp(played * .65 + head, 0., 1.)), a); }`;

export function createTitle(scene, shared) {
  const group = new THREE.Group(); scene.add(group);
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = (fs, uniforms, order, additive = false) => {
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {map: {value: null}, uA: {value: 0}, uClip: {value: 1}, uLie: {value: 0}, uWater: shared.uWater, uMirror: shared.uMirror, ...uniforms}}));
    m.frustumCulled = false; m.visible = false; m.renderOrder = order; group.add(m);
    return m;
  };
  const halo = mesh(RING_FS, {uCol: {value: new THREE.Color()}, uSweep: {value: 2}}, 2.4, true);
  const disc = mesh(DISC_FS, {uGain: {value: 1}, uScan: {value: 2}, uDev: {value: 1}, uSpinA: {value: 0}, uScanCol: {value: new THREE.Color()}}, 2.6);
  const ticks = mesh(TICK_FS, {uCol: {value: new THREE.Color()}, uHot: {value: new THREE.Color()}, uNow: {value: 0}, uSweep: {value: 0}}, 2.7);
  const ringT = mesh(TITLE_FS, {uCol: {value: new THREE.Color()}, uHot: {value: new THREE.Color()}, map2: {value: null}, uFill: {value: -9}, uWipe: {value: -9}}, 2.8);
  const ringA = mesh(RING_FS, {uCol: {value: new THREE.Color()}, uSweep: {value: 0}}, 2.8);
  const all = [halo, disc, ticks, ringT, ringA];
  let track = null, shots = null, arc = 1, key = '', hitT = 1, beatsT = [];
  const hits = [];

  const canvas = n => { const cv = document.createElement('canvas'); cv.width = cv.height = n; return cv; };
  const texOf = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const setTex = (m, cv) => { m.material.uniforms.map.value?.dispose(); m.material.uniforms.map.value = texOf(cv); };

  // the cover as a picture disc: cut round, fine grooves, a rim (no spindle hole: the user asked for the cover whole)
  function coverDisc(img) {
    const cv = canvas(CN), c = cv.getContext('2d'), R = CN / 2 - 6, o = CN / 2;
    c.save(); c.beginPath(); c.arc(o, o, R, 0, 7); c.clip();
    c.fillStyle = '#1a1a1c'; c.fillRect(0, 0, CN, CN);
    if (img) { const s = Math.max(CN / img.width, CN / img.height), w = img.width * s, h = img.height * s; c.drawImage(img, (CN - w) / 2, (CN - h) / 2, w, h); }
    for (let r = R * .16, i = 0; r < R; r += 4.5, i++) { c.beginPath(); c.arc(o, o, r, 0, 7); c.strokeStyle = `rgba(255,255,255,${.03 + .035 * ((i * .618) % 1)})`; c.lineWidth = 1; c.stroke(); }
    const g = c.createRadialGradient(o, o, R * .5, o, o, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fillRect(0, 0, CN, CN);
    c.restore();
    c.beginPath(); c.arc(o, o, R, 0, 7); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2.5; c.stroke();
    return cv;
  }
  // the song once round: one tick per half degree, as long as that moment is loud
  function tickRing(env) {
    const cv = canvas(TN), c = cv.getContext('2d'), o = TN / 2, ppu = TN / (2 * 1.2), n = 720;
    c.strokeStyle = '#fff'; c.lineCap = 'butt';
    c.globalAlpha = .4; c.lineWidth = 1.2; c.beginPath(); c.arc(o, o, (R_TICK - .012) * ppu, 0, 7); c.stroke();
    for (let i = 0; i < n; i++) {
      const v = env.length ? env[Math.min(env.length - 1, Math.floor(i / n * env.length))] : .3, a = i / n * Math.PI * 2, r0 = R_TICK * ppu, r1 = (R_TICK + .012 + .11 * Math.pow(clamp(v), 1.2)) * ppu;
      c.globalAlpha = .45 + .55 * clamp(v); c.lineWidth = i % 2 ? 1.1 : 1.6;
      c.beginPath(); c.moveTo(o + Math.sin(a) * r0, o - Math.cos(a) * r0); c.lineTo(o + Math.sin(a) * r1, o - Math.cos(a) * r1); c.stroke();
    }
    return cv;
  }
  // text on a ring. glyphs: [{ch, font(px), adv (em)}]; returns the arc it covers (rad)
  const PPU = SZ / (2 * R_MAX);                                      // canvas pixels per disc radius
  const fontT = (ch, px) => (CJK.test(ch) ? {font: `900 ${px * .9}px 'Noto Serif JP','Noto Serif SC',serif`, stretch: 'normal'} : {font: `900 ${px}px 'Archivo','MiSans',sans-serif`, stretch: 'extra-condensed'});
  const fontA = (ch, px) => (CJK.test(ch) ? {font: `400 ${px * .96}px 'MiSans','Noto Sans SC',sans-serif`, stretch: 'normal'} : {font: `500 ${px}px 'IBM Plex Mono',ui-monospace,monospace`, stretch: 'normal'});
  const put = (c, f) => { c.font = f.font; c.fontStretch = f.stretch; };
  function measure(c, str, fontOf, track) { const chars = [...str]; return chars.map(ch => { put(c, fontOf(ch, 100)); return {ch, adv: c.measureText(ch).width / 100 + (ch === ' ' ? 0 : track)}; }); }
  function drawRing(c, glyphs, fontOf, em, radius, from, hollow = false) {
    let ang = from;
    c.fillStyle = c.strokeStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    for (const g of glyphs) {
      const w = g.adv * em / radius;
      if (g.ch !== ' ') {
        c.save(); c.translate(SZ / 2, SZ / 2); c.rotate(ang + w / 2); put(c, fontOf(g.ch, em * PPU));
        // hollow: a line round the outside of the glyph (these faces' contours overlap; a plain stroke shows the seams)
        if (hollow) { c.lineWidth = Math.max(3, em * PPU * .03); c.strokeText(g.ch, 0, -radius * PPU); c.globalCompositeOperation = 'destination-out'; c.fillText(g.ch, 0, -radius * PPU); c.globalCompositeOperation = 'source-over'; }
        else c.fillText(g.ch, 0, -radius * PPU);
        c.restore();
      }
      ang += w;
    }
    return ang - from;
  }
  function titleRing(str) {
    const cv = canvas(SZ), c = cv.getContext('2d'), cv2 = canvas(SZ), c2 = cv2.getContext('2d'), g = measure(c, str.toUpperCase(), fontT, .06), total = g.reduce((s, x) => s + x.adv, 0);
    let em = CAP_TITLE / .7;
    const maxArc = 2.75; let a = total * em / R_TITLE;
    if (a > maxArc) { em = Math.max(.085 / .7, em * maxArc / a); a = total * em / R_TITLE; }
    drawRing(c, g, fontT, em, R_TITLE, -a / 2); drawRing(c2, g, fontT, em, R_TITLE, -a / 2, true);
    return {cv, cv2, arc: a};
  }
  function artistRing(parts) {
    const cv = canvas(SZ), c = cv.getContext('2d'), unit = parts.filter(Boolean).join('  ·  ').toUpperCase() + '  ·  ', g = measure(c, unit, fontA, .3);
    let em = CAP_ART / .7, ua = g.reduce((s, x) => s + x.adv, 0) * em / R_ART;
    if (ua > Math.PI * 2) { em *= Math.PI * 2 / ua; ua = Math.PI * 2; }
    // as many times round as fit, the remainder shared out between the letters
    const n = Math.max(1, Math.floor(Math.PI * 2 / ua)), extra = (Math.PI * 2 / n - ua) * R_ART / em / g.length;
    for (const x of g) x.adv += extra;
    let from = 0;
    for (let i = 0; i < n; i++) from += drawRing(c, g, fontA, em, R_ART, from);
    return cv;
  }
  function haloTex() {
    const cv = canvas(256), c = cv.getContext('2d'), g = c.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.42, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    return cv;
  }

  function setTrack(t, theme, sh) {
    shots = sh;
    const k = t.key + '|' + t.title + '|' + t.artist + '|' + (t.style?.name || '');
    if (k !== key) {
      key = k; track = t;
      // (2026-10-08) every song: its cover as a disc, whole, no hole; its style a ring round it (discface.js)
      setTex(disc, styledDisc(t.cover || t.thumb, t.style?.name, t.pal?.emit, CN));
      setTex(ticks, tickRing(t.env || []));
      const T = titleRing(t.title || ''); arc = T.arc; setTex(ringT, T.cv);
      ringT.material.uniforms.map2.value?.dispose(); ringT.material.uniforms.map2.value = texOf(T.cv2);
      setTex(ringA, artistRing([t.artist, t.album && t.album !== t.title ? t.album : null]));
      if (!halo.material.uniforms.map.value) setTex(halo, haloTex());
    }
    const star = new THREE.Color(theme.star), emit = new THREE.Color(t.pal.emit), hsl = {}; emit.getHSL(hsl);
    const accent = new THREE.Color().setHSL(hsl.h, Math.min(.8, hsl.s * 1.1), Math.max(.74, Math.min(.86, hsl.l)));
    ringT.material.uniforms.uCol.value.copy(star); ringT.material.uniforms.uHot.value.copy(accent);
    ringA.material.uniforms.uCol.value.copy(accent);
    ticks.material.uniforms.uCol.value.copy(star).multiplyScalar(.75); ticks.material.uniforms.uHot.value.copy(accent);
    halo.material.uniforms.uCol.value.copy(emit).multiplyScalar(.55);
    disc.material.uniforms.uScanCol.value.copy(accent);
    // the entrance's own moment: the first hard low beat in its window (drop, stamp)
    const TT = sh.title, on = (t.motion?.onsets?.low || []).filter(o => o[0] > TT.a + .45 && o[0] < TT.a + 2.2 && o[1] >= .45);
    hitT = on.length ? on.reduce((p, o) => (o[1] > p[1] ? o : p))[0] : TT.a + .95;
    beatsT = (t.motion?.onsets?.low || []).filter(o => o[0] > hitT + .2 && o[1] >= .3).map(o => o[0]).slice(0, 4);
  }

  const tgB = {pos: new THREE.Vector3(), look: new THREE.Vector3(), smooth: .5, fov: 42, turnK: 1}, qB = new THREE.Quaternion();
  const P0 = new THREE.Vector3(), dv = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const qE = new THREE.Quaternion(), qN = new THREE.Quaternion(), qL = new THREE.Quaternion(), qF = new THREE.Quaternion(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), m4 = new THREE.Matrix4(), bx = new THREE.Vector3(), bn = new THREE.Vector3(), by = new THREE.Vector3();
  function update(F, t, cam) {
    hits.length = 0;
    if (!track || !shots) return;
    const TT = shots.title, a = TT.a, b = TT.lift, R = DISC, D = TT.s1 - TT.s0;
    // lying on the lake, lifting off it and turning up over it (standOf); then away into the sky
    const S0 = standOf(TT, t), st = S0.st, fl = clamp((t - b) / 3.4), fly = inOut(fl), up = sm(b, b + 1, t), aloft = fl > .004;
    P0.copy(TT.c); P0.y += S0.y;
    // the entrance (before lift-off): an offset over the water, a scale, a spin of the label, a turn about the
    // vertical, how much is shown, a flash
    const EN = TT.entry || 'label', E = clamp((b - a) * .45, .9, 2.6);
    let eY = 0, eS = 1, eSpin = 0, eTurn = 0, eRoll = 0, eA = 1, eFlash = 0, scan = 2, dev = 1;
    if (EN === 'drop') { const f = clamp((t - (hitT - .6)) / .6), af = t - hitT; eA = t < hitT - .6 ? 0 : 1; eY = af < 0 ? 9 * (1 - f * f) : -.22 * Math.exp(-af / .09); eS = af >= 0 ? 1 - .05 * Math.exp(-af / .08) : 1; eFlash = af >= 0 ? Math.exp(-af / .22) : 0; }
    else if (EN === 'turn') { const u = clamp((t - a) / E); eTurn = 1.5708 * (1 - outBack(u, 1.1)); eSpin = 6.2832 * (1 - outCubic(u)); eA = sm(0, .15, u); }
    else if (EN === 'scan') { const u = clamp((t - a - .15) / Math.min(1.6, E)); scan = u >= 1 ? 2 : u; eSpin = 9 * Math.pow(1 - clamp((t - a) / (E * 1.4)), 2.2); }
    else if (EN === 'stamp') { const af = t - hitT; eA = af < 0 ? 0 : 1; eS = af < 0 ? 1.45 : 1 + .45 * Math.pow(1 - clamp(af / .09), 2); eRoll = af < 0 ? -.2 : -.06 - .14 * Math.pow(1 - clamp(af / .09), 2); eFlash = af >= 0 ? .7 * Math.exp(-af / .18) : 0; }
    else if (EN === 'develop') dev = clamp((t - a - .2) / Math.max(1.6, E * 1.1));
    if (!aloft) P0.y += eY;
    // (lying, it settles onto the water as it appears)
    let k = TT.plan ? .95 + .05 * outCubic((t - a) / 1.1) : 1;
    if (aloft) {
      // the way up, as the eye sees it. It keeps the place in the frame it left from (rising in it) while the camera
      // turns away to what comes next, and settles into its quarter of the sky as the camera arrives; it recedes in
      // log distance, the angle it fills shrinking with it, so it is never thrown about while it is still near
      shots.target(b, tgB); m4.lookAt(tgB.pos, tgB.look, UP); qB.setFromRotationMatrix(m4).invert();
      P0.y = TT.c.y + standOf(TT, b).y; dv.subVectors(P0, tgB.pos); const d0 = dv.length(); dv.divideScalar(d0).applyQuaternion(qB);
      const el = Math.asin(clamp(dv.y, -1, 1)) + .07 * Math.pow(Math.sin(Math.PI * fl), 1.4), az = Math.atan2(dv.x, -dv.z);
      dv.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).applyQuaternion(cam.quaternion).lerp(TT.moonDir, inOut(sm(.2, 1, fl))).normalize();
      const dist = Math.exp(lerp(Math.log(d0), Math.log(MOON.dist), fly)), ang = Math.exp(lerp(Math.log(Math.atan(R / d0)), Math.log(MOON.half), fly));
      pos.copy(cam.position).addScaledVector(dv, dist);
      k = dist * Math.tan(ang) / R;
    } else pos.copy(P0);
    const lie = clamp(1 - (S0.y - .014) / .9) * (1 - fly);
    // lying: its top away from the title's side of the lake; standing: facing down the title's axis; aloft it faces
    // the eye, like any moon
    bx.set(Math.cos(TT.th), 0, Math.sin(TT.th)); bn.set(-Math.sin(TT.th), 0, Math.cos(TT.th));
    m4.makeBasis(bx, UP, bn); qN.setFromRotationMatrix(m4);
    m4.makeBasis(bx, by.copy(bn).negate(), UP); qL.setFromRotationMatrix(m4);
    m4.lookAt(cam.position, pos, UP); qF.setFromRotationMatrix(m4);
    q.copy(qL).slerp(qN, st).slerp(qF, inOut(sm(0, .55, fl)));
    if (eTurn) q.premultiply(qE.setFromAxisAngle(UP, eTurn * (TT.dir || 1)));
    if (eRoll && !aloft) q.multiply(qE.setFromAxisAngle(AZ, eRoll * (1 - up)));
    nrm.set(0, 0, 1).applyQuaternion(q);
    k *= eS;
    const set = (m, extent, rot, alpha, off) => {
      m.visible = alpha > .004; if (!m.visible) return;
      m.position.copy(pos).addScaledVector(nrm, off * k); m.quaternion.copy(q); if (rot) m.quaternion.multiply(qz.setFromAxisAngle(AZ, -rot));
      m.scale.set(extent * k, extent * k, 1); const u = m.material.uniforms; u.uA.value = alpha; u.uClip.value = aloft ? 0 : 1; u.uLie.value = lie;
      m.renderOrder = aloft && fly > .6 ? .5 + off : 2.5 + off;        // aloft it is behind everything on the lake
    };
    const seen = sm(a - .1, a + (TT.plan ? .5 : .25), t);
    set(disc, 2 * R * (CN / 2) / (CN / 2 - 6), eSpin, seen * eA, 0); disc.material.uniforms.uGain.value = (.96 - .1 * fly) * (1 + .5 * eFlash);
    disc.material.uniforms.uScan.value = scan; disc.material.uniforms.uDev.value = dev; disc.material.uniforms.uSpinA.value = eSpin;
    set(halo, 2 * R * 2.5, 0, seen * eA * ((.1 + .16 * fly) * (.85 + .3 * F.slow) * (1 - .7 * lie) + .5 * eFlash), -.02);
    // one sweep clockwise draws the ticks and the legend; from then on the played part of the song is lit
    const sweep = EN === 'drop' || EN === 'stamp' ? clamp((t - hitT) / .35) : EN === 'scan' ? clamp((t - a - .3) / .9) : EN === 'reflect' ? clamp((t - a - .6) / 2.6) : clamp((t - (a + .45)) / 1.7);
    ticks.material.uniforms.uSweep.value = sweep; ticks.material.uniforms.uNow.value = t / track.duration;
    set(ticks, 2 * R * 1.2, 0, seen * eA * (.95 - .2 * fly) * (scan < 1.5 ? sm(0, .3, scan) : 1), .01);
    // the title: its outlines are drawn from its first letter to its last, then a light runs along them and fills
    // them; it nods to the kick while it is there; it goes up with the record and is gone when it is too small to read
    const i0 = a + .55, i1 = i0 + clamp(((TT.plan ? TT.s0 : b) - a) * .3, .8, 1.4), gone = sm(b + .7, b + 1.9, t);
    const creep = .06 * (2 * clamp((t - i1) / Math.max(.5, b - i1)) - 1), nod = .03 * F.kick * sm(i1, i1 + .5, t) * (1 - up);
    // (by entrance: drawn and lit; stamped at once; stamped in parts on beats; typed; faded in)
    const W0 = -arc / 2 - .12, W1 = arc / 2 + .12;
    let wipe, fill, tA;
    if (EN === 'drop') { wipe = lerp(W0, W1, clamp((t - hitT) / .22)); fill = wipe; tA = sm(hitT - .02, hitT + .05, t); }
    else if (EN === 'stamp') { const marks = [hitT, ...beatsT].slice(0, 3); let n = 0; for (const m of marks) if (t >= m) n++; wipe = n >= marks.length || n >= 3 ? 9 : lerp(W0, W1, n / Math.min(3, marks.length)); fill = 9; tA = sm(hitT - .02, hitT + .04, t); }
    else if (EN === 'scan') { const u = clamp((t - a - .45) / .9); wipe = u >= 1 ? 9 : lerp(W0, W1, Math.floor(u * 14) / 14); fill = 9; tA = sm(a + .4, a + .5, t); }
    else if (EN === 'reflect') { wipe = 9; fill = 9; tA = sm(a + .9, a + 2.6, t); }
    else { wipe = t > i1 + .1 ? 9 : lerp(-arc / 2 - .1, arc / 2 + .1, outCubic((t - i0) / (i1 - i0))); fill = lerp(-arc / 2 - .2, arc / 2 + .2, clamp((t - (i1 - .2)) / .95)) + (t > i1 + .8 ? 9 : 0); tA = sm(i0, i0 + .2, t); }
    ringT.material.uniforms.uWipe.value = wipe; ringT.material.uniforms.uFill.value = fill;
    set(ringT, 2 * R * R_MAX, creep + nod + (EN === 'stamp' && !aloft ? eRoll * (1 - up) : 0), tA * (1 - gone), .02);
    // the legend: all the way round, turning slowly against the title; it belongs to the label lying on the water
    // and is let go as the record stands up
    ringA.material.uniforms.uSweep.value = clamp((t - (a + .7)) / 1.7) * 1.04;
    set(ringA, 2 * R * R_MAX, -.6 - .05 * (t - a), sm(a + .7, a + 1.1, t) * (1 - sm(.08, .5, st)) * .92, .02);
    // rings on the water where the record settles on it and where it lifts off it (or, hanging there from the
    // start, under it as it appears)
    const rings = EN === 'drop' || EN === 'stamp' ? [[hitT, 1.5]] : EN === 'reflect' ? [[a + .05, 1.3], [a + .9, .7]] : EN === 'scan' ? [[a + .15, .5]] : [[a + .12, TT.plan ? .9 : .7], [TT.plan ? TT.s0 + .2 * D : -9, 1.2]];
    for (const [t0, w] of rings) if (t >= t0 && t < t0 + 1.4) hits.push({x: TT.c.x, z: TT.c.z, age: t - t0, k: w});
  }
  return {setTrack, setShots: s => { shots = s; }, update, hits, get arc() { return arc; }};
}
