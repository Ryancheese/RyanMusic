import React from 'react';
import { DEFAULT_SONNET_TUNING } from '../../../types';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { defineVisualizer } from '../definition';
import SonnetSettingsPanel from './SonnetSettingsPanel';
import VisualizerSonnet from './VisualizerSonnet';

// src/components/visualizer/sonnet/entry.tsx
// Registers 商籁, the deterministic Japanese MG lyric-PV director.
export default defineVisualizer({
    mode: 'sonnet',
    order: 70,
    labelKey: 'ui.visualizerSonnet',
    labelFallback: '海报',
    previewSeed: 'sonnet',
    previewStartOffset: 0,
    tuningKind: 'sonnet',
    beatEffects: [{
        id: BEAT_EFFECT_IDS.sonnetLensTear,
        nameKey: 'options.beatEffect_sonnetLensTear',
        descKey: 'options.beatEffect_sonnetLensTearDesc',
        source: 'beats',
    }],
    render: props => <VisualizerSonnet key={props.seed} {...props} />,
    renderSettingsPanel: props => <SonnetSettingsPanel {...props} />,
    resetSettings: ({ resetSonnetTuning, setDraftSonnetTuning }) => {
        setDraftSonnetTuning?.(DEFAULT_SONNET_TUNING);
        resetSonnetTuning?.();
    },
});
