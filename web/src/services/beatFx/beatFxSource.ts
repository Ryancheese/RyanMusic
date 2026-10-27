import type { Track } from '../../types';
import { trackKey } from '../../types';
import { mergeBeatFxEvents, type BeatFxEvent } from './clock';
import { getTrackBeatGrid, getTrackBeatAccents } from '../analysis/beatGrid';
import { getDrumHits, loadStoredDrumHits, loadTrackDrumHits, setWantedDrumTrack } from '../analysis/drumHits';
import { BEAT_THIS_SAMPLE_RATE, canRunBeatThis } from '../analysis/beatThis';
import { decodeAtRate, toMidSide } from '../analysis/trackAudio';

// RyanMusic: beat list and drum hits from the playing track's media URL (minimal Folia beatFxSource.ts, GPU-only).

export type BeatFxSourceKind = 'beat_this' | 'none';

export interface BeatFxTrackBeats {
    events: BeatFxEvent[];
    source: BeatFxSourceKind;
    note?: string;
    retry?: boolean;
    trackScale: number;
    accented?: Promise<BeatFxTrackBeats | null>;
}

const memory = new Map<string, Promise<BeatFxTrackBeats>>();
const MAX_TRACKS = 24;

const analysisKeyForTrack = (track: Track, mediaUrl: string): string => `${trackKey(track)}:${hashMediaUrl(mediaUrl)}`;

/** The analysis key beats and drum hits of this track are filed under. */
export const beatFxAnalysisKey = analysisKeyForTrack;

const hashMediaUrl = (url: string): string => {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
};

/** One in-flight / remembered full-file fetch per media URL — beats and drums used to each download the song and starve playback. */
const trackBytesInflight = new Map<string, Promise<ArrayBuffer | null>>();
const trackBytesKept = new Map<string, ArrayBuffer>();
const TRACK_BYTES_MAX = 3;

const fetchTrackBytes = async (mediaUrl: string): Promise<ArrayBuffer | null> => {
    if (!mediaUrl || !/^(https?:|blob:|data:)/.test(mediaUrl)) return null;
    const kept = trackBytesKept.get(mediaUrl);
    if (kept) {
        trackBytesKept.delete(mediaUrl);
        trackBytesKept.set(mediaUrl, kept);
        return kept.slice(0);
    }
    const running = trackBytesInflight.get(mediaUrl);
    if (running) {
        const joined = await running;
        return joined ? joined.slice(0) : null;
    }
    const pending = (async (): Promise<ArrayBuffer | null> => {
        try {
            const response = await fetch(mediaUrl);
            if (!response.ok) return null;
            const bytes = await response.arrayBuffer();
            if (bytes.byteLength > 0 && bytes.byteLength <= 64 * 1024 * 1024) {
                trackBytesKept.set(mediaUrl, bytes);
                while (trackBytesKept.size > TRACK_BYTES_MAX) {
                    const oldest = trackBytesKept.keys().next().value;
                    if (oldest === undefined) break;
                    trackBytesKept.delete(oldest);
                }
            }
            return bytes;
        } catch (error) {
            console.warn('[BeatFx] could not fetch track audio', error);
            return null;
        } finally {
            trackBytesInflight.delete(mediaUrl);
        }
    })();
    trackBytesInflight.set(mediaUrl, pending);
    const bytes = await pending;
    return bytes ? bytes.slice(0) : null;
};

const resolveTrackBeats = async (
    key: string,
    mediaUrl: string,
    storedOnly: boolean,
): Promise<BeatFxTrackBeats> => {
    let note = storedOnly ? 'none stored (智能动感模式 uses stored results only)' : 'beat_this returned no beats (no usable GPU, or a failed run)';
    let retry = false;
    const readMid = async () => {
        if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
            note = 'no WebGPU in this renderer';
            return null;
        }
        const bytes = await fetchTrackBytes(mediaUrl);
        if (!bytes) {
            note = 'track bytes not available yet';
            retry = Boolean(mediaUrl);
            return null;
        }
        const buffer = await decodeAtRate(bytes, BEAT_THIS_SAMPLE_RATE);
        if (!buffer) {
            note = 'decode failed';
            return null;
        }
        return toMidSide(buffer).mid;
    };
    try {
        const grid = await getTrackBeatGrid(key, readMid, { storedOnly, urgency: 'onScreen' });
        if (grid?.beats.length) {
            if (grid.accents || storedOnly) {
                return {
                    events: mergeBeatFxEvents(grid.beats, grid.downbeats, grid.accents),
                    source: 'beat_this',
                    trackScale: grid.accents?.trackScale ?? 1,
                };
            }
            const accented = getTrackBeatAccents(key, grid, readMid)
                .then((accents): BeatFxTrackBeats | null => (accents
                    ? {
                        events: mergeBeatFxEvents(grid.beats, grid.downbeats, accents),
                        source: 'beat_this',
                        trackScale: accents.trackScale,
                    }
                    : null))
                .catch(() => null);
            return { events: mergeBeatFxEvents(grid.beats, grid.downbeats), source: 'beat_this', trackScale: 1, accented };
        }
        if (!storedOnly && !canRunBeatThis()) return { events: [], source: 'none', note: 'Beat This! unavailable', trackScale: 1 };
        return { events: [], source: 'none', note, trackScale: 1, ...(retry ? { retry } : {}) };
    } catch (error) {
        return { events: [], source: 'none', note: `beat lookup failed: ${String(error)}`, trackScale: 1 };
    }
};

export const loadBeatFxTrackBeats = (
    track: Track,
    mediaUrl: string,
    { storedOnly = false } = {},
): { key: string; beats: Promise<BeatFxTrackBeats> } => {
    const key = analysisKeyForTrack(track, mediaUrl);
    const remembered = storedOnly ? `stored:${key}` : key;
    const existing = memory.get(remembered);
    if (existing) return { key, beats: existing };
    const pending = resolveTrackBeats(key, mediaUrl, storedOnly);
    memory.set(remembered, pending);
    while (memory.size > MAX_TRACKS) {
        const oldest = memory.keys().next().value;
        if (oldest === undefined) break;
        memory.delete(oldest);
    }
    void pending.then((result) => {
        if (result.source === 'none' && memory.get(remembered) === pending) memory.delete(remembered);
    });
    return { key, beats: pending };
};

/** How a drum hit lookup ended: hits to play, none for this track, or no bytes yet (ask again). */
export type BeatFxTrackDrums = 'hits' | 'none' | 'retry';

/**
 * Starts reading a track's drum hits (analysis/drumHits.ts) - from the cache, or separated now on the
 * GPU - for a live effect that plays them, under the same analysis key as its beats. 'hits' once
 * `getDrumHits` answers for the key; 'none' for a drumless track, no htdemucs_gpu or no WebGPU;
 * 'retry' when the bytes are not to be had yet. The track asked for is the one a separation may run
 * for; the caller says when it is left (`setWantedDrumTrack(null)`). `storedOnly` (智能动感模式's
 * `cached`): the cache alone, 'hits' or 'none', and no track is wanted.
 */
export const loadBeatFxTrackDrums = (
    track: Track,
    mediaUrl: string,
    { storedOnly = false } = {},
): { key: string; drums: Promise<BeatFxTrackDrums> } => {
    const key = analysisKeyForTrack(track, mediaUrl);
    if (storedOnly) {
        const drums = loadStoredDrumHits(key).then((analysis): BeatFxTrackDrums => (analysis && getDrumHits(key) ? 'hits' : 'none'));
        return { key, drums };
    }
    setWantedDrumTrack(key);
    let missing = false;
    const readBytes = async () => {
        const bytes = await fetchTrackBytes(mediaUrl);
        if (!bytes) missing = true;
        return bytes;
    };
    const drums = loadTrackDrumHits(key, readBytes)
        .then((analysis): BeatFxTrackDrums => (analysis && getDrumHits(key) ? 'hits' : missing ? 'retry' : 'none'));
    return { key, drums };
};
