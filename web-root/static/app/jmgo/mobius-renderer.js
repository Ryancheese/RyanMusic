// Original JMGO Mobius meshes, hierarchy, vertex+fragment arithmetic and material state.
// Three supplies matrix math only; drawing uses native WebGL2 to preserve GLSL programs.
import { Matrix4, Vector3, Quaternion, Euler } from './vendor/three.module.js';
import { readAsset, loadAssetImage } from './assets.js';
import { rhythmAmount } from './rhythm.js';

const BASE = new URL('./mobius/', import.meta.url);
async function load(path, json = false, base = BASE) {
  return readAsset(new URL(path, base), json ? 'json' : 'text');
}
function loadImage(path, base = BASE) {
  return loadAssetImage(new URL(path, base));
}
function shader(gl, type, text) {
  const result = gl.createShader(type); gl.shaderSource(result, text); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result); gl.deleteShader(result); throw new Error(message);
  }
  return result;
}

export async function createMobiusRenderer(canvas, { linear = false, assetBase = BASE } = {}) {
  const base = new URL(assetBase, location.href);
  const scene = await load('scene.json', true, base);
  const [shaderSources, meshData, imageData] = await Promise.all([
    Promise.all(Object.entries(scene.shaders).map(async ([id, value]) => [id, { ...value, vertex: await load(value.vert, false, base), fragment: await load(value.frag, false, base) }])),
    Promise.all(Object.entries(scene.meshes).map(async ([id, value]) => [id, await load(value.file, true, base)])),
    Promise.all(Object.entries(scene.textures).map(async ([id, value]) => [id, await loadImage(value.file, base)])),
  ]);
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('莫比乌斯光环需要 WebGL2。');
  const programs = new Map(), meshes = new Map(), textures = new Map();
  const shaderObjects = [], buffers = [], vaos = [];
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    programs.forEach(p => gl.deleteProgram(p.program));
    textures.forEach(t => gl.deleteTexture(t)); buffers.forEach(b => gl.deleteBuffer(b));
    vaos.forEach(v => gl.deleteVertexArray(v)); shaderObjects.forEach(s => gl.deleteShader(s));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  try {
    for (const [id, source] of shaderSources) {
      let fragment = source.fragment;
      if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
        vec3 encodeSRGB(vec3 x) { return mix(12.92*x,1.055*pow(max(x,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x)); }
        void main() { originalMain(); SV_Target0.rgb = encodeSRGB(SV_Target0.rgb); }
      `;
      const vs = shader(gl, gl.VERTEX_SHADER, source.vertex); shaderObjects.push(vs);
      const fs = shader(gl, gl.FRAGMENT_SHADER, fragment); shaderObjects.push(fs);
      const program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      programs.set(id, { program, state: source.state, uniforms: new Map() });
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
        const info = gl.getActiveUniform(program, i);
        programs.get(id).uniforms.set(info.name.replace(/\[0\]$/, ''), { type: info.type, size: info.size, location: gl.getUniformLocation(program, info.name) });
      }
    }
    for (const [id, pixels] of imageData) {
      const tex = gl.createTexture(); textures.set(id, tex); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      const settings = scene.textures[id];
      gl.texImage2D(gl.TEXTURE_2D, 0, linear && settings.colorSpace === 1 ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, settings.settings.m_WrapU === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, settings.settings.m_WrapV === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (settings.mipCount > 1) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, settings.mipCount > 1 ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
    }
    for (const [id, data] of meshData) {
      const attributes = {};
      for (const [name, value, components] of [['in_POSITION0', data.positions, 3], ['in_NORMAL0', data.normals, 3], ['in_TEXCOORD0', data.uv, 2]]) {
        const buffer = gl.createBuffer(); buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(value.flat()), gl.STATIC_DRAW);
        attributes[name] = { buffer, components };
      }
      const index = gl.createBuffer(); buffers.push(index); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
      meshes.set(id, { attributes, index, count: data.indices.length });
    }
    const nodes = new Map(scene.nodes.map(node => [node.id, {
      ...node, p: new Vector3(...node.position), q: new Quaternion(...node.quaternion), s: new Vector3(...node.scale),
      local: new Matrix4(), world: new Matrix4(), inverse: new Matrix4(),
    }]));
    const draws = scene.draws.filter(d => d.enabled).map(draw => {
      const material = scene.materials[draw.material], program = programs.get(material.shader), mesh = meshes.get(draw.mesh);
      const vao = gl.createVertexArray(); vaos.push(vao); gl.bindVertexArray(vao);
      for (const [name, attribute] of Object.entries(mesh.attributes)) {
        const location = gl.getAttribLocation(program.program, name);
        if (location < 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer); gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, attribute.components, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      return { ...draw, material, program, mesh, vao, node: nodes.get(draw.node) };
    }).sort((a, b) => b.program.state.depthWrite - a.program.state.depthWrite);
    const c = scene.camera;
    const cameraWorld = new Matrix4().compose(new Vector3(c.Position.x, c.Position.y, c.Position.z),
      new Quaternion().setFromEuler(new Euler(c.Rotation.x * Math.PI / 180, c.Rotation.y * Math.PI / 180, c.Rotation.z * Math.PI / 180)), new Vector3(1, 1, 1));
    const view = cameraWorld.clone().invert(), projection = new Matrix4(), vp = new Matrix4();
    const spin = new Quaternion(), q = new Quaternion(), euler = new Euler();
    const deg = Math.PI / 180;
    function resize(width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const f = 1 / Math.tan(c.fieldOfView * Math.PI / 360), n = c.nearClipPlane, far = c.farClipPlane;
      // Unity left-handed view space, +Z forward, OpenGL NDC depth -1..1.
      projection.set(f / (width / height), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + n) / (far - n), -2 * far * n / (far - n), 0, 0, 1, 0);
      vp.multiplyMatrices(projection, view);
    }
    const blendEnum = value => ({0:gl.ZERO,1:gl.ONE,2:gl.DST_COLOR,3:gl.SRC_COLOR,4:gl.ONE_MINUS_DST_COLOR,5:gl.SRC_ALPHA,6:gl.ONE_MINUS_SRC_COLOR,7:gl.DST_ALPHA,8:gl.ONE_MINUS_DST_ALPHA,9:gl.SRC_ALPHA_SATURATE,10:gl.ONE_MINUS_SRC_ALPHA}[value] ?? gl.ONE);
    function upload(program, name, value) {
      const u = program.uniforms.get(name); if (!u) return;
      switch (u.type) {
        case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.location, value) : gl.uniform1f(u.location, value); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.location, value); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.location, value); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.location, value); break;
        case gl.SAMPLER_2D: gl.uniform1i(u.location, value); break;
      }
    }
    let rhythmTime = null, flowAccent = 0;
    const scaleAccent = new Vector3();
    function render({ time = 0, low = 0, mid = 0, beat = 0, energy = 0, rhythmEnabled = true, rhythmStrength = 1 } = {}) {
      if (disposed || gl.isContextLost()) return;
      const strength = rhythmEnabled ? rhythmAmount(rhythmStrength) : 0;
      const delta = rhythmTime === null ? 0 : time - rhythmTime;
      if (delta < 0 || delta > 0.5 || !strength) flowAccent = 0;
      else flowAccent += Math.max(0, delta) * strength * (energy * 0.38 + beat * 0.85);
      rhythmTime = time;
      // Deliberate enhanced mode: beat-linked breathing and flowing highlights.
      // No camera motion or unrelated shake; the saved rig transform remains the base.
      const breathing = 1 + strength * (0.07 * energy + 0.13 * beat);
      gl.depthMask(true); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // Serialized motion factors are known; their exact native update equations remain unverified.
      const r = scene.driver.rotationFactor;
      spin.setFromEuler(euler.set(r[0] * time * deg, r[1] * time * deg, r[2] * time * deg));
      const done = new Set();
      function world(node) {
        if (done.has(node.id)) return node.world;
        q.copy(node.q); if (node.name === 'Mobius' && scene.driver.rotateSelf) q.multiply(spin);
        node.local.compose(node.p, q, node.name === 'Mobius' ? scaleAccent.copy(node.s).multiplyScalar(breathing) : node.s);
        const parent = nodes.get(node.parent);
        parent ? node.world.multiplyMatrices(world(parent), node.local) : node.world.copy(node.local);
        done.add(node.id); return node.world;
      }
      for (const draw of draws) {
        const { program, material, mesh, node } = draw;
        if (!node.active) continue;
        world(node); node.inverse.copy(node.world).invert();
        gl.useProgram(program.program); gl.bindVertexArray(draw.vao);
        const state = program.state, blend = state.blend;
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(!!state.depthWrite);
        gl.enable(gl.CULL_FACE); gl.frontFace(gl.CW); gl.cullFace(state.cull === 1 ? gl.FRONT : gl.BACK);
        if (state.cull === 0) gl.disable(gl.CULL_FACE);
        if (blend.srcBlend === 1 && blend.destBlend === 0) gl.disable(gl.BLEND);
        else { gl.enable(gl.BLEND); gl.blendFuncSeparate(blendEnum(blend.srcBlend), blendEnum(blend.destBlend), blendEnum(blend.srcBlendAlpha), blendEnum(blend.destBlendAlpha)); }
        for (const [name, value] of Object.entries(material.floats)) upload(program, name, value);
        for (const [name, value] of Object.entries(material.colors)) upload(program, name, value);
        if (strength) {
          if ('_mHDR' in material.floats) upload(program, '_mHDR', material.floats._mHDR * (1 + strength * (0.18 * energy + 0.42 * beat)));
          if ('_Push' in material.floats) upload(program, '_Push', material.floats._Push * (1 + strength * 0.55 * beat));
          if ('_AlphaIntensity' in material.floats) upload(program, '_AlphaIntensity', Math.min(1, material.floats._AlphaIntensity + strength * beat * 0.25));
        }
        upload(program, 'hlslcc_mtx4x4unity_MatrixVP', vp.elements);
        upload(program, 'hlslcc_mtx4x4unity_ObjectToWorld', node.world.elements);
        upload(program, 'hlslcc_mtx4x4unity_WorldToObject', node.inverse.elements);
        upload(program, '_WorldSpaceCameraPos', [c.Position.x, c.Position.y, c.Position.z]);
        upload(program, '_UVTime', scene.driver.curValue + time * scene.driver.Speed + low * scene.driver.frequency + flowAccent + strength * beat * 0.08);
        let unit = 0;
        for (const [name, texture] of Object.entries(material.textures)) {
          gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, textures.get(texture)); upload(program, name, unit++);
        }
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.depthMask(true);
    }
    return { resize, render, dispose, scene, gl,
      info: { meshes: meshes.size, draws: draws.length, shaders: programs.size, textures: textures.size,
        vertices: Object.values(scene.meshes).reduce((sum, m) => sum + m.vertices, 0) } };
  } catch (error) { dispose(); throw error; }
}
