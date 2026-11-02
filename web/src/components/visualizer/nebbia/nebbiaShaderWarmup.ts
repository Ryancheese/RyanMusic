import { canRenderFogToFloat, NebbiaProgramBuild } from './nebbiaPrograms';
import { DEFAULT_NEBBIA_TUNING } from './types';

const POLL_MS = 100;
const GIVE_UP_MS = 30_000;
let started = false;

/** Warm the saved-style shaders once. RyanMusic calls this only if something asks. */
export const warmNebbiaShaders = (): void => {
    if (started || typeof document === 'undefined') return;
    started = true;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension('KHR_parallel_shader_compile')) {
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return;
    }
    const startedAt = performance.now();
    const saved = DEFAULT_NEBBIA_TUNING;
    const scene = saved.behind === 'aquarium' ? 'aquarium' : 'night';
    const build = new NebbiaProgramBuild(gl, canRenderFogToFloat(gl), scene, saved.glass);
    const finish = () => {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    const poll = () => {
        if (gl.isContextLost()) return finish();
        try {
            if (build.poll()) return finish();
        } catch (error) {
            console.warn('[Nebbia] shader warm-up failed', error);
            return finish();
        }
        if (performance.now() - startedAt > GIVE_UP_MS) return finish();
        window.setTimeout(poll, POLL_MS);
    };
    window.setTimeout(poll, POLL_MS);
};
