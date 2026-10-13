// Small type for the picture's own captions (sheet.js, figure.js): the text in white on nothing as a canvas texture,
// and a plane that carries it, anchored at the end of its baseline.
import * as THREE from 'three';

const MONO = `'IBM Plex Mono','Noto Sans SC',monospace`, GROT = `'Archivo','MiSans',sans-serif`, SERIF = `'Noto Serif SC','Noto Serif JP','Instrument Serif',serif`;
/** face: 'mono' | 'serif' | 'grot'; sizes come back in em (h = 1.4; the baseline lies `base` em above the lower edge) */
export function label(text, {px = 64, face = 'mono', outline = false, track = .08} = {}) {
  const font = face === 'mono' ? `500 ${px}px ${MONO}` : face === 'serif' ? `600 ${px}px ${SERIF}` : `900 ${px}px ${GROT}`;
  const set = c => { c.font = font; c.fontStretch = face === 'grot' ? 'extra-condensed' : 'normal'; c.letterSpacing = `${track * px}px`; };
  const c0 = document.createElement('canvas').getContext('2d'); set(c0);
  const tw = Math.ceil(c0.measureText(text).width), pad = Math.round(px * .2), cv = document.createElement('canvas');
  cv.width = Math.max(2, tw + pad * 2); cv.height = Math.round(px * 1.4);
  const c = cv.getContext('2d'); set(c); c.textBaseline = 'alphabetic'; c.fillStyle = c.strokeStyle = '#fff';
  if (outline) { c.lineWidth = Math.max(1.5, px * .02); c.lineJoin = 'round'; c.strokeText(text, pad, px * 1.05); } else c.fillText(text, pad, px * 1.05);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return {tex, w: cv.width / px, h: 1.4, pad: pad / px, base: .35};
}
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
// (what lies flat on the water is not in the water's mirror picture)
const FS = `uniform sampler2D map; uniform vec3 uCol; uniform float uA, uMirror, uFlat; varying vec2 vUv;
void main(){ if (uMirror > .5 && uFlat > .5) discard; float a = texture2D(map, vUv).a * uA; if (a < .004) discard; gl_FragColor = vec4(uCol, a); }`;
/** em: world units per em. ax: 0 the text starts at the origin, 1 it ends there, .5 it is centred on it. */
export function labelMesh(L, em, col, shared, {flat = false, ax = 0} = {}) {
  const g = new THREE.PlaneGeometry(L.w * em, L.h * em);
  g.translate((.5 - ax) * (L.w - 2 * L.pad) * em, (.5 * L.h - L.base) * em, 0);
  const mat = new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {map: {value: L.tex}, uCol: {value: col.clone()}, uA: {value: 0}, uMirror: shared.uMirror, uFlat: {value: flat ? 1 : 0}}});
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5;
  if (flat) m.layers.set(1); // The mirror shader already discards this whole caption.
  return m;
}
