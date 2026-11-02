import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Theme } from '../../../types';
import {
    MACHI_CAMERA_LABEL_KEYS,
    MACHI_FOCUS_LABEL_KEYS,
    MACHI_VIEW_SLIDERS,
    apertureReadout,
    machiApertureFromTrack,
    machiApertureToTrack,
    MACHI_APERTURE_TRACK_MAX,
} from './cameraControls';
import {
    DEFAULT_MACHI_VIEW,
    MACHI_CAMERA_MODES,
    MACHI_DOF_LIMITS,
    MACHI_FOCUS_MODES,
    MACHI_MOTION_SPEED_LIMITS,
    MACHI_VIEW_LIMITS,
    type MachiCameraMode,
    type MachiCameraView,
    type MachiFocusMode,
    type MachiSceneId,
    type MachiTuning,
} from './types';

interface MachiCameraBarProps {
    tuning: MachiTuning;
    scene: MachiSceneId;
    theme: Theme;
    t: (key: string) => string;
    onPreview: (patch: Partial<MachiTuning>) => void;
    onCommit: (patch?: Partial<MachiTuning>) => void;
    onTuningChange: (patch: Partial<MachiTuning>) => void;
    onClose: () => void;
}

const pages = ['view', 'lens', 'motion'] as const;

const MachiCameraBar: React.FC<MachiCameraBarProps> = ({
    tuning,
    scene,
    theme,
    t,
    onPreview,
    onCommit,
    onTuningChange,
    onClose,
}) => {
    const [page, setPage] = useState<(typeof pages)[number]>('view');
    const view = tuning.views[scene] ?? DEFAULT_MACHI_VIEW;
    const ink = theme.primaryColor;

    const slider = (
        label: string,
        value: number,
        min: number,
        max: number,
        step: number,
        readout: string,
        onChange: (value: number) => void,
    ) => (
        <label className="grid grid-cols-[4.5rem_1fr_3.2rem] items-center gap-2 text-[11px]" style={{ color: ink }}>
            <span className="truncate opacity-70">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={event => onChange(Number(event.target.value))}
                onPointerUp={() => onCommit()}
                onPointerCancel={() => onCommit()}
            />
            <span className="text-right font-mono opacity-80">{readout}</span>
        </label>
    );

    return (
        <div
            className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-white/15 px-3 py-2.5 backdrop-blur-md"
            style={{ backgroundColor: 'rgba(8,10,16,0.72)', color: ink }}
            onClick={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
        >
            <div className="mb-2 flex items-center gap-1.5">
                {pages.map(id => (
                    <button
                        key={id}
                        type="button"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                        style={{ backgroundColor: page === id ? 'rgba(255,255,255,0.16)' : 'transparent' }}
                        onClick={() => setPage(id)}
                    >
                        {t(id === 'view' ? 'options.machiCameraBarView' : id === 'lens' ? 'options.machiCameraBarLens' : 'options.machiCameraBarMotion')}
                    </button>
                ))}
                <button type="button" className="ml-auto rounded-full p-1 opacity-70" onClick={onClose} aria-label={t('options.machiCameraBarClose')}>
                    <X size={14} />
                </button>
            </div>

            {page === 'view' && (
                <div className="space-y-1.5">
                    <div className="mb-1 flex gap-1.5">
                        {MACHI_CAMERA_MODES.map(mode => (
                            <button
                                key={mode}
                                type="button"
                                className="rounded-full px-2.5 py-1 text-[11px]"
                                style={{ backgroundColor: tuning.camera === mode ? 'rgba(255,255,255,0.16)' : 'transparent' }}
                                onClick={() => onTuningChange({ camera: mode satisfies MachiCameraMode })}
                            >
                                {t(MACHI_CAMERA_LABEL_KEYS[mode])}
                            </button>
                        ))}
                    </div>
                    {MACHI_VIEW_SLIDERS.map(spec => slider(
                        t(spec.labelKey),
                        view[spec.key],
                        MACHI_VIEW_LIMITS[spec.key].min,
                        MACHI_VIEW_LIMITS[spec.key].max,
                        spec.step,
                        spec.format(view[spec.key]),
                        value => onPreview({
                            camera: 'custom',
                            views: { ...tuning.views, [scene]: { ...view, [spec.key]: value } satisfies MachiCameraView },
                        }),
                    ))}
                </div>
            )}

            {page === 'lens' && (
                <div className="space-y-1.5">
                    <div className="mb-1 flex flex-wrap gap-1.5">
                        {MACHI_FOCUS_MODES.map(mode => (
                            <button
                                key={mode}
                                type="button"
                                className="rounded-full px-2.5 py-1 text-[11px]"
                                style={{ backgroundColor: tuning.focus === mode ? 'rgba(255,255,255,0.16)' : 'transparent' }}
                                onClick={() => onTuningChange({ focus: mode satisfies MachiFocusMode })}
                            >
                                {t(MACHI_FOCUS_LABEL_KEYS[mode])}
                            </button>
                        ))}
                    </div>
                    {slider(t('options.machiAperture'), machiApertureToTrack(tuning.aperture), 0, MACHI_APERTURE_TRACK_MAX, 1, apertureReadout(tuning.aperture), index => onPreview({ aperture: machiApertureFromTrack(index) }))}
                    {slider(t('options.machiDof'), tuning.dof, MACHI_DOF_LIMITS.dof.min, MACHI_DOF_LIMITS.dof.max, 0.05, tuning.dof.toFixed(2), dof => onPreview({ dof }))}
                    {slider(t('options.machiDofRange'), tuning.dofRange, MACHI_DOF_LIMITS.dofRange.min, MACHI_DOF_LIMITS.dofRange.max, 0.05, `${tuning.dofRange.toFixed(2)}x`, dofRange => onPreview({ dofRange }))}
                    {slider(t('options.machiTiltShift'), tuning.tiltShift, MACHI_DOF_LIMITS.tiltShift.min, MACHI_DOF_LIMITS.tiltShift.max, 0.05, tuning.tiltShift.toFixed(2), tiltShift => onPreview({ tiltShift }))}
                    {slider(t('options.machiFocusOffset'), tuning.focusOffset, MACHI_DOF_LIMITS.focusOffset.min, MACHI_DOF_LIMITS.focusOffset.max, 0.1, `${tuning.focusOffset.toFixed(1)} m`, focusOffset => onPreview({ focusOffset }))}
                </div>
            )}

            {page === 'motion' && (
                <div className="space-y-1.5">
                    <button
                        type="button"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                        style={{ backgroundColor: tuning.motion ? 'rgba(255,255,255,0.16)' : 'transparent' }}
                        onClick={() => onTuningChange({ motion: !tuning.motion })}
                    >
                        {t('options.machiCameraMotion')}
                    </button>
                    {slider(t('options.machiCameraMotionSpeed'), tuning.motionSpeed, MACHI_MOTION_SPEED_LIMITS.min, MACHI_MOTION_SPEED_LIMITS.max, 0.05, `${tuning.motionSpeed.toFixed(2)}x`, motionSpeed => onPreview({ motionSpeed }))}
                </div>
            )}
        </div>
    );
};

export default MachiCameraBar;
