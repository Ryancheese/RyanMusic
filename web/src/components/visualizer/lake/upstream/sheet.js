// The sheet. When something is read from straight above, the water is a page and the page is set like one: crop
// marks at its corners, a rule under every row with the row's number in the margin, a scale along the foot, a
// register mark, the page's number set large and hollow in the margin, and a slug of small type (which lines, from
// when to when). All of it lies on the water, drawn on as the camera goes up and gone when it comes down; none of
// it is in the water's mirror picture. The row being sung is marked in the margin.
// The song's title has a sheet of its own: the record lies in the middle of it like a label, with the instrument's
// name, the song's slot, its kind and its length in the corners.
// A stanza that is read flat (square on, through a long lens) has a board: the same marks standing on the waterline
// in the plane of the type, the waterline its baseline, a rule of heights up its margin, the line's number set
// large and hollow over it. Square on it is a poster; when the camera leaves for the next stanza it is seen to be a
// plane standing in the lake, and it is in the water's mirror picture like everything that stands.
import * as THREE from 'three';
import {label, labelMesh} from './label.js';
import {DISC, LABEL} from './shots.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const pad2 = i => String(i).padStart(2, '0'), TAU = Math.PI * 2;
const stamp = t => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}.${pad2(Math.floor(t * 100 % 100))}`;
// aL: a mark's place in the order of drawing (0..1)
const VS = `attribute float aL, aK; varying float vL, vK; void main(){ vL = aL; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FS = `uniform vec3 uCol; uniform float uA, uDraw, uMirror, uStand; varying float vL, vK;
void main(){ if (uMirror > .5 && uStand < .5 || vL > uDraw) discard; float tip = exp(-(uDraw - vL) / .04) * step(uDraw, .995); gl_FragColor = vec4(uCol * (1. + 1.4 * tip), uA * vK); }`;

export function createSheet(scene, shared) {
  const group = new THREE.Group(); scene.add(group);
  let sheets = [], chrome = 1;
  const basis = new THREE.Matrix4(), r = new THREE.Vector3(), n = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function clear() {
    for (const s of sheets) { group.remove(s.g); s.g.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); for (const t of s.tex) t.dispose(); }
    sheets = [];
  }
  // a sheet lying on the water at c, its head toward heading th (stand: standing on it, facing the front)
  function sheet(c, th, waterY, col, stand = false) {
    const s = {tex: [], labels: [], pos: [], aK: [], stand};
    r.set(Math.cos(th), 0, Math.sin(th)); n.set(-Math.sin(th), 0, Math.cos(th));
    const g = s.g = new THREE.Group(); if (stand) basis.makeBasis(r, up, n); else basis.makeBasis(r, n.clone().negate(), up);
    g.quaternion.setFromRotationMatrix(basis); g.position.copy(c); g.position.y = waterY + (stand ? 0 : .005); group.add(g);
    s.seg = (xa, ya, xb, yb, k = 1) => { s.pos.push(xa, ya, 0, xb, yb, 0); s.aK.push(k, k); };
    s.crop = (hw, hd) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) { s.seg(sx * (hw + .14), sy * hd, sx * (hw + .6), sy * hd); s.seg(sx * hw, sy * (hd + .14), sx * hw, sy * (hd + .6)); } };
    s.scale = (hw, y) => { for (let i = 0, xa = -hw; xa <= hw + 1e-6; i++, xa += .25) s.seg(xa, y, xa, y - (i % 4 ? .07 : .16), .8); s.seg(-hw, y, hw, y, .5); };
    s.register = (cx, cy) => { for (let i = 0; i < 28; i++) { const a0 = i / 28 * TAU, a1 = (i + 1) / 28 * TAU; s.seg(cx + Math.cos(a0) * .17, cy + Math.sin(a0) * .17, cx + Math.cos(a1) * .17, cy + Math.sin(a1) * .17); } s.seg(cx - .3, cy, cx + .3, cy); s.seg(cx, cy - .3, cx, cy + .3); };
    s.put = (str, em, x, y, opt = {}) => { const L = label(str, opt), m = labelMesh(L, em, col, shared, {...opt, flat: !stand}); m.position.set(x, y, 0); g.add(m); s.tex.push(L.tex); s.labels.push(m); return m; };
    s.done = () => {
      const nS = s.pos.length / 6, aL = []; for (let i = 0; i < nS; i++) aL.push(i / nS * .92, i / nS * .92);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); lg.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1)); lg.setAttribute('aK', new THREE.Float32BufferAttribute(s.aK, 1));
      s.lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uCol: {value: col.clone()}, uA: {value: 0}, uDraw: {value: 0}, uStand: {value: stand ? 1 : 0}, uMirror: shared.uMirror}}));
      s.lines.frustumCulled = false; s.lines.renderOrder = 4; g.add(s.lines);
      if (!stand) s.lines.layers.set(1);
      sheets.push(s); return s;
    };
    return s;
  }
  function setTrack(track, theme, shots) {
    clear();
    const star = new THREE.Color(theme.star), emit = new THREE.Color(track.pal.emit).lerp(star, .3), title = shots.title;      // (asking for the title places the stations)
    // how much of the instrument's chrome the style keeps (genre.js LOOKS): none, the marks only, all of it
    chrome = track.style?.look?.chrome ?? 1;
    // the title's sheet
    if (title.plan) {
      const hs = DISC * LABEL + .62, s = sheet(title.c, title.th, shots.waterY, star);
      s.crop(hs, hs); s.scale(hs, -hs - .2); s.register(hs + .75, hs - .3);
      s.put('UNIVERSE ANTHEM · F.S.C.', .15, -hs, hs + .26);
      s.put(track.slot ? `S/${pad2(track.slot)}` : track.source === 'netease' ? 'NETEASE' : 'SPECIMEN', .15, hs, hs + .26, {ax: 1});
      s.put([String(track.genre || '').toUpperCase(), stamp(track.duration).slice(0, 5)].filter(Boolean).join(' · '), .13, -hs, -hs - .66);
      if (track.album) s.put(String(track.album).toUpperCase().slice(0, 30), .13, hs, -hs - .66, {ax: 1});
      s.big = s.put(track.slot ? pad2(track.slot) : 'NE', 1.7, -hs - .75, -hs, {face: 'grot', outline: true, ax: 1, px: 220, track: 0});
      s.a = title.a + .25; s.b = title.s0 - .25; s.in = 1.3; s.out = .95; s.title = true;
      s.done();
    }
    if (chrome <= 0) return;
    boards(track, shots, star);
    let no = 0;
    for (const G of shots.groups) {
      // (a scene of the music read from above is the picture itself: it gets no page round it)
      if (!G.plan || !G.page || G.phantom) continue;
      no++;
      const pg = G.page, x0 = G.st[0], hw = pg.W / 2 + .6, hd = pg.D / 2 + .55, s = sheet(pg.c, x0.th, shots.waterY, star);
      s.G = G; s.a = G.a - 1.3; s.b = G.b + .3; s.in = 1.2; s.out = 1;
      s.crop(hw, hd);
      // a rule under every row (broken, so it stays a guide and not a box), and the margin line they hang on (a
      // figure has no rows)
      const rowY = G.st.map((x, k) => pg.cz - pg.z[k]);
      if (!G.phantom) for (const y of rowY) for (let xa = -hw; xa < hw - .01; xa += .5) s.seg(xa, y - .07, Math.min(hw, xa + .3), y - .07, .55);
      s.seg(-hw, -hd, -hw, hd, .6);
      if (!G.phantom) for (const y of rowY) s.seg(-hw - .12, y - .07, -hw, y - .07, 1);
      s.scale(hw, -hd - .2); s.register(hw + .75, hd - .3);
      // the slug and the page number (a narrow page: the slug in two lines, left)
      const Ls = G.st.filter(x => x.L).map(x => x.L.i + 1), what = Ls.length ? (Ls.length > 1 ? `L${pad2(Ls[0])}–${pad2(Ls[Ls.length - 1])}` : `L${pad2(Ls[0])}`) : 'FIG.', narrow = hw * 2 < 5.4;
      s.put(`P/${pad2(no)} · ${what}`, .15, -hw, hd + (narrow ? .52 : .26));
      s.put(`${stamp(G.a)} — ${stamp(G.b)}`, .15, narrow ? -hw : hw, hd + .26, {ax: narrow ? 0 : 1});
      if (hw * 2 >= 3.4) s.put(`UNIVERSE ANTHEM · ${String(track.title || '').toUpperCase().slice(0, narrow ? 12 : 28)}`, .12, -hw, -hd - .62);
      G.st.forEach((x, k) => { if (G.st.length > 1) s.put(pad2(k + 1), .12, -hw - .5, rowY[k] - .11, {ax: 1}); });
      s.big = s.put(pad2(no), 1.7, -hw - .75, -hd, {face: 'grot', outline: true, ax: 1, px: 220, track: 0});
      s.done();
      // the row being sung: a short bar in the margin
      if (!G.phantom) {
        const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute([-.42, 0, 0, -.2, 0, 0, -.42, .05, 0, -.2, .05, 0], 3)); mg.setAttribute('aL', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1)); mg.setAttribute('aK', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
        s.mark = new THREE.LineSegments(mg, new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uCol: {value: emit.clone()}, uA: {value: 0}, uDraw: {value: 1}, uStand: {value: 0}, uMirror: shared.uMirror}}));
        s.mark.frustumCulled = false; s.mark.renderOrder = 4; s.g.add(s.mark); s.rowY = rowY; s.hw = hw;
        s.mark.layers.set(1);
      }
    }
  }
  // the boards of the stanzas that are read flat
  function boards(track, shots, star) {
    const f = {c: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3()};
    for (const G of shots.groups) {
      const x0 = G.st[0];
      if (G.plan || G.phantom || G.see !== 'flat' || !x0.L || x0.L.layout === 'scatter' || x0.L.layout === 'steps') continue;
      const lay = shots.layOf(x0), hw = lay.w / 2 + .42, top = lay.h + .34;
      if (!(hw > .6 && top > .5)) continue;
      shots.stationFrame(x0, f);
      const s = sheet(f.c, x0.th, shots.waterY, star, true), last = G.st.length > 1 ? x0 : G.st[G.st.length - 1];
      s.a = x0.a - .95; s.b = last.b + .15; s.in = 1; s.out = .7; s.gain = .8;
      // its corners: the upper two, and the lower two as ticks on the waterline
      for (const sx of [-1, 1]) { s.seg(sx * (hw + .1), top, sx * (hw + .36), top); s.seg(sx * hw, top + .1, sx * hw, top + .36); s.seg(sx * (hw + .1), .004, sx * (hw + .36), .004); }
      // the margin, and the heights up it from the waterline
      s.seg(-hw, .004, -hw, top, .5);
      for (let i = 0, y = 0; y <= top + 1e-6; i++, y += .25) s.seg(-hw, y + .004, -hw - (i % 4 ? .06 : .14), y + .004, .8);
      // over it, as much as the frame has room for: the line's number, large and hollow, and the slug
      const tv = Math.tan(shots.baseFov * (G.lens || 1) * Math.PI / 360), room = .98 * shots.distOf(x0) * tv - top, em = Math.min(.55 * top, 1.3, (room - .3) / .8);
      if (em >= .45) s.big = s.put(pad2(x0.L.i + 1), em, -hw, top + .2, {face: 'grot', outline: true, px: 200, track: 0});
      if (room > .5) s.put(`L${pad2(x0.L.i + 1)} · ${stamp(x0.L.start)} — ${stamp(x0.L.end)}`, Math.min(.12, .05 * shots.distOf(x0) * tv), hw, top + .22, {ax: 1});
      s.done();
    }
  }
  function update(t) {
    for (const s of sheets) {
      const show = t > s.a - .3 && t < s.b + s.out + .3;
      s.g.visible = show; if (!show) continue;
      const kin = sm(s.a, s.a + s.in, t), kout = 1 - sm(s.b, s.b + s.out, t);
      const ck = s.title ? 1 : chrome;
      s.lines.material.uniforms.uDraw.value = kin; s.lines.material.uniforms.uA.value = .42 * kout * (s.gain || 1) * ck;
      const la = sm(s.a + .5 * s.in, s.a + s.in, t) * kout * (s.gain || 1) * (ck < .5 ? ck * .6 : ck);
      for (const m of s.labels) m.material.uniforms.uA.value = (m === s.big ? .3 : .62) * la;
      if (!s.mark) continue;
      // which row
      let k = 0; s.G.st.forEach((x, i) => { if (x.a - .3 <= t) k = i; });
      const y = s.rowY[k] - .07;
      s.mark.position.x = -s.hw; s.mark.position.y += (y - s.mark.position.y) * (Math.abs(y - s.mark.position.y) > 3 ? 1 : .2);
      s.mark.material.uniforms.uA.value = .9 * la;
    }
  }
  return {setTrack, update, clear, get count() { return sheets.length; }};
}
