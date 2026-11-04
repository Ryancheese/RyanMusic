// Scene resources and fragment arithmetic come from JMGO's FlowingIllusion bundle.
// Audio-band normalization is supplied by the host; its original runtime mapping is unknown.
import { readAsset, loadAssetImage } from './assets.js';
import { setLyricText, animateLyricText } from './lyric-effects.js';
const DEFAULT_ASSETS = new URL('./flowing/', import.meta.url);

const VERTEX = `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 mvp;
out highp vec4 vs_TEXCOORD3;
void main() {
  gl_Position = mvp * vec4(position, 1.0);
  vs_TEXCOORD3 = vec4(uv, 0.0, 0.0);
}`;

async function get(url, json = false) {
  return readAsset(url, json ? 'json' : 'text');
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader 编译失败：${message}`);
  }
  return shader;
}

function image(url) {
  return loadAssetImage(url);
}

/** The canvas renderer has no dependency on React, Three.js, or the demo's audio graph. */
export async function createFlowingRenderer(canvas, { assetBase = DEFAULT_ASSETS, linear = false } = {}) {
  const base = new URL(assetBase, location.href);
  const [scene, mesh, originalFragment] = await Promise.all([
    get(new URL('scene.json', base), true), get(new URL('mesh.json', base), true),
    get(new URL('fragment.glsl', base)),
  ]);
  const images = await Promise.all(scene.textures.map(t => image(new URL(t.file, base))));
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('当前浏览器不支持 WebGL2，请使用支持 WebGL2 的浏览器。');
  // Optional presentation conversion is outside the original program body.
  let fragment = originalFragment;
  if (linear) fragment = fragment.replace('void main()', 'void originalMain()') + `
    vec3 encodeSRGB(vec3 x) {
      return mix(12.92*x, 1.055*pow(max(x,vec3(0.0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),x));
    }
    void main() { originalMain(); SV_Target0.rgb = encodeSRGB(SV_Target0.rgb); }
  `;
  const program = gl.createProgram();
  const shaders = [];
  const buffers = [];
  const textures = [];
  const vao = gl.createVertexArray();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    textures.forEach(t => gl.deleteTexture(t));
    buffers.forEach(b => gl.deleteBuffer(b));
    shaders.forEach(s => gl.deleteShader(s));
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  try {
    shaders.push(compile(gl, gl.VERTEX_SHADER, VERTEX));
    shaders.push(compile(gl, gl.FRAGMENT_SHADER, fragment));
    shaders.forEach(s => gl.attachShader(program, s));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    for (const [name, values, count] of [['position', mesh.positions, 3], ['uv', mesh.uv, 2]]) {
      const buffer = gl.createBuffer(); buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values.flat()), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, count, gl.FLOAT, false, 0, 0);
    }
    const indices = gl.createBuffer(); buffers.push(indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    const props = scene.material.m_SavedProperties;
    const floats = Object.fromEntries(props.m_Floats);
    const envs = Object.fromEntries(props.m_TexEnvs);
    const uniforms = Object.fromEntries(['mvp', 'audioStrength', '_TimeParameters', '_TwistMap_ST',
      '_Mid', '_Step', '_low', '_DetailMapBrightIntensity', '_HightLightIntensity']
      .map(name => [name, gl.getUniformLocation(program, name)]));
    for (const name of ['_Mid', '_Step', '_low', '_DetailMapBrightIntensity', '_HightLightIntensity']) {
      gl.uniform1f(uniforms[name], floats[name]);
    }
    const twist = envs._TwistMap;
    gl.uniform4f(uniforms._TwistMap_ST, twist.m_Scale.x, twist.m_Scale.y, twist.m_Offset.x, twist.m_Offset.y);
    for (const [unit, name] of ['_BaseMap', '_TwistMap', '_DetailMap'].entries()) {
      // Resolve IDs in Python before JSON parsing: Unity pathIDs exceed JS integer precision.
      const index = scene.textures.findIndex(t => t.file === scene.uniformTextures[name]);
      if (index < 0) throw new Error(`缺少贴图 ${name}`);
      const tex = gl.createTexture(); textures.push(tex);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      const srgb = linear && scene.textures[index].colorSpace === 1;
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, images[index]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const hasMips = scene.textures[index].mipCount > 1;
      if (hasMips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, hasMips ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    }
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    const mvp = new Float32Array(16);
    function resize(width, height, dpr = Math.min(devicePixelRatio || 1, 2)) {
      if (disposed) return;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Unity is left-handed, looking along +Z. Saved root rotation is (0,-1,0,0).
      // Preserve the source mesh, camera Y=1, FOV=60 and root Z=9.39, including its crop.
      const camera = scene.camera;
      const f = 1 / Math.tan(camera.fieldOfView * Math.PI / 360);
      const n = camera.nearClipPlane, far = camera.farClipPlane;
      const a = (far + n) / (far - n), b = -2 * far * n / (far - n);
      const z = scene.transform.m_LocalPosition.z - camera.Position.z;
      mvp.fill(0);
      mvp[0] = -f / (width / height); mvp[5] = f;
      mvp[10] = -a; mvp[11] = -1;
      mvp[13] = -camera.Position.y * f;
      mvp[14] = a * z + b; mvp[15] = z;
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.mvp, false, mvp);
    }
    function render({ time = 0, low = 0, mid = 0 } = {}) {
      if (disposed || gl.isContextLost()) return;
      gl.useProgram(program); gl.bindVertexArray(vao);
      gl.uniform4f(uniforms._TimeParameters, time, Math.sin(time), Math.cos(time), 0);
      gl.uniform2f(uniforms.audioStrength, low, mid);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    }
    return { resize, render, dispose, scene, gl, info: { vertices: mesh.positions.length, indices: mesh.indices.length, textures: textures.length } };
  } catch (error) { dispose(); throw error; }
}

/**
 * Future RyanMusic adapter: readSnapshot is called each animation frame.
 * {time, paused, low?, mid?, bass?, lines?, showText?, fontScale?}
 * Returns synchronous cleanup, including cancellation during async initialization.
 */
export function mountJmgoScene(host, readSnapshot, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'jmgo-canvas';
  const lyric = document.createElement('div');
  lyric.className = 'jmgo-lyric';
  host.append(canvas, lyric);
  let renderer, frame, stopped = false;
  const onLost = e => { e.preventDefault(); options.onError?.(new Error('WebGL 上下文丢失，请重新加载页面。')); };
  canvas.addEventListener('webglcontextlost', onLost);
  const observer = new ResizeObserver(() => {
    renderer?.resize(host.clientWidth, host.clientHeight);
  });
  observer.observe(host);
  const createRenderer = options.createRenderer ?? createFlowingRenderer;
  createRenderer(canvas, options).then(value => {
    if (stopped) { value.dispose(); return; }
    renderer = value;
    if (renderer.overlay) host.append(renderer.overlay);
    renderer.resize(host.clientWidth, host.clientHeight);
    // Keep the recovered source layout intact; player/demo presentation may override it.
    const profile = { ...renderer.scene?.lyrics, ...options.lyricPresentation };
    options.onReady?.({ ...renderer.info, hasOverlay: !!renderer.overlay }, { ...renderer.scene, lyrics: profile });
    lyric.classList.toggle('jmgo-lyric-readable', profile.readable === true);
    lyric.style.fontFamily = `${profile.fontFamily ?? 'JMGOHeavy'}, sans-serif`;
    lyric.style.fontWeight = profile.fontFamily === 'JMGORegular' ? '400' : '800';
    if (profile.color) lyric.style.color = profile.color;
    const tick = () => {
      if (stopped) return;
      try {
        const s = readSnapshot();
        renderer.render({ ...s, time: s.time, low: s.low ?? s.bass ?? 0, mid: s.mid ?? 0 });
        let line;
        for (const candidate of s.lines ?? []) {
          if (candidate.startTime > s.time) break;
          line = candidate;
        }
        if (!line && profile.fallbackToTitle && (s.title || s.songTitle)) {
          line = { startTime: 0, fullText: s.title || s.songTitle };
        }
        setLyricText(lyric, line?.fullText ?? '', {effect:s.lyricEffect ?? 'focus',font:s.lyricFont ?? 'modern',active:true});
        lyric.hidden = profile.hidden === true || profile.disabled === true || s.showText === false || !line;
        const scale = host.clientWidth / 1920;
        const referenceWidth = profile.width ?? 1320;
        lyric.style.width = profile.readable ? 'max-content' : `${referenceWidth / 1920 * 100}%`;
        lyric.style.maxWidth = profile.readable ? `${referenceWidth / 1920 * 100}%` : '';
        lyric.style.top = `calc(${(1 - (profile.anchorY ?? 0.5)) * 100}% - ${(profile.y ?? 0) * scale}px)`;
        const referenceSize = profile.autoSize === false ? (profile.fontSize ?? 80)
          : Math.max(profile.minFontSize ?? 50.84, Math.min(profile.maxFontSize ?? 100, referenceWidth / Math.max(1, Array.from(line?.fullText ?? '').length)));
        const scaledSize = referenceSize * scale * (s.fontScale ?? 1);
        const fontSize = profile.readable ? Math.min(80, Math.max(20, scaledSize)) : scaledSize;
        lyric.style.fontSize = `${fontSize}px`;
        if (profile.shadowY != null) lyric.style.textShadow = `0 ${-profile.shadowY * scale}px ${Math.max(1, scale * 2)}px rgba(0,0,0,0.8)`;
        animateLyricText(lyric, {time:s.time,lineStart:line?.startTime ?? 0,lineEnd:line?.endTime,beat:s.beat ?? 0,paused:s.paused,active:true});
        frame = requestAnimationFrame(tick);
      } catch (error) { options.onError?.(error); }
    };
    tick();
  }).catch(error => { if (!stopped) options.onError?.(error); });
  return () => {
    stopped = true; cancelAnimationFrame(frame); observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onLost);
    renderer?.dispose(); renderer?.overlay?.remove(); canvas.remove(); lyric.remove();
  };
}

// Preserve the original demo's embedding API.
export const mountFlowingIllusion = mountJmgoScene;
