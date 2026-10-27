import type { AudioBands } from '../../../types';
import { beatImpact, downbeatImpact } from '../../../stores/motionSignals';
import {
    getBeatFxLastBeat,
    getBeatFxLastDownbeat,
    getBeatFxRotationSign,
    isBeatFxHearing,
    isBeatFxReady,
} from '../../../services/beatFx/beatFxLive';
import type { BeatFxEvent } from '../../../services/beatFx/clock';
import type { SonnetAnimationCue } from './types';

export const SONNET_BEAT_FX = {
    zoomPercent: 6,
    rotationDeg: 0.6,
    downbeatZoomPercent: 5,
    tear: 0.6,
    tearRate: 24,
    flare: 0.7,
    iconPop: 0.4,
    iconDecayMs: 300,
    lineBaseAlpha: 0.78,
} as const;

export interface SonnetBeatFxAccent {
    zoom: number;
    tilt: number;
}

export const SONNET_BEAT_FX_NO_ACCENT: Readonly<SonnetBeatFxAccent> = { zoom: 1, tilt: 1 };

export const resolveSonnetBeatFxAccent = (
    event: Pick<BeatFxEvent, 'tone' | 'barPos'> | null,
    out: SonnetBeatFxAccent = { zoom: 1, tilt: 1 },
): SonnetBeatFxAccent => {
    if (!event?.tone) {
        out.zoom = 1;
        out.tilt = 1;
        return out;
    }
    out.zoom = 0.85 + 0.3 * event.tone.low;
    out.tilt = (0.7 + 0.6 * event.tone.high) * (event.barPos === 3 ? 0.5 : 1);
    return out;
};

export interface SonnetBeatFxFrame {
    zoom: number;
    rotation: number;
    tear: number;
    tearSeed: number;
    flare: number;
    lineLift: number;
}

export interface SonnetBeatFxShotLayers {
    haloLayer: { alpha: number };
    haloBaseAlpha: number;
    mgGeoLayer?: { alpha: number };
    mgBackgroundLayer?: { alpha: number };
    mgFixedGeoLayer?: { alpha: number };
}

const normalizeLevel = (value: number) => Math.min(1, Math.max(0, value > 1 ? value / 255 : value));

export const resolveSonnetBeatFxFrame = (
    k: number,
    d: number,
    rotationSign: number,
    wallTimeSec: number,
    lineLift: number,
    out: SonnetBeatFxFrame = { zoom: 1, rotation: 0, tear: 0, tearSeed: 0, flare: 0, lineLift: 0 },
    accent: Readonly<SonnetBeatFxAccent> = SONNET_BEAT_FX_NO_ACCENT,
): SonnetBeatFxFrame => {
    out.zoom = 1 + (SONNET_BEAT_FX.zoomPercent / 100) * k * accent.zoom + (SONNET_BEAT_FX.downbeatZoomPercent / 100) * d;
    out.rotation = (SONNET_BEAT_FX.rotationDeg * Math.PI / 180) * k * rotationSign * accent.tilt;
    out.tear = d > 0.02 ? SONNET_BEAT_FX.tear * d : 0;
    out.tearSeed = Math.floor(wallTimeSec * SONNET_BEAT_FX.tearRate) % 997;
    out.flare = SONNET_BEAT_FX.flare * d;
    out.lineLift = lineLift;
    return out;
};

export const isSonnetBeatFxActive = (smartBeatEnabled: boolean): boolean =>
    smartBeatEnabled && isBeatFxReady();

export const createSonnetBeatFxReader = () => {
    let smoothedTreble = 0;
    const frame: SonnetBeatFxFrame = { zoom: 1, rotation: 0, tear: 0, tearSeed: 0, flare: 0, lineLift: 0 };
    const accent: SonnetBeatFxAccent = { zoom: 1, tilt: 1 };
    return (audioBands: AudioBands | undefined, smartBeatEnabled: boolean): SonnetBeatFxFrame | null => {
        if (!isSonnetBeatFxActive(smartBeatEnabled)) {
            smoothedTreble = 0;
            return null;
        }
        const treble = isBeatFxHearing() ? normalizeLevel(audioBands?.treble?.get() ?? 0) : 0;
        const target = Math.min(1, Math.max(0, (treble - 0.04) / 0.35));
        smoothedTreble += (target - smoothedTreble) * (target > smoothedTreble ? 0.25 : 0.08);
        const beat = getBeatFxLastBeat();
        const downbeat = getBeatFxLastDownbeat();
        const last = beat && (!downbeat || beat.t > downbeat.t) ? beat : downbeat;
        return resolveSonnetBeatFxFrame(
            beatImpact.get(),
            downbeatImpact.get(),
            getBeatFxRotationSign(),
            performance.now() / 1000,
            smoothedTreble,
            frame,
            resolveSonnetBeatFxAccent(last, accent),
        );
    };
};

export const resolveSonnetLineFlashAlpha = (lineLift: number) =>
    SONNET_BEAT_FX.lineBaseAlpha + (1 - SONNET_BEAT_FX.lineBaseAlpha) * Math.min(1, Math.max(0, lineLift));

export const resolveSonnetIconOnsetPop = (time: number, cues: readonly SonnetAnimationCue[]): number => {
    let lastAt = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < cues.length; index += 1) {
        const at = cues[index].at;
        if (at <= time && at > lastAt) lastAt = at;
    }
    const elapsedMs = (time - lastAt) * 1000;
    return elapsedMs >= 0 && Number.isFinite(elapsedMs)
        ? Math.exp(-elapsedMs / SONNET_BEAT_FX.iconDecayMs * 2.3)
        : 0;
};

export const resolveSonnetIconPopScale = (k: number) => 1 + SONNET_BEAT_FX.iconPop * k * (1.15 - 0.15 * k);

export const applySonnetBeatFxLayers = (view: SonnetBeatFxShotLayers, frame: SonnetBeatFxFrame) => {
    const lineAlpha = resolveSonnetLineFlashAlpha(frame.lineLift);
    if (view.mgGeoLayer) view.mgGeoLayer.alpha = lineAlpha;
    if (view.mgBackgroundLayer) view.mgBackgroundLayer.alpha = lineAlpha;
    if (view.mgFixedGeoLayer) view.mgFixedGeoLayer.alpha = lineAlpha;
    const base = view.haloBaseAlpha;
    view.haloLayer.alpha = Math.min(1, base + (1 - base) * Math.min(1, frame.flare));
};

export const restoreSonnetBeatFxLayers = (view: SonnetBeatFxShotLayers) => {
    if (view.mgGeoLayer) view.mgGeoLayer.alpha = 1;
    if (view.mgBackgroundLayer) view.mgBackgroundLayer.alpha = 1;
    if (view.mgFixedGeoLayer) view.mgFixedGeoLayer.alpha = 1;
    view.haloLayer.alpha = view.haloBaseAlpha;
};
