// MV mode. A song's MV from Bilibili or YouTube, through the local service: it finds candidates, keeps the user's
// bindings (song → video) and relays the platform's streams (nothing is stored; handoff/OPUS55_TO_CODEX_MV在线中继).
// The MV is heard with its own sound, so in MV mode the song IS the MV's version: its sound is measured in the
// browser like a NetEase song's, and the release's lyric times and reading of the words are carried over by
// measuring where each moment of the MV is in the release (mvsync.js). Its picture stands on the horizon as a
// screen in the sky (sky.js), in the lake's mirror like everything else.
//   ?mvdev   a stand-in binding for every song (the release's own sound, /p/_dev/mv.mp4 as the picture), to try the
//            mode before the service has it; &mvdevedit also edits the sound before it is measured (a 2.5 s longer
//            intro, 6 s cut at 60 s) to check the alignment end to end
import * as THREE from 'three';
import {alignMv, mapLyrics, toMv, toRelease} from './mvsync.js';
import {decode22k, analyseInWorker} from './data.js';
import {schedule} from './analysis-structure.js';

const Q = new URLSearchParams(location.search), DEV = Q.has('mvdev'), DEV_EDIT = Q.has('mvdevedit');
export const REASON = {'mv-service': 'MV 服务未就绪（等本机服务的中继接口）。', 'mv-bot-check': 'YouTube 要求验证（需要在本机服务里配置凭据）。', 'mv-login-required': '这个视频需要登录才能播放。',
  'mv-region': '这个视频在当前地区不可用。', 'mv-removed': '视频已删除。', 'mv-private': '视频是私有的。', 'mv-no-format': '平台没有给出可用的画面或音轨。', 'mv-resolver-error': '解析失败。', 'mv-upstream-refused': '已找到 MV，但平台拒绝读取当前音视频流。', 'mv-upstream-unavailable': 'MV 传输暂时失败，请稍后重试。', 'mv-none': '这首歌还没有绑定 MV（按 V 打开 MV 面板）。', 'mv-mismatch': 'MV 的声音和发行版对不上，歌词不显示。'};
const fail = (code, msg) => { const e = new Error(REASON[code] || msg || code); e.code = code; return e; };

async function api(path, init) {
  let r; try { r = await fetch('/api/mv/' + path, init); } catch (error) { if (error?.name === 'AbortError') throw error; throw fail('mv-service'); }
  if (!(r.headers.get('content-type') || '').includes('json')) throw fail('mv-service');
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 && (!j.error || j.error === 'unknown')) throw fail('mv-service');
  if (!r.ok) throw fail('mv-' + (j.reason || 'resolver-error'), j.error);
  return j;
}
const DEV_BINDING = {id: 'dev', platform: 'dev', label: 'DEV STAND-IN', title: 'stand-in picture, release sound', uploader: 'local', duration: 0};
export const mvApi = {
  bindings: song => (DEV ? Promise.resolve({items: [DEV_BINDING]}) : api('bindings?song=' + encodeURIComponent(song))),
  search: (song, platform, q, {signal} = {}) => api(`search?song=${encodeURIComponent(song)}&platform=${platform}${q ? '&q=' + encodeURIComponent(q) : ''}`, {signal}),
  bind: b => api('binding', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(b)}),
  unbind: id => api('binding/' + encodeURIComponent(id), {method: 'DELETE'}),
  resolve: id => api('resolve/' + encodeURIComponent(id)),
};

// where the user is: mainland China plays Bilibili first, elsewhere YouTube first (set by hand, never guessed)
export const region = {get: () => localStorage.getItem('spectra-mv-region') || 'cn', set: v => localStorage.setItem('spectra-mv-region', v)};
export function pickBinding(items) {
  if (!items?.length) return null;
  const order = region.get() === 'cn' ? ['bilibili', 'youtube'] : ['youtube', 'bilibili'], pref = localStorage.getItem('spectra-mv-pick:' + items[0].song);
  const rank = b => { const i = order.indexOf(b.platform); return i < 0 ? 9 : i; };
  return items.find(b => b.id === pref) || [...items].sort((a, b) => rank(a) - rank(b))[0];
}

// (?mvdevedit) what an MV's own cut might do to the release: a longer intro, a stretch cut out
function devEdit(L, R) {
  const sr = 22050, pre = Math.round(2.5 * sr), a = 60 * sr, b = 66 * sr, n = L.length + pre - (b - a);
  const cut = x => { const y = new Float32Array(n); y.set(x.subarray(0, a), pre); y.set(x.subarray(b), pre + a); return y; };
  return [cut(L), cut(R)];
}

const cache = new Map();
async function fetchMvSound(src) {
  let r;
  try {r = await fetch(src);} catch {throw fail('mv-upstream-unavailable');}
  if (!r.ok) {
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json().catch(() => ({})) : {};
    const code = 'mv-' + (j.reason || 'upstream-unavailable');
    throw fail(REASON[code] ? code : 'mv-upstream-unavailable');
  }
  try {return await r.arrayBuffer();} catch {throw fail('mv-upstream-unavailable');}
}
/** the song as its MV: base = the release (loadTrack), b = a binding */
export function loadMvTrack(base, b, onStage = () => {}) {
  const key = base.key + '@' + b.id;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    onStage('asking for the MV', .04);
    const R = b.platform === 'dev' ? {ok: true, video: {src: '/p/_dev/mv.mp4', loop: true}, audio: {src: base.audioSrc, mime: 'audio/mpeg'}, title: DEV_BINDING.title, uploader: 'local'} : await mvApi.resolve(b.id);
    if (!R.ok) throw fail('mv-' + (R.reason || 'resolver-error'), R.detail);
    onStage('fetching the MV sound', .1);
    const buf = await fetchMvSound(R.audio.src);
    onStage('decoding the MV sound', .3);
    let [L, Rr] = await decode22k(buf.slice(0));
    if (DEV_EDIT && b.platform === 'dev') [L, Rr] = devEdit(L, Rr);
    onStage('measuring the MV sound', .38);
    const an = await analyseInWorker(L, Rr, q => onStage('measuring the MV sound', .38 + q * .5));
    const {data, wave, ...mj} = an, motion = {...mj, data};
    onStage('finding the release in the MV', .9);
    // the release's lyric times, carried over where the MV's sound is the release's; none where it is not
    const al = alignMv(base.motion, motion), ok = !!al && al.cover.rel > .3 && al.cover.mv > .3;
    const lyrics = ok ? mapLyrics(base.lyrics, al) : [];
    const neChorus = ok ? (base.neChorus || []).flatMap(([a, z]) => toMv(al, a).map(x => [x, x + (z - a)])) : [];
    const states = schedule(an.duration, an.phases, lyrics);
    const blobUrl = URL.createObjectURL(new Blob([buf], {type: R.audio.mime || 'audio/mp4'}));
    return {
      ...base, key, source: 'mv', mvOf: base.key, release: () => URL.revokeObjectURL(blobUrl),
      duration: an.duration, catalogueDuration: an.duration, audioSrc: blobUrl, trial: null, bitrate: R.audio.bitrate || 0,
      states, phases: an.phases, env: an.env, spec: an.spec, motion, wave,
      lyrics, verified: false, lyricSource: (base.lyricSource || 'release') + ' → mv', neChorus, lyricMismatch: !ok && base.lyrics.length > 0,
      mv: {binding: b, video: R.video, title: R.title, uploader: R.uploader, align: al, ok},
    };
  })();
  cache.set(key, p); p.catch(() => cache.delete(key));
  return p;
}
/** a reading of the release's words, for the MV's lines (they keep the release line they came from) */
export const senseForMv = (sense, t) => (sense ? {...sense, lines: t.lyrics.map(L => sense.lines?.[L.relI] || null)} : null);
/** a moment of one version in the other (the user switches mode while playing) */
export function carryTime(from, to, tm) {
  if (from.mv && !to.mv) return toRelease(from.mv.align, tm);
  if (!from.mv && to.mv) { const xs = toMv(to.mv.align, tm); return xs.length ? xs[0] : Math.min(tm, to.duration - 1); }
  return tm;
}

// ---- the screening (2026-10-07, second version) -----------------------------------------------------------------
// In MV mode the MV is the picture: always whole, the largest thing in the frame, the stage around it. It hangs as a
// screen over the far water, held in one place of the frame (upper middle, under the title bar) whatever the camera
// does, drifting a little against the camera's turns so it floats rather than sticks. Its own colours spill round its
// edges into the night (sampled from the picture, like a television's bias light), a hairline frames it, print marks
// and a slug sit at its corners (app.js, #mvframe), and the lake mirrors it under the horizon (sky.js). The lines stand
// on the near water below it, smaller, as its subtitles (shots.js). When the eye looks down at the water (a page, the
// label from above) the screen goes down into the lake and plays under the surface, wavering, in the water's colour.
const PANEL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const PANEL_FS = `uniform sampler2D map, uGrid; uniform float uA, uMirror, uCalm, uGlow, uHz, uT; uniform vec2 uPic, uRes; uniform vec4 uCalmC; varying vec2 vUv;
vec3 toLin(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }
void main(){
  if (uMirror > .5) discard;                                       // (the lake's mirror of it is drawn by sky.js)
  vec2 ext = uPic + vec2(1.), p = (vUv * 2. - 1.) * ext;          // panel units: the picture is [-uPic, uPic], the glow one unit round it
  vec2 o = abs(p) - uPic, fw = fwidth(p);
  float outside = length(max(o, 0.)), inPic = step(max(o.x, o.y), 0.);
  vec2 uv = clamp(p / uPic * .5 + .5, vec2(.001), vec2(.999));
  // (2026-10-08) it stands on the horizon; where the frame puts the horizon high, its foot is in the lake: seen
  // through the water there, rippled, darker and cooler
  float ny = gl_FragCoord.y / uRes.y * 2. - 1., sub = smoothstep(0., .015, uHz - ny);
  uv.x += sub * .0035 * sin(ny * 140. + uT * 2.3) * (1. + .5 * sin(ny * 37. - uT));
  vec3 c = vec3(0.); float a = 0.;
  if (inPic > .5) {
    // (2026-10-08) no cut edge: the picture is whole, and only its outermost hundredths thin into the night; there its
    // light parts into colours as in the instrument's slit (red outward, blue inward)
    float e = min(uPic.x - abs(p.x), uPic.y - abs(p.y)) / min(uPic.x, uPic.y), fr = 1. - smoothstep(0., .07, e);
    vec2 dir = p / uPic * .5;
    c = vec3(toLin(texture2D(map, clamp(uv + dir * .01 * fr, vec2(.001), vec2(.999))).rgb).r, toLin(texture2D(map, uv).rgb).g, toLin(texture2D(map, clamp(uv - dir * .01 * fr, vec2(.001), vec2(.999))).rgb).b);
    vec2 cz = (gl_FragCoord.xy / uRes - uCalmC.xy) / max(uCalmC.zw, vec2(.02)); c *= 1. - .4 * uCalm * exp(-dot(cz, cz) * .9);
    a = smoothstep(0., .03, e);
    vec3 g = toLin(texture2D(uGrid, uv).rgb) * uGlow * .9; c = c * a + g * (1. - a);
    c = mix(c, c * vec3(.66, .76, .86), sub);
  } else {
    // the bias light: the picture's own edge colours, falling off into the night
    vec3 g = toLin(texture2D(uGrid, uv).rgb);
    c = g * uGlow * (exp(-outside * 3.4) * .55 + exp(-outside * 9.) * .35) * smoothstep(1., .75, outside);
  }
  // (the deeper below the horizon, the more the lake covers it: the water seen through it)
  float keep = 1. - .86 * smoothstep(0., 1., clamp((uHz - ny) / .32, 0., 1.));
  gl_FragColor = vec4(c * uA * keep, a * uA * keep);
}`;
const UNDER_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const UNDER_FS = `uniform sampler2D map; uniform float uA, uT, uMirror, uCalm; uniform vec4 uCalmC; uniform vec2 uRes; uniform vec3 uDeep; varying vec2 vUv; varying vec3 vW;
vec3 toLin(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }
vec3 tap(vec2 uv){ return toLin(texture2D(map, clamp(uv, vec2(.001), vec2(.999))).rgb); }
void main(){
  if (uMirror > .5) discard;
  // seen through the water: the surface bends it, blurs it and takes some of its light and colour
  vec2 uv = vUv + .004 * vec2(sin(vW.x * 2.3 + vW.z * 1.7 + uT * 1.3) + .5 * sin(vW.z * 5.1 - uT * 1.9), cos(vW.z * 2.1 - vW.x * 1.2 + uT * 1.1) + .5 * cos(vW.x * 4.7 + uT * 1.7));
  vec2 o = vec2(.003, .0045);
  vec3 c = tap(uv) * .4 + (tap(uv + o) + tap(uv - o) + tap(uv + o * vec2(1., -1.)) + tap(uv - o * vec2(1., -1.))) * .15;
  c = mix(uDeep * 1.2, c * .66, .76) * (.92 + .16 * pow(.5 + .5 * sin(vW.x * 3.1 + uT * .9) * sin(vW.z * 2.7 - uT * .7), 3.));
  vec2 e = min(vUv, 1. - vUv); float m = smoothstep(0., .025, e.x) * smoothstep(0., .04, e.y);
  vec2 cz = (gl_FragCoord.xy / uRes - uCalmC.xy) / max(uCalmC.zw, vec2(.02)); c *= 1. - .5 * uCalm * exp(-dot(cz, cz) * .9);
  float a = m * uA; if (a < .01) discard;
  gl_FragColor = vec4(c, a);
}`;
export function createMvStage(scene, shared) {
  const res = new THREE.Vector2(1600, 900), calmC = new THREE.Vector4(.5, .5, .4, .25);
  // the picture's edge colours, 8 × 4, sampled a few times a second (the bias light and the lake's tint)
  const gc = document.createElement('canvas'); gc.width = 8; gc.height = 4;
  const gx = gc.getContext('2d', {willReadFrequently: true}), gridTex = new THREE.CanvasTexture(gc);
  gridTex.colorSpace = THREE.NoColorSpace; gridTex.minFilter = gridTex.magFilter = THREE.LinearFilter; gridTex.generateMipmaps = false;
  const P = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({vertexShader: PANEL_VS, fragmentShader: PANEL_FS, transparent: true, depthWrite: true, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {map: {value: null}, uGrid: {value: gridTex}, uA: {value: 0}, uMirror: shared.uMirror, uCalm: {value: 0}, uCalmC: {value: calmC}, uRes: {value: res}, uPic: {value: new THREE.Vector2(3, 2)}, uGlow: {value: .72}, uHz: {value: -2}, uT: {value: 0}}}));
  const W = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({vertexShader: UNDER_VS, fragmentShader: UNDER_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {map: {value: null}, uA: {value: 0}, uT: {value: 0}, uMirror: shared.uMirror, uCalm: {value: 0}, uCalmC: {value: calmC}, uRes: {value: res}, uDeep: {value: new THREE.Color()}}}));
  for (const m of [P, W]) { m.layers.set(1); m.frustumCulled = false; m.renderOrder = -2; m.visible = false; scene.add(m); }
  W.rotation.order = 'YXZ';
  const S = {t: null, yaw: 0, pitch: 0, dx: 0, dy: 0, wx: 0, wz: 0, ws: 10, lastGrid: -9};
  const fw = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3();
  const ease = (cur, want, dt, tau) => cur + (want - cur) * (1 - Math.exp(-dt / tau));
  // where the picture is in the frame (NDC: centre and half sizes), for the frame marks and the lake's mirror of it
  const rect = {on: false, cx: 0, cy: 0, hw: .5, hh: .5, a: 0, horizon: 0};
  let video = null;
  return {
    rect,
    set(tex, deep, el) { P.material.uniforms.map.value = W.material.uniforms.map.value = tex || null; video = el || null; if (deep) W.material.uniforms.uDeep.value.copy(deep); S.t = null; S.lastGrid = -9; if (!tex) { P.visible = W.visible = false; rect.on = false; } },
    /** o: {t, ready, aspect, capture, calm, calmC, res, waterY} */
    update(cam, o) {
      if (!P.material.uniforms.map.value) return;
      cam.getWorldDirection(fw);
      const yaw = Math.atan2(fw.x, -fw.z), pitch = Math.asin(Math.max(-1, Math.min(1, fw.y))), tv = Math.tan(cam.fov * Math.PI / 360), A = cam.aspect || 1.78, va = o.aspect || 16 / 9;
      const dt = S.t == null ? 9 : o.t - S.t, snap = o.capture || dt <= 0 || dt > .5;
      S.pitch = pitch; S.t = o.t;
      // (2026-10-08) a screen standing in the world on the horizon, D ahead of the eye: it turns after the eye on a
      // quick spring (a camera move carries it through the frame for a moment, then it comes round; it is a thing the
      // camera looks at, not a sticker on the lens). As large as before at the stage's own lens (58% of the width), so
      // a closer lens makes it larger as it would any thing; its foot on the water, or, where the eye looks down far
      // enough that its top would pass under the title bar, sunk into the lake by as much (PANEL_FS)
      const D = 70, portrait = A < 1.1, top = portrait ? .7 : .84, hz = -Math.tan(pitch) / tv;
      const tb = Math.tan((o.baseFov || cam.fov) * Math.PI / 360);
      let hwW = D * tb * A * (portrait ? .92 : .58), hhW = hwW / va;
      if (2 * hhW > (top + .55) * D * tb) { hhW = (top + .55) * D * tb / 2; hwW = hhW * va; }
      if (snap || S.yawF == null) S.yawF = yaw; else S.yawF += Math.atan2(Math.sin(yaw - S.yawF), Math.cos(yaw - S.yawF)) * (1 - Math.exp(-dt / .35));
      // looking down at the water it goes under it (the plane below)
      const f = Math.max(0, Math.min(1, (-.5 - pitch) / .45)), fs = f * f * (3 - 2 * f), k = o.ready ? 1 : 0;
      const wy = o.waterY ?? -1.05, cxw = cam.position.x + Math.sin(S.yawF) * D, czw = cam.position.z - Math.cos(S.yawF) * D;
      // how far its top would stand over the title bar if it stood on the water: sink by that (smoothly)
      V.set(cxw, wy + 2 * hhW, czw).project(cam);
      const wantS = V.z < 1 ? Math.max(0, V.y - top) * D * tv : 0;
      S.sink = snap || S.sink == null ? wantS : S.sink + (wantS - S.sink) * (1 - Math.exp(-dt / .4));
      const glow = .34 * Math.min(hwW, hhW);
      P.position.set(cxw, wy + hhW - S.sink, czw);
      P.rotation.set(0, Math.atan2(cam.position.x - cxw, cam.position.z - czw), 0);
      P.scale.set(2 * (hwW + glow), 2 * (hhW + glow), 1);
      const PU = P.material.uniforms; PU.uPic.value.set(hwW / glow, hhW / glow); PU.uHz.value = hz; PU.uT.value = o.t;
      PU.uA.value = (1 - fs) * k; PU.uCalm.value = o.calm || 0; P.visible = PU.uA.value > .005;
      // where it is in the frame (for the sky's wash and the lake's mirror of it): its corners, projected
      P.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9, front = true;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { V.set(sx * hwW, sy * hhW, 0).applyEuler(P.rotation).add(P.position).project(cam); if (V.z > 1) front = false; x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); y0 = Math.min(y0, V.y); y1 = Math.max(y1, V.y); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
      // under the water: where the eye looks down at it, its head away from the eye, whole in the frame
      const ty = o.waterY - .45, s = fw.y < -.08 ? (cam.position.y - ty) / -fw.y : 40, ux = cam.position.x + fw.x * s, uz = cam.position.z + fw.z * s;
      const ws = Math.min(2 * s * tv * A * .74, 2 * s * tv * .74 * va);
      if (snap || f < .02) { S.wx = ux; S.wz = uz; S.ws = ws; } else { S.wx = ease(S.wx, ux, dt, .4); S.wz = ease(S.wz, uz, dt, .4); S.ws = ease(S.ws, ws, dt, .5); }
      W.position.set(S.wx, ty, S.wz); W.rotation.set(-Math.PI / 2, -yaw, 0); W.scale.set(S.ws, S.ws / va, 1);
      const WU = W.material.uniforms; WU.uA.value = fs * k; WU.uT.value = o.t; WU.uCalm.value = o.calm || 0; W.visible = WU.uA.value > .005;
      if (o.calmC) calmC.copy(o.calmC); if (o.res) res.set(o.res[0], o.res[1]);
      // the edge colours, a few times a second (every frame for stills)
      if (video && video.readyState >= 2 && (o.capture || Math.abs(o.t - S.lastGrid) > .12)) { try { gx.drawImage(video, 0, 0, 8, 4); gridTex.needsUpdate = true; S.lastGrid = o.t; } catch {} }
      Object.assign(rect, {on: PU.uA.value > .005 && front, cx, cy, hw, hh, a: PU.uA.value, horizon: hz});
    },
    gridTex,
    hide() { P.visible = W.visible = false; rect.on = false; },
  };
}

// ---- the picture: a muted <video> that follows the song's clock (the MV's own sound plays in audio.js) ----------
export function createMvScreen() {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  const tex = new THREE.VideoTexture(v);
  tex.colorSpace = THREE.NoColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  let src = null, failed = false;
  v.addEventListener('error', () => { if (src) { failed = true; console.warn('MV picture failed', v.error?.code); } });
  v.addEventListener('seeked', () => { tex.needsUpdate = true; });
  function set(video) {
    const s = video?.src || null;
    if (s === src) return;
    src = s; failed = false; v.loop = !!video?.loop;
    if (s) { v.src = s; v.load(); } else { v.pause(); v.removeAttribute('src'); v.load(); }
  }
  // the picture keeps to the sound: small differences are taken up by its speed, large ones by a seek
  function follow(t, playing, still) {
    if (!src || failed || v.readyState < 1) return;
    const d = v.duration || 1e9, want = v.loop ? t % d : Math.min(t, d - .05);
    if (still || !playing) {
      if (!v.paused) v.pause();
      if (!v.seeking && Math.abs(v.currentTime - want) > (still ? .02 : .06)) v.currentTime = want;
      return;
    }
    // Waiting for the next decoded frame is not drift. Re-seeking on every render while the
    // network/decoder is starved repeatedly abandons the same unfinished video range.
    if (v.readyState < 3 || v.seeking) return;
    const err = v.currentTime - want;
    if (Math.abs(err) > .25) { if (!v.seeking) v.currentTime = want + .08; v.playbackRate = 1; }
    else v.playbackRate = Math.min(1.12, Math.max(.88, 1 - err * 2.5));
    if (v.paused && !v.seeking) v.play().catch(() => {});
  }
  return {
    set, follow, tex, el: v,
    get on() { return !!src && !failed; },
    get ready() { return !!src && !failed && v.readyState >= 2; },
    busy: () => !!src && !failed && (v.readyState < 2 || v.seeking),
    get aspect() { return v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9; },
  };
}
