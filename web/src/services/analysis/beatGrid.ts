import { melSpectrogram, analyseBeatGrid, canRunBeatThis, type BeatGrid } from './beatThis';
import { raiseGpuUrgency, runPercussiveEnergyGpu } from './beatThisGpu';
import type { Urgency } from './scheduler';
import { computeBeatAccents, formatBeatMeter, isBeatAccents, resolveBeatConfidence, type BeatAccents, type BeatMeter } from './beatAccents';
import { readStoredBeatGrid, storeBeatGrid, type AccentedBeatGrid } from './beatGridCache';

// RyanMusic: whole-track Beat This! grid, stored in localStorage (Folia beatGrid.ts, GPU-only).

interface Run {
    grid: Promise<AccentedBeatGrid | null>;
}

const running = new Map<string, Run>();

export interface TrackBeatGridOptions {
    storedOnly?: boolean;
    urgency?: Urgency;
}

export const getTrackBeatGrid = async (
    key: string,
    readMid: () => Promise<Float32Array | null>,
    { storedOnly = false, urgency = 'background' }: TrackBeatGridOptions = {},
): Promise<AccentedBeatGrid | null> => {
    const stored = await readStoredBeatGrid(key);
    if (stored) return stored;

    const joined = running.get(key);
    if (joined) {
        if (urgency !== 'background') raiseGpuUrgency(key, urgency);
        return joined.grid;
    }
    if (storedOnly || !canRunBeatThis()) return null;

    const grid = (async () => {
        const mid = await readMid();
        if (!mid) return null;
        const mel = await melSpectrogram(mid);
        const analysed = await analyseBeatGrid(mel, { percussive: true, urgency, key });
        const grid: BeatGrid | null = analysed ? { beats: analysed.beats, downbeats: analysed.downbeats } : null;
        const found: AccentedBeatGrid | null = grid?.beats.length && analysed?.percussive
            ? {
                ...grid,
                accents: computeBeatAccents(mel, grid.beats, grid.downbeats, analysed?.percussive ?? null, {
                    confidence: analysed?.beatLogits ? resolveBeatConfidence(analysed.beatLogits, grid.beats) : null,
                    onMeter: logBeatMeter(key),
                }),
            }
            : grid;
        if (found) await storeBeatGrid(key, found);
        return found;
    })();
    running.set(key, { grid });
    try {
        return await grid;
    } finally {
        if (running.get(key)?.grid === grid) running.delete(key);
    }
};

const logBeatMeter = (key: string) => (meter: BeatMeter, pulse: readonly number[]) => {
    console.info(`[BeatMeter] ${key}: ${formatBeatMeter(meter, pulse)}`);
};

const accentRuns = new Map<string, Promise<BeatAccents | null>>();

export const getTrackBeatAccents = (
    key: string,
    grid: BeatGrid,
    readMid: () => Promise<Float32Array | null>,
): Promise<BeatAccents | null> => {
    const existing = accentRuns.get(key);
    if (existing) return existing;
    const run = (async () => {
        const mid = await readMid();
        if (!mid) return null;
        const mel = await melSpectrogram(mid);
        const analysed = await analyseBeatGrid(mel, { percussive: true, urgency: 'onScreen' });
        const energy = analysed?.percussive ?? (analysed ? null : await runPercussiveEnergyGpu(mel, { urgency: 'onScreen', key }));
        const accents = computeBeatAccents(mel, grid.beats, grid.downbeats, energy, {
            confidence: analysed?.beatLogits ? resolveBeatConfidence(analysed.beatLogits, grid.beats) : null,
            onMeter: logBeatMeter(key),
        });
        const stored = await readStoredBeatGrid(key);
        if (stored && stored.beats.length === grid.beats.length && stored.beats.every((time, index) => time === grid.beats[index])) {
            await storeBeatGrid(key, { ...stored, accents });
        }
        return accents;
    })();
    accentRuns.set(key, run);
    void run.finally(() => {
        if (accentRuns.get(key) === run) accentRuns.delete(key);
    }).catch(() => undefined);
    return run;
};

export { isBeatAccents };
