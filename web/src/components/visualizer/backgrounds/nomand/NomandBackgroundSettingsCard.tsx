import React, { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
    DEFAULT_NOMAND_BACKGROUND_TUNING,
    type MonetBackgroundImage,
    type NomandBackgroundEffect,
    type NomandBackgroundSource,
    type NomandBackgroundTuning,
    type Theme,
} from '../../../../types';
import { colorWithAlpha } from '../../colorMix';
import BackgroundToggleRow from '../BackgroundToggleRow';
import NomandDitheringSettings from './NomandDitheringSettings';
import NomandFlutedGlassSettings from './NomandFlutedGlassSettings';
import NomandHalftoneDotsSettings from './NomandHalftoneDotsSettings';
import NomandLensDistortionSettings from './NomandLensDistortionSettings';
import NomandPaperTextureSettings from './NomandPaperTextureSettings';

const EFFECTS: NomandBackgroundEffect[] = [
    'dithering',
    'fluted-glass',
    'paper-texture',
    'halftone-dots',
    'lens-distortion',
];

const EFFECT_LABEL_KEYS: Record<NomandBackgroundEffect, string> = {
    dithering: 'options.nomandBackgroundEffectDithering',
    'fluted-glass': 'options.nomandBackgroundEffectFlutedGlass',
    'paper-texture': 'options.nomandBackgroundEffectPaperTexture',
    'halftone-dots': 'options.nomandBackgroundEffectHalftoneDots',
    'lens-distortion': 'options.nomandBackgroundEffectLensDistortion',
};

interface NomandBackgroundSettingsCardProps {
    t: (key: string) => string;
    isDaylight: boolean;
    theme: Theme;
    controlCardBg: string;
    rangeInputClass: string;
    tuning: NomandBackgroundTuning;
    onTuningChange?: (patch: Partial<NomandBackgroundTuning>) => void;
    monetBackgroundImage?: MonetBackgroundImage | null;
    onUploadMonetBackgroundImage?: (files: File[]) => Promise<{ ok: boolean; error?: string; }>;
    onClearMonetBackgroundImage?: () => Promise<void> | void;
    isLoadingMonetBackgroundImage?: boolean;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
}

const NomandBackgroundSettingsCard: React.FC<NomandBackgroundSettingsCardProps> = ({
    t,
    isDaylight,
    theme,
    controlCardBg,
    rangeInputClass,
    tuning: tuningProp,
    onTuningChange,
    monetBackgroundImage,
    onUploadMonetBackgroundImage,
    onClearMonetBackgroundImage,
    isLoadingMonetBackgroundImage = false,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const resolvedTuning = { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...tuningProp };
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [feedback, setFeedback] = useState('');
    const borderColor = colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.16);
    const selectedBg = colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16);

    const setSource = (imageSource: NomandBackgroundSource) => {
        onTuningChange?.({ imageSource });
    };

    const handleFiles = async (files: File[]) => {
        if (!files.length || !onUploadMonetBackgroundImage) return;
        const result = await onUploadMonetBackgroundImage(files);
        setFeedback(result.ok ? t('options.nomandBackgroundUploadSuccess') : result.error ?? t('options.nomandBackgroundUploadFailed'));
        if (result.ok) setSource('uploaded-global');
    };

    const effectPanelProps = {
        t,
        tuning: resolvedTuning,
        onTuningChange,
        onSliderPointerDown,
        onSliderCommit,
        isDaylight,
        theme,
        rangeInputClass,
    };

    return (
        <div className="rounded-[24px] border p-4 space-y-4" style={{ backgroundColor: controlCardBg, borderColor }}>
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: theme.primaryColor }}>
                    {t('options.nomandBackgroundSettings')}
                </div>
                <div className="text-xs opacity-70" style={{ color: theme.secondaryColor }}>
                    {t('options.nomandBackgroundSettingsDesc')}
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-sm" style={{ color: theme.primaryColor }}>
                    {t('options.nomandBackgroundSource')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {([
                        ['cover-derived', t('options.monetBackgroundSourceCover')],
                        ['uploaded-global', t('options.monetBackgroundSourceUploaded')],
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            disabled={value === 'uploaded-global' && !monetBackgroundImage && !isLoadingMonetBackgroundImage}
                            onClick={() => setSource(value)}
                            className="rounded-2xl border px-3 py-2 text-sm disabled:opacity-40"
                            style={{
                                borderColor: resolvedTuning.imageSource === value ? theme.accentColor : borderColor,
                                backgroundColor: resolvedTuning.imageSource === value ? selectedBg : 'transparent',
                                color: theme.primaryColor,
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => {
                            void handleFiles(Array.from(event.target.files ?? []));
                            event.target.value = '';
                        }}
                    />
                    <button
                        type="button"
                        disabled={isLoadingMonetBackgroundImage || !onUploadMonetBackgroundImage}
                        onClick={() => inputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40"
                        style={{ borderColor, color: theme.primaryColor }}
                    >
                        <Upload size={14} />
                        {t('options.monetUploadBackground')}
                    </button>
                    <button
                        type="button"
                        disabled={!monetBackgroundImage || !onClearMonetBackgroundImage}
                        onClick={() => void onClearMonetBackgroundImage?.()}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40"
                        style={{ borderColor, color: theme.secondaryColor }}
                    >
                        <Trash2 size={14} />
                        {t('options.monetClearBackground')}
                    </button>
                </div>
                <div className="truncate text-xs opacity-60" style={{ color: theme.secondaryColor }}>
                    {feedback || monetBackgroundImage?.name || '-'}
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor }}>
                <BackgroundToggleRow
                    label={t('options.nomandBackgroundOverlay')}
                    description={t('options.nomandBackgroundOverlayDesc')}
                    checked={resolvedTuning.overlayEnabled}
                    onChange={overlayEnabled => onTuningChange?.({ overlayEnabled })}
                    theme={theme}
                />
                <label className={`block space-y-2 ${resolvedTuning.overlayEnabled ? '' : 'opacity-45'}`}>
                    <span className="flex justify-between text-sm" style={{ color: theme.primaryColor }}>
                        <span>{t('options.nomandBackgroundOverlayOpacity')}</span>
                        <span className="font-mono opacity-70">{Math.round(resolvedTuning.overlayOpacity * 100)}%</span>
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={resolvedTuning.overlayOpacity}
                        disabled={!resolvedTuning.overlayEnabled}
                        onChange={event => onTuningChange?.({ overlayOpacity: Number(event.target.value) })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                        className={rangeInputClass}
                    />
                </label>
            </div>

            <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor }}>
                <div className="text-sm font-medium" style={{ color: theme.primaryColor }}>
                    {t('options.nomandBackgroundEffect')}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {EFFECTS.map(effect => (
                        <button
                            key={effect}
                            type="button"
                            onClick={() => onTuningChange?.({ effect })}
                            className="rounded-xl border px-2 py-2 text-xs leading-snug"
                            style={{
                                borderColor: resolvedTuning.effect === effect ? theme.accentColor : borderColor,
                                backgroundColor: resolvedTuning.effect === effect ? selectedBg : 'transparent',
                                color: theme.primaryColor,
                            }}
                        >
                            {t(EFFECT_LABEL_KEYS[effect])}
                        </button>
                    ))}
                </div>
                <div className="space-y-3 pt-1">
                    {resolvedTuning.effect === 'dithering' && <NomandDitheringSettings {...effectPanelProps} />}
                    {resolvedTuning.effect === 'fluted-glass' && <NomandFlutedGlassSettings {...effectPanelProps} />}
                    {resolvedTuning.effect === 'paper-texture' && <NomandPaperTextureSettings {...effectPanelProps} />}
                    {resolvedTuning.effect === 'halftone-dots' && <NomandHalftoneDotsSettings {...effectPanelProps} />}
                    {resolvedTuning.effect === 'lens-distortion' && <NomandLensDistortionSettings {...effectPanelProps} />}
                </div>
            </div>
        </div>
    );
};

export default NomandBackgroundSettingsCard;
