import React from 'react';
import { useTranslation } from 'react-i18next';
import { useVisualizerSettingsStore } from '../../store/visualizerSettingsStore';
import { useSmartBeatAvailability } from '../../hooks/useSmartBeatAvailability';
import type { SmartBeatMode } from '../../types';

type SmartBeatSettingsCardProps = {
    controlCardBg: string;
    pill: string;
    idle: string;
    activeStyle: React.CSSProperties;
};

const SmartBeatSettingsCard: React.FC<SmartBeatSettingsCardProps> = ({
    controlCardBg,
    pill,
    idle,
    activeStyle,
}) => {
    const { t } = useTranslation();
    const smartBeat = useVisualizerSettingsStore((state) => state.smartBeat);
    const setSmartBeat = useVisualizerSettingsStore((state) => state.handleSetSmartBeat);
    const availability = useSmartBeatAvailability(smartBeat.mode);
    const modeOptions: { id: SmartBeatMode; label: string }[] = [
        { id: 'off', label: t('options.smartBeatOff') || '关闭' },
        { id: 'cached', label: t('options.smartBeatCached') || '只用已分析' },
        { id: 'on', label: t('options.smartBeatOn') || '开启' },
    ];
    const descKey = `options.smartBeatDesc_${smartBeat.mode}`;
    const description = t(descKey);
    const unavailable = availability === 'noGpu'
        ? (t('options.beatFxUnavailable_noGpu') || '此设备没有可用的 WebGPU，开启模式下节拍效果不会分析新歌。')
        : null;

    return (
        <div
            className="space-y-3 rounded-[22px] border border-white/10 p-4"
            style={{ backgroundColor: controlCardBg }}
        >
            <div className="space-y-0.5">
                <div className="text-sm font-medium">{t('options.smartBeat') || '智能动感模式'}</div>
                <div className="text-[11px] opacity-45">{description !== descKey ? description : ''}</div>
            </div>
            <div className={`flex rounded-full p-1 ${pill}`}>
                {modeOptions.map((option) => {
                    const active = smartBeat.mode === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setSmartBeat({ mode: option.id })}
                            className={`flex-1 rounded-full py-1.5 text-[12px] font-medium transition ${active ? '' : `${idle} opacity-50 hover:opacity-80`}`}
                            style={active ? activeStyle : undefined}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            {unavailable ? <div className="text-[11px] opacity-55">{unavailable}</div> : null}
        </div>
    );
};

export default SmartBeatSettingsCard;
