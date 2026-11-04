// Original JMGO Matrix meshes, hierarchy, material variants and vertex/fragment programs.
// Three is used only for matrix/quaternion math; draw calls use the original WebGL2 programs.
import { Matrix4, Quaternion, Vector3, Euler, PerspectiveCamera } from './vendor/three.module.js';
import { readAsset } from './assets.js';

const DEFAULT_ASSETS = new URL('./matrix/', import.meta.url);

async function read(url, json = false) {
  return readAsset(url, json ? 'json' : 'text');
}

async function readPrograms(entries, base) {
  const results = new Array(entries.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, async () => {
    while (next < entries.length) {
      const index = next++;
      const [key, program] = entries[index];
      const [vertex, fragment] = await Promise.all([read(new URL(program.vertex, base)), read(new URL(program.fragment, base))]);
      results[index] = [key, { vertex, fragment }];
    }
  }));
  return Object.fromEntries(results);
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Matrix Shader 编译失败：${message}`);
  }
  return shader;
}

function vec(object) { return new Vector3(object.x, object.y, object.z); }

/**
 * Retains the shader's recovered MatrixAudio[17] interface. The host-to-array mapping
 * is provisional: eight amplitudes, overall normal offset, eight active segment counts.
 * A caller may provide matrixAudio directly when the native algorithm is recovered.
 */
export function matrixAudioInput({ low = 0, mid = 0, bands, matrixAudio } = {}) {
  if (matrixAudio?.length === 17) return new Float32Array(matrixAudio);
  const input = new Float32Array(17);
  for (let i = 0; i < 8; i++) {
    const amplitude = bands?.[i] ?? low * (1 - i / 7) + mid * i / 7;
    const value = Math.min(1, Math.max(0, Number.isFinite(amplitude) ? amplitude : 0));
    input[i] = value;
    input[8] += value / 8;
    input[9 + i] = Math.ceil(value * 6);
  }
  return input;
}

export async function createMatrixRenderer(canvas, { assetBase = DEFAULT_ASSETS, linear = false } = {}) {
  const base = new URL(assetBase, location.href);
  const scene = await read(new URL('scene.json', base), true);
  const sources = await readPrograms(Object.entries(scene.programs), base);
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('光影矩阵需要 WebGL2。');
  const programs = new Map(), buffers = [], shaders = [], vaos = [];
  let disposed = false;
  const vp = new Matrix4(), worldMatrices = new Map();
  const view = new Matrix4(), cameraWorld = new Matrix4();
  const cameraRotation = scene.camera.Rotation;
  cameraWorld.compose(vec(scene.camera.Position), new Quaternion().setFromEuler(new Euler(
    cameraRotation.x * Math.PI / 180, cameraRotation.y * Math.PI / 180, cameraRotation.z * Math.PI / 180, 'YXZ')),
    new Vector3(1, 1, 1));
  // Shader world coordinates stay in Unity's left-handed system; only the camera view flips Z.
  view.copy(new Matrix4().makeScale(1, 1, -1)).multiply(cameraWorld.clone().invert());
  function world(id) {
    if (worldMatrices.has(id)) return worldMatrices.get(id);
    const node = scene.nodes[id];
    const q = node.rotation;
    const matrix = new Matrix4().compose(vec(node.position), new Quaternion(q.x, q.y, q.z, q.w), vec(node.scale));
    if (node.parent !== '0') matrix.premultiply(world(node.parent));
    worldMatrices.set(id, matrix);
    return matrix;
  }
  function active(id) {
    const node = scene.nodes[id];
    return !!node.active && (node.parent === '0' || active(node.parent));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    vaos.forEach(vao => gl.deleteVertexArray(vao));
    buffers.forEach(buffer => gl.deleteBuffer(buffer));
    shaders.forEach(shader => gl.deleteShader(shader));
    programs.forEach(p => gl.deleteProgram(p.program));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  try {
    for (const [name, source] of Object.entries(sources)) {
      let fragment = source.fragment;
      if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
        vec3 encodeSRGB(vec3 x) {
          return mix(x*12.92, 1.055*pow(max(x,vec3(0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),x));
        }
        void main() { originalMain(); SV_Target0.rgb=encodeSRGB(SV_Target0.rgb); }
      `;
      const program = gl.createProgram();
      const vertexShader = compile(gl, gl.VERTEX_SHADER, source.vertex); shaders.push(vertexShader);
      const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment); shaders.push(fragmentShader);
      gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(`${name}: ${message}`);
      }
      const p = { program, uniforms: new Map(), state: scene.programs[name] };
      programs.set(name, p);
      p.uniform = key => {
        if (!p.uniforms.has(key)) p.uniforms.set(key, gl.getUniformLocation(program, key));
        return p.uniforms.get(key);
      };
    }
    const draws = scene.draws.filter(draw => draw.enabled && active(draw.node)).map(draw => {
      const material = scene.materials[draw.material], p = programs.get(material.program), mesh = scene.meshes[draw.mesh];
      const vao = gl.createVertexArray(); vaos.push(vao); gl.bindVertexArray(vao);
      for (const [attribute, array, size] of [
        ['in_POSITION0', mesh.positions, 3], ['in_NORMAL0', mesh.normals, 3],
        ['in_TEXCOORD1', mesh.uv1, 2], ['in_COLOR0', mesh.colors, 4],
      ]) {
        const location = gl.getAttribLocation(p.program, attribute);
        if (location < 0) continue;
        const buffer = gl.createBuffer(); buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array.flat()), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }
      const indices = gl.createBuffer(); buffers.push(indices); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
      return { ...draw, material, p, vao, count: mesh.indices.length, world: world(draw.node),
        inverseWorld: world(draw.node).clone().invert() };
    }).sort((a, b) => b.p.state.zWrite - a.p.state.zWrite);
    gl.clearColor(0, 0, 0, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // Unity mesh front faces are clockwise in the preserved source coordinate projection.
    gl.frontFace(gl.CW);
    function resize(width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const camera = new PerspectiveCamera(scene.camera.fieldOfView, width / Math.max(1, height), scene.camera.nearClipPlane, scene.camera.farClipPlane);
      vp.multiplyMatrices(camera.projectionMatrix, view);
    }
    function render(snapshot = {}) {
      if (disposed || gl.isContextLost()) return;
      const input = matrixAudioInput(snapshot);
      gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const draw of draws) {
        const { p, material } = draw;
        gl.useProgram(p.program); gl.bindVertexArray(draw.vao);
        gl.uniform4fv(p.uniform('hlslcc_mtx4x4unity_MatrixVP[0]'), vp.elements);
        gl.uniform4fv(p.uniform('hlslcc_mtx4x4unity_ObjectToWorld[0]'), draw.world.elements);
        gl.uniform4fv(p.uniform('hlslcc_mtx4x4unity_WorldToObject[0]'), draw.inverseWorld.elements);
        gl.uniform3f(p.uniform('_WorldSpaceCameraPos'), scene.camera.Position.x, scene.camera.Position.y, scene.camera.Position.z);
        gl.uniform1fv(p.uniform('MatrixAudio[0]'), input);
        for (const [name, value] of Object.entries(material.floats)) gl.uniform1f(p.uniform(name), value);
        for (const [name, color] of Object.entries(material.colors)) {
          const value = linear && name.endsWith('Color') ? color.map((v, i) => i === 3 ? v : v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) : color;
          gl.uniform4fv(p.uniform(name), value);
        }
        gl.depthMask(!!p.state.zWrite);
        if (p.state.cull === 0) gl.disable(gl.CULL_FACE);
        else { gl.enable(gl.CULL_FACE); gl.cullFace(p.state.cull === 1 ? gl.FRONT : gl.BACK); }
        if (p.state.srcBlend === 5 && p.state.dstBlend === 10) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
        else gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    return { resize, render, dispose, scene, gl, info: { meshes: draws.length, vertices: Object.values(scene.meshes).reduce((n, m) => n + m.positions.length, 0),
      programs: programs.size, textures: 0, source: 'JMGO Matrix03 / MatrixLight01', audioAdapter: 'provisional MatrixAudio[17] mapping' } };
  } catch (error) { dispose(); throw error; }
}
