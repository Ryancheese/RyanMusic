import React from 'react';
import { DEFAULT_PENDOLO_TUNING } from '../../../types';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { defineVisualizer } from '../definition';
import PendoloSettingsPanel from './PendoloSettingsPanel';
import VisualizerPendolo from './VisualizerPendolo';

// src/components/visualizer/pendolo/entry.tsx
// 智能动感模式: the dial plays the track's drum hits once its drum stem is read (htdemucs_gpu,
// usePendoloBeatFx.ts). The clockwork stepping on beat_this' beats is retired, its code kept.

export default defineVisualizer({
    mode: 'pendolo',
    order: 48,
    labelKey: 'ui.visualizerPendolo',
    labelFallback: '钟摆',
    previewSeed: 'pendolo',
    previewStartOffset: 0,
    tuningKind: 'pendolo',
    beatEffects: [
        {
            id: BEAT_EFFECT_IDS.pendoloDrumhead,
            nameKey: 'options.beatEffect_pendoloDrumhead',
            descKey: 'options.beatEffect_pendoloDrumheadDesc',
            source: 'drums',
        },
        {
            id: BEAT_EFFECT_IDS.pendoloGearBeats,
            nameKey: 'options.beatEffect_pendoloGearBeats',
            descKey: 'options.beatEffect_pendoloGearBeatsDesc',
            source: 'beats',
            retired: true,
        },
    ],
    // The song-scoped seed resets Pendolo's lyric rail state before the next track starts.
    render: props => <VisualizerPendolo key={props.seed} {...props} />,
    renderSettingsPanel: props => <PendoloSettingsPanel {...props} />,
    resetSettings: ({ resetPendoloTuning, setDraftPendoloTuning }) => {
        setDraftPendoloTuning?.(DEFAULT_PENDOLO_TUNING);
        resetPendoloTuning?.();
    },
});
