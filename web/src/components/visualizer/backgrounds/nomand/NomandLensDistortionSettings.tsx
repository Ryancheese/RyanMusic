import React from 'react';
import { percentLabel, twoDecimals, type NomandBackgroundEffectPanelProps } from './NomandBackgroundEffectPanel';

const NomandLensDistortionSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
    t,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
    theme,
    rangeInputClass = 'w-full',
}) => {
    if (!theme) return null;

    const slider = (label: string, key: 'lensDistortionSpread' | 'lensDistortionBulge' | 'lensDistortionDispersion', min: number, max: number, step: number, format: (v: number) => string) => (
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
            {slider(t('options.nomandBackgroundLensDistortionSpread'), 'lensDistortionSpread', 0, 1, 0.05, percentLabel)}
            {slider(t('options.nomandBackgroundLensDistortionBulge'), 'lensDistortionBulge', -1, 1, 0.05, twoDecimals)}
            {slider(t('options.nomandBackgroundLensDistortionDispersion'), 'lensDistortionDispersion', 0, 1, 0.05, percentLabel)}
        </>
    );
};

export default NomandLensDistortionSettings;
