import { defineVisualizerTuning } from '../tuningRegistry';

// src/components/visualizer/machi/tuning.ts
// Injects 町景's tuning at the renderer boundary.
export default defineVisualizerTuning({
    mode: 'machi',
    settingsKey: 'machiTuning',
    settingsSetterKey: 'patchMachi',
    apply: (props, tuning) => ({ ...props, machiTuning: tuning }),
});
