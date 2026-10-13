// Resource preparation for Three r185. No song clock, pose, material uniforms or visibility is advanced.
// compile() links every material, including both transparent DoubleSide variants; its asynchronous
// readiness and first-use metadata are completed here before a song starts drawing those objects.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function compileVariant(renderer, scene, emptyScene, variant) {
  const previous = {
    target: renderer.getRenderTarget(), planes: renderer.clippingPlanes, autoClear: renderer.autoClear,
    cubeFace: renderer.getActiveCubeFace?.() || 0, mip: renderer.getActiveMipmapLevel?.() || 0,
  };
  try {
    renderer.autoClear = false;
    renderer.clippingPlanes = variant.planes;
    renderer.setRenderTarget(variant.target);
    // compile() does not initialize Three's private clipping state. An empty draw does, without
    // clearing a target or invoking any of the live scene's animation/update callbacks.
    renderer.render(emptyScene, variant.camera);
    renderer.compile(scene, variant.camera);
  } finally {
    // All renderer state is restored synchronously, before any readiness polling can yield.
    // setRenderTarget also restores that target's viewport/scissor; neither is changed here.
    renderer.clippingPlanes = previous.planes;
    try {
      renderer.setRenderTarget(previous.target, previous.cubeFace, previous.mip);
      renderer.render(emptyScene, variant.camera);
    } finally {renderer.autoClear = previous.autoClear;}
  }
}

export async function preparePrograms(renderer, scene, emptyScene, variants, {
  active = () => true, timeoutMs = 5000, budgetMs = 4,
  now = () => performance.now(), wait = sleep,
} = {}) {
  const started = now(), programs = new Set();
  let initialized = 0, unsupported = 0;
  const result = status => ({status, programs: programs.size, initialized, unsupported});
  for (const variant of variants) {
    if (!active()) return result('cancelled');
    if (now() - started >= timeoutMs) return result('timeout');
    compileVariant(renderer, scene, emptyScene, variant);
    for (const program of renderer.info?.programs || []) programs.add(program);
  }
  const pending = new Set(programs);
  while (pending.size) {
    if (!active()) return result('cancelled');
    if (now() - started >= timeoutMs) return result('timeout');
    const slice = now(); let progressed = false;
    for (const program of pending) {
      if (!active()) return result('cancelled');
      if (now() - started >= timeoutMs) return result('timeout');
      // These methods belong to the pinned Three WebGLProgram implementation, not its public API.
      // Disposed programs and a future incompatible implementation are safe to skip.
      if (('program' in program && !program.program) ||
          !['isReady', 'getUniforms', 'getAttributes'].every(name => typeof program[name] === 'function')) {
        pending.delete(program); unsupported++; progressed = true;
      } else if (program.isReady()) {
        program.getUniforms(); program.getAttributes();
        pending.delete(program); initialized++; progressed = true;
      }
      if (now() - slice >= budgetMs) break;
    }
    if (pending.size) await wait(progressed ? 0 : 10);
  }
  return result(unsupported ? 'partial' : 'ready');
}
