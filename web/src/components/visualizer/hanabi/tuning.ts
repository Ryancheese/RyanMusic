// Copyright (c) 2026 chthollyphile
import { defineVisualizerTuning } from '../tuningRegistry';

// src/components/visualizer/hanabi/tuning.ts
// Injects 花火's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({
    mode: 'hanabi',
    settingsKey: 'hanabiTuning',
    settingsSetterKey: 'handleSetHanabiTuning',
    apply: (props, tuning) => ({ ...props, hanabiTuning: tuning }),
});
