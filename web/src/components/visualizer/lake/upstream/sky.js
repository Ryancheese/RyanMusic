// PUBLIC PACKAGE: uses the original project spectral curtain; optional licensed sky media are user-supplied.
// The running studio project and its demo may use a separate noncommercial aurora extension.
// The night sky behind every mode. Nothing here is computed live any more except the aurora: the sky's pictures are
// loops rendered ahead of time (tools/bake_sky.py; 3840×2160, 60 fps, closing on themselves in time) and the page
// plays them and lays them on the sky (personal, non-public, non-commercial use; CC BY-NC-SA 3.0 sources):
//   field   "Starfield (2022)" by jurnip / Jared Berghold (after CBS "Simplicity Galaxy"), shadertoy.com/view/cdj3DW
//           A tile that closes on itself: three times round the horizon (120° each), 67.5° high. No fold, no mirror.
//   arch    "Galaxy/Nebula and Stars" by jgkling, shadertoy.com/view/4llfzj (Milky Way branch)
//           The band itself, laid along a tilted great circle: one arch over the lake, its two feet on the horizon.
//   nebula  "Dusty nebula 4" by Duke with otaviogood's spiral noise, shadertoy.com/view/MsVXWW (ported)
//   kerr    Kerr black hole by baopinsui, shadertoy.com/view/wXdfzj; bloom after sonicether's "Gargantua With HDR
//           Bloom". Baked from close by and set large: its disc is wider than the frame, it stands where the song's
//           choruses face, it comes nearer in the loud passages and flares on the kick.
//           (A song has a nebula, a black hole, or neither.)
// The sky belongs to the world, not to the screen: wherever the camera turns there is another part of it, and the
// arch, the nebula or the black hole, the moon (title.js) and the aurora tell which way one is looking. Each layer
// is graded after the picture (hue, saturation, a tint ramp keeping luminance, gain) in the song's cover colours.
//
// Ours, live: the spectral aurora. A curtain all the way round the horizon: the whole song, once round (it begins
// behind the record, where the title stands, and runs clockwise). Its height and brightness are the loudness of each
// moment, its colour the spectrum; what has been played is lit, what is still to come hangs faint, and the edge
// between them travels round the sky as the song goes.
import * as THREE from 'three';
import {familyOf, grammarOf} from './genre.js';
import {AURORA_GLSL} from './spectral-aurora.js';

const CAM = `uniform mat3 uCamRot; uniform float uTanHalf, uAspect;
vec3 worldRay(vec2 uv){ vec2 n = uv * 2. - 1.; return normalize(uCamRot * vec3(n.x * uTanHalf * uAspect, n.y * uTanHalf, -1.)); }`;
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const SKY_FS = `precision highp float; precision highp int;
varying vec2 vUv;
${CAM}
uniform sampler2D uVF, uVA, uVX, uVY;
uniform vec4 uGF, uGA, uGX, uGY; uniform vec3 uDeepF, uHiF, uDeepA, uHiA, uDeepX, uHiX, uDeepY, uHiY; uniform float uTintF, uTintA, uTintX, uTintY;
uniform float uAzF, uArchOff, uFeatOver, uFeatOver2; uniform vec3 uArchX, uArchP, uArchZ, uFeatR, uFeatU, uFeatD, uFeatR2, uFeatU2, uFeatD2; uniform vec2 uFeatTan, uFeatTan2;
uniform sampler2D uSpec; uniform float uNow, uSecPerRad, uDur, uAurK, uT, uAurN; uniform vec3 uAurLo, uAurHi, uAurF, uAurR, uAurP[4];
uniform vec3 uHorizon, uGround; uniform float uHaze, uExposure, uCalm; uniform vec4 uCalmC;
uniform sampler2D uMvGrid; uniform vec4 uMvRect2; uniform float uMvWash;
uniform vec4 uShaft[3]; uniform float uBeamK; uniform vec3 uBeamDir, uBeamCol, uShaftCol;
vec3 toLin(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }
vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1. - ca); }
vec3 grade(vec3 srgb, vec4 g, vec3 deep, vec3 hi, float tintK){
  vec3 c = toLin(clamp(srgb, 0., 1.));
  c = max(hueRot(c, g.y), 0.);
  float L = dot(c, vec3(.2126, .7152, .0722));
  c = max(mix(vec3(L), c, g.z), 0.);
  vec3 ramp = mix(deep, hi, smoothstep(0., .45, L));
  c = mix(c, ramp / max(dot(ramp, vec3(.2126, .7152, .0722)), 1e-4) * L, tintK);
  return c * g.w * g.x;
}
float hash1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(hash1(i), hash1(i + 1.), f); }
// one curtain: a folded ribbon hanging over the horizon. Round it runs song time; its height and brightness are
// the loudness at that moment (smoothed over ~1 s, so it billows instead of flickering), and its colour rises
// through the spectrum: where a band is loud, that height of the curtain turns to the upper colour.
float spec(float u, float row){ return textureLod(uSpec, vec2(u, (row * 31. + .5) / 32.), 0.).r; }
float energy(float u){
  float d = .5 / uDur, e = 0.;
  for (int i = -2; i <= 2; i++) { float uu = clamp(u + float(i) * d, 0., 1.); e += spec(uu, .06) + spec(uu, .25) + spec(uu, .5) + .5 * spec(uu, .8); }
  return e / 17.5;
}
// a feature picture in the sky: a 16:9 loop centred on FD, FR right and FU2 up, tn the tangents of its half spans.
// G.x is how much of it is there (an act's hand-over fades it); the grade itself runs at full strength
vec3 featLayer(vec3 c, vec3 w, sampler2D tex, vec4 G, vec3 dp, vec3 hi, float tk, vec3 FR, vec3 FU2, vec3 FD, vec2 tn, float over, vec3 dth){
  if (G.x <= 0.) return c;
  vec3 q = vec3(dot(w, FR), dot(w, FU2), dot(w, FD));
  if (q.z <= .05) return c;
  vec2 n = q.xy / q.z / tn;
  if (abs(n.x) >= 1. || abs(n.y) >= 1.) return c;
  vec2 fu = n * .5 + .5; vec3 px = texture2D(tex, fu).rgb;
  // a cloud is soft (a wide tap ring); a black hole keeps every line of its disc
  if (over < .5) { vec2 o = vec2(.0045, .008); px = px * .28 + .18 * (texture2D(tex, fu + o).rgb + texture2D(tex, fu - o).rgb + texture2D(tex, fu + o * vec2(1., -1.)).rgb + texture2D(tex, fu - o * vec2(1., -1.)).rgb); }
  vec3 x = grade(px + dth, vec4(1., G.yzw), dp, hi, tk);
  float r = pow(pow(abs(n.x), 4.) + pow(abs(n.y), 4.), .25);
  float m = over > .5 ? smoothstep(1., .7, r) : smoothstep(1., .82, max(abs(n.x), abs(n.y)));
  return over > .5 ? mix(c, x, m * min(1., G.x)) : c + x * m * G.x;
}
${AURORA_GLSL}
void main(){
  vec3 w = worldRay(vUv);
  vec3 c = vec3(0.);
  if (w.y > -.03) {
    float el = asin(clamp(w.y, 0., 1.));
    // one step of the picture's 8 bits, scattered: no banding in the dark gradients after the grade
    vec3 dth = (vec3(hash2(gl_FragCoord.xy + fract(uT * 7.13) * 61.), hash2(gl_FragCoord.yx + fract(uT * 5.71) * 37.), hash2(gl_FragCoord.xy * 1.7 + fract(uT * 3.31) * 53.)) - .5) / 255.;
    if (uGF.x > 0.) {                     // the field: round the horizon; over 67.5° it turns back on itself and dims
      float v = el / 1.178097, top = 1. - .5 * smoothstep(.9, 1.5, v);
      v = 1. - abs(1. - v);
      // (round the zenith the picture's columns all meet: it fades out there and plain stars take over)
      float pole = smoothstep(.92, 1.22, el / 1.178097);
      c += grade(texture2D(uVF, vec2(atan(w.x, -w.z) / 2.0943951 + uAzF, clamp(v, .002, .998))).rgb + dth, uGF, uDeepF, uHiF, uTintF) * top * (1. - pole);
      if (pole > 0.) { vec3 cell = floor(w * 260.), f = fract(w * 260.) - .5; float hs = hash2(cell.xy + cell.z * 17.31), st = step(.985, hs) * smoothstep(.32, .0, length(f)) * (.35 + .65 * fract(hs * 91.7));
        c += uHiF * st * uGF.x * uGF.w * 1.6 * pole; }
    }
    if (uGA.x > 0.) {                     // the arch: longitude along its own great circle, latitude across it
      vec3 q = vec3(dot(w, uArchX), dot(w, uArchP), dot(w, uArchZ));
      float v = asin(clamp(q.y, -1., 1.)) / 1.0995574 + .5;
      if (v > 0. && v < 1.) c += grade(texture2D(uVA, vec2(atan(q.z, q.x) / 3.14159265 + uArchOff, v)).rgb + dth, uGA, uDeepA, uHiA, uTintA) * smoothstep(0., .1, v) * smoothstep(1., .9, v);
    }
    // the features: two places, so one can hand over to the next within the song (sky.js acts): a nebula, a galaxy
    // or Simplicity's field (added), a black hole (it hides what is behind it)
    c = featLayer(c, w, uVX, uGX, uDeepX, uHiX, uTintX, uFeatR, uFeatU, uFeatD, uFeatTan, uFeatOver, dth);
    c = featLayer(c, w, uVY, uGY, uDeepY, uHiY, uTintY, uFeatR2, uFeatU2, uFeatD2, uFeatTan2, uFeatOver2, dth);
  }
  c = mix(c, uHorizon, exp(-max(w.y, 0.) / .06) * uHaze);
  // (rock) shafts of light struck up the sky on the hard low beats: hard-edged, white, gone in a quarter second
  if (w.y > -.02) for (int i = 0; i < 3; i++) { vec4 S = uShaft[i]; if (S.z <= 0.) continue;
    float az = atan(w.x, -w.z), d = abs(atan(sin(az - S.x), cos(az - S.x))), el = asin(clamp(w.y, 0., 1.));
    c += uShaftCol * S.z * smoothstep(S.y, S.y * .7, d) * (1. - smoothstep(.0, .9, el) * .7) * (.85 + .15 * hash1(floor(el * 90.) + S.x)); }
  // (anime) beams fanning down from the record's place in the sky
  if (uBeamK > 0.) { float d = dot(w, uBeamDir); if (d > 0.) { vec3 bU = normalize(cross(uBeamDir, vec3(0., 1., 0.)) + vec3(0., 0., 1e-4)), bV = cross(bU, uBeamDir); vec3 q = w - uBeamDir * d;
    float ang = atan(dot(q, bV), dot(q, bU)), st = pow(vnoise(ang * 26. + uT * .07), 3.) * .8 + pow(vnoise(ang * 61. - uT * .05), 6.) * .6;
    c += uBeamCol * uBeamK * st * smoothstep(.55, .97, d) * (1. - smoothstep(.985, .998, d)) * smoothstep(-.05, .2, w.y + .1); } }
  if (uAurK > 0.) c += aurora(w) * uAurK;
  // (2026-10-08, MV mode) the picture's light on the night: its edge colours spread over the whole sky, strongest round
  // it, as a screen lights a dark room; the stars and the aurora are seen through it
  if (uMvWash > 0.) { vec2 nd = vUv * 2. - 1., r = (nd - uMvRect2.xy) / uMvRect2.zw;
    vec3 g = pow(texture2D(uMvGrid, clamp(r * .5 + .5, vec2(.02), vec2(.98))).rgb, vec3(2.2));
    float o = length(max(abs(r) - 1., 0.)); c += g * uMvWash * (.025 + .26 * exp(-o * 1.8)) * smoothstep(-.12, .1, w.y); }
  // the sky steps back behind the line being sung (and so does its reflection)
  vec2 cz = (vUv - uCalmC.xy) / max(uCalmC.zw, vec2(.02));
  c *= 1. - uCalm * exp(-dot(cz, cz) * .9);
  gl_FragColor = vec4(c * uExposure, 1.);
}`;

// Finish pass: the lake. One real horizontal plane at world height uWaterY for the whole song. The sky is rendered a
// second time through the camera mirrored in that plane (and so is the scene: stage.js); a water pixel reflects its
// view ray off the rippled surface and looks that direction up in the mirrored pictures. So a reflection always
// starts at the waterline under its object, whatever the camera does, and the sky above the frame is in the water
// when the camera looks down. Ripples: a few crossing swells, and packets that start under the line being sung at
// every onset. Reflections are darker than the sky (Fresnel), darkest looking straight down. Then the song's filter.
const FIN_FS = `precision highp float;
varying vec2 vUv;
${CAM}
uniform sampler2D uSky, uSkyM, uScene; uniform mat3 uCamRotM; uniform vec3 uCamPos; uniform float uWaterY, uT, uMirror, uSceneK, uFocusD; uniform vec3 uRipC, uHitCol; uniform vec4 uRip[6]; uniform vec4 uHit[4];
uniform float uGrid, uGridPulse, uMist; uniform vec3 uGridCol, uMistCol;
uniform sampler2D uMvTex; uniform vec4 uMvRect; uniform float uMvHz, uMvK;
uniform int uFilter; uniform float uFilterK; uniform vec3 uInk0, uInk1, uInk2, uHorizon, uDeep; uniform vec2 uRes; uniform float uCalm; uniform vec4 uCalmC;
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
float bayer(vec2 p){ ivec2 q = ivec2(mod(p, 4.)); int i = q.x + q.y * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + .5) / 16.; }
// where a world direction appears in the mirrored camera's picture (x < -1: behind it)
vec2 inMirror(vec3 d){ vec3 q = transpose(uCamRotM) * d; if (q.z > -1e-3) return vec2(-9.); return vec2(q.x / (-q.z) / (uTanHalf * uAspect), q.y / (-q.z) / uTanHalf) * .5 + .5; }
void main(){
  vec3 w = worldRay(vUv);
  vec3 c = texture2D(uSky, vUv).rgb, sceneAdd = vec3(0.);
  float h = uCamPos.y - uWaterY;
  if (w.y < 0. && h > 0.) {
    float dist = h / max(-w.y, 1e-4);
    vec2 fp = uCamPos.xz + w.xz * dist;                                   // where the view ray meets the water
    float calm = 1. / (1. + dist * .06);                                  // far water is smooth
    vec2 g = vec2(0.);
    g += .010 * vec2(.86, .5) * cos(dot(fp, vec2(.86, .5)) * 1.3 + uT * .6);
    g += .008 * vec2(-.42, .91) * cos(dot(fp, vec2(-.42, .91)) * 2.1 - uT * .47);
    g += .006 * vec2(.2, -.98) * cos(dot(fp, vec2(.2, -.98)) * 3.7 + uT * .83);
    g += .004 * vec2(-.93, -.36) * cos(dot(fp, vec2(-.93, -.36)) * 6.1 - uT * 1.1);
    vec2 rv = fp - uRipC.xz; float r = length(rv); vec2 rn = rv / max(r, 1e-3); float crest = 0.;
    for (int i = 0; i < 6; i++) { vec4 R = uRip[i]; if (R.x < 0.) continue;
      bool low = i < 3; float sp = low ? 2.2 : 3.6, wid = low ? 1. : .55, k = low ? 4.2 : 7.5;
      float dr = r - R.x * sp, env = exp(-dr * dr / (wid * wid)) * exp(-.9 * R.x) / (1. + .25 * r) * R.y;
      g += rn * env * cos(dr * k) * (low ? .02 : .011); crest += env * (.5 + .5 * sin(dr * k)); }
    // every sung word touches the water: a ring from its foot (lyric.js moves the neighbouring words with it)
    float ring = 0.;
    for (int i = 0; i < 4; i++) { vec4 H = uHit[i]; if (H.w <= 0.) continue;
      vec2 hv = fp - H.xy; float hr = length(hv), dr = hr - (.1 + H.z * 1.7), env = exp(-dr * dr / .1) * exp(-H.z * 1.5) * H.w / (1. + .3 * hr);
      g += hv / max(hr, 1e-3) * env * cos(dr * 9.) * .016; ring += exp(-dr * dr / .045) * exp(-H.z * 2.2) * H.w / (1. + .5 * hr); }
    g *= calm;
    vec3 rd = reflect(w, normalize(vec3(-g.x, 1., -g.y))); rd.y = abs(rd.y);
    vec2 uv = inMirror(rd), uv0 = inMirror(vec3(w.x, -w.y, w.z));
    if (uv.x < -5.) uv = uv0;
    vec3 refl = texture2D(uSkyM, clamp(uv, vec2(.002), vec2(.998))).rgb;
    // The sky is far away: a ripple turns its reflection by the ripple's full angle. What stands on the lake is
    // near: its reflection bends in proportion to how far the water point lies in front of it, and not at all
    // where it meets the water. So the picture of the stage joins every object exactly on the waterline.
    // (2026-10-07) how far in front of the object the water point is: 0 at its waterline, toward 1 deep under it
    float under = clamp((uFocusD - dist) / max(uFocusD, 1.), 0., 1.), kS = under * 1.35;
    vec3 rs = reflect(w, normalize(vec3(-g.x * kS, 1., -g.y * kS))); rs.y = abs(rs.y);
    vec2 us = inMirror(rs); if (us.x < -5.) us = uv0;
    // where the mirrored picture ends the reflection fades out instead of being cut
    vec2 ed = min(us, 1. - us); float inPic = smoothstep(0., .03, min(ed.x, ed.y));
    vec2 uc = clamp(us, vec2(.002), vec2(.998)), bl = vec2(0., .0042 + .012 * under);
    float fres = .2 + .72 * pow(1. - clamp(-w.y, 0., 1.), 4.);
    // a reflection, not a copy: smeared down the water, darker than its object (more so looking down into the water),
    // fading as it goes under, a little toward the water's own colour
    vec3 sr = texture2D(uScene, uc).rgb * .3 + (texture2D(uScene, uc + bl).rgb + texture2D(uScene, uc - bl).rgb) * .22 + (texture2D(uScene, uc + 2.2 * bl).rgb + texture2D(uScene, uc - 2.2 * bl).rgb) * .13;
    float sl = luma(sr); sr = mix(vec3(sl), sr, .8);
    sceneAdd = sr * uSceneK * (.2 + .5 * fres) * (1. - .55 * smoothstep(.05, .8, under)) * inPic;
    // the sky's picture in the water steps back behind the line being sung, as the sky itself does
    vec2 cz = (vUv - uCalmC.xy) / max(uCalmC.zw, vec2(.02));
    refl *= 1. - min(1., uCalm * 1.6) * exp(-dot(cz, cz) * .9);
    vec3 water = refl * fres * uMirror + uDeep * (1. - fres) + uHorizon * crest * .35 * calm + uHitCol * ring * .1;
    c = mix(water, uHorizon * 1.15, exp(-(-w.y) / .008) * .55);          // the horizon stays a clean line of light
    // (MV mode) the screen over the far water, mirrored under the horizon in the moving water
    if (uMvK > 0.) { vec2 nd = vUv * 2. - 1.; float below = uMvHz - nd.y;
      if (below > 0.) { vec2 q = (vec2(nd.x, uMvHz + below) - uMvRect.xy) / uMvRect.zw * .5 + .5 + g * 5.;
        vec2 e = min(q, 1. - q); float m = smoothstep(0., .02, e.x) * smoothstep(0., .03, e.y);
        if (m > 0.) c += pow(texture2D(uMvTex, clamp(q, vec2(.002), vec2(.998))).rgb, vec3(2.2)) * m * uMvK * .34 * exp(-below * 2.2) * (.45 + .55 * fres); } }
    // (electro) a lit grid on the water, and a pulse running out over it from the stage on the beat
    if (uGrid > 0.) { vec2 gp = fp / 1.6, gw = fwidth(gp) * 1.3; vec2 ln = 1. - smoothstep(vec2(0.), gw, abs(fract(gp - .5) - .5));
      float gl = max(ln.x, ln.y) * exp(-dist * .035) * smoothstep(0., .02, -w.y), rr = length(fp - uRipC.xz), pulse = exp(-pow(rr - uGridPulse * 22., 2.) / 3.) * step(.0, uGridPulse) * (1. - uGridPulse);
      c += uGridCol * gl * uGrid * (.28 + 1.6 * pulse); }
  }
  // (soft) a low mist lying on the water and over the horizon, drifting
  if (uMist > 0.) { float m = exp(-abs(w.y + .012) / .05) * (.6 + .4 * sin(atan(w.x, -w.z) * 5. + uT * .05) * sin(atan(w.x, -w.z) * 11. - uT * .03)); c = mix(c, uMistCol, clamp(m * .55 * uMist, 0., .7)); }
  // the song's filter (on the sky and the water, not on the reflected type)
  float L = luma(c);
  vec3 f = c;
  if (uFilter == 1) { f = mix(uInk0, uInk1, smoothstep(.0, .22, L)); f = mix(f, uInk2, smoothstep(.22, .6, L)); f *= .35 + 2.2 * L / max(.05, luma(f) + .02) * .35; }
  else if (uFilter == 2) { float sat = length(c - vec3(L)) / max(L, .02); vec3 grey = vec3(L) * mix(vec3(1.), uInk1 / max(luma(uInk1), .01), .25); f = mix(grey, c, smoothstep(.35, .9, sat) * .6); }
  else if (uFilter == 3) { float lv = pow(L * 3.2, .6) * 2. + bayer(gl_FragCoord.xy / 2.) - .5; f = lv < 1. ? uInk0 : lv < 2. ? uInk1 * .55 : uInk2 * .9; f = mix(f, c, .25); }
  else if (uFilter == 4) { float cell = 6., rr = length(fract(gl_FragCoord.xy / cell) - .5); float dot_ = smoothstep(.04, -.04, rr - .62 * sqrt(clamp(L * 3.2, 0., 1.))); f = mix(uInk0, uInk2, dot_) ; f = mix(f, c, .3); }
  c = mix(c, f, uFilterK * smoothstep(.03, .25, L));
  gl_FragColor = vec4(c + sceneAdd, 1.);
}`;

const lin = c => new THREE.Color(c);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** A sky layer's grade: weight, hue (rad), saturation, gain, tint ramp (deep → hi) and its mix; where in its loop it starts. */
export const LAYER = (o = {}) => ({k: 0, hue: 0, sat: 1, gain: 1, tintK: 0, deep: lin('#05060a'), hi: lin('#9fb8ff'), phase: 0, ...o});
/** the loops (tools/bake_sky.py): how much of the sky a picture covers */
// (2026-10-08) seven loops. The three new ones (assets/shadertoy-backups-2k4k60, CC BY-NC-SA 3.0, credits there):
//   pegasus      "Pegasus Galaxy" by frankenburgh, shadertoy.com/view/lty3Rt: a spiral galaxy, added to the sky
//   gargantua    "Gargantua With HDR Bloom" by sonicether, shadertoy.com/view/lstSRS: a black hole, over the sky
//   simplicity   "Simplicity Galaxy" by CBS (calm cut, no flicker), shadertoy.com/view/MslGWN: a wide field of colour
export const LOOPS = {
  field: {tile: true},
  arch: {tile: true},
  nebula: {span: [92, 51.75], over: false},
  kerr: {file: 'kerr_near', span: [92, 51.75], over: true},
  pegasus: {span: [100, 56.25], over: false},
  gargantua: {span: [98, 55.1], over: true},
  simplicity: {span: [124, 69.75], over: false},
};
export const FEATS = ['nebula', 'kerr', 'pegasus', 'gargantua', 'simplicity'];
// which size of a loop is played: the 4K originals on the high tier, the 2560 x 1440 bakes below it and on phones
// (app.js puts the tier on <html data-tier>)
// (2026-10-08) the 2560 x 1440 bakes are already native for these soft, graded skies on a canvas up to about 2600
// device px wide, and decode and upload at half the cost: the 4K originals play only on the high tier on wider canvases
export const loopSrc = name => {
  const t = document.documentElement.dataset.tier, wide = innerWidth * Math.min(2, devicePixelRatio || 1) > 2600;
  const big = (!t || t === 'high') && wide;
  return `/p/sky/${LOOPS[name].file || name}${big ? '' : '@1440p60'}.mp4`;
};

// loops: false leaves out the baked video loops only (a phone cannot decode 4K 60 fps); the aurora and haze stay
export async function createSky(renderer, {layers = true, loops: withLoops = true} = {}) {
  const camU = () => ({uCamRot: {value: new THREE.Matrix3()}, uTanHalf: {value: .4}, uAspect: {value: 16 / 9}});
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.PlaneGeometry(2, 2);
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, depthBuffer: false});
  const out = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, depthBuffer: false});
  const rtM = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, depthBuffer: false});
  const V3 = () => ({value: new THREE.Vector3()}), C3 = () => ({value: new THREE.Color()}), V4 = () => ({value: new THREE.Vector4()});
  const U = {...camU(), uVF: {value: blank}, uVA: {value: blank}, uVX: {value: blank}, uVY: {value: blank}, uGF: V4(), uGA: V4(), uGX: V4(), uGY: V4(),
    uDeepF: C3(), uHiF: C3(), uDeepA: C3(), uHiA: C3(), uDeepX: C3(), uHiX: C3(), uDeepY: C3(), uHiY: C3(), uTintF: {value: 0}, uTintA: {value: 0}, uTintX: {value: 0}, uTintY: {value: 0},
    uAzF: {value: 0}, uArchOff: {value: 0}, uFeatOver: {value: 0}, uFeatOver2: {value: 0}, uArchX: V3(), uArchP: V3(), uArchZ: V3(), uFeatR: V3(), uFeatU: V3(), uFeatD: V3(), uFeatTan: {value: new THREE.Vector2(1, 1)},
    uFeatR2: V3(), uFeatU2: V3(), uFeatD2: V3(), uFeatTan2: {value: new THREE.Vector2(1, 1)},
    uSpec: {value: blank}, uNow: {value: 0}, uSecPerRad: {value: 20}, uDur: {value: 1}, uAurK: {value: 0}, uT: {value: 0}, uAurN: {value: 32},
    uAurLo: C3(), uAurHi: C3(), uAurP: {value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()]}, uAurF: {value: new THREE.Vector3(0, 0, -1)}, uAurR: {value: new THREE.Vector3(1, 0, 0)},
    uHorizon: C3(), uGround: C3(), uHaze: {value: .5}, uExposure: {value: 1}, uCalm: {value: 0}, uCalmC: {value: new THREE.Vector4(.5, .5, .4, .25)},
    uMvGrid: {value: blank}, uMvRect2: {value: new THREE.Vector4(0, .3, .5, .5)}, uMvWash: {value: 0},
    uShaft: {value: Array.from({length: 3}, () => new THREE.Vector4(0, .02, 0, 0))}, uShaftCol: C3(), uBeamK: {value: 0}, uBeamDir: {value: new THREE.Vector3(0, .3, -1).normalize()}, uBeamCol: C3(),
  };
  let fragmentShader = SKY_FS;
  if (new URLSearchParams(location.search).has('externalAurora')) {
    const response = await fetch('/p/shaders/user-aurora.glsl');
    if (!response.ok) throw new Error('User-supplied aurora shader is missing.');
    fragmentShader = SKY_FS.replace(AURORA_GLSL, await response.text());
  }
  const mat = new THREE.ShaderMaterial({vertexShader: VS, fragmentShader, uniforms: U, depthTest: false, depthWrite: false});
  const scene = new THREE.Scene(), mesh = new THREE.Mesh(quad, mat); mesh.frustumCulled = false; scene.add(mesh);
  const FU = {...camU(), uSky: {value: rt.texture}, uScene: {value: blank}, uSceneK: {value: 0}, uSkyM: {value: rtM.texture}, uCamRotM: {value: new THREE.Matrix3()}, uCamPos: {value: new THREE.Vector3()}, uWaterY: {value: -1.05}, uDeep: {value: new THREE.Color()}, uT: {value: 0}, uMirror: {value: 1}, uFocusD: {value: 8}, uHitCol: {value: new THREE.Color()}, uHit: {value: Array.from({length: 4}, () => new THREE.Vector4(0, 0, 0, 0))}, uRipC: {value: new THREE.Vector3()},
    uRip: {value: Array.from({length: 6}, () => new THREE.Vector4(-1, 0, 0, 0))}, uFilter: {value: 0}, uFilterK: {value: 0}, uInk0: {value: new THREE.Color()}, uInk1: {value: new THREE.Color()}, uInk2: {value: new THREE.Color()},
    uHorizon: {value: new THREE.Color()}, uRes: {value: new THREE.Vector2()}, uCalm: {value: 0}, uCalmC: {value: new THREE.Vector4(.5, .5, .4, .25)},
    uGrid: {value: 0}, uGridPulse: {value: -1}, uGridCol: {value: new THREE.Color()}, uMist: {value: 0}, uMistCol: {value: new THREE.Color()},
    uMvTex: {value: blank}, uMvRect: {value: new THREE.Vector4(0, .3, .5, .5)}, uMvHz: {value: 0}, uMvK: {value: 0}};
  const finMat = new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FIN_FS, uniforms: FU, depthTest: false, depthWrite: false, glslVersion: null});
  const finScene = new THREE.Scene(), finMesh = new THREE.Mesh(quad, finMat); finMesh.frustumCulled = false; finScene.add(finMesh);
  let p = null;

  // ---- the loops: one <video> each, made when a song first asks for it, paused while no song uses it ----
  const loops = new Map();
  let active = [], lastClock = null;
  function loop(name) {
    let L = loops.get(name);
    if (L) return L;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = loopSrc(name);
    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.NoColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    if (LOOPS[name].tile) tex.wrapS = THREE.RepeatWrapping;
    L = {name, v, tex, phase: 0, rate: 1, failed: false};
    v.addEventListener('seeked', () => { tex.needsUpdate = true; });
    v.addEventListener('error', () => { L.failed = true; console.warn('sky loop missing:', name); });
    loops.set(name, L);
    return L;
  }
  const okay = L => !L.failed && L.v.readyState >= 2;
  const wrap = (x, d) => ((x % d) + d) % d;

  function setCam(u, cam) { u.uCamRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(cam.quaternion)); u.uTanHalf.value = Math.tan(cam.fov * Math.PI / 360); u.uAspect.value = cam.aspect; }
  function layer(L, g, deep, hi, tint) { U[g].value.set(L.k, L.hue, L.sat, L.gain); U[deep].value.copy(L.deep); U[hi].value.copy(L.hi); U[tint].value = L.tintK; }
  const slots = [['field', 'uVF', 'uGF'], ['arch', 'uVA', 'uGA']];
  // ---- the acts (2026-10-08): a song's sky changes at its loud passages; two feature places hand over ----
  const FS = {X: {tex: 'uVX', g: 'uGX', deep: 'uDeepX', hi: 'uHiX', tint: 'uTintX', R: 'uFeatR', U: 'uFeatU', D: 'uFeatD', tan: 'uFeatTan', over: 'uFeatOver', base: new THREE.Vector2(1, 1), act: -2, L: null},
    Y: {tex: 'uVY', g: 'uGY', deep: 'uDeepY', hi: 'uHiY', tint: 'uTintY', R: 'uFeatR2', U: 'uFeatU2', D: 'uFeatD2', tan: 'uFeatTan2', over: 'uFeatOver2', base: new THREE.Vector2(1, 1), act: -2, L: null}};
  const mul = {uGF: 1, uGA: 1, uGX: 0, uGY: 0}, HO = 5;              // HO: seconds a hand-over takes, centred on the act's start
  let base = [];
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function placeFeat(S, f) {
    const D = f.dir.clone().normalize(), R = new THREE.Vector3().crossVectors(D, new THREE.Vector3(0, 1, 0)).normalize(), Up = new THREE.Vector3().crossVectors(R, D).normalize();
    R.applyAxisAngle(D, f.roll || 0); Up.applyAxisAngle(D, f.roll || 0);
    const sp = LOOPS[f.name].span, z = f.zoom || 1;
    U[S.R].value.copy(R); U[S.U].value.copy(Up); U[S.D].value.copy(D); U[S.over].value = LOOPS[f.name].over ? 1 : 0;
    S.base.set(Math.tan(sp[0] * z * Math.PI / 360), Math.tan(sp[1] * z * Math.PI / 360)); U[S.tan].value.copy(S.base);
    layer(f, S.g, S.deep, S.hi, S.tint);
  }
  function stageActs(t) {
    const acts = p?.acts; if (!acts?.length) return;
    let i = 0; while (i + 1 < acts.length && t >= acts[i + 1].t0 - HO / 2) i++;
    const a = acts[i], prev = acts[i - 1], next = acts[i + 1], kIn = prev ? smooth((t - (a.t0 - HO / 2)) / HO) : 1;
    // the tile layers' weights move from the last act's to this one's
    mul.uGF = prev ? prev.field + (a.field - prev.field) * kIn : a.field; mul.uGA = prev ? prev.arch + (a.arch - prev.arch) * kIn : a.arch;
    for (const key of ['X', 'Y']) {
      const S = FS[key]; let j = -1, k = 0;
      if (a.slot === key) { j = i; k = kIn; }
      else if (prev?.slot === key && kIn < 1) { j = i - 1; k = 1 - kIn; }
      else if (next?.slot === key && t > next.t0 - HO / 2 - 4) { j = i + 1; k = 0; }   // its loop starts before it is seen
      if (j !== S.act) {
        S.act = j; S.L = null;
        // (a phone plays only the light features: withLoops 'feat')
        if (j >= 0) { const f = acts[j].feat; placeFeat(S, f); if (layers && (withLoops === true || withLoops === 'feat' && ['gargantua', 'nebula', 'kerr'].includes(f.name))) { S.L = loop(f.name); S.L.phase = f.phase || 0; S.L.slot = [S.tex, S.g, f.k]; } }
      }
      mul[S.g] = k; if (!S.L) U[S.g].value.x = 0;
    }
    active = base.concat([FS.X.L, FS.Y.L].filter(Boolean));
  }
  return {
    texture: out.texture,
    // The song clock keeps advancing while hidden. Save the current phase/rate and catch up once,
    // before resuming the same loop; foreground playback and its rate curve are unchanged.
    suspend() { for (const L of active) { if (!L.v.paused) L.resume = {time: L.v.currentTime, clock: lastClock, rate: L.v.playbackRate}; L.v.pause(); } },
    /** w, h: CSS pixels (the sky is soft; it does not need device pixels) */
    resize(w, h) { const k = Math.min(1, 1920 / w); rt.setSize(Math.round(w * k), Math.round(h * k)); out.setSize(Math.round(w * k), Math.round(h * k)); FU.uRes.value.set(w * k, h * k); rtM.setSize(Math.round(w * k / 2), Math.round(h * k / 2)); },
    /** params: {field, arch (LAYER), feat: LAYER + {name, dir, roll, zoom} | null, archPole, archFoot, archOff, az, aurora: {k, lo, hi},
     *  horizon, ground, haze, calm, exposure, filter, mirror, waterY}; spec: mel history texture; dur: song length; fwd: the way the title faces */
    set(params, spec, dur, fwd) {
      p = params;
      lastClock = null; for (const L of loops.values()) L.resume = null;
      layer(p.field, 'uGF', 'uDeepF', 'uHiF', 'uTintF'); layer(p.arch, 'uGA', 'uDeepA', 'uHiA', 'uTintA'); layer(p.feat || LAYER(), 'uGX', 'uDeepX', 'uHiX', 'uTintX');
      U.uAzF.value = p.az || 0; U.uArchOff.value = p.archOff || 0;
      // the arch: its great circle crosses the horizon at archFoot and leans over to its pole's far side
      const P = p.archPole.clone().normalize(), X = p.archFoot.clone().addScaledVector(P, -p.archFoot.dot(P)).normalize(), Z = new THREE.Vector3().crossVectors(X, P).normalize();
      if (Z.y < 0) Z.negate();
      U.uArchX.value.copy(X); U.uArchP.value.copy(P); U.uArchZ.value.copy(Z);
      U.uSpec.value = spec || blank; U.uDur.value = dur; U.uAurK.value = p.aurora.k; U.uAurLo.value.copy(p.aurora.lo); U.uAurHi.value.copy(p.aurora.hi); (p.aurora.flow || [p.aurora.lo, p.aurora.hi, p.aurora.lo, p.aurora.hi]).forEach((c, i) => U.uAurP.value[i].copy(c));
      U.uSecPerRad.value = p.aurora.secPerRad || 22;
      const f = fwd.clone().setY(0).normalize(); U.uAurF.value.copy(f); U.uAurR.value.crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
      U.uHorizon.value.copy(p.horizon); U.uGround.value.copy(p.ground); U.uHaze.value = p.haze; U.uCalm.value = p.calm || 0; U.uExposure.value = p.exposure ?? 1;
      FU.uFilter.value = p.filter?.id || 0; FU.uFilterK.value = p.filter?.k || 0; FU.uMirror.value = p.mirror ?? 1; FU.uHorizon.value.copy(p.horizon); FU.uDeep.value.copy(p.ground); FU.uWaterY.value = p.waterY ?? -1.05;
      if (p.filter) { FU.uInk0.value.copy(p.filter.ink[0]); FU.uInk1.value.copy(p.filter.ink[1]); FU.uInk2.value.copy(p.filter.ink[2]); }
      // the tile layers this song plays (a phone plays none: withLoops 'feat'); the features are put in their places
      // act by act (stageActs); the loops nobody uses rest
      base = [];
      for (const [key, tex, g] of slots) {
        const P2 = p[key];
        if (!layers || withLoops !== true || !P2 || !(P2.k > 0)) { U[g].value.x = 0; continue; }
        const L = loop(key); L.phase = P2.phase || 0; L.slot = [tex, g, P2.k]; base.push(L);
      }
      for (const S of Object.values(FS)) { S.act = -2; S.L = null; U[S.g].value.x = 0; }
      active = base.slice(); stageActs(0);
      // without the sky layers: no pictures and no aurora, a plain night with the horizon's haze over the same lake
      if (!layers) { U.uAurK.value = 0; U.uHaze.value = .8; }
    },
    /** how many layers the aurora is drawn with (the picture's tier: 32 high, 20 mid, 12 low) */
    setAuroraLayers(n) { U.uAurN.value = n; },
    /** live tweaks per frame: aurora strength, exposure, calm, how fast the loops run, how far the field has turned */
    tweak(o) {
      if (o.aurora != null) U.uAurK.value = layers ? o.aurora : 0; if (o.exposure != null) U.uExposure.value = o.exposure; if (o.calm != null) { U.uCalm.value = o.calm; FU.uCalm.value = o.calm; } if (o.calmC) { U.uCalmC.value.copy(o.calmC); FU.uCalmC.value.copy(o.calmC); }
      if (o.az != null) U.uAzF.value = o.az; if (o.rate != null) for (const L of active) L.rate = o.rate;
      // (the black holes come nearer and flare with the song: whichever place holds one)
      if (p?.acts && (o.featZoom != null || o.featGain != null)) for (const S of Object.values(FS)) {
        const f = S.act >= 0 ? p.acts[S.act]?.feat : null; if (!f || !LOOPS[f.name].over) continue;
        if (o.featZoom != null) U[S.tan].value.copy(S.base).multiplyScalar(o.featZoom); if (o.featGain != null) U[S.g].value.w = f.gain * o.featGain;
      }
      if (o.scene !== undefined) { FU.uScene.value = o.scene || blank; FU.uSceneK.value = o.scene ? (o.sceneK ?? .8) : 0; }
      if (o.focusD != null) FU.uFocusD.value = o.focusD; if (o.hitCol) FU.uHitCol.value.copy(o.hitCol);
      if (o.hits) for (let i = 0; i < 4; i++) { const h = o.hits[i]; FU.uHit.value[i].set(h ? h.x : 0, h ? h.z : 0, h ? h.age : 0, h ? h.k : 0); }
      if (o.mvWash) { U.uMvWash.value = o.mvWash.k || 0; if (o.mvWash.k > 0) { U.uMvGrid.value = o.mvWash.grid; U.uMvRect2.value.set(o.mvWash.rect.cx, o.mvWash.rect.cy, o.mvWash.rect.hw, o.mvWash.rect.hh); } }
      if (o.mvRefl) { const M = o.mvRefl; FU.uMvK.value = M.k || 0; if (M.k > 0) { FU.uMvTex.value = M.tex; FU.uMvRect.value.set(M.rect.cx, M.rect.cy, M.rect.hw, M.rect.hh); FU.uMvHz.value = M.hz; } }
      if (o.ripC) FU.uRipC.value.copy(o.ripC); if (o.rip) o.rip.forEach((r, i) => FU.uRip.value[i].set(r ? r[0] : -1, r ? r[1] : 0, 0, 0));
      // the style's own elements (genre.js LOOKS): shafts [[az, half width, strength]], beams {k, dir, col}, grid, mist
      if (o.look) { const L = o.look; for (let i = 0; i < 3; i++) { const s = L.shafts?.[i]; U.uShaft.value[i].set(s ? s[0] : 0, s ? s[1] : .02, s ? s[2] : 0, 0); }
        if (L.shaftCol) U.uShaftCol.value.copy(L.shaftCol); U.uBeamK.value = L.beams || 0; if (L.beamDir) U.uBeamDir.value.copy(L.beamDir); if (L.beamCol) U.uBeamCol.value.copy(L.beamCol);
        FU.uGrid.value = L.grid || 0; FU.uGridPulse.value = L.gridPulse ?? -1; if (L.gridCol) FU.uGridCol.value.copy(L.gridCol); FU.uMist.value = L.mist || 0; if (L.mistCol) FU.uMistCol.value.copy(L.mistCol); }
    },
    /** stills are waiting for a loop to reach its frame */
    busy() { return active.some(L => !L.failed && (L.v.readyState < 2 || L.v.seeking)); },
    /** mirror: the camera mirrored in the water plane (the same sky, seen from below the waterline).
     *  still: the sky's own time is set (stills, seeking while paused); otherwise the loops simply play. */
    render(cam, t, now, mirror, still, clock = t) {
      if (!p) return;
      stageActs(t);
      for (const L of loops.values()) if (!active.includes(L) && !L.v.paused) L.v.pause();
      for (const L of active) {
        const v = L.v, d = v.duration || 24;
        if (L.resume && !document.hidden) {
          const saved = L.resume; L.resume = null;
          if (!still && v.readyState >= 1 && saved.clock != null) v.currentTime = wrap(saved.time + Math.max(0, clock - saved.clock) * saved.rate, d - .02);
        }
        if (still) {
          if (!v.paused) v.pause();
          const want = wrap(L.phase + clock, d - .02);
          if (v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - want) > .012) v.currentTime = want;
        } else if (!document.hidden) {
          if (v.paused) { if (v.readyState >= 1 && v.currentTime === 0 && L.phase) v.currentTime = wrap(L.phase, d - .02); v.play().catch(() => {}); }
          if (Math.abs(v.playbackRate - L.rate) > .05) v.playbackRate = L.rate;
        }
        const [tex, g, k] = L.slot;
        U[tex].value = okay(L) ? L.tex : blank; U[g].value.x = okay(L) ? k * (mul[g] ?? 1) : 0;
      }
      lastClock = clock;
      const prev = renderer.getRenderTarget();
      U.uT.value = t; U.uNow.value = now;
      if (mirror) {
        // (the lake's picture of the sky: the aurora with half its layers; the water blurs it anyway)
        const calm = U.uCalm.value, aN = U.uAurN.value; U.uCalm.value = 0; U.uAurN.value = Math.max(6, Math.round(aN / 2));
        setCam(U, mirror); renderer.setRenderTarget(rtM); renderer.render(scene, ortho);
        U.uCalm.value = calm; U.uAurN.value = aN; FU.uCamRotM.value.copy(U.uCamRot.value);
      }
      setCam(U, cam);
      renderer.setRenderTarget(rt); renderer.render(scene, ortho);
      setCam(FU, cam); FU.uCamPos.value.copy(cam.position); FU.uT.value = t;
      renderer.setRenderTarget(out); renderer.render(finScene, ortho);
      renderer.setRenderTarget(prev);
    },
  };
}

// ---- a song's sky: which pictures, graded how, filtered how, moving how -------------------------------------
// Four skies. Which one a song gets comes from its cover (a warm cover leans to the open star field with its warm
// filaments, a cool one to the arch, a colourful one to the nebula; a grey one keeps silver stars) and from what
// kind of song it is (the heavy and the electronic lean to the black hole, and so does a dark, driving song of any
// family); among what fits, the song's own number decides. ?sky=stars|arch|nebula|kerr sets it by hand.
//   stars   the field alone, the arch faint behind it
//   arch    the Milky Way's arch over the lake, the field dim
//   nebula  one cloud in the quarter of the sky opposite the moon
//   kerr    the black hole low over the horizon opposite the moon, its disc in the water
const FILTERS = {grade: 0, duotone: 1, mono: 2, dither: 3, halftone: 4};
const KERR_FAM = {'摇滚': 1.5, '电子': 1.4, '原声带': 1.1, '二次元': .9, '另类/独立': .9, '嘻哈说唱': .7, 'R&B': .5, '流行': .45, '爵士': .3, '轻音乐': .25, '世界乐器体裁': .25};
const rng2 = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// A song cut into acts at its sections (sig.sections, automatic candidates: similar sections share a letter), or at
// its loud passages when it has no sections; none shorter than 14 s, at most eight. Each act: its time, whether it is
// loud (its energy over the song's median), its letter (a section that comes back comes back to its own sky).
function actsOf(dur, sections, phases) {
  let segs = [];
  if (sections?.length > 1) {
    const en = sections.map(x => x.energy).sort((a, b) => a - b), med = en[en.length >> 1] || 0;
    for (const x of sections) { const L = segs[segs.length - 1]; if (L && L[3] === x.label) L[1] = x.end; else segs.push([x.start, x.end, x.energy > med * 1.12, x.label]); }
  } else {
    let t = 0;
    for (const [a, b] of [...phases].sort((x, y) => x[0] - y[0])) { if (a > t) segs.push([t, a, false, 'q']); if (b > Math.max(a, t)) segs.push([Math.max(a, t), b, true, 'L']); t = Math.max(t, b); }
    if (t < dur) segs.push([t, dur, false, 'q']);
    if (!phases.length && dur > 150) segs = [[0, dur / 3, false, 'a'], [dur / 3, dur * 2 / 3, true, 'b'], [dur * 2 / 3, dur, false, 'c']];
  }
  if (!segs.length) segs = [[0, dur, false, 'a']];
  segs[0][0] = 0; segs[segs.length - 1][1] = Math.max(segs[segs.length - 1][1], dur);
  for (let i = 0; i < segs.length && segs.length > 1; i++) if (segs[i][1] - segs[i][0] < 14) { if (i > 0) segs[i - 1][1] = segs[i][1]; else segs[1][0] = segs[0][0]; segs.splice(i, 1); i = -1; }
  while (segs.length > 8) { let k = 1; for (let i = 1; i < segs.length; i++) if (segs[i][1] - segs[i][0] < segs[k][1] - segs[k][0]) k = i; segs[k - 1][1] = segs[k][1]; segs.splice(k, 1); }
  return segs.map(([t0, t1, loud, label]) => ({t0, t1, loud, label}));
}
export function skyFor(track, sig, shots, theme, force) {
  const pal = track.pal, M = track.motion, ch = sig.character, r = rng2((track.vinyl?.seed || 7) ^ 0x51);
  const c = h => new THREE.Color(h), emit = c(pal.emit), deep = c(pal.deep), light = c(pal.light), second = c(pal.second || pal.ramp[0]);
  const night = c(theme.night).lerp(c(pal.night), .6).lerp(deep, .1);
  const cl = (pal.clusters || []);
  const chroma = cl.reduce((s, x) => s + x.C * x.weight, 0) / Math.max(1e-6, cl.reduce((s, x) => s + x.weight, 0));
  const hsl = {}; emit.getHSL(hsl);
  const warm = hsl.h < .17 || hsl.h > .85, grey = !!pal.greyscale || chroma < .03;
  const G = grammarOf(track), fam = familyOf(track);
  // spectrum texture for the aurora: 32 mel bands × 1024 columns over the whole song
  const PW = 1024, S = M.stride, bytes = new Uint8Array(PW * 32);
  for (let x = 0; x < PW; x++) { const a = Math.floor(x * M.frames / PW), b = Math.max(a + 1, Math.floor((x + 1) * M.frames / PW)); for (let m = 0; m < 32; m++) { let v = 0; for (let f = a; f < b; f++) v += M.data[f * S + m]; bytes[m * PW + x] = v / (b - a); } }
  const spec = new THREE.DataTexture(bytes, PW, 32, THREE.RedFormat, THREE.UnsignedByteType); spec.magFilter = spec.minFilter = THREE.LinearFilter; spec.needsUpdate = true;
  // which skies (2026-10-08: seven, and a song changes sky at its loud passages). The weight of each for this song
  // comes from its cover and its kind; a loud act leans to the black holes and the galaxy, a quiet one to the open
  // skies and the clouds; never the same sky twice running, at most three features in one song.
  const wt = {stars: grey ? 3 : warm ? 1.3 : .8, arch: grey ? .4 : warm ? .7 : 1.3, nebula: grey ? .1 : chroma > .09 ? 1.4 : .7,
    kerr: (KERR_FAM[fam] ?? .5) * (grey ? .7 : 1) * (1 + .6 * clamp((ch.punch - .5) * 2)) * (1 + .4 * clamp((.5 - (ch.bright ?? .5)) * 2)),
    gargantua: (KERR_FAM[fam] ?? .5) * .85 * (grey ? .8 : 1) * (1 + .5 * clamp((ch.punch - .5) * 2)),
    pegasus: grey ? .3 : (warm ? .8 : 1.1) * (1 + .3 * clamp((ch.range ?? .5) - .3)),
    simplicity: grey ? .1 : chroma > .07 ? 1.2 : .6};
  const DRAMA = {kerr: 1, gargantua: 1, pegasus: .6};
  const pick = (w, not) => { let tot = 0; for (const k in w) if (k !== not) tot += w[k]; let q = r() * tot, out = null; for (const k in w) { if (k === not || !(w[k] > 0)) continue; out = k; q -= w[k]; if (q <= 0) break; } return out || 'stars'; };
  // (a letter that comes back keeps its sky, unless that would repeat the sky just before it)
  const segs = actsOf(track.duration, sig.sections, track.phases || []), used = new Set(), names = [], byLabel = {};
  for (const [i, sg] of segs.entries()) {
    if (force && wt[force] != null) { names.push(force); if (!i) r(); continue; }
    const again = byLabel[sg.label];
    if (again && again !== names[i - 1]) { names.push(again); continue; }
    const w = {}; for (const k in wt) w[k] = wt[k] * (sg.loud ? (DRAMA[k] ? 1.8 * DRAMA[k] + .2 : .55) : (DRAMA[k] ? .45 : 1.15));
    if (used.size >= 3) for (const k of FEATS) if (!used.has(k)) w[k] = 0;
    const nm = pick(w, names[i - 1]); names.push(nm); if (FEATS.includes(nm)) used.add(nm);
    byLabel[sg.label] ||= nm;
  }
  const name = names[0], hole = n => n === 'kerr' || n === 'gargantua';
  // layers (the tile layers' weight per sky: [field, arch]; an act moves them)
  const hi = light.clone().lerp(emit, .45), dp = night.clone().multiplyScalar(.3);
  const K = {stars: [1, .3], arch: [.5, 1], nebula: [.6, .22], kerr: [.5, 0], pegasus: [.55, .15], gargantua: [.45, 0], simplicity: [.45, .08]};
  const field = LAYER({k: warm ? .85 : .6, sat: grey ? .2 : 1.04, gain: warm ? .7 : .58, tintK: grey ? .9 : .7, deep: dp, hi: grey ? c(theme.star).multiplyScalar(.8) : hi, phase: 24 * r()});
  const arch = LAYER({k: names.some(n => K[n][1] > 0) ? (warm ? .6 : .9) : 0, sat: grey ? .15 : 1, gain: warm ? .6 : .75, tintK: grey ? .9 : .55, deep: dp, hi: grey ? c(theme.star).multiplyScalar(.7) : second.clone().lerp(emit, .4), phase: 24 * r()});
  const TT = shots.title, fwd = new THREE.Vector3(Math.sin(TT.th), 0, -Math.cos(TT.th));     // the way the title faces
  const dirOf = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  // opposite the moon, a little to one side
  const fa = TT.moonTh + Math.PI + (r() - .5) * .9;
  // where the song looks most while it is loudest (within an act's time): a black hole stands there, not by the moon
  const wrapA = a => ((a % 6.2831853) + 9.42477796) % 6.2831853 - Math.PI;
  const faced = (t0 = 0, t1 = 1e9) => {
    let best = fa, bs = -1;
    const inAct = shots.groups.some(g => g.st[0].L && g.st[0].L.start >= t0 && g.st[0].L.start < t1);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * 6.2831853; let s = 0;
      for (const g of shots.groups) { const x = g.st[0]; if (!x.L || g.plan || x.th == null) continue; if (inAct && (x.L.start < t0 || x.L.start >= t1)) continue; const d = Math.abs(wrapA(x.th - a)); if (d < .6) s += (g.b - g.a + 1) * (x.L.chorus ? 2.4 : 1) * (1 - d / .6); }
      if (Math.abs(wrapA(a - TT.moonTh)) < .8) s *= .2;
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  };
  const featOf = (nm, sg, i) => {
    const v1 = r(), v2 = r(), v3 = r(), v4 = r();
    const L = {
      nebula: () => LAYER({k: grey ? .5 : chroma > .09 ? 1 : .8, sat: grey ? .2 : 1, gain: .5, tintK: grey ? .9 : .8, deep: second.clone().lerp(deep, .4), hi: emit.clone().lerp(light, .25), phase: 24 * v1}),
      kerr: () => LAYER({k: 1, sat: grey ? .25 : .92, gain: .6, tintK: grey ? .7 : .34, deep: night.clone().lerp(deep, .5), hi: light.clone().lerp(emit, .5), phase: 20 * v1}),
      gargantua: () => LAYER({k: 1, sat: grey ? .25 : .85, gain: .55, tintK: grey ? .7 : .38, deep: night.clone().lerp(deep, .5), hi: light.clone().lerp(emit, .45), phase: 24 * v1}),
      pegasus: () => LAYER({k: grey ? .6 : .95, sat: grey ? .2 : .95, gain: .55, tintK: grey ? .9 : .6, deep: second.clone().lerp(deep, .5), hi: light.clone().lerp(emit, .35), phase: 24 * v1}),
      simplicity: () => LAYER({k: grey ? .45 : .8, sat: grey ? .15 : .9, gain: .45, tintK: grey ? .9 : .7, deep: deep.clone().lerp(night, .4), hi: emit.clone().lerp(light, .3), phase: 24 * v1}),
    }[nm]();
    // where the song looks in that act (so the hand-over is seen): a hole right there, a cloud or a galaxy beside it
    const az = faced(sg.t0, sg.t1) + (hole(nm) ? 0 : v4 < .5 ? -.45 : .45);
    // (low: the camera looks out over the water; a feature a little above the horizon is in its picture)
    const el = hole(nm) ? .1 + .025 * v2 : nm === 'simplicity' ? .15 + .04 * v2 : nm === 'pegasus' ? .09 + .03 * v2 : .13 + .04 * v2;
    return {...L, name: nm, dir: dirOf(az, el), roll: (v3 - .5) * (hole(nm) ? .24 : nm === 'pegasus' ? .5 : .8), zoom: 1 + (hole(nm) ? .1 : .2) * v4};
  };
  let slot = 'Y';
  const acts = segs.map((sg, i) => {
    const nm = names[i], feat = FEATS.includes(nm) ? featOf(nm, sg, i) : null;
    if (feat) slot = slot === 'X' ? 'Y' : 'X';
    return {t0: sg.t0, t1: sg.t1, loud: sg.loud, name: nm, field: K[nm][0], arch: K[nm][1], feat, slot: feat ? slot : null};
  });
  const feat = acts[0].feat;
  // the arch: one foot on the horizon a quarter-turn from the title, leaning 50-62° up
  const footAz = TT.th + (r() < .5 ? -1 : 1) * (1.1 + .9 * r()), lean = .87 + .22 * r(), ax = dirOf(footAz, 0), side = new THREE.Vector3().crossVectors(ax, new THREE.Vector3(0, 1, 0));
  const archPole = new THREE.Vector3(0, 1, 0).multiplyScalar(Math.cos(lean)).addScaledVector(side, Math.sin(lean));
  const filterName = grey ? 'mono' : G.filter;
  const ink = filterName === 'duotone' ? [night.clone().multiplyScalar(.4), deep.clone().lerp(emit, .5), light] : filterName === 'mono' ? [night, c(theme.star).multiplyScalar(.5), emit] : [night.clone().multiplyScalar(.5), deep.clone().lerp(second, .5), emit.clone().lerp(light, .3)];
  const params = {
    name, field, arch, feat, acts, archPole, archFoot: ax, archOff: -.12 - .16 * r(), az: r(),
    aurora: {k: (grey ? .6 : .7) * (hole(name) ? .8 : 1), lo: emit.clone().lerp(c('#ffffff'), .2), hi: (grey ? emit : c(pal.ramp[2] || pal.light)).clone().multiplyScalar(.9), secPerRad: 22,
      flow: [emit.clone().lerp(c('#ffffff'), .15), second.clone().lerp(c('#ffffff'), .2), c(pal.ramp[1] || pal.deep).lerp(emit, .4).lerp(c('#ffffff'), .25), light.clone().lerp(emit, .35)].map(x => (grey ? x.lerp(emit, .7) : x))},
    horizon: night.clone().lerp(emit, .1), ground: night.clone().multiplyScalar(.3), haze: .5, calm: .22, exposure: 1, waterY: shots.waterY,
    filter: {id: FILTERS[filterName], k: filterName === 'grade' ? 0 : filterName === 'mono' ? .7 : filterName === 'halftone' ? .16 : filterName === 'dither' ? .22 : .4, ink},
    mirror: (G.mirror ?? 1) * (hole(name) ? .6 : name === 'nebula' || name === 'simplicity' ? .8 : 1),
  };
  // motion: how the sky's own clock runs
  const motion = [...G.motion];
  if (ch.punch > .65 && !motion.includes('pulse')) motion.push('pulse');
  if (ch.range > .6 && !motion.includes('flow')) motion.push('flow');
  const live = {aurora: params.aurora.k, exposure: 1, rate: 1, az: params.az, featZoom: 1, featGain: 1, calmGain: hole(name) ? 1.5 : 1};
  let rate = 1, zoom = 1;
  function tick(F, t, still) {
    // 'still': the loops at half speed; 'flow': faster where the song is loud; 'drift': the field turns slowly round the lake
    const want = (motion.includes('still') ? .5 : 1) * (motion.includes('flow') ? .7 + .8 * F.slow : 1);
    rate += (want - rate) * .02; live.rate = Math.round(rate * 10) / 10;
    live.az = params.az + (motion.includes('drift') ? t * .0011 : 0);
    const breath = motion.includes('pulse') ? .14 * F.kick : 0;
    live.exposure = (1 + .1 * (F.slow - .4)) * (1 + breath);
    live.aurora = params.aurora.k * (.75 + .5 * F.slow) * (1 - .4 * F.burst);
    let ai = 0; while (ai + 1 < acts.length && t >= acts[ai + 1].t0) ai++; live.act = acts[ai].name;   // (the readout's SKY)
    // the black hole comes nearer where the song is at its loudest, and its disc flares with the kick
    if (acts.some(a => hole(a.name))) {
      const want = 1 - .12 * F.drive - .05 * F.slow;
      zoom = still ? want : zoom + (want - zoom) * .035;
      live.featZoom = zoom; live.featGain = .85 + .4 * F.drive + .3 * F.kick * (.4 + .6 * F.drive);
    }
  }
  return {params, spec, fwd, tick, live, family: fam, filter: filterName, motion, name};
}
