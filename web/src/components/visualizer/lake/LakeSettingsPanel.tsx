import React, { useMemo } from 'react';
import { DEFAULT_LAKE_TUNING, type LakeLook, type LakeOutline } from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup from '../VisualizerPresetGroup';
import { LAKE_LOOKS, LAKE_OUTLINES } from './grammar';

const LakeSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
  isDaylight,
  theme,
  lakeTuning = DEFAULT_LAKE_TUNING,
  onLakeTuningChange,
}) => {
  const outlines = useMemo(() => LAKE_OUTLINES.map((item) => ({ value: item.id, label: item.label })), []);
  const looks = useMemo(() => LAKE_LOOKS.map((item) => ({ value: item.id, label: item.label })), []);

  return (
    <div className="space-y-5">
      <VisualizerPresetGroup<LakeOutline>
        label="演出"
        value={lakeTuning.outline}
        options={outlines}
        onChange={(outline) => onLakeTuningChange?.({ outline })}
        isDaylight={isDaylight}
        theme={theme}
      />
      <VisualizerPresetGroup<LakeLook>
        label="样子"
        value={lakeTuning.look}
        options={looks}
        onChange={(look) => onLakeTuningChange?.({ look })}
        isDaylight={isDaylight}
        theme={theme}
      />
    </div>
  );
};

export default LakeSettingsPanel;
