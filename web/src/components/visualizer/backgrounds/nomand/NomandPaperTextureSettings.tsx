import React from 'react';
import { percentLabel, type NomandBackgroundEffectPanelProps } from './NomandBackgroundEffectPanel';

const NomandPaperTextureSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
    t,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
    theme,
    rangeInputClass = 'w-full',
}) => {
    if (!theme) return null;

    const slider = (label: string, key: 'paperTextureContrast' | 'paperTextureRoughness' | 'paperTextureFiber', step: number) => (
        <label key={key} className="block space-y-2">
            <span className="flex justify-between text-sm" style={{ color: theme.primaryColor }}>
                <span>{label}</span>
                <span className="font-mono opacity-70">{percentLabel(tuning[key])}</span>
            </span>
            <input
                type="range"
                min={0}
                max={1}
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
            {slider(t('options.nomandBackgroundPaperTextureContrast'), 'paperTextureContrast', 0.01)}
            {slider(t('options.nomandBackgroundPaperTextureRoughness'), 'paperTextureRoughness', 0.01)}
            {slider(t('options.nomandBackgroundPaperTextureFiber'), 'paperTextureFiber', 0.05)}
        </>
    );
};

export default NomandPaperTextureSettings;
