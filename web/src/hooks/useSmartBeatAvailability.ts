import { useEffect, useState } from 'react';
import { probeBeatThisGpu } from '../services/analysis/beatThisGpu';
import type { SmartBeatMode } from '../types';

export type SmartBeatAvailability = 'ready' | 'noGpu';

export function useSmartBeatAvailability(mode: SmartBeatMode): SmartBeatAvailability {
    const [gpu, setGpu] = useState(true);
    const probe = mode === 'on';

    useEffect(() => {
        if (!probe) return;
        let cancelled = false;
        void probeBeatThisGpu().then((found) => {
            if (!cancelled) setGpu(found);
        });
        return () => {
            cancelled = true;
        };
    }, [probe]);

    if (mode === 'off' || mode === 'cached') return 'ready';
    return gpu ? 'ready' : 'noGpu';
}
