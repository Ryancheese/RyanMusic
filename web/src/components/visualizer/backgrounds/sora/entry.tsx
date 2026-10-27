import React from 'react';
import { DEFAULT_SORA_BACKGROUND_TUNING } from '../../../../types';
import SoraBackground from './SoraBackground';
import SoraBackgroundSettingsCard from './SoraBackgroundSettingsCard';
import { defineVisualizerBackground } from '../definition';

export default defineVisualizerBackground({
    mode: 'sora',
    order: 50,
    labelKey: 'options.visualizerBackgroundModeSora',
    labelFallback: '星空',
    render: ({ config, theme, isDaylight, paused, staticMode }) => (
        <div className="absolute inset-0 z-0" style={{ backgroundColor: isDaylight ? '#ffffff' : '#000000' }}>
            {!config?.sora?.tuning?.blank && (
                <SoraBackground theme={theme} isDaylight={isDaylight} paused={paused || staticMode} />
            )}
        </div>
    ),
    renderSettingsPanel: ({ config, actions, ...props }) => (
        <SoraBackgroundSettingsCard
            {...props}
            tuning={config?.sora?.tuning ?? DEFAULT_SORA_BACKGROUND_TUNING}
            onTuningChange={actions?.sora?.onTuningChange}
        />
    ),
    resetSettings: actions => actions?.sora?.onResetTuning?.(),
});
