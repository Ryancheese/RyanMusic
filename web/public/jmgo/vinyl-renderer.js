import { Matrix4, Quaternion, Vector3, Euler, OrthographicCamera } from './vendor/three.module.js';
import { vinylSpriteGeometry, createVinylMotion } from './vinyl-animation.js';
import { readAsset, loadAssetImage } from './assets.js';
import { setLyricText, animateLyricText, getLyricFont } from './lyric-effects.js';
import { createVinylLyricLayout } from './vinyl-lyrics.js';

const DEFAULT_ASSETS = new URL('./vinyl/', import.meta.url);
async function read(url, json = false) {
  return readAsset(url, json ? 'json' : 'text');
}
const image = loadAssetImage;
const SPRITE_VERTEX = `#version 300 es
precision highp float;
in vec3 position; in vec2 uv; uniform mat4 mvp; out vec2 vUV;
void main(){gl_Position=mvp*vec4(position,1.0);vUV=uv;}`;
const SPRITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D map; uniform vec4 tint; in vec2 vUV; out vec4 color;
void main(){color=texture(map,vUV)*tint;color.rgb*=color.a;}`;
const vec = v => new Vector3(v.x, v.y, v.z);

/** Original active Cover2D03 layout: tight/sliced sprites, cover mesh and source arm clips. */
export async function createVinylRenderer(canvas, { linear = false, assetBase = DEFAULT_ASSETS } = {}) {
  const base = new URL(assetBase, location.href), scene = await read(new URL('scene.json', base), true);
  const nodes = scene.nodes;
  const nodeByName = Object.fromEntries(Object.entries(nodes).map(([id, n]) => [n.name, id]));
  const matrices = new Map(), localMatrices = new Map();
  function active(id) { const n = nodes[id]; return n.active && (n.parent === '0' || active(n.parent)); }
  const activeDraws = scene.draws.filter(d => d.enabled && active(d.node));
  const requiredPrograms = [...new Set(activeDraws.filter(d => d.kind === 'mesh').flatMap(d => d.materials.map(m => scene.materials[m].program)))];
  const programSources = Object.fromEntries(await Promise.all(requiredPrograms.map(async id => {
    const descriptor = scene.programs[id];
    const [vertex, fragment] = await Promise.all([read(new URL(descriptor.vertex, base)), read(new URL(descriptor.fragment, base))]);
    return [id, { vertex, fragment }];
  })));
  const requiredTextures = new Set([scene.defaultCover]);
  for (const draw of activeDraws) {
    if (draw.kind === 'sprite') requiredTextures.add(scene.sprites[draw.sprite].texture);
    else for (const material of draw.materials) for (const tex of Object.values(scene.materials[material].textures)) if (scene.textures[tex.texture]) requiredTextures.add(tex.texture);
  }
  const textureEntries = await Promise.all([...requiredTextures].map(async id => [id, await image(new URL(scene.textures[id].file, base))]));
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('黑胶唱机需要 WebGL2。');
  const programs = new Map(), shaders = [], buffers = [], vaos = [], textures = new Map();
  const overlay = document.createElement('div');
  overlay.className = 'jmgo-vinyl-overlay'; overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  let disposed = false, width = 1, height = 1, lyricLayout;
  function dispose() {
    if (disposed) return; disposed = true; lyricLayout?.dispose(); overlay.remove();
    vaos.forEach(v => gl.deleteVertexArray(v)); buffers.forEach(b => gl.deleteBuffer(b)); shaders.forEach(s => gl.deleteShader(s));
    programs.forEach(p => gl.deleteProgram(p.program)); textures.forEach(t => gl.deleteTexture(t.texture)); gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function compile(type, source) {
    const shader = gl.createShader(type); shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Vinyl Shader：${gl.getShaderInfoLog(shader)}`);
    return shader;
  }
  function createProgram(id, source) {
    const program = gl.createProgram();
    const entry = { program, uniforms: new Map() }; programs.set(id, entry);
    gl.attachShader(program, compile(gl.VERTEX_SHADER, source.vertex)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source.fragment)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    entry.uniform = name => { if (!entry.uniforms.has(name)) entry.uniforms.set(name, gl.getUniformLocation(program, name)); return entry.uniforms.get(name); };
    return entry;
  }
  try {
    for (const [id, original] of Object.entries(programSources)) {
      let fragment = original.fragment;
      if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
        vec3 encodeSRGB(vec3 x){return mix(12.92*x,1.055*pow(max(x,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x));}
        void main(){originalMain();SV_Target0.rgb=encodeSRGB(SV_Target0.rgb);}`;
      createProgram(id, { vertex: original.vertex, fragment });
    }
    let spriteFragment = SPRITE_FRAGMENT;
    if (linear) spriteFragment = spriteFragment.replace('void main()', 'void originalMain()') + `
      vec3 encodeSRGB(vec3 x){return mix(12.92*x,1.055*pow(max(x,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x));}
      void main(){originalMain();if(color.a>0.0)color.rgb=encodeSRGB(color.rgb/color.a)*color.a;}`;
    const spriteProgram = createProgram('sprite', { vertex: SPRITE_VERTEX, fragment: spriteFragment });
    for (const [unit, [id, img]] of textureEntries.entries()) {
      const descriptor = scene.textures[id], texture = gl.createTexture(); textures.set(id, { texture, unit });
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, linear && descriptor.colorSpace === 1 ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, descriptor.settings.m_WrapU === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, descriptor.settings.m_WrapV === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (descriptor.mipCount > 1) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, descriptor.mipCount > 1 ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
    }
    function makeDraw(descriptor, geometry, p, first = 0, count = geometry.indices.length, material = null) {
      const vao = gl.createVertexArray(); vaos.push(vao); gl.bindVertexArray(vao);
      for (const [name, array, size] of descriptor.kind === 'sprite' ? [['position', geometry.positions, 3], ['uv', geometry.uv, 2]] : [['in_POSITION0', geometry.positions, 3], ['in_TEXCOORD0', geometry.uv, 2]]) {
        const location = gl.getAttribLocation(p.program, name); if (location < 0) continue;
        const buffer = gl.createBuffer(); buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array.flat()), gl.STATIC_DRAW); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }
      const indexBuffer = gl.createBuffer(); buffers.push(indexBuffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
      return { ...descriptor, vao, p, first, count, material };
    }
    const draws = [];
    for (const draw of activeDraws) {
      if (draw.kind === 'sprite') draws.push(makeDraw(draw, vinylSpriteGeometry(scene.sprites[draw.sprite], draw), spriteProgram));
      else {
        const mesh = scene.meshes[draw.mesh];
        draw.materials.forEach((id, i) => { const part = mesh.subMeshes[i]; if (part) draws.push(makeDraw(draw, mesh, programs.get(scene.materials[id].program), part.first, part.count, scene.materials[id])); });
      }
    }
    function local(id, armDegrees, recordDegrees) {
      const n = nodes[id], rotation = n.rotation;
      let q = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      if (n.name === 'TurntableGan') q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), armDegrees * Math.PI / 180);
      if (n.name === 'Vinyl') q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), recordDegrees * Math.PI / 180));
      const matrix = new Matrix4().compose(vec(n.position), q, vec(n.scale)); localMatrices.set(id, matrix); return matrix;
    }
    function world(id, motion) {
      if (matrices.has(id)) return matrices.get(id);
      const n = nodes[id], matrix = local(id, motion.armDegrees, motion.recordDegrees);
      if (n.parent !== '0') matrix.premultiply(world(n.parent, motion));
      matrices.set(id, matrix); return matrix;
    }
    const cameraRotation = scene.camera.Rotation;
    const cameraWorld = new Matrix4().compose(vec(scene.camera.Position), new Quaternion().setFromEuler(new Euler(cameraRotation.x * Math.PI / 180, cameraRotation.y * Math.PI / 180, cameraRotation.z * Math.PI / 180, 'YXZ')), new Vector3(1, 1, 1));
    const view = new Matrix4().makeScale(1, 1, -1).multiply(cameraWorld.clone().invert());
    const vp = new Matrix4(), mvp = new Matrix4(), projected = new Vector3();
    const motion = createVinylMotion(scene.animations, scene.runtime._vinylRotationSpeed);
    function projectUI(x, y) {
      const s = scene.canvas.scale.x, p = scene.canvas.position;
      projected.set(p.x + x * s, p.y + y * s, p.z).applyMatrix4(vp);
      return [(projected.x + 1) * width / 2, (1 - projected.y) * height / 2];
    }
    const text = (className, fontSize, alpha = 1) => {
      const node = document.createElement('div'); node.className = className;
      node.style.cssText = `position:absolute;font-family:JMGOLight,sans-serif;font-weight:300;color:rgba(255,255,255,${alpha});line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:clip;`;
      node.dataset.sourceSize = fontSize; overlay.append(node); return node;
    };
    const titleNode = text('jmgo-vinyl-title', 80, 0.6), artistNode = text('jmgo-vinyl-artist', 45, 0.6);
    const lyricWindow = document.createElement('div'); lyricWindow.style.cssText = 'position:absolute;overflow:hidden;'; overlay.append(lyricWindow);
    lyricLayout = createVinylLyricLayout(lyricWindow, { setLyricText, animateLyricText, getLyricFont });
    let lastTitle = '', lastArtist = '';
    function positionOverlay() {
      const px = scene.canvas.scale.x * height / (2 * scene.camera.orthographicSize);
      const [titleX, titleY] = projectUI(202.0376, 569.997);
      titleNode.style.left = `${titleX}px`; titleNode.style.top = `${titleY - 80 * px / 2}px`;
      titleNode.style.fontSize = `${80 * px}px`; titleNode.style.width = `${763.738 * px}px`;
      const [artistX, artistY] = projectUI(197.3478, 487.2241);
      artistNode.style.left = `${artistX}px`; artistNode.style.top = `${artistY - 45 * px / 2}px`;
      artistNode.style.fontSize = `${45 * px}px`; artistNode.style.width = `${679.696 * px}px`;
      const [left, top] = projectUI(201.6044, scene.runtime.topLimit - 90);
      lyricWindow.style.left = `${left}px`; lyricWindow.style.top = `${top}px`;
      lyricWindow.style.width = `${650 * px}px`; lyricWindow.style.height = `${(scene.runtime.topLimit - scene.runtime.bottomLimit) * px}px`;
      // The source graphic mask is disabled; retain the window without inventing an edge fade.
      return px;
    }
    function resize(w, h, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return; width = w; height = h;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); gl.viewport(0, 0, canvas.width, canvas.height);
      const halfY = scene.camera.orthographicSize, halfX = halfY * w / h;
      const camera = new OrthographicCamera(-halfX, halfX, halfY, -halfY, scene.camera.nearClipPlane, scene.camera.farClipPlane);
      vp.multiplyMatrices(camera.projectionMatrix, view); positionOverlay();
    }
    function render(snapshot = {}) {
      if (disposed || gl.isContextLost()) return;
      const t = Number.isFinite(snapshot.time) ? snapshot.time : 0, frameMotion = motion(snapshot);
      matrices.clear(); localMatrices.clear();
      gl.clearColor(0, 0, 0, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.frontFace(gl.CW);
      const ordered = [...draws].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'mesh' ? -1 : 1;
        return world(b.node, frameMotion).elements[14] - world(a.node, frameMotion).elements[14];
      });
      for (const draw of ordered) {
        const { p } = draw, model = world(draw.node, frameMotion);
        gl.useProgram(p.program); gl.bindVertexArray(draw.vao);
        if (draw.kind === 'sprite') {
          gl.disable(gl.CULL_FACE); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          mvp.multiplyMatrices(vp, model); gl.uniformMatrix4fv(p.uniform('mvp'), false, mvp.elements);
          gl.uniform4fv(p.uniform('tint'), draw.color);
          gl.uniform1i(p.uniform('map'), textures.get(scene.sprites[draw.sprite].texture).unit);
        } else {
          const material = draw.material, state = scene.programs[material.program];
          const resolveState = name => material.floats[state.stateBindings?.[name]] ?? state[name];
          const cull = resolveState('cull'), srcBlend = resolveState('srcBlend'), dstBlend = resolveState('dstBlend');
          gl.depthMask(!!resolveState('zWrite'));
          if (srcBlend === 1 && dstBlend === 0) gl.disable(gl.BLEND);
          else {
            const blendModes = [gl.ZERO, gl.ONE, gl.DST_COLOR, gl.SRC_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA,
              gl.ONE_MINUS_SRC_COLOR, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA];
            gl.enable(gl.BLEND); gl.blendFunc(blendModes[srcBlend] ?? gl.ONE, blendModes[dstBlend] ?? gl.ZERO);
          }
          if (cull === 0) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 1 ? gl.FRONT : gl.BACK); }
          gl.uniform4fv(p.uniform('hlslcc_mtx4x4unity_ObjectToWorld[0]'), model.elements);
          gl.uniform4fv(p.uniform('hlslcc_mtx4x4unity_MatrixVP[0]'), vp.elements);
          for (const [name, value] of Object.entries(material.floats)) gl.uniform1f(p.uniform(name), value);
          for (const [name, value] of Object.entries(material.colors)) gl.uniform4fv(p.uniform(name), value);
          const texture = material.textures._BaseMap;
          gl.uniform1i(p.uniform('_BaseMap'), textures.get(texture?.texture === '0' || !texture ? scene.defaultCover : texture.texture).unit);
          gl.uniform4f(p.uniform('_BaseMap_ST'), texture?.scale.x ?? 1, texture?.scale.y ?? 1, texture?.offset.x ?? 0, texture?.offset.y ?? 0);
        }
        gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, draw.first * 2);
      }
      const title = snapshot.title || snapshot.songTitle || '黑胶唱机', artist = snapshot.artist || '';
      if (title !== lastTitle) { titleNode.textContent = title; lastTitle = title; }
      if (artist !== lastArtist) { artistNode.textContent = artist; lastArtist = artist; }
      artistNode.hidden = !artist;
      overlay.hidden = snapshot.showText === false;
      const px = positionOverlay();
      lyricLayout.update({ ...snapshot, time: t }, {
        px, width: 650 * px, height: (scene.runtime.topLimit - scene.runtime.bottomLimit) * px,
        activeScale: scene.runtime.centerScale, padding: scene.runtime.padding, duration: scene.runtime.duration,
      });
    }
    return { resize, render, dispose, scene, overlay, gl, info: { sprites: draws.filter(d => d.kind === 'sprite').length, meshes: draws.filter(d => d.kind === 'mesh').length, textures: textures.size, programs: programs.size, animationClips: 4, source: 'JMGO VinylLRC / Cover2D03', summary: '原始唱盘/唱针贴图与切片几何、封面网格、1 秒唱针曲线；歌词与元数据按原布局投影' } };
  } catch (error) { dispose(); throw error; }
}
