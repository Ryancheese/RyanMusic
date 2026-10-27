// Reads beat_this-wgsl.bin: tensors + manifest in one file (Folia electron/analysis/packedWeights.cjs, browser port).

import type { BeatThisWgslManifest } from './beatThisWgsl/runtime';
import type { HtdemucsWgslManifest } from './htdemucsWgsl/runtime';

const MAGIC = 'FOLIABTW';
const TRAILER = MAGIC.length + 8;

export const unpackPackedWeights = <M extends { bytes: number }>(file: ArrayBuffer | Uint8Array): { weights: Uint8Array; manifest: M } => {
    const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
    if (bytes.byteLength < TRAILER) throw new Error('not a packed WGSL export (file too short)');
    const tailStart = bytes.byteLength - TRAILER;
    const magic = String.fromCharCode(...bytes.subarray(tailStart, tailStart + MAGIC.length));
    if (magic !== MAGIC) throw new Error('not a packed WGSL export (no FOLIABTW trailer)');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const at = Number(view.getBigUint64(bytes.byteLength - 8, true));
    if (!(at > 0 && at < bytes.byteLength - TRAILER)) throw new Error(`manifest offset ${at} is outside the file`);
    const json = new TextDecoder().decode(bytes.subarray(at, bytes.byteLength - TRAILER));
    const manifest = JSON.parse(json) as M;
    if (manifest.bytes !== at) throw new Error(`the tensors are ${at} bytes, the manifest says ${manifest.bytes}`);
    return { weights: bytes.subarray(0, at), manifest };
};

export const unpackBeatThisWeights = (file: ArrayBuffer | Uint8Array) => unpackPackedWeights<BeatThisWgslManifest>(file);

export const unpackHtdemucsWeights = (file: ArrayBuffer | Uint8Array) => unpackPackedWeights<HtdemucsWgslManifest>(file);
