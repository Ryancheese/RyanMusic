/** Sample the original Unity streamed cubic coefficients at clip-local seconds. */
export function sampleVinylCurve(clip, index, time) {
  let key = null, keyTime = 0;
  for (const frame of clip.frames) {
    if (frame.time > time) break;
    const candidate = frame.keys.find(k => k.index === index);
    if (candidate) { key = candidate; keyTime = frame.time; }
  }
  if (!key) return clip.constants[index] ?? 0;
  const dt = Math.max(0, time - keyTime), [a, b, c, d] = key.coeff;
  return ((a * dt + b) * dt + c) * dt + d;
}

/** Retain tight outlines for Simple sprites and source border widths for Sliced. */
export function vinylSpriteGeometry(sprite, draw) {
  if (draw.drawMode === 0) return { positions: sprite.positions, uv: sprite.uv, indices: sprite.indices };
  const ppu = sprite.pixelsToUnits, b = sprite.border, pivot = sprite.pivot;
  const width = draw.size.x, height = draw.size.y;
  let left = b.x / ppu, right = b.z / ppu, bottom = b.y / ppu, top = b.w / ppu;
  const shrinkX = Math.min(1, width / Math.max(1e-8, left + right));
  const shrinkY = Math.min(1, height / Math.max(1e-8, bottom + top));
  left *= shrinkX; right *= shrinkX; bottom *= shrinkY; top *= shrinkY;
  const xs = [-width * pivot.x, -width * pivot.x + left, width * (1 - pivot.x) - right, width * (1 - pivot.x)];
  const ys = [-height * pivot.y, -height * pivot.y + bottom, height * (1 - pivot.y) - top, height * (1 - pivot.y)];
  const us = [0, b.x / sprite.rect.width, 1 - b.z / sprite.rect.width, 1];
  const vs = [0, b.y / sprite.rect.height, 1 - b.w / sprite.rect.height, 1];
  const positions = [], uv = [], indices = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    positions.push([xs[x], ys[y], 0]); uv.push([us[x], vs[y]]);
  }
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const i = y * 4 + x; indices.push(i, i + 4, i + 1, i + 1, i + 4, i + 5);
  }
  return { positions, uv, indices };
}

/** Wall time drives the supplied arm clip; playback time drives the supplied spin speed. */
export function createVinylMotion(animations, rotationSpeed, transitionDuration = 0.25) {
  let previousPaused = null, start = 0, from = 0, arm = 0, currentClip = null;
  return ({ time = 0, paused = false } = {}, wallTime = performance.now() / 1000) => {
    if (paused !== previousPaused) {
      from = arm; start = wallTime;
      currentClip = animations[paused ? 'TurntableStop' : 'TurntableStart'];
      // The first paused frame is the original zero-angle Idle state.
      if (previousPaused === null && paused) currentClip = null;
      previousPaused = paused;
    }
    if (currentClip) {
      const elapsed = Math.max(0, wallTime - start);
      const target = sampleVinylCurve(currentClip, 2, Math.min(currentClip.duration, elapsed));
      const mix = Math.min(1, elapsed / Math.max(1e-6, transitionDuration));
      arm = from + (target - from) * mix;
    }
    return { armDegrees: arm, recordDegrees: -Math.max(0, time) * rotationSpeed };
  };
}
