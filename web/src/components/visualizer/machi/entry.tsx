import React from 'react';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { defineVisualizer } from '../definition';
import MachiSettingsPanel from './MachiSettingsPanel';

const VisualizerMachi = React.lazy(() => import('./VisualizerMachi'));

// src/components/visualizer/machi/entry.tsx
// Registers 町景 (Machi): procedural miniature town dioramas whose signs and screens carry the lyrics.
export default defineVisualizer({
    mode: 'machi',
    order: 27,
    labelKey: 'ui.visualizerMachi',
    labelFallback: '町景',
    previewSeed: 'machi',
    previewStartOffset: 0,
    tuningKind: 'machi',
    background: false,
    beatEffects: [
        {
            id: BEAT_EFFECT_IDS.machiNeonPulse,
            nameKey: 'options.beatEffect_machiNeonPulse',
            descKey: 'options.beatEffect_machiNeonPulseDesc',
            source: 'beats',
        },
        {
            id: BEAT_EFFECT_IDS.machiDrumRipple,
            nameKey: 'options.beatEffect_machiDrumRipple',
            descKey: 'options.beatEffect_machiDrumRippleDesc',
            source: 'drums',
        },
        {
            id: BEAT_EFFECT_IDS.machiScreenFlash,
            nameKey: 'options.beatEffect_machiScreenFlash',
            descKey: 'options.beatEffect_machiScreenFlashDesc',
            source: 'drums',
        },
    ],
    render: props => <VisualizerMachi {...props} />,
    renderSettingsPanel: props => <MachiSettingsPanel {...props} />,
    resetSettings: ({ resetMachiTuning }) => {
        resetMachiTuning?.();
    },
});
