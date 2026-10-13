import React from 'react';
import { defineVisualizer } from '../definition';
import LakeSettingsPanel from './LakeSettingsPanel';
import VisualizerLake from './VisualizerLake';

export default defineVisualizer({
  mode: 'lake',
  order: 72,
  labelKey: 'ui.visualizerLake',
  labelFallback: '湖面',
  previewSeed: 'lake',
  previewStartOffset: 0,
  tuningKind: 'lake',
  render: (props) => <VisualizerLake {...props} />,
  renderSettingsPanel: (props) => <LakeSettingsPanel {...props} />,
});
