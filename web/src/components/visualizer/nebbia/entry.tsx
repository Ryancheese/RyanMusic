import React from 'react';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { defineVisualizer } from '../definition';
import NebbiaSettingsPanel from './NebbiaSettingsPanel';

const VisualizerNebbia = React.lazy(() => import('./VisualizerNebbia'));

// src/components/visualizer/nebbia/entry.tsx
// Registers 雾笺: lyrics written by a fingertip on a fogged bus window.
export default defineVisualizer({
    mode: 'nebbia',
    order: 29,
    labelKey: 'ui.visualizerNebbia',
    labelFallback: '雾笺',
    previewSeed: 'nebbia',
    previewStartOffset: 0,
    tuningKind: 'nebbia',
    beatEffects: [
        {
            id: BEAT_EFFECT_IDS.nebbiaDrizzleRide,
            nameKey: 'options.beatEffect_nebbiaDrizzleRide',
            descKey: 'options.beatEffect_nebbiaDrizzleRideDesc',
            source: 'stems',
            parts: [
                { key: 'rain', nameKey: 'options.beatEffectPart_nebbiaRain' },
                { key: 'bump', nameKey: 'options.beatEffectPart_nebbiaBump' },
            ],
        },
        {
            id: BEAT_EFFECT_IDS.nebbiaAquaBeat,
            nameKey: 'options.beatEffect_nebbiaAquaBeat',
            descKey: 'options.beatEffect_nebbiaAquaBeatDesc',
            source: 'beats',
            parts: [
                { key: 'jelly', nameKey: 'options.beatEffectPart_nebbiaJelly' },
                { key: 'weed', nameKey: 'options.beatEffectPart_nebbiaWeed' },
                { key: 'bubble', nameKey: 'options.beatEffectPart_nebbiaBubble' },
                { key: 'spot', nameKey: 'options.beatEffectPart_nebbiaSpot' },
            ],
        },
    ],
    render: props => <VisualizerNebbia {...props} />,
    renderSettingsPanel: props => <NebbiaSettingsPanel {...props} />,
});
