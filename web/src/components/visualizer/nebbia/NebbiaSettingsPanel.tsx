import React, { useMemo } from 'react';
import type { LyricRenderScale } from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { LYRIC_RENDER_SCALES } from '../../../utils/lyricRenderQuality';
import { TemperaSettingsSection as SettingsSection } from '../tempera/TemperaSettingsControls';
import {
    DEFAULT_NEBBIA_TUNING,
    NEBBIA_APPEAR_STYLES,
    NEBBIA_BEHIND,
    NEBBIA_FADE_STYLES,
    NEBBIA_GLASS,
    NEBBIA_GLASS_FOR,
    NEBBIA_LAYOUTS,
    NEBBIA_LIMITS,
    NEBBIA_RAIN,
    NEBBIA_SCENERY,
    type NebbiaNumberKey,
    type NebbiaTuning,
} from './types';

export const NEBBIA_APPEAR_LABEL_KEYS: Record<NebbiaTuning['appear'][number], string> = {
    write: 'options.nebbiaAppearWrite',
    fade: 'options.nebbiaAppearFade',
    breath: 'options.nebbiaAppearBreath',
};
export const NEBBIA_FADE_LABEL_KEYS: Record<NebbiaTuning['fade'][number], string> = {
    fog: 'options.nebbiaFadeFog',
    fingers: 'options.nebbiaFadeFingers',
};

const LAYOUT_LABEL: Record<NebbiaTuning['layouts'][number], string> = {
    ribbon: 'options.nebbiaLayout_ribbon',
    lines2: 'options.nebbiaLayout_lines2',
    lines3: 'options.nebbiaLayout_lines3',
    cross: 'options.nebbiaLayout_cross',
    pillar: 'options.nebbiaLayout_pillar',
    header: 'options.nebbiaLayout_header',
    badge: 'options.nebbiaLayout_badge',
    columns: 'options.nebbiaLayout_columns',
    orbit: 'options.nebbiaLayout_orbit',
};

const hint = (text: string) => (
    <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>{text}</p>
);

const Slider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    rangeInputClass: string;
    onChange: (value: number) => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
}> = ({ label, value, min, max, step, rangeInputClass, onChange, onPointerDown, onPointerUp }) => (
    <label className="block space-y-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
        <span className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="font-mono text-xs opacity-60">{Number(value.toFixed(2))}</span>
        </span>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            className={rangeInputClass}
            onChange={event => onChange(Number(event.target.value))}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        />
    </label>
);

const toggled = <T extends string>(choices: readonly T[], on: readonly T[], item: T, next: boolean): T[] | null => {
    const out = choices.filter(choice => (choice === item ? next : on.includes(choice)));
    return out.length ? out : null;
};

const NebbiaSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    nebbiaTuning = DEFAULT_NEBBIA_TUNING,
    onNebbiaTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const tuning = nebbiaTuning;
    const aquarium = tuning.behind === 'aquarium';
    const patch = (next: Partial<NebbiaTuning>) => onNebbiaTuningChange?.(next);
    const sceneryKey = aquarium ? 'options.nebbiaAquaScenery' : 'options.nebbiaScenery';
    const rainKey = aquarium ? 'options.nebbiaAquaRain' : 'options.nebbiaRain';

    const behindOptions = useMemo<VisualizerPresetOption<NebbiaTuning['behind']>[]>(() => (
        NEBBIA_BEHIND.map(value => ({ value, label: t(`options.nebbiaBehind_${value}`) }))
    ), [t]);
    const glassOptions = useMemo<VisualizerPresetOption<NebbiaTuning['glass']>[]>(() => (
        NEBBIA_GLASS.map(value => ({ value, label: t(`options.nebbiaGlass_${value}`) }))
    ), [t]);
    const rainOptions = useMemo<VisualizerPresetOption<NebbiaTuning['rain']>[]>(() => (
        NEBBIA_RAIN.map(value => ({ value, label: t(`${rainKey}_${value}`) }))
    ), [rainKey, t]);
    const scaleOptions = useMemo<VisualizerPresetOption<LyricRenderScale | 'global'>[]>(() => ([
        { value: 'global', label: t('options.machiFollowGlobal') },
        ...LYRIC_RENDER_SCALES.map(value => ({ value, label: `${value}×` })),
    ]), []);

    const slider = (key: NebbiaNumberKey, labelKey: string, step: number) => (
        <Slider
            key={key}
            label={t(labelKey)}
            value={tuning[key]}
            min={NEBBIA_LIMITS[key].min}
            max={NEBBIA_LIMITS[key].max}
            step={step}
            rangeInputClass={rangeInputClass}
            onChange={value => patch({ [key]: value } as Partial<NebbiaTuning>)}
            onPointerDown={onSliderPointerDown}
            onPointerUp={onSliderCommit}
        />
    );
    const switches = <T extends string>(
        choices: readonly T[],
        on: readonly T[],
        labelOf: (item: T) => string,
        apply: (next: T[]) => Partial<NebbiaTuning>,
    ) => choices.map(item => {
        const checked = on.includes(item);
        const locked = on.length === 1 && checked;
        return (
            <button
                key={item}
                type="button"
                disabled={locked}
                className="rounded-full border px-2.5 py-1 text-xs disabled:opacity-40"
                style={{
                    borderColor: checked ? 'color-mix(in srgb, var(--text-primary) 45%, transparent)' : 'transparent',
                    color: 'var(--text-primary)',
                }}
                onClick={() => {
                    const next = toggled(choices, on, item, !checked);
                    if (next) patch(apply(next));
                }}
            >
                {labelOf(item)}
            </button>
        );
    });

    return (
        <div className="space-y-4 rounded-[24px] border border-white/10 p-4" style={{ backgroundColor: controlCardBg }}>
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('options.nebbiaSettings')}</div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>{t('options.nebbiaSettingsDesc')}</div>
            </div>

            <SettingsSection title={t('options.nebbiaWriting')}>
                {slider('strokeWidth', 'options.nebbiaStrokeWidth', 0.005)}
                {slider('writeSpeed', 'options.nebbiaWriteSpeed', 0.05)}
                {slider('jitter', 'options.nebbiaJitter', 0.05)}
                {slider('warp', 'options.nebbiaWarp', 0.05)}
                {slider('doodle', 'options.nebbiaDoodle', 0.05)}
                {slider('mist', 'options.nebbiaMist', 0.01)}
                {slider('hold', 'options.nebbiaHold', 0.1)}
                {slider('refog', 'options.nebbiaRefog', 0.5)}
                <VisualizerPresetGroup
                    label={t('options.nebbiaCredits')}
                    value={tuning.credits}
                    options={[{ value: true, label: t('options.machiToggleOn') }, { value: false, label: t('options.machiToggleOff') }]}
                    onChange={credits => patch({ credits })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint(t('options.nebbiaCreditsHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaAppear')}>
                <div className="flex flex-wrap gap-2">
                    {switches(NEBBIA_APPEAR_STYLES, tuning.appear, item => t(NEBBIA_APPEAR_LABEL_KEYS[item]), appear => ({ appear }))}
                </div>
                {hint(t('options.nebbiaAppearHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaFade')}>
                <div className="flex flex-wrap gap-2">
                    {switches(NEBBIA_FADE_STYLES, tuning.fade, item => t(NEBBIA_FADE_LABEL_KEYS[item]), fade => ({ fade }))}
                </div>
                {hint(t('options.nebbiaFadeHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaLayouts')}>
                <div className="flex flex-wrap gap-2">
                    {switches(NEBBIA_LAYOUTS, tuning.layouts, item => t(LAYOUT_LABEL[item]), layouts => ({ layouts }))}
                </div>
                {hint(t('options.nebbiaLayoutsHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaWindow')}>
                {slider('busSpeed', 'options.nebbiaBusSpeed', 0.05)}
                {slider('neon', 'options.nebbiaNeon', 0.05)}
                {aquarium ? null : slider('bump', 'options.nebbiaBump', 0.05)}
                {slider('spot', 'options.nebbiaSpot', 0.05)}
                {slider('spotX', 'options.nebbiaSpotX', 0.01)}
                {aquarium ? (
                    <>
                        {slider('jellies', 'options.nebbiaJellies', 1)}
                        {slider('jellySize', 'options.nebbiaJellySize', 0.05)}
                        {slider('bubbles', 'options.nebbiaBubbles', 0.05)}
                    </>
                ) : null}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaGlass')}>
                <VisualizerPresetGroup
                    label={t('options.nebbiaGlassStyle')}
                    value={tuning.glass}
                    options={glassOptions}
                    onChange={glass => patch({ glass })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint(t('options.nebbiaGlassHint'))}
                {tuning.glass === 'rain' ? (
                    <>
                        {slider('rainHit', 'options.nebbiaRainHit', 0.05)}
                        {slider('rainBig', 'options.nebbiaRainBig', 0.05)}
                    </>
                ) : (
                    <>
                        {slider('dew', 'options.nebbiaDew', 0.05)}
                        {slider('dewSize', 'options.nebbiaDewSize', 0.05)}
                        {slider('dewGlint', 'options.nebbiaDewGlint', 0.05)}
                    </>
                )}
            </SettingsSection>

            <SettingsSection title={t(sceneryKey)}>
                <VisualizerPresetGroup
                    label={t('options.nebbiaBehind')}
                    value={tuning.behind}
                    options={behindOptions}
                    onChange={behind => patch({ behind, glass: NEBBIA_GLASS_FOR[behind] ?? tuning.glass })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint(t('options.nebbiaBehindHint'))}
                <div className="flex flex-wrap gap-2">
                    {NEBBIA_SCENERY.map(part => {
                        const checked = tuning.scenery.includes(part);
                        const disabled = tuning.behind === 'backdrop' && part !== 'spot';
                        return (
                            <button
                                key={part}
                                type="button"
                                disabled={disabled}
                                className="rounded-full border px-2.5 py-1 text-xs disabled:opacity-30"
                                style={{
                                    borderColor: checked ? 'color-mix(in srgb, var(--text-primary) 45%, transparent)' : 'transparent',
                                    color: 'var(--text-primary)',
                                }}
                                onClick={() => patch({
                                    scenery: NEBBIA_SCENERY.filter(item => (item === part ? !checked : tuning.scenery.includes(item))),
                                })}
                            >
                                {t(`${sceneryKey}_${part}`)}
                            </button>
                        );
                    })}
                </div>
                {hint(t(`${sceneryKey}Hint`))}
                <VisualizerPresetGroup
                    label={t(rainKey)}
                    value={tuning.rain}
                    options={rainOptions}
                    onChange={rain => patch({ rain })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint(t(`${rainKey}Hint`))}
            </SettingsSection>

            <SettingsSection title={t('options.nebbiaRender')}>
                <VisualizerPresetGroup
                    label={t('options.nebbiaRenderScale')}
                    value={tuning.render.scale}
                    options={scaleOptions}
                    onChange={scale => patch({ render: { ...tuning.render, scale } })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
            </SettingsSection>
        </div>
    );
};

export default NebbiaSettingsPanel;
