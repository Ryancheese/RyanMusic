import React from 'react';
import { defineVisualizer } from '../definition';
import JizuraSettingsPanel from './JizuraSettingsPanel';
import VisualizerJizura from './VisualizerJizura';

export default defineVisualizer({
  mode: 'jizura',
  order: 74,
  labelKey: 'ui.visualizerJizura',
  labelFallback: '字面',
  previewSeed: 'jizura',
  previewStartOffset: 0,
  tuningKind: 'jizura',
  render: (props) => <VisualizerJizura {...props} />,
  renderSettingsPanel: (props) => <JizuraSettingsPanel {...props} />,
});
