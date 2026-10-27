// Minimal track decode for Beat This! (from Folia analysis/trackAudio.ts).

export const decodeAtRate = async (bytes: ArrayBuffer, sampleRate: number): Promise<AudioBuffer | null> => {
    if (typeof window === 'undefined') return null;
    const OfflineContext = window.OfflineAudioContext
        || (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OfflineContext) return null;
    try {
        return await new OfflineContext(1, 1, sampleRate).decodeAudioData(bytes.slice(0));
    } catch (error) {
        console.warn('[Analysis] could not decode a track', error);
        return null;
    }
};

export const toMidSide = (buffer: AudioBuffer): { mid: Float32Array; side: Float32Array | null } => {
    const left = buffer.getChannelData(0);
    if (buffer.numberOfChannels < 2) return { mid: Float32Array.from(left), side: null };
    const right = buffer.getChannelData(1);
    const mid = new Float32Array(buffer.length);
    const side = new Float32Array(buffer.length);
    for (let index = 0; index < mid.length; index += 1) {
        mid[index] = (left[index] + right[index]) / 2;
        side[index] = (left[index] - right[index]) / 2;
    }
    return { mid, side };
};
