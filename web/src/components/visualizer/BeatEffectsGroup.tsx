import React, { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useVisualizerSettingsStore } from '../../store/visualizerSettingsStore';
import { modelsPresent, subscribeModelAvailability } from '../../services/analysis/modelAvailability';
import {
    BEAT_EFFECT_STRENGTH_MAX,
    offeredBeatEffects,
    resolveBeatEffectSetting,
    smartBeatActive,
    smartBeatMayAnalyse,
    type BeatEffectDef,
} from '../../services/beatFx/beatEffects';

type BeatEffectsGroupProps = {
    effects: readonly BeatEffectDef[] | undefined;
    controlCardBg: string;
    isDaylight: boolean;
    rangeInputClass: string;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
    onOpenSmartBeat?: () => void;
};

const BeatEffectsGroup: React.FC<BeatEffectsGroupProps> = ({
    effects,
    controlCardBg,
    isDaylight,
    rangeInputClass,
    onSliderPointerDown,
    onSliderCommit,
    onOpenSmartBeat,
}) => {
    const { t } = useTranslation();
    const smartBeat = useVisualizerSettingsStore((state) => state.smartBeat);
    const setSmartBeat = useVisualizerSettingsStore((state) => state.handleSetSmartBeat);
    // An effect reading drum hits says when its model (htdemucs_gpu) is missing - only under `on`, the one mode that runs it.
    const drumsPresent = useSyncExternalStore(subscribeModelAvailability, modelsPresent, modelsPresent).htdemucs_gpu;
    const offered = offeredBeatEffects(effects);
    const active = smartBeatActive(smartBeat);
    if (!offered.length) return null;

    return (
        <div
            className="space-y-3 rounded-[22px] border border-white/10 p-4"
            style={{ backgroundColor: controlCardBg }}
        >
            <div className="text-sm font-medium">{t('options.beatEffects') || '动感效果'}</div>
            {!active && (
                <div className="space-y-2 text-[11px] opacity-55">
                    <p>{t('options.beatEffectsNeedSmartBeat') || '在「全局」页打开智能动感模式后，这些效果才会生效。'}</p>
                    {onOpenSmartBeat ? (
                        <button
                            type="button"
                            className="rounded-full border border-white/15 px-3 py-1 text-[12px] opacity-80 hover:opacity-100"
                            onClick={onOpenSmartBeat}
                        >
                            {t('options.beatEffectsOpenSmartBeat') || '前往「全局」'}
                        </button>
                    ) : null}
                </div>
            )}
            {offered.map((effect) => {
                const setting = resolveBeatEffectSetting(smartBeat, effect.id);
                const name = t(effect.nameKey);
                const desc = t(effect.descKey);
                const missingModel = effect.source === 'drums' && !drumsPresent && smartBeatMayAnalyse(smartBeat);
                return (
                    <div key={effect.id} className="space-y-2 border-t border-white/8 pt-3 first:border-t-0 first:pt-0">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 text-left"
                            onClick={() => setSmartBeat({ effects: { [effect.id]: { on: !setting.on } } })}
                        >
                            <div className="min-w-0">
                                <div className="text-[13px] font-medium">
                                    {name !== effect.nameKey ? name : effect.id}
                                </div>
                                {desc !== effect.descKey ? (
                                    <div className="text-[11px] opacity-45">{desc}</div>
                                ) : null}
                            </div>
                            <span
                                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                                style={{
                                    backgroundColor: setting.on
                                        ? 'color-mix(in srgb, var(--text-accent) 70%, transparent)'
                                        : (isDaylight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)'),
                                }}
                            >
                                <span
                                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                                    style={{ transform: setting.on ? 'translateX(22px)' : 'translateX(2px)' }}
                                />
                            </span>
                        </button>
                        {active && setting.on && missingModel ? (
                            <p className="text-[11px] opacity-55">
                                {t('options.beatEffectNeedsDrums') || '缺少 HTDemucs 模型文件，仿真鼓面暂时不会出效果。'}
                            </p>
                        ) : null}
                        {active && setting.on ? (
                            <div className="space-y-1.5 pl-0.5">
                                <div className="flex items-center justify-between text-[12px]">
                                    <span className="opacity-70">{t('options.beatEffectStrength') || '强度'}</span>
                                    <span className="font-mono opacity-55">{setting.strength.toFixed(2)}×</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={BEAT_EFFECT_STRENGTH_MAX}
                                    step={0.05}
                                    value={setting.strength}
                                    onPointerDown={onSliderPointerDown}
                                    onPointerUp={onSliderCommit}
                                    onChange={(event) => setSmartBeat({
                                        effects: { [effect.id]: { strength: Number(event.target.value) } },
                                    })}
                                    className={rangeInputClass}
                                />
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
};

export default BeatEffectsGroup;
