// Original JMGO MusicFX mesh deformation and MatCap/outline fragment program.
// ShapesFXSetting-to-audio mapping, shape activation and shared camera are documented adapters.
import { Matrix4, Quaternion, Vector3, Euler, PerspectiveCamera } from './vendor/three.module.js';
import { readAsset, loadAssetImage } from './assets.js';
import { rhythmAmount } from './rhythm.js';

const ASSETS = new URL('./shapes/', import.meta.url);
const loadImage = loadAssetImage;
const read = readAsset;
const vector = value => new Vector3(value.x, value.y, value.z);

export function shapesVariantIndex(value, time = 0, count = 5) {
  if (value === 'auto' || value === -1 || value === '-1') return Math.floor(Math.max(0, time) / 12) % count;
  const fallback = Math.min(2, Math.max(0, count - 1));
  const index = Number(value ?? fallback);
  return Number.isInteger(index) && index >= 0 && index < count ? index : fallback;
}

export async function createShapesRenderer(canvas, { linear = false, assetBase = ASSETS } = {}) {
  const base = new URL(assetBase, location.href);
  const [scene, vertex, originalFragment] = await Promise.all([
    read(new URL('scene.json', base), 'json'), read(new URL('vertex.glsl', base)), read(new URL('fragment.glsl', base)),
  ]);
  const [meshBuffers, images] = await Promise.all([
    Promise.all(Object.entries(scene.meshes).map(async ([id, mesh]) => [id, await read(new URL(mesh.file, base), 'buffer')])),
    Promise.all(scene.textures.map(texture => loadImage(new URL(texture.file, base)))),
  ]);
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('轮廓几何需要 WebGL2 支持。');
  const buffers = [], shaders = [], textures = [], vaos = [], locations = new Map();
  let disposed = false, program;
  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers.forEach(buffer => gl.deleteBuffer(buffer)); shaders.forEach(shader => gl.deleteShader(shader));
    textures.forEach(texture => gl.deleteTexture(texture)); vaos.forEach(vao => gl.deleteVertexArray(vao));
    if (program) gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function compile(type, source) {
    const shader = gl.createShader(type); shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`轮廓几何 Shader：${gl.getShaderInfoLog(shader)}`);
    return shader;
  }
  function location(name) {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name);
  }
  const u1 = (name, value) => gl.uniform1f(location(name), value);
  const u4 = (name, value) => gl.uniform4fv(location(name), value);
  try {
    let fragment = originalFragment;
    if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
      vec3 encodeSRGB(vec3 x) {return mix(12.92*x,1.055*pow(max(x,vec3(0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x));}
      void main(){originalMain();SV_Target0.rgb=encodeSRGB(SV_Target0.rgb);}
    `;
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`轮廓几何 Shader 链接失败：${gl.getProgramInfoLog(program)}`);
    gl.useProgram(program);
    const geometries = new Map();
    for (const [id, binary] of meshBuffers) {
      const descriptor = scene.meshes[id], vao = gl.createVertexArray(); vaos.push(vao); gl.bindVertexArray(vao);
      const buffer = gl.createBuffer(); buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(binary, 0, descriptor.indexOffset), gl.STATIC_DRAW);
      for (const [name, attribute] of Object.entries(descriptor.attributes)) {
        const loc = gl.getAttribLocation(program, name);
        if (loc < 0) continue;
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, attribute.size, gl.FLOAT, false, 0, attribute.byteOffset);
      }
      const indexBuffer = gl.createBuffer(); buffers.push(indexBuffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(binary, descriptor.indexOffset, descriptor.indexCount), gl.STATIC_DRAW);
      const frameAttribute = name => {
        const attribute = descriptor.attributes[name];
        return new Float32Array(binary, attribute.byteOffset, attribute.length);
      };
      geometries.set(id, { vao, count: descriptor.indexCount,
        framing: { positions: frameAttribute('in_POSITION0'), normals: frameAttribute('in_NORMAL0'),
          uv3: frameAttribute('in_TEXCOORD3'), uv4: frameAttribute('in_TEXCOORD4') } });
    }
    const textureUnits = new Map();
    for (const [unit, descriptor] of scene.textures.entries()) {
      const texture = gl.createTexture(); textures.push(texture); textureUnits.set(descriptor.id, unit);
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, linear && descriptor.colorSpace === 1 ? gl.SRGB8_ALPHA8 : gl.RGBA8,
        gl.RGBA, gl.UNSIGNED_BYTE, images[unit]);
      const wrap = value => value === 1 ? gl.CLAMP_TO_EDGE : value === 2 ? gl.MIRRORED_REPEAT : gl.REPEAT;
      const point = descriptor.settings.m_FilterMode === 0, trilinear = descriptor.settings.m_FilterMode === 2;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap(descriptor.settings.m_WrapU));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap(descriptor.settings.m_WrapV));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, point ? gl.NEAREST : gl.LINEAR);
      if (descriptor.mipCount > 1) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, descriptor.mipCount > 1
        ? point ? gl.NEAREST_MIPMAP_NEAREST : trilinear ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_NEAREST
        : point ? gl.NEAREST : gl.LINEAR);
    }
    const localMatrices = new Map();
    for (const [id, node] of Object.entries(scene.nodes)) {
      const q = node.rotation;
      localMatrices.set(id, new Matrix4().compose(vector(node.position), new Quaternion(q.x, q.y, q.z, q.w), vector(node.scale)));
    }
    function sourceWorld(id) {
      const node = scene.nodes[id], matrix = localMatrices.get(id).clone();
      if (node.parent !== '0') matrix.premultiply(sourceWorld(node.parent));
      return matrix;
    }
    const sourceWorlds = scene.draws.map(draw => sourceWorld(draw.node));
    const cameraWorld = new Matrix4().makeTranslation(scene.camera.Position.x, scene.camera.Position.y, scene.camera.Position.z);
    const view = new Matrix4().makeScale(1, 1, -1).multiply(cameraWorld.clone().invert());
    u4('hlslcc_mtx4x4unity_MatrixInvV[0]', view.clone().invert().elements);
    const projection = new PerspectiveCamera(scene.camera.fieldOfView, 16 / 9, scene.camera.nearClipPlane, scene.camera.farClipPlane);
    const vp = new Matrix4(), rotationMatrix = new Matrix4(), world = new Matrix4(), inverse = new Matrix4();
    const rootRotation = new Quaternion();
    const camera = scene.camera;
    const halfFovTangent = Math.tan(camera.fieldOfView * Math.PI / 360);
    const distanceForFraction = fraction => Math.sqrt(1 + 1 / (fraction * halfFovTangent) ** 2);
    const baseDistanceFactor = distanceForFraction(camera.baseHeightFraction ?? 0.4);
    const envelopeDistanceFactor = distanceForFraction(camera.maxHeightFraction ?? 0.9);
    function displacementEnvelope(geometry, draw, material, push, shrink) {
      const { positions, normals, uv3, uv4 } = geometry.framing;
      const defaultShrink = material.floats._DefaultShrink;
      const extrude = !!material.floats._ExtrudeUpFaces;
      let maxSquaredRadius = 0;
      // The shader displacement is affine in the sampled mask red channel [0,1].
      // Euclidean norm is convex, so testing both endpoints encloses every texel.
      for (let i = 0; i < positions.length / 3; i++) {
        const j = i * 3, k = i * 2, mask = extrude ? uv4[k + 1] : 1;
        const dx = -uv3[k], dy = uv3[k + 1], dz = uv4[k];
        const ax = positions[j] + dx * defaultShrink * 0.01 * mask;
        const ay = positions[j + 1] + dy * defaultShrink * 0.01 * mask;
        const az = positions[j + 2] + dz * defaultShrink * 0.01 * mask;
        const bx = ax + (dx * shrink + normals[j] * push) * 0.01 * mask;
        const by = ay + (dy * shrink + normals[j + 1] * push) * 0.01 * mask;
        const bz = az + (dz * shrink + normals[j + 2] * push) * 0.01 * mask;
        maxSquaredRadius = Math.max(maxSquaredRadius, ax * ax + ay * ay + az * az, bx * bx + by * by + bz * bz);
      }
      return Math.sqrt(maxSquaredRadius) * scene.nodes[draw.node].scale.x;
    }
    let previousTime = null, previousVariant = null, normalPush = 0, shrink = 0;
    function resize(width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      projection.aspect = width / Math.max(1, height); projection.updateProjectionMatrix();
      vp.multiplyMatrices(projection.projectionMatrix, view);
      gl.useProgram(program); u4('hlslcc_mtx4x4unity_MatrixVP[0]', vp.elements);
    }
    function render({ time = 0, low = 0, mid = 0, shapeVariant = 2, beat = 0, energy = 0, rhythmEnabled = true, rhythmStrength = 1 } = {}) {
      if (disposed || gl.isContextLost()) return;
      const index = shapesVariantIndex(shapeVariant, time, scene.draws.length), draw = scene.draws[index];
      const material = scene.materials[draw.material], geometry = geometries.get(draw.mesh), settings = draw.settings;
      const clamp = value => Math.min(1, Math.max(0, value));
      const strength = rhythmEnabled ? rhythmAmount(rhythmStrength) : 0;
      const level = clamp(low * 0.7 + mid * 0.3);
      // Enhanced mode uses the recovered min/max deformation ranges with a sharper
      // beat attack. This is a deliberate audio mapping, not recovered native code.
      const pushLevel = clamp(level + strength * (level * -0.65 + beat * 0.85 + energy * energy * 0.25));
      const shrinkLevel = clamp(level + strength * (level * -0.8 + mid * mid * 0.3 + beat * 0.85));
      const range = (key, amount = level) => settings[key].min + (settings[key].Max - settings[key].min) * amount;
      const targetNormal = settings?.NomalPush ? range('NomalPushValue', pushLevel) : material.floats._NormalPush;
      const targetShrink = settings?.ShrinkFactor ? range('ShrinkFactorValue', shrinkLevel) : material.floats._Shrink_Faces_Amplitude;
      const delta = previousTime === null ? Infinity : time - previousTime;
      const reset = index !== previousVariant || delta < 0 || delta > 1;
      const lerp = target => reset ? 1 : strength
        ? 1 - Math.exp(-Math.max(0, delta) / (target ? 0.025 : 0.12))
        : Math.min(1, Math.max(0, delta / (settings?.LerpTime || 0.2)));
      normalPush += (targetNormal - normalPush) * lerp(targetNormal > normalPush);
      shrink += (targetShrink - shrink) * lerp(targetShrink > shrink);
      previousTime = time; previousVariant = index;
      // Camera framing is inferred, not part of the recovered prefab. Original
      // scale/materials stay intact; retreat only to avoid clipping their deformation.
      const baseDistance = scene.variants[index].framing.basePlanarRadius * baseDistanceFactor;
      // Enhanced mode fixes the camera against the preset's maximum source range.
      // Expansion therefore remains visible instead of being cancelled by camera retreat.
      const envelopeDistance = (strength ? scene.variants[index].framing.maxDisplacementRadius
        : displacementEnvelope(geometry, draw, material, normalPush, shrink)) * envelopeDistanceFactor;
      const distance = Math.max(baseDistance, envelopeDistance, camera.nearClipPlane + 0.01);
      cameraWorld.makeTranslation(camera.Position.x, camera.Position.y, -distance);
      view.makeScale(1, 1, -1).multiply(cameraWorld.clone().invert());
      vp.multiplyMatrices(projection.projectionMatrix, view);
      gl.clearColor(0, 0, 0, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
      const cull = scene.forwardState.culling.val;
      gl.frontFace(gl.CW);
      if (cull === 0) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 1 ? gl.FRONT : gl.BACK); }
      gl.useProgram(program); gl.bindVertexArray(geometry.vao);
      u4('hlslcc_mtx4x4unity_MatrixVP[0]', vp.elements);
      u4('hlslcc_mtx4x4unity_MatrixInvV[0]', view.clone().invert().elements);
      const direction = scene.rotator.direction, angle = time * scene.rotator.speed * Math.PI / 180;
      rootRotation.setFromEuler(new Euler(angle * direction.x, angle * direction.y, angle * direction.z, 'YXZ'));
      rotationMatrix.makeRotationFromQuaternion(rootRotation); world.multiplyMatrices(rotationMatrix, sourceWorlds[index]); inverse.copy(world).invert();
      u4('hlslcc_mtx4x4unity_ObjectToWorld[0]', world.elements); u4('hlslcc_mtx4x4unity_WorldToObject[0]', inverse.elements);
      u4('_TimeParameters', [time, Math.sin(time), Math.cos(time), 0]);
      for (const [name, value] of Object.entries(material.floats)) u1(name, value);
      for (const [name, color] of Object.entries(material.colors)) {
        const value = linear && name.endsWith('Color') ? color.map((v, i) => i === 3 ? v : v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) : color;
        u4(name, value);
      }
      for (const [name, texture] of Object.entries(material.texEnvs)) {
        if (!textureUnits.has(texture.texture)) continue;
        gl.uniform1i(location(name), textureUnits.get(texture.texture));
        u4(name + '_ST', [texture.scale.x, texture.scale.y, texture.offset.x, texture.offset.y]);
      }
      u1('_NormalPush', normalPush); u1('_Shrink_Faces_Amplitude', shrink);
      if (settings?.AnimationSpeed) u1('_Animation_speed', range('AnimationSpeedValue'));
      gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_SHORT, 0);
    }
    return { resize, render, dispose, scene, gl, info: { meshes: Object.keys(scene.meshes).length, variants: scene.variants,
      vertices: Object.values(scene.meshes).reduce((n, mesh) => n + mesh.vertices, 0), textures: textures.length,
      shader: scene.shader.name, cameraInferred: camera.inferred, audioAdapter: 'ShapesFXSetting source ranges; provisional FFT mapping' } };
  } catch (error) { dispose(); throw error; }
}
