import React from 'react';
import { defineVisualizer } from '../definition';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { DioramaSettingsPanel } from '../settingsPanels';
import VisualizerDiorama from './VisualizerDiorama';

// src/components/visualizer/diorama/entry.tsx
// Registers Diorama: a procedural 3D lyric flythrough with lyric-synced cinematic camera work, plus
// its tuning panel (camera speed / motion amount / geometry visibility and response / particles).
export default defineVisualizer({
    mode: 'diorama',
    order: 60,
    labelKey: 'ui.visualizerDiorama',
    labelFallback: '景深',
    previewSeed: 'diorama',
    previewStartOffset: 0,
    tuningKind: 'diorama',
    beatEffects: [{
        id: BEAT_EFFECT_IDS.dioramaRipple,
        nameKey: 'options.beatEffect_dioramaRipple',
        descKey: 'options.beatEffect_dioramaRippleDesc',
        source: 'beats',
    }],
    render: props => <VisualizerDiorama {...props} />,
    renderSettingsPanel: props => <DioramaSettingsPanel {...props} />,
    resetSettings: ({ resetDioramaTuning }) => {
        resetDioramaTuning?.();
    },
});
