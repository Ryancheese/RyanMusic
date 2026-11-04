import React from 'react';
import {
  DEFAULT_LYRIC_WALL_TUNING, LYRIC_WALL_MODES, LYRIC_WALL_EFFECTS, LYRIC_WALL_FONTS, LYRIC_WALL_SHAPES,
  normalizeLyricWallTuning, type LyricWallTuning,
} from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup from '../VisualizerPresetGroup';

const LyricWallSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
  isDaylight, theme, lyricWallTuning = DEFAULT_LYRIC_WALL_TUNING, onLyricWallTuningChange,
  rangeInputClass, onSliderPointerDown, onSliderCommit,
}) => {
  const tuning = normalizeLyricWallTuning(lyricWallTuning);
  const active = LYRIC_WALL_MODES.find(item => item.id === tuning.mode);
  const rhythmScene = ['mobius', 'shapes', 'elantra'].includes(tuning.mode);
  const presets = <T,>(label: string, key: keyof LyricWallTuning, value: T, options: { id: T; label: string }[]) => (
    <VisualizerPresetGroup label={label} value={value} options={options.map(item => ({ value: item.id, label: item.label }))}
      onChange={next => onLyricWallTuningChange?.({ [key]: next })} isDaylight={isDaylight} theme={theme} />
  );
  const slider = (label: string, key: 'fontScale' | 'rhythmStrength' | 'inputGain', min: number, max: number) => (
    <label className="block space-y-2 text-sm">
      <span className="flex justify-between"><span>{label}</span><output className="opacity-55 tabular-nums">{key === 'fontScale' ? `${Math.round(tuning[key] * 100)}%` : `${tuning[key].toFixed(2)}×`}</output></span>
      <input type="range" aria-label={label} min={min} max={max} step={.05} value={tuning[key]}
        className={rangeInputClass || 'w-full accent-current'}
        onPointerDown={onSliderPointerDown} onPointerUp={onSliderCommit} onPointerCancel={onSliderCommit}
        onBlur={onSliderCommit} onKeyUp={onSliderCommit}
        onChange={event => onLyricWallTuningChange?.({ [key]: Number(event.target.value) })} />
    </label>
  );
  return (
    <div className="space-y-5" data-lyric-wall-settings>
      {presets('场景', 'mode', tuning.mode, LYRIC_WALL_MODES)}
      {active ? <p className="text-xs leading-relaxed opacity-50">{active.description}</p> : null}
      {presets('歌词字效', 'lyricEffect', tuning.lyricEffect, LYRIC_WALL_EFFECTS)}
      {presets('字体', 'lyricFont', tuning.lyricFont, LYRIC_WALL_FONTS)}
      {slider('场景歌词大小', 'fontScale', .65, 1.35)}
      {tuning.mode === 'shapes' ? presets('几何造型', 'shapeVariant', tuning.shapeVariant, LYRIC_WALL_SHAPES) : null}
      {rhythmScene ? <>
        <label className="flex items-center justify-between text-sm"><span>增强律动</span>
          <input type="checkbox" aria-label="增强律动" checked={tuning.rhythmEnabled} className="accent-current"
            onChange={event => onLyricWallTuningChange?.({ rhythmEnabled: event.target.checked })} />
        </label>
        {tuning.rhythmEnabled ? slider('律动强度', 'rhythmStrength', .4, 1.8) : null}
      </> : null}
      {slider('音频输入增益', 'inputGain', 0, 2)}
      <button type="button" className="w-full rounded-xl border border-current/15 px-3 py-2 text-sm opacity-70 hover:opacity-100"
        onClick={() => onLyricWallTuningChange?.({ ...DEFAULT_LYRIC_WALL_TUNING, mode: tuning.mode })}>恢复场景默认设置</button>
    </div>
  );
};
export default LyricWallSettingsPanel;
