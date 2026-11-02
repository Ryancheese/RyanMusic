import type { LyricRenderOverride, LyricRenderQuality, LyricRenderScale } from '../types';

export const LYRIC_RENDER_SCALES = [0.5, 0.75, 1, 1.5, 2] as const satisfies readonly LyricRenderScale[];
export const DEFAULT_LYRIC_RENDER_QUALITY: LyricRenderQuality = { scale: 1, antialias: 'auto' };
export const DEFAULT_LYRIC_RENDER_OVERRIDE: LyricRenderOverride = { scale: 'global', antialias: 'global' };
export const MAX_LYRIC_PIXEL_RATIO = 3;

export const isLyricRenderScale = (value: unknown): value is LyricRenderScale =>
    (LYRIC_RENDER_SCALES as readonly unknown[]).includes(value);

export const normalizeLyricRenderOverride = (raw: unknown): LyricRenderOverride => {
    const input = raw && typeof raw === 'object' ? raw as Partial<LyricRenderOverride> : {};
    return {
        scale: isLyricRenderScale(input.scale) ? input.scale : 'global',
        antialias: input.antialias === 'on' || input.antialias === 'off' ? input.antialias : 'global',
    };
};

/** Device pixel ratio times the style scale, capped so a 2× screen plus supersampling stays usable. */
export const resolveLyricPixelRatio = (base: number, scale: LyricRenderScale, max = MAX_LYRIC_PIXEL_RATIO) => {
    const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
    const ratio = safeBase * scale;
    return scale > 1 ? Math.max(safeBase, Math.min(ratio, max)) : ratio;
};
