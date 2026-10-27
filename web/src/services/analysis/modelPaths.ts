// WebGPU Beat This! weights served beside the app bundle.

/** Production: `/static/models/…` from site root; Vite dev serves via proxy or absolute path. */
export const BEAT_THIS_WGSL_URL = '/static/models/beat_this-wgsl.bin';

/** htdemucs' WebGPU export (the drum stem of 智能动感模式), served beside beat_this-wgsl.bin. */
export const HTDEMUCS_WGSL_URL = '/static/models/htdemucs-wgsl.bin';
