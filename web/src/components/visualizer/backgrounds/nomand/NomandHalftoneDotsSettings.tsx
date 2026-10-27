import React from 'react';
import BackgroundToggleRow from '../BackgroundToggleRow';
import { percentLabel, twoDecimals, type NomandBackgroundEffectPanelProps } from './NomandBackgroundEffectPanel';

const NomandHalftoneDotsSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
    t,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
    theme,
    rangeInputClass = 'w-full',
}) => {
    if (!theme) return null;

    const slider = (label: string, key: 'halftoneDotsSize' | 'halftoneDotsRadius' | 'halftoneDotsContrast', min: number, max: number, step: number, format: (v: number) => string) => (
        <label key={key} className="block space-y-2">
            <span className="flex justify-between text-sm" style={{ color: theme.primaryColor }}>
                <span>{label}</span>
                <span className="font-mono opacity-70">{format(tuning[key])}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={tuning[key]}
                onChange={event => onTuningChange?.({ [key]: Number(event.target.value) })}
                onPointerDown={onSliderPointerDown}
                onPointerUp={onSliderCommit}
                className={rangeInputClass}
            />
        </label>
    );

    return (
        <>
            {slider(t('options.nomandBackgroundHalftoneDotsSize'), 'halftoneDotsSize', 0.1, 1, 0.05, twoDecimals)}
            {slider(t('options.nomandBackgroundHalftoneDotsRadius'), 'halftoneDotsRadius', 0.1, 2, 0.05, twoDecimals)}
            {slider(t('options.nomandBackgroundHalftoneDotsContrast'), 'halftoneDotsContrast', 0, 1, 0.05, percentLabel)}
            <BackgroundToggleRow
                label={t('options.nomandBackgroundOriginalColors')}
                checked={tuning.halftoneDotsOriginalColors}
                onChange={halftoneDotsOriginalColors => onTuningChange?.({ halftoneDotsOriginalColors })}
                theme={theme}
            />
            <BackgroundToggleRow
                label={t('options.nomandBackgroundInverted')}
                checked={tuning.halftoneDotsInverted}
                onChange={halftoneDotsInverted => onTuningChange?.({ halftoneDotsInverted })}
                theme={theme}
            />
        </>
    );
};

export default NomandHalftoneDotsSettings;
