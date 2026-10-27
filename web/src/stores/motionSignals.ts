import { motionValue, type MotionValue } from 'framer-motion';

// Per-frame signals for beat FX (from Folia stores/motionSignals.ts, RyanMusic subset).

/**
 * Beat-synchronous impact envelopes under 智能动感模式: 0..1, times effect strengths.
 * Driven by services/beatFx/beatFxLive when smart beat is active.
 */
export const beatImpact = motionValue(0);
export const downbeatImpact = motionValue(0);

export type BeatMotionSignals = {
    beatImpact: MotionValue<number>;
    downbeatImpact: MotionValue<number>;
};

export const beatMotionSignals: BeatMotionSignals = { beatImpact, downbeatImpact };
