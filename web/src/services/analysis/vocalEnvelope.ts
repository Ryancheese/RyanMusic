// RyanMusic does not run the vocal-stem task yet. 雾笺 asks for this envelope and, when it is
// missing, drops rain on the mix's vocal band instead.

export const VOCAL_FPS = 50;

export interface VocalEnvelope {
    fps: number;
    db: Float32Array;
    top: number;
    onsets: Uint32Array;
    from?: number;
}

export const getVocalEnvelope = (_key: string | null): VocalEnvelope | null => null;
