import type { BeatAccents } from './beatAccents';
import type { BeatGrid } from './beatThis';

const PREFIX = 'ryanmusic-beat-grid-v1:';
const BEAT_GRID_VERSION = 1;

interface StoredBeatGrid {
    version: number;
    beats: number[];
    downbeats: number[];
    accents?: BeatAccents;
}

export interface AccentedBeatGrid extends BeatGrid {
    accents?: BeatAccents;
}

const isTimeList = (value: unknown): value is number[] =>
    Array.isArray(value) && value.every(time => typeof time === 'number' && Number.isFinite(time));

export const readStoredBeatGrid = async (key: string): Promise<AccentedBeatGrid | null> => {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const stored = JSON.parse(raw) as StoredBeatGrid;
        if (!stored || stored.version !== BEAT_GRID_VERSION) return null;
        if (!isTimeList(stored.beats) || !isTimeList(stored.downbeats) || !stored.beats.length) return null;
        const grid: AccentedBeatGrid = { beats: stored.beats, downbeats: stored.downbeats };
        if (stored.accents && stored.accents.v && stored.accents.impact?.length === stored.beats.length) {
            grid.accents = stored.accents;
        }
        return grid;
    } catch {
        return null;
    }
};

export const storeBeatGrid = async (key: string, grid: AccentedBeatGrid): Promise<void> => {
    if (!grid.beats.length) return;
    const entry: StoredBeatGrid = {
        version: BEAT_GRID_VERSION,
        beats: [...grid.beats],
        downbeats: [...grid.downbeats],
    };
    if (grid.accents && grid.accents.impact.length === grid.beats.length) entry.accents = grid.accents;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch (error) {
        console.warn('[BeatGrid] could not store beats', error);
    }
};
