import { DIORAMA_PARTICLE_AUDIO_SCALE_MAX } from './cameraPath';
import { resolveBeatFxAccentGain, type BeatFxEvent } from '../../../services/beatFx/clock';

// Diorama's share of 智能动感模式: beat_this' beats spawn ripples and drive breath (see DioramaParticleField).

export const DIORAMA_BEAT_RIPPLE_STRENGTH = 1.6;
export const DIORAMA_DOWNBEAT_RIPPLE_STRENGTH = 2.2;

export interface DioramaBeatCounter {
    beats: number;
    downbeats: number;
    synced: boolean;
}

export const createDioramaBeatCounter = (): DioramaBeatCounter => ({ beats: 0, downbeats: 0, synced: false });

export interface DioramaBeatTriggers {
    beat: boolean;
    downbeat: boolean;
}

export const stepDioramaBeatCounter = (
    counter: DioramaBeatCounter,
    fired: Readonly<{ beats: number; downbeats: number }>,
): DioramaBeatTriggers => {
    const newBeats = counter.synced ? fired.beats - counter.beats : 0;
    const newDownbeats = counter.synced ? fired.downbeats - counter.downbeats : 0;
    counter.beats = fired.beats;
    counter.downbeats = fired.downbeats;
    counter.synced = true;
    return { beat: newBeats - newDownbeats > 0, downbeat: newDownbeats > 0 };
};

export const resolveDioramaBeatClusterPulse = (beat: number, downbeat: number): number => Math.min(
    DIORAMA_PARTICLE_AUDIO_SCALE_MAX,
    1 + Math.max(0, beat) * 0.2 + Math.max(0, downbeat) * 0.28,
);

export const DIORAMA_LOW_BEAT_SHARE = 0.5;

export interface DioramaBeatRipple {
    index: number;
    strength: number;
}

export const resolveDioramaBeatRipple = (
    kind: 'beat' | 'downbeat',
    event: Pick<BeatFxEvent, 'impact' | 'tone' | 'rhythmic'> | null,
    trackScale: number,
    intensity: number,
): DioramaBeatRipple => {
    const gain = resolveBeatFxAccentGain(event, trackScale);
    if (kind === 'downbeat') return { index: 0, strength: DIORAMA_DOWNBEAT_RIPPLE_STRENGTH * intensity * gain };
    const low = event?.tone && event.tone.low > DIORAMA_LOW_BEAT_SHARE;
    return { index: low ? 0 : 1, strength: DIORAMA_BEAT_RIPPLE_STRENGTH * intensity * gain };
};

export const DIORAMA_LYRIC_HOP_BEAT = 0.25;
export const DIORAMA_LYRIC_HOP_DOWNBEAT = 0.4;
const DIORAMA_LYRIC_HOP_MAX = 0.8;

export const resolveDioramaLyricHop = (beat: number, downbeat: number): number => Math.min(
    DIORAMA_LYRIC_HOP_MAX,
    Math.max(0, beat) * DIORAMA_LYRIC_HOP_BEAT + Math.max(0, downbeat) * DIORAMA_LYRIC_HOP_DOWNBEAT,
);
