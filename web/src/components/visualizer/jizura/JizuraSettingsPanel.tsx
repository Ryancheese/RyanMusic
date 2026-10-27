import React, { useMemo } from 'react';
import { Shuffle } from 'lucide-react';
import {
  DEFAULT_JIZURA_TUNING,
  JIZURA_THEME_OPTIONS,
  type JizuraStyle,
  type JizuraThemeId,
} from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup from '../VisualizerPresetGroup';
import { JIZURA_STYLES } from './grammar';

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDaylight: boolean;
}> = ({ label, description, checked, onChange, isDaylight }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left"
  >
    <div className="min-w-0">
      <div className="text-[13px] font-medium">{label}</div>
      {description ? <div className="text-[11px] opacity-45">{description}</div> : null}
    </div>
    <span
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: checked ? 'var(--text-accent)' : (isDaylight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)') }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  </button>
);

const JizuraSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
  isDaylight,
  theme,
  jizuraTuning = DEFAULT_JIZURA_TUNING,
  onJizuraTuningChange,
}) => {
  const styles = useMemo(() => JIZURA_STYLES.map((item) => ({ value: item.id, label: item.label })), []);
  const idle = isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/8 hover:bg-white/12';
  const activeStyle: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, var(--text-accent) 22%, transparent)',
    color: 'var(--text-accent)',
  };
  const tuning = { ...DEFAULT_JIZURA_TUNING, ...jizuraTuning };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-[22px] border border-white/10 p-4" style={{ backgroundColor: isDaylight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.06)' }}>
        <div className="text-sm font-medium">随机</div>
        <ToggleRow
          label="おまかせ"
          description="重建时按主题方向随机一整套情绪、技法和配色"
          checked={tuning.omakase}
          onChange={(omakase) => onJizuraTuningChange?.({ omakase })}
          isDaylight={isDaylight}
        />
        {tuning.omakase ? (
          <>
            <div className="space-y-1.5">
              <div className="text-[12px] opacity-70">主题方向</div>
              <div className="flex flex-wrap gap-1.5">
                {JIZURA_THEME_OPTIONS.map((item) => {
                  const active = tuning.theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onJizuraTuningChange?.({ theme: item.id as JizuraThemeId })}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${idle}`}
                      style={active ? activeStyle : undefined}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onJizuraTuningChange?.({ roll: (tuning.roll || 0) + 1 })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ${idle}`}
            >
              <Shuffle size={13} />
              再随机一次
            </button>
          </>
        ) : null}

        <ToggleRow
          label="追加分"
          description="允许随机与样式池使用扩展素材"
          checked={tuning.extra}
          onChange={(extra) => onJizuraTuningChange?.({ extra })}
          isDaylight={isDaylight}
        />
        <ToggleRow
          label="和风"
          description="纳入和风字体与布局"
          checked={tuning.wa}
          onChange={(wa) => onJizuraTuningChange?.({ wa })}
          isDaylight={isDaylight}
        />
        <ToggleRow
          label="文字 PV 包"
          checked={tuning.typo}
          onChange={(typo) => onJizuraTuningChange?.({ typo })}
          isDaylight={isDaylight}
        />
        <ToggleRow
          label="动能包"
          checked={tuning.kinetic}
          onChange={(kinetic) => onJizuraTuningChange?.({ kinetic })}
          isDaylight={isDaylight}
        />
        <ToggleRow
          label="恐怖包"
          checked={tuning.horror}
          onChange={(horror) => onJizuraTuningChange?.({ horror })}
          isDaylight={isDaylight}
        />
      </div>

      <VisualizerPresetGroup<JizuraStyle>
        label={tuning.omakase ? '样子（关闭おまかせ时使用）' : '样子'}
        value={tuning.style}
        options={styles}
        onChange={(style) => onJizuraTuningChange?.({ style, omakase: false })}
        isDaylight={isDaylight}
        theme={theme}
      />
    </div>
  );
};

export default JizuraSettingsPanel;
