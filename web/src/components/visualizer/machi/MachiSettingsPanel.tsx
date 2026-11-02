import React, { useMemo, useSyncExternalStore } from 'react';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { TemperaSettingsSection as SettingsSection } from '../tempera/TemperaSettingsControls';
import { getMachiShownScene, subscribeMachiShownScene } from './shownScene';
import { resolveMachiQualityPreset } from './machiTuning';
import {
    DEFAULT_MACHI_TUNING,
    DEFAULT_MACHI_VIEW,
    MACHI_ANTIALIAS_MODES,
    MACHI_CAMERA_MODES,
    MACHI_DETAIL_LEVELS,
    MACHI_DOF_LIMITS,
    MACHI_FOCUS_MODES,
    MACHI_FOLLOW_GLOBAL,
    MACHI_MOTION_SPEED_LIMITS,
    MACHI_QUALITY_PRESETS,
    MACHI_QUALITY_REVISION,
    MACHI_RENDER_SCALES,
    MACHI_SCENE_IDS,
    MACHI_TIMES_OF_DAY,
    MACHI_VIEW_LIMITS,
    MACHI_WEATHERS,
    type MachiAntialias,
    type MachiCameraMode,
    type MachiCameraView,
    type MachiDetailLevel,
    type MachiFocusMode,
    type MachiQuality,
    type MachiQualityPresetId,
    type MachiRenderScale,
    type MachiSceneId,
    type MachiTimeOfDay,
    type MachiTuning,
    type MachiWeather,
} from './types';

const SCENE_LABEL: Record<MachiTuning['scene'], string> = {
    auto: 'options.machiSceneAuto',
    konbini: 'options.machiSceneKonbini',
    station: 'options.machiSceneStation',
    kowloon: 'options.machiSceneKowloon',
};
const TIME_LABEL: Record<MachiTimeOfDay, string> = {
    auto: 'options.machiTimeAuto',
    day: 'options.machiTimeDay',
    dusk: 'options.machiTimeDusk',
    night: 'options.machiTimeNight',
};
const WEATHER_LABEL: Record<MachiWeather, string> = {
    auto: 'options.machiWeatherAuto',
    clear: 'options.machiWeatherClear',
    rain: 'options.machiWeatherRain',
    snow: 'options.machiWeatherSnow',
    fog: 'options.machiWeatherFog',
};
const CAMERA_LABEL: Record<MachiCameraMode, string> = {
    default: 'options.machiCameraDefault',
    custom: 'options.machiCameraCustom',
};
const FOCUS_LABEL: Record<MachiFocusMode, string> = {
    center: 'options.machiFocusCenter',
    lyrics: 'options.machiFocusLyrics',
    manual: 'options.machiFocusManual',
};
const LEVEL_LABEL: Record<MachiDetailLevel, string> = {
    off: 'options.machiLevelOff',
    low: 'options.machiLevelLow',
    high: 'options.machiLevelHigh',
};
const AA_LABEL: Record<MachiAntialias | typeof MACHI_FOLLOW_GLOBAL, string> = {
    global: 'options.machiFollowGlobal',
    off: 'options.machiAntialiasOff',
    fxaa: 'options.machiAntialiasFxaa',
    smaa: 'options.machiAntialiasSmaa',
    ssaa: 'options.machiAntialiasSsaa',
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
    readout: string;
    rangeInputClass: string;
    onChange: (value: number) => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
}> = ({ label, value, min, max, step, readout, rangeInputClass, onChange, onPointerDown, onPointerUp }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            <span>{label}</span>
            <span className="shrink-0 font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>{readout}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={rangeInputClass}
        />
    </div>
);

const MachiSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    machiTuning = DEFAULT_MACHI_TUNING,
    onMachiTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const shown = useSyncExternalStore(subscribeMachiShownScene, getMachiShownScene, getMachiShownScene);
    const viewScene: MachiSceneId = machiTuning.scene === 'auto' ? (shown ?? 'konbini') : machiTuning.scene;
    const view = machiTuning.views[viewScene] ?? DEFAULT_MACHI_VIEW;
    const quality = machiTuning.quality;
    const preset = resolveMachiQualityPreset(quality);

    const sceneOptions = useMemo<VisualizerPresetOption<MachiTuning['scene']>[]>(() => (
        (['auto', ...MACHI_SCENE_IDS] as const).map(value => ({ value, label: t(SCENE_LABEL[value]) }))
    ), [t]);
    const timeOptions = useMemo<VisualizerPresetOption<MachiTimeOfDay>[]>(() => (
        MACHI_TIMES_OF_DAY.map(value => ({ value, label: t(TIME_LABEL[value]) }))
    ), [t]);
    const weatherOptions = useMemo<VisualizerPresetOption<MachiWeather>[]>(() => (
        MACHI_WEATHERS.map(value => ({ value, label: t(WEATHER_LABEL[value]) }))
    ), [t]);
    const cameraOptions = useMemo<VisualizerPresetOption<MachiCameraMode>[]>(() => (
        MACHI_CAMERA_MODES.map(value => ({ value, label: t(CAMERA_LABEL[value]) }))
    ), [t]);
    const focusOptions = useMemo<VisualizerPresetOption<MachiFocusMode>[]>(() => (
        MACHI_FOCUS_MODES.map(value => ({ value, label: t(FOCUS_LABEL[value]) }))
    ), [t]);
    const presetOptions = useMemo<VisualizerPresetOption<MachiQualityPresetId | 'custom'>[]>(() => ([
        ...(['high', 'balanced', 'low'] as const).map(value => ({
            value,
            label: t(value === 'high' ? 'options.machiQualityHigh' : value === 'balanced' ? 'options.machiQualityBalanced' : 'options.machiQualityLow'),
        })),
        { value: 'custom' as const, label: t('options.machiQualityCustom') },
    ]), [t]);
    const levelOptions = useMemo<VisualizerPresetOption<MachiDetailLevel>[]>(() => (
        MACHI_DETAIL_LEVELS.map(value => ({ value, label: t(LEVEL_LABEL[value]) }))
    ), [t]);
    const scaleOptions = useMemo<VisualizerPresetOption<MachiRenderScale | typeof MACHI_FOLLOW_GLOBAL>[]>(() => ([
        { value: MACHI_FOLLOW_GLOBAL, label: t('options.machiFollowGlobal') },
        ...MACHI_RENDER_SCALES.map(value => ({ value, label: `${Math.round(value * 100)}%` })),
    ]), [t]);
    const aaOptions = useMemo<VisualizerPresetOption<MachiAntialias | typeof MACHI_FOLLOW_GLOBAL>[]>(() => (
        ([MACHI_FOLLOW_GLOBAL, ...MACHI_ANTIALIAS_MODES] as const).map(value => ({ value, label: t(AA_LABEL[value]) }))
    ), [t]);
    const boolOptions = useMemo<VisualizerPresetOption<boolean>[]>(() => ([
        { value: true, label: t('options.machiToggleOn') },
        { value: false, label: t('options.machiToggleOff') },
    ]), [t]);

    const patch = (next: Partial<MachiTuning>) => onMachiTuningChange?.(next);
    const patchView = (key: keyof MachiCameraView, value: number) => {
        patch({
            camera: 'custom',
            views: { ...machiTuning.views, [viewScene]: { ...view, [key]: value } },
        });
    };
    const patchQuality = (next: Partial<MachiQuality>) => {
        patch({ quality: { ...quality, ...next, revision: MACHI_QUALITY_REVISION } });
    };

    return (
        <div className="rounded-[24px] border border-white/10 p-4 space-y-4" style={{ backgroundColor: controlCardBg }}>
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('options.machiSettings')}</div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>{t('options.machiSettingsDesc')}</div>
            </div>

            <SettingsSection title={t('options.machiSceneSection')}>
                <VisualizerPresetGroup label={t('options.machiScene')} value={machiTuning.scene} options={sceneOptions} onChange={scene => patch({ scene })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiSceneHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.machiSkySection')}>
                <VisualizerPresetGroup label={t('options.machiTimeOfDay')} value={machiTuning.timeOfDay} options={timeOptions} onChange={timeOfDay => patch({ timeOfDay })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiTimeOfDayHint'))}
                <VisualizerPresetGroup label={t('options.machiWeather')} value={machiTuning.weather} options={weatherOptions} onChange={weather => patch({ weather })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiWeatherHint'))}
            </SettingsSection>

            <SettingsSection title={t('options.machiCameraSection')}>
                <VisualizerPresetGroup label={t('options.machiCameraMode')} value={machiTuning.camera} options={cameraOptions} onChange={camera => patch({ camera })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiCameraModeHint'))}
                <p className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.machiViewScene')}: {t(SCENE_LABEL[viewScene])}
                </p>
                {(['azimuth', 'elevation', 'zoom', 'panX', 'panZ'] as const).map(key => (
                    <Slider
                        key={key}
                        label={t(key === 'azimuth' ? 'options.machiViewAzimuth' : key === 'elevation' ? 'options.machiViewElevation' : key === 'zoom' ? 'options.machiViewZoom' : key === 'panX' ? 'options.machiViewPanX' : 'options.machiViewPanZ')}
                        value={view[key]}
                        min={MACHI_VIEW_LIMITS[key].min}
                        max={MACHI_VIEW_LIMITS[key].max}
                        step={key === 'zoom' ? 0.05 : key === 'panX' || key === 'panZ' ? 0.1 : 1}
                        readout={key === 'zoom' ? `${view[key].toFixed(2)}x` : `${view[key].toFixed(key === 'panX' || key === 'panZ' ? 1 : 0)}`}
                        rangeInputClass={rangeInputClass}
                        onChange={value => patchView(key, value)}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                    />
                ))}
                <button
                    type="button"
                    className="text-xs underline opacity-70"
                    onClick={() => patch({ views: { ...machiTuning.views, [viewScene]: { ...DEFAULT_MACHI_VIEW } } })}
                >
                    {t('options.machiViewReset')}
                </button>
                <VisualizerPresetGroup label={t('options.machiCameraMotion')} value={machiTuning.motion} options={boolOptions} onChange={motion => patch({ motion })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiCameraMotionHint'))}
                <Slider
                    label={t('options.machiCameraMotionSpeed')}
                    value={machiTuning.motionSpeed}
                    min={MACHI_MOTION_SPEED_LIMITS.min}
                    max={MACHI_MOTION_SPEED_LIMITS.max}
                    step={0.05}
                    readout={`${machiTuning.motionSpeed.toFixed(2)}x`}
                    rangeInputClass={rangeInputClass}
                    onChange={motionSpeed => patch({ motionSpeed })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
            </SettingsSection>

            <SettingsSection title={t('options.machiDofSection')}>
                <Slider
                    label={t('options.machiAperture')}
                    value={machiTuning.aperture}
                    min={MACHI_DOF_LIMITS.aperture.min}
                    max={MACHI_DOF_LIMITS.aperture.max}
                    step={0.1}
                    readout={`f/${machiTuning.aperture.toFixed(1)}`}
                    rangeInputClass={rangeInputClass}
                    onChange={aperture => patch({ aperture })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
                {hint(t('options.machiApertureHint'))}
                <Slider
                    label={t('options.machiDof')}
                    value={machiTuning.dof}
                    min={MACHI_DOF_LIMITS.dof.min}
                    max={MACHI_DOF_LIMITS.dof.max}
                    step={0.05}
                    readout={machiTuning.dof.toFixed(2)}
                    rangeInputClass={rangeInputClass}
                    onChange={dof => patch({ dof })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
                <Slider
                    label={t('options.machiDofRange')}
                    value={machiTuning.dofRange}
                    min={MACHI_DOF_LIMITS.dofRange.min}
                    max={MACHI_DOF_LIMITS.dofRange.max}
                    step={0.05}
                    readout={`${machiTuning.dofRange.toFixed(2)}x`}
                    rangeInputClass={rangeInputClass}
                    onChange={dofRange => patch({ dofRange })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
                <Slider
                    label={t('options.machiTiltShift')}
                    value={machiTuning.tiltShift}
                    min={MACHI_DOF_LIMITS.tiltShift.min}
                    max={MACHI_DOF_LIMITS.tiltShift.max}
                    step={0.05}
                    readout={machiTuning.tiltShift.toFixed(2)}
                    rangeInputClass={rangeInputClass}
                    onChange={tiltShift => patch({ tiltShift })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
                {hint(t('options.machiTiltShiftHint'))}
                <VisualizerPresetGroup label={t('options.machiFocus')} value={machiTuning.focus} options={focusOptions} onChange={focus => patch({ focus })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiFocusHint'))}
                <Slider
                    label={t('options.machiFocusOffset')}
                    value={machiTuning.focusOffset}
                    min={MACHI_DOF_LIMITS.focusOffset.min}
                    max={MACHI_DOF_LIMITS.focusOffset.max}
                    step={0.1}
                    readout={`${machiTuning.focusOffset.toFixed(1)} m`}
                    rangeInputClass={rangeInputClass}
                    onChange={focusOffset => patch({ focusOffset })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
            </SettingsSection>

            <SettingsSection title={t('options.machiQualitySection')}>
                <VisualizerPresetGroup
                    label={t('options.machiQuality')}
                    value={preset}
                    options={presetOptions}
                    onChange={value => {
                        if (value === 'custom') return;
                        patch({ quality: { ...MACHI_QUALITY_PRESETS[value], adaptive: quality.adaptive, revision: MACHI_QUALITY_REVISION } });
                    }}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                <VisualizerPresetGroup label={t('options.machiRenderScale')} value={quality.renderScale} options={scaleOptions} onChange={renderScale => patchQuality({ renderScale })} isDaylight={isDaylight} theme={theme} />
                <VisualizerPresetGroup label={t('options.machiAntialias')} value={quality.antialias} options={aaOptions} onChange={antialias => patchQuality({ antialias })} isDaylight={isDaylight} theme={theme} />
                <VisualizerPresetGroup label={t('options.machiShadows')} value={quality.shadows} options={levelOptions} onChange={shadows => patchQuality({ shadows })} isDaylight={isDaylight} theme={theme} />
                <VisualizerPresetGroup label={t('options.machiReflections')} value={quality.reflections} options={levelOptions} onChange={reflections => patchQuality({ reflections })} isDaylight={isDaylight} theme={theme} />
                <VisualizerPresetGroup label={t('options.machiGlow')} value={quality.glow} options={boolOptions} onChange={glow => patchQuality({ glow })} isDaylight={isDaylight} theme={theme} />
                <VisualizerPresetGroup label={t('options.machiAdaptive')} value={quality.adaptive} options={boolOptions} onChange={adaptive => patchQuality({ adaptive })} isDaylight={isDaylight} theme={theme} />
                {hint(t('options.machiAdaptiveHint'))}
            </SettingsSection>
        </div>
    );
};

export default MachiSettingsPanel;
