import type { NomandBackgroundTuning, Theme } from '../../../../types';

// src/components/visualizer/backgrounds/nomand/NomandBackgroundEffectPanel.tsx
// Shared props for per-effect Nomand tuning rows.

export interface NomandBackgroundEffectPanelProps {
    t: (key: string) => string;
    tuning: NomandBackgroundTuning;
    onTuningChange?: (patch: Partial<NomandBackgroundTuning>) => void;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
    isDaylight?: boolean;
    theme?: Theme;
    rangeInputClass?: string;
}

export const twoDecimals = (value: number) => value.toFixed(2);

export const percentLabel = (value: number) => `${Math.round(value * 100)}%`;
