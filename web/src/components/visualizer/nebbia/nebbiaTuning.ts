import type { LyricRenderOverride, LyricRenderScale } from '../../../types';
import { LYRIC_RENDER_SCALES, normalizeLyricRenderOverride } from '../../../utils/lyricRenderQuality';
import {
    DEFAULT_NEBBIA_TUNING,
    NEBBIA_APPEAR_STYLES,
    NEBBIA_BEHIND,
    NEBBIA_FADE_STYLES,
    NEBBIA_GLASS,
    NEBBIA_GLASS_FOR,
    NEBBIA_LAYOUTS,
    NEBBIA_LIMITS,
    NEBBIA_RAIN,
    NEBBIA_SCENERY,
    type NebbiaNumberKey,
    type NebbiaTuning,
} from './types';

const numberWithin = (value: unknown, fallback: number, min: number, max: number) => (
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
);

const subsetOf = <T extends string>(choices: readonly T[], value: unknown, fallback: readonly T[]): T[] => {
    const picked = Array.isArray(value) ? choices.filter(choice => value.includes(choice)) : [];
    return picked.length ? picked : [...fallback];
};

const LEGACY_APPEAR: Record<string, NebbiaTuning['appear']> = { auto: ['write', 'fade'], write: ['write'], fade: ['fade'] };
const LEGACY_FADE: Record<string, NebbiaTuning['fade']> = { fog: ['fog'], fingers: ['fingers'], mix: ['fog', 'fingers'] };

const readRender = (render: unknown, legacyResolution: unknown): LyricRenderOverride => {
    if (render !== undefined) return normalizeLyricRenderOverride(render);
    const override = normalizeLyricRenderOverride(null);
    if (legacyResolution === undefined) return override;
    const resolution = numberWithin(legacyResolution, 1, 0.5, 2);
    if (resolution === 1) return override;
    const scale = LYRIC_RENDER_SCALES.reduce<LyricRenderScale>(
        (best, next) => (Math.abs(next - resolution) <= Math.abs(best - resolution) ? next : best),
        LYRIC_RENDER_SCALES[0],
    );
    return { ...override, scale };
};

export const normalizeNebbiaTuning = (stored: unknown): NebbiaTuning => {
    const values = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof NebbiaTuning | 'appearMode' | 'fadeMode' | 'resolution', unknown>>;
    const base = DEFAULT_NEBBIA_TUNING;
    const numbers = Object.fromEntries((Object.keys(NEBBIA_LIMITS) as NebbiaNumberKey[]).map(key => [
        key,
        numberWithin(values[key], base[key], NEBBIA_LIMITS[key].min, NEBBIA_LIMITS[key].max),
    ])) as Pick<NebbiaTuning, NebbiaNumberKey>;
    const appear = values.appear ?? LEGACY_APPEAR[String(values.appearMode)];
    const fade = values.fade ?? LEGACY_FADE[String(values.fadeMode)];
    const behind = NEBBIA_BEHIND.find(item => item === values.behind) ?? base.behind;
    return {
        render: readRender(values.render, values.resolution),
        appear: subsetOf(NEBBIA_APPEAR_STYLES, appear, base.appear),
        fade: subsetOf(NEBBIA_FADE_STYLES, fade, base.fade),
        layouts: subsetOf(NEBBIA_LAYOUTS, values.layouts, base.layouts),
        behind,
        glass: NEBBIA_GLASS.find(item => item === values.glass) ?? NEBBIA_GLASS_FOR[behind] ?? base.glass,
        scenery: Array.isArray(values.scenery) ? NEBBIA_SCENERY.filter(item => (values.scenery as unknown[]).includes(item)) : [...base.scenery],
        rain: NEBBIA_RAIN.find(item => item === values.rain) ?? base.rain,
        credits: typeof values.credits === 'boolean' ? values.credits : base.credits,
        ...numbers,
    };
};

export const readNebbiaTuning = (bundle?: { nebbia?: unknown }): NebbiaTuning => normalizeNebbiaTuning(bundle?.nebbia);
