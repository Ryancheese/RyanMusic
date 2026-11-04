import { Matrix4, Vector3, Quaternion, PerspectiveCamera } from './vendor/three.module.js';
import { readAsset, loadAssetImage } from './assets.js';
import { rhythmAmount } from './rhythm.js';

const ASSETS = new URL('./elantra/', import.meta.url);
async function load(file, base, json = false) {
  return readAsset(new URL(file, base), json ? 'json' : 'text');
}
const loadImage = (file, base) => loadAssetImage(new URL(file, base));

export function elantraRhythmBands({ low = 0, mid = 0, bands, beat = 0, rhythmEnabled = true, rhythmStrength = 1 } = {}) {
  const strength = rhythmEnabled ? rhythmAmount(rhythmStrength) : 0;
  // Preserve all eight actual bands: an onset accents the low end, not every band.
  const kickWeights = [0.45, 0.35, 0.17, 0.08, 0.03, 0, 0, 0];
  return Array.from({ length: 8 }, (_, i) => {
    const value = Number.isFinite(bands?.[i]) ? Math.max(0, bands[i]) : Math.max(0, i < 2 ? low : mid);
    if (!strength) return value;
    const shaped = Math.min(1.4, value ** 1.2 * (i < 2 ? 1.65 : i < 5 ? 1.45 : 1.3) + beat * kickWeights[i]);
    return Math.min(1.6, Math.max(0, value + strength * (shaped - value)));
  });
}

/** Original 600-vertex JMGO DynamicGeometry shader; ordinary uniforms replace Unity UBOs. */
export async function createElantraRenderer(canvas, { linear = false, assetBase = ASSETS } = {}) {
  const base = new URL(assetBase, location.href);
  const [scene, mesh, vertex, originalFragment] = await Promise.all([
    load('scene.json', base, true), load('mesh.json', base, true), load('vertex.glsl', base), load('fragment.glsl', base),
  ]);
  const images = await Promise.all(scene.textures.map(t => loadImage(t.file, base)));
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('动态几何球需要 WebGL2 支持。');
  const programs = [], shaders = [], buffers = [], textures = [], vaos = [];
  let disposed = false, viewportHeight = 1;
  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers.forEach(b => gl.deleteBuffer(b)); textures.forEach(t => gl.deleteTexture(t));
    vaos.forEach(v => gl.deleteVertexArray(v)); programs.forEach(p => gl.deleteProgram(p));
    shaders.forEach(s => gl.deleteShader(s)); gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function compile(type, source) {
    const shader = gl.createShader(type); shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`动态几何球 Shader：${gl.getShaderInfoLog(shader)}`);
    return shader;
  }
  function program(vs, fs) {
    const result = gl.createProgram(); programs.push(result);
    gl.attachShader(result, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
    return result;
  }
  function attribute(p, name, values, size, usage = gl.STATIC_DRAW) {
    const loc = gl.getAttribLocation(p, name); if (loc < 0) return null;
    const buffer = gl.createBuffer(); buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, values, usage); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return buffer;
  }
  const uniformLocations = new Map();
  function location(p, name) {
    let map = uniformLocations.get(p);
    if (!map) { map = new Map(); uniformLocations.set(p, map); }
    if (!map.has(name)) map.set(name, gl.getUniformLocation(p, name));
    return map.get(name);
  }
  const u1 = (p, name, value) => gl.uniform1f(location(p, name), value);
  const u4 = (p, name, values) => gl.uniform4fv(location(p, name), values);
  try {
    let fragment = originalFragment;
    if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
      vec3 encodeSRGB(vec3 x) {return mix(12.92*x,1.055*pow(max(x,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x));}
      void main(){originalMain(); SV_Target0.rgb=encodeSRGB(SV_Target0.rgb);}
    `;
    const sphereProgram = program(vertex, fragment);
    const vao = gl.createVertexArray(); vaos.push(vao); gl.bindVertexArray(vao);
    attribute(sphereProgram, 'in_POSITION0', new Float32Array(mesh.positions.flat()), 3);
    attribute(sphereProgram, 'in_NORMAL0', new Float32Array(mesh.normals.flat()), 3);
    attribute(sphereProgram, 'in_TEXCOORD0', new Float32Array(mesh.uv.flat()), 2);
    attribute(sphereProgram, 'in_TEXCOORD1', new Float32Array(mesh.uv1.flat()), 2);
    const indices = gl.createBuffer(); buffers.push(indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    gl.useProgram(sphereProgram);
    const props = scene.material.m_SavedProperties;
    const floats = Object.fromEntries(props.m_Floats), colors = Object.fromEntries(props.m_Colors), envs = Object.fromEntries(props.m_TexEnvs);
    for (const [name, value] of Object.entries(floats)) u1(sphereProgram, name, value);
    const blink = colors._BlinkingSpeed;
    gl.uniform2f(location(sphereProgram, '_BlinkingSpeed'), blink.r, blink.g);
    const outline = envs._OutlineMap;
    u4(sphereProgram, '_OutlineMap_ST', [outline.m_Scale.x, outline.m_Scale.y, outline.m_Offset.x, outline.m_Offset.y]);
    const textureMap = new Map();
    for (const [i, descriptor] of scene.textures.entries()) {
      const texture = gl.createTexture(); textures.push(texture); textureMap.set(descriptor.file, { texture, unit: i });
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, linear && descriptor.colorSpace === 1 ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, descriptor.settings.m_WrapU === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, descriptor.settings.m_WrapV === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const mip = descriptor.mipCount > 1;
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
    }
    for (const [name, file] of Object.entries(scene.uniformTextures)) gl.uniform1i(location(sphereProgram, name), textureMap.get(file).unit);

    const pos = scene.transform.m_LocalPosition, rot = scene.transform.m_LocalRotation, scale = scene.transform.m_LocalScale;
    const world = new Matrix4().compose(new Vector3(pos.x, pos.y, pos.z), new Quaternion(rot.x, rot.y, rot.z, rot.w), new Vector3(scale.x, scale.y, scale.z));
    u4(sphereProgram, 'hlslcc_mtx4x4unity_ObjectToWorld[0]', world.elements);
    u4(sphereProgram, 'hlslcc_mtx4x4unity_WorldToObject[0]', world.clone().invert().elements);
    const camera = scene.camera;
    const cameraWorld = new Matrix4().makeTranslation(camera.Position.x, camera.Position.y, camera.Position.z);
    // Unity shader view space faces -Z although the identity camera faces world +Z.
    const view = new Matrix4().makeScale(1, 1, -1).multiply(cameraWorld.clone().invert());
    u4(sphereProgram, 'hlslcc_mtx4x4unity_MatrixV[0]', view.elements);
    const projection = new PerspectiveCamera(camera.fieldOfView, 16 / 9, camera.nearClipPlane, camera.farClipPlane);
    const vp = new Matrix4();

    // CircleEffect uses a serialized ParticleSystem. Billboard pixels use the source
    // circle texture; burst cadence is a documented low-band adapter approximation.
    const particleProgram = program(`#version 300 es
      precision highp float;
      in vec3 position; in float alpha;
      uniform mat4 vp; uniform float viewportHeight; uniform float pointSize;
      out float particleAlpha;
      void main(){gl_Position=vp*vec4(position,1.0);gl_PointSize=pointSize*viewportHeight/gl_Position.w;particleAlpha=alpha;}
    `, `#version 300 es
      precision highp float;
      uniform sampler2D circle; in float particleAlpha; out vec4 color;
      void main(){vec4 tex=texture(circle,vec2(gl_PointCoord.x,1.0-gl_PointCoord.y));color=vec4(tex.rgb,tex.a*particleAlpha);}
    `);
    const particleVAO = gl.createVertexArray(); vaos.push(particleVAO); gl.bindVertexArray(particleVAO);
    const count = scene.particle.EmissionModule.m_Bursts[0].countCurve.scalar;
    const lifetime = scene.particle.InitialModule.startLifetime.scalar;
    const radius = scene.particle.ShapeModule.radius.value;
    const speed = scene.particle.InitialModule.startSpeed.scalar;
    const startSize = scene.particle.InitialModule.startSize.scalar;
    const particlePositions = new Float32Array(count * 3), particleAlpha = new Float32Array(count);
    const positionBuffer = attribute(particleProgram, 'position', particlePositions, 3, gl.DYNAMIC_DRAW);
    const alphaBuffer = attribute(particleProgram, 'alpha', particleAlpha, 1, gl.DYNAMIC_DRAW);
    gl.useProgram(particleProgram);
    const circle = textureMap.get('DynamicGeometry_Circle.png');
    gl.uniform1i(location(particleProgram, 'circle'), circle.unit);
    let burstTime = null, lastTime = null, lastLow = 0, burstEnergy = 0;
    const particlePointSize = startSize / (2 * Math.tan(camera.fieldOfView * Math.PI / 360));
    function resize(width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      viewportHeight = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      projection.aspect = width / height; projection.updateProjectionMatrix();
      vp.multiplyMatrices(projection.projectionMatrix, view);
      gl.useProgram(sphereProgram); u4(sphereProgram, 'hlslcc_mtx4x4unity_MatrixVP[0]', vp.elements);
      gl.useProgram(particleProgram); gl.uniformMatrix4fv(location(particleProgram, 'vp'), false, vp.elements);
    }
    function render({ time = 0, low = 0, mid = 0, bands, beat = 0, energy = 0, onset = false, paused = false, rhythmEnabled = true, rhythmStrength = 1 } = {}) {
      if (disposed || gl.isContextLost()) return;
      const strength = rhythmEnabled ? rhythmAmount(rhythmStrength) : 0;
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
      // The original Forward pass uses Cull Back (Unity enum 2). Unreflected Unity
      // geometry viewed along world +Z has clockwise front faces in this GL wrapper.
      const cull = scene.forwardState.culling.val;
      gl.frontFace(gl.CW);
      if (cull === 0) gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 1 ? gl.FRONT : gl.BACK); }
      gl.useProgram(sphereProgram); gl.bindVertexArray(vao);
      u4(sphereProgram, '_TimeParameters', [time, Math.sin(time), Math.cos(time), 0]);
      const drivenBands = elantraRhythmBands({ low, mid, bands, beat, rhythmEnabled, rhythmStrength });
      for (let i = 0; i < 8; i++) u1(sphereProgram, `AudioStrength${i}`, drivenBands[i]);
      // User-requested stronger deformation uses existing original shader uniforms;
      // the GLSL body, source mesh, camera and saved transform remain unchanged.
      u1(sphereProgram, '_LowIntensity', floats._LowIntensity * (1 + strength * 2.6));
      u1(sphereProgram, '_MiddleIntensity', floats._MiddleIntensity * (1 + strength * 2.1));
      u1(sphereProgram, '_HighIntensity', floats._HighIntensity * (1 + strength * 1.8));
      u1(sphereProgram, '_Control', floats._Control * (1 + strength * beat * 0.3));
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      const discontinuity = lastTime !== null && (time < lastTime || time - lastTime > 0.5);
      if (strength) {
        if (discontinuity) burstTime = null;
        if (onset && !paused && (lastTime === null || time > lastTime) && (burstTime === null || time - burstTime > 0.16)) {
          burstTime = time; burstEnergy = Math.max(0.35, energy);
        }
      } else {
        if (burstTime === null || discontinuity) burstTime = time;
        if (low > 0.55 && lastLow <= 0.55 && time - burstTime > 0.5) burstTime = time;
      }
      const age = burstTime === null ? Infinity : Math.max(0, time - burstTime);
      const burstDuration = strength ? Math.min(0.85, lifetime * 0.4) : lifetime * 0.4;
      if (age < burstDuration) {
        const fade = 1 - age / burstDuration;
        for (let i = 0; i < count; i++) {
          const angle = i / count * Math.PI * 2;
          const r = radius + age * speed * (1 + strength * 1.2);
          particlePositions[i * 3] = pos.x + Math.cos(angle) * r;
          particlePositions[i * 3 + 1] = pos.y + Math.sin(angle) * r;
          particlePositions[i * 3 + 2] = pos.z;
          // Source random gradient is white for its first half and black for its second.
          let seed = Math.imul(i + 1, 0x45d9f3b);
          seed ^= seed >>> 16; seed = Math.imul(seed, 0x45d9f3b); seed ^= seed >>> 16;
          const random = (seed >>> 0) / 4294967296;
          particleAlpha[i] = random < 0.5 ? fade * (strength ? Math.min(1, 0.6 + burstEnergy * 0.4) : 1) : 0;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, particlePositions);
        gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, particleAlpha);
        gl.useProgram(particleProgram); gl.bindVertexArray(particleVAO);
        u1(particleProgram, 'viewportHeight', viewportHeight);
        u1(particleProgram, 'pointSize', particlePointSize * (1 + strength * burstEnergy * 0.4) * Math.max(0, 1 - age / (strength ? burstDuration : lifetime)));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.drawArrays(gl.POINTS, 0, count); gl.depthMask(true); gl.disable(gl.BLEND);
      }
      lastTime = time; lastLow = low;
    }
    return { resize, render, dispose, gl, scene, info: { vertices: mesh.positions.length, indices: mesh.indices.length, textures: textures.length, shader: 'JMGO/Music/DynamicGeometry', sourceMesh: mesh.name, bands: 8 } };
  } catch (error) { dispose(); throw error; }
}
