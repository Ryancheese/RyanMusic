// Which analysis model weights are reachable in this browser build (Folia modelAvailability.ts, web-only).
//
// Folia asks the desktop main process; RyanMusic HEADs the static files. `htdemucs` and `htdemucs_gpu`
// are one file here (htdemucs-wgsl.bin, the WebGPU export), so both are true together; there is no CPU
// (MNN) htdemucs path.

import { BEAT_THIS_WGSL_URL, HTDEMUCS_WGSL_URL } from './modelPaths';

/** htdemucs_gpu: htdemucs' WebGPU export, the drum stem of 智能动感模式 (HTDEMUCS_WGSL_URL). */
export type AutomixModelName = 'beat_this' | 'htdemucs' | 'htdemucs_gpu';

export type AutomixModelsPresent = Readonly<Record<AutomixModelName, boolean>>;

const ABSENT: AutomixModelsPresent = Object.freeze({ beat_this: false, htdemucs: false, htdemucs_gpu: false });

let present: AutomixModelsPresent = ABSENT;
const listeners = new Set<() => void>();

export const subscribeModelAvailability = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

export const modelsPresent = (): AutomixModelsPresent => present;

export const modelCanRun = (name: AutomixModelName): boolean => present[name];

const reachable = async (primary: string, fileName: string): Promise<boolean> => {
    const candidates = [
        primary,
        `${import.meta.env.BASE_URL}../models/${fileName}`.replace(/([^:]\/)\/+/g, '$1'),
    ];
    for (const url of candidates) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) return true;
        } catch { /* next */ }
    }
    return false;
};

export const refreshModelAvailability = async (): Promise<AutomixModelsPresent> => {
    if (typeof fetch === 'undefined') return present;
    try {
        const [beatThis, htdemucs] = await Promise.all([
            reachable(BEAT_THIS_WGSL_URL, 'beat_this-wgsl.bin'),
            reachable(HTDEMUCS_WGSL_URL, 'htdemucs-wgsl.bin'),
        ]);
        const next: AutomixModelsPresent = Object.freeze({ beat_this: beatThis, htdemucs, htdemucs_gpu: htdemucs });
        if (next.beat_this === present.beat_this && next.htdemucs === present.htdemucs && next.htdemucs_gpu === present.htdemucs_gpu) return present;
        present = next;
        for (const listener of listeners) listener();
        return present;
    } catch {
        return present;
    }
};

export const noteModelFailed = async (name: AutomixModelName): Promise<void> => {
    const stillThere = (await refreshModelAvailability())[name];
    if (!stillThere) console.warn(`[Analysis] ${name} produced nothing and its weights are gone`);
};

void refreshModelAvailability();
