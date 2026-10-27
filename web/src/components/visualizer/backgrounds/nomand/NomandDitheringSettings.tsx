import React from 'react';
import type { NomandBackgroundDitheringType } from '../../../../types';
import BackgroundToggleRow from '../BackgroundToggleRow';
import type { NomandBackgroundEffectPanelProps } from './NomandBackgroundEffectPanel';

const DITHERING_TYPES: NomandBackgroundDitheringType[] = ['2x2', '4x4', '8x8'];

const NomandDitheringSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
    t,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
    theme,
    rangeInputClass = 'w-full',
}) => {
    if (!theme) return null;
    const borderColor = theme.accentColor;
    const selectedBg = 'color-mix(in srgb, var(--text-accent) 16%, transparent)';

    return (
        <>
            <div className="space-y-2">
                <div className="text-sm" style={{ color: theme.primaryColor }}>
                    {t('options.nomandBackgroundDitheringType')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {DITHERING_TYPES.map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => onTuningChange?.({ ditheringType: type })}
                            className="rounded-xl border px-2 py-2 text-xs"
                            style={{
                                borderColor: tuning.ditheringType === type ? borderColor : 'color-mix(in srgb, var(--text-secondary) 18%, transparent)',
                                backgroundColor: tuning.ditheringType === type ? selectedBg : 'transparent',
                                color: theme.primaryColor,
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>
            <label className="block space-y-2">
                <span className="flex justify-between text-sm" style={{ color: theme.primaryColor }}>
                    <span>{t('options.nomandBackgroundSize')}</span>
                    <span className="font-mono opacity-70">{tuning.size.toFixed(1)}</span>
                </span>
                <input
                    type="range"
                    min="0.5"
                    max="20"
                    step="0.5"
                    value={tuning.size}
                    onChange={event => onTuningChange?.({ size: Number(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </label>
            <label className="block space-y-2">
                <span className="flex justify-between text-sm" style={{ color: theme.primaryColor }}>
                    <span>{t('options.nomandBackgroundColorSteps')}</span>
                    <span className="font-mono opacity-70">{tuning.colorSteps}</span>
                </span>
                <input
                    type="range"
                    min="1"
                    max="7"
                    step="1"
                    value={tuning.colorSteps}
                    onChange={event => onTuningChange?.({ colorSteps: Number(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </label>
            <BackgroundToggleRow
                label={t('options.nomandBackgroundOriginalColors')}
                checked={tuning.originalColors}
                onChange={originalColors => onTuningChange?.({ originalColors })}
                theme={theme}
            />
            <BackgroundToggleRow
                label={t('options.nomandBackgroundInverted')}
                checked={tuning.inverted}
                onChange={inverted => onTuningChange?.({ inverted })}
                theme={theme}
            />
        </>
    );
};

export default NomandDitheringSettings;
