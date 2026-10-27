// Copyright (c) 2026 chthollyphile
import React from 'react';
import { BEAT_EFFECT_IDS } from '../../../services/beatFx/beatEffects';
import { DEFAULT_HANABI_TUNING } from '../../../types';
import { defineVisualizer } from '../definition';
import HanabiSettingsPanel from './HanabiSettingsPanel';

const VisualizerHanabi = React.lazy(() => import('./VisualizerHanabi'));

// src/components/visualizer/hanabi/entry.tsx
// Registers 花火, the Japanese lyric-PV director: lyrics pop in on bright colour blocks, fireworks and MG
// stickers bloom along the words, and the whole world keeps rising shot after shot like a fireworks show.
export default defineVisualizer({
    mode: 'hanabi',
    order: 26,
    labelKey: 'ui.visualizerHanabi',
    labelFallback: '花火',
    previewSeed: 'hanabi',
    previewStartOffset: 0,
    tuningKind: 'hanabi',
    // 智能动感模式: beat_this' beat list schedules shells that burst on the beats, and the beat envelopes
    // punch the whole scene (hanabiBeatFx.ts).
    beatEffects: [
        {
            id: BEAT_EFFECT_IDS.hanabiBeatBursts,
            nameKey: 'options.beatEffect_hanabiBeatBursts',
            descKey: 'options.beatEffect_hanabiBeatBurstsDesc',
            source: 'beats',
        },
        {
            id: BEAT_EFFECT_IDS.hanabiBeatPulse,
            nameKey: 'options.beatEffect_hanabiBeatPulse',
            descKey: 'options.beatEffect_hanabiBeatPulseDesc',
            source: 'beats',
        },
    ],
    // Deliberately unkeyed on the seed, like lumiere: the runtime hands a track change over in
    // place (songHandover.ts / pixiRuntimeHost.ts) instead of throwing the WebGL context away.
    render: props => <VisualizerHanabi {...props} />,
    renderSettingsPanel: props => <HanabiSettingsPanel {...props} />,
    resetSettings: ({ resetHanabiTuning, setDraftHanabiTuning }) => {
        setDraftHanabiTuning?.(DEFAULT_HANABI_TUNING);
        resetHanabiTuning?.();
    },
});
