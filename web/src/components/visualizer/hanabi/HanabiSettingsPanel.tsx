// Copyright (c) 2026 chthollyphile
import React, { useMemo } from 'react';
import { DEFAULT_HANABI_TUNING, type HanabiRenderQuality, type HanabiTuning } from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { TemperaRangeControl as RangeControl, TemperaSettingsSection as SettingsSection } from '../tempera/TemperaSettingsControls';

// src/components/visualizer/hanabi/HanabiSettingsPanel.tsx
// 花火的参数面板：烟花、画面、文字、装饰、配色、性能六组，滑块遵循 VisPlayground 的草稿 / 松手提交语义。

type NumberKey = { [K in keyof HanabiTuning]: HanabiTuning[K] extends number ? K : never }[keyof HanabiTuning];
type BooleanKey = { [K in keyof HanabiTuning]: HanabiTuning[K] extends boolean ? K : never }[keyof HanabiTuning];

interface SliderSpec { kind: 'slider'; key: NumberKey; labelKey: string; min: number; max: number; step?: number; noteKey?: string; }
interface ToggleSpec { kind: 'toggle'; key: BooleanKey; labelKey: string; noteKey?: string; }
type ControlSpec = SliderSpec | ToggleSpec;

const slider = (key: NumberKey, labelKey: string, min: number, max: number, extra: Partial<SliderSpec> = {}): SliderSpec => (
    { kind: 'slider', key, labelKey, min, max, ...extra }
);
const toggle = (key: BooleanKey, labelKey: string, noteKey?: string): ToggleSpec => ({ kind: 'toggle', key, labelKey, noteKey });

const FIREWORKS_CONTROLS: ControlSpec[] = [
    slider('sparkAmount', 'options.hanabiSparkAmount', 0, 2),
    slider('glow', 'options.hanabiGlow', 0, 2),
    slider('chorusBloom', 'options.hanabiChorusBloom', 0, 2, { noteKey: 'options.hanabiChorusBloomHint' }),
    slider('bloom', 'options.hanabiBloom', 0, 2, { noteKey: 'options.hanabiBloomHint' }),
    toggle('launches', 'options.hanabiLaunches', 'options.hanabiLaunchesHint'),
];

const STAGE_CONTROLS: ControlSpec[] = [
    slider('sky', 'options.hanabiSky', 0, 1, { step: 0.01, noteKey: 'options.hanabiSkyHint' }),
    slider('riseSpeed', 'options.hanabiRiseSpeed', 0, 2, { noteKey: 'options.hanabiRiseSpeedHint' }),
    slider('spin', 'options.hanabiSpin', 0, 2, { noteKey: 'options.hanabiSpinHint' }),
    slider('ambient', 'options.hanabiAmbient', 0, 2),
    toggle('overlayFrame', 'options.hanabiOverlayFrame'),
];

const TEXT_CONTROLS: ControlSpec[] = [
    toggle('textOnly', 'options.hanabiTextOnly', 'options.hanabiTextOnlyHint'),
    slider('textMotion', 'options.hanabiTextMotion', 0, 2),
    slider('blockOpacity', 'options.hanabiBlockOpacity', 0, 1, { step: 0.01 }),
];

const DECOR_CONTROLS: ControlSpec[] = [
    slider('collage', 'options.hanabiCollage', 0, 2, { noteKey: 'options.hanabiCollageHint' }),
    slider('ornamentAmount', 'options.hanabiOrnamentAmount', 0, 2),
];

const HanabiSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    hanabiTuning = DEFAULT_HANABI_TUNING,
    onHanabiTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const booleanOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.hanabiToggleOn') },
        { value: false, label: t('options.hanabiToggleOff') },
    ]), [t]);

    const colorModeOptions: VisualizerPresetOption<HanabiTuning['colorMode']>[] = useMemo(() => ([
        { value: 'mixed', label: t('options.hanabiColorModeMixed') },
        { value: 'vivid', label: t('options.hanabiColorModeVivid') },
        { value: 'theme', label: t('options.hanabiColorModeTheme') },
    ]), [t]);

    const qualityOptions: VisualizerPresetOption<HanabiRenderQuality>[] = useMemo(() => ([
        { value: 'full', label: t('options.hanabiRenderQualityFull') },
        { value: 'balanced', label: t('options.hanabiRenderQualityBalanced') },
        { value: 'low', label: t('options.hanabiRenderQualityLow') },
    ]), [t]);

    const hint = (key: string) => (
        <p key={`hint-${key}`} className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>{t(key)}</p>
    );

    const renderControl = (spec: ControlSpec) => (
        <React.Fragment key={spec.key}>
            {spec.kind === 'slider' ? (
                <RangeControl
                    label={t(spec.labelKey)}
                    value={hanabiTuning[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step ?? 0.05}
                    rangeInputClass={rangeInputClass}
                    onChange={value => onHanabiTuningChange?.({ [spec.key]: value })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
            ) : (
                <VisualizerPresetGroup
                    label={t(spec.labelKey)}
                    value={hanabiTuning[spec.key]}
                    options={booleanOptions}
                    onChange={value => onHanabiTuningChange?.({ [spec.key]: value })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
            )}
            {spec.noteKey ? hint(spec.noteKey) : null}
        </React.Fragment>
    );

    return (
        <div className="rounded-[24px] border border-white/10 p-4 space-y-4" style={{ backgroundColor: controlCardBg }}>
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('options.hanabiSettings')}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.hanabiSettingsDesc')}
                </div>
            </div>

            <SettingsSection title={t('options.hanabiFireworksSection')}>
                {FIREWORKS_CONTROLS.map(renderControl)}
            </SettingsSection>

            <SettingsSection title={t('options.hanabiStageSection')}>
                {STAGE_CONTROLS.map(renderControl)}
            </SettingsSection>

            <SettingsSection title={t('options.hanabiTextSection')}>
                {TEXT_CONTROLS.map(renderControl)}
            </SettingsSection>

            <SettingsSection title={t('options.hanabiDecorSection')}>
                {DECOR_CONTROLS.map(renderControl)}
            </SettingsSection>

            <SettingsSection title={t('options.hanabiColorSection')}>
                <VisualizerPresetGroup
                    label={t('options.hanabiColorMode')}
                    value={hanabiTuning.colorMode}
                    options={colorModeOptions}
                    onChange={colorMode => onHanabiTuningChange?.({ colorMode })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint('options.hanabiColorModeHint')}
            </SettingsSection>

            <SettingsSection title={t('options.hanabiPerformanceSection')}>
                <VisualizerPresetGroup
                    label={t('options.hanabiRenderQuality')}
                    value={hanabiTuning.renderQuality}
                    options={qualityOptions}
                    onChange={renderQuality => onHanabiTuningChange?.({ renderQuality })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint('options.hanabiRenderQualityHint')}
            </SettingsSection>
        </div>
    );
};

export default HanabiSettingsPanel;
