import React, { useMemo } from 'react';
import { DEFAULT_JIZURA_TUNING, type JizuraStyle } from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup from '../VisualizerPresetGroup';
import { JIZURA_STYLES } from './grammar';

const JizuraSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
  isDaylight,
  theme,
  jizuraTuning = DEFAULT_JIZURA_TUNING,
  onJizuraTuningChange,
}) => {
  const styles = useMemo(() => JIZURA_STYLES.map((item) => ({ value: item.id, label: item.label })), []);

  return (
    <div className="space-y-5">
      <VisualizerPresetGroup<JizuraStyle>
        label="样子"
        value={jizuraTuning.style}
        options={styles}
        onChange={(style) => onJizuraTuningChange?.({ style })}
        isDaylight={isDaylight}
        theme={theme}
      />
    </div>
  );
};

export default JizuraSettingsPanel;
