import React from 'react';
import { defineVisualizer } from '../definition';
import VisualizerSpotlight from './VisualizerSpotlight';

/** 聚光 — 左对齐大字滚动，高亮始终居中，逐字上色 + 句末放大 */
export default defineVisualizer({
  mode: 'spotlight',
  order: 15,
  labelKey: 'ui.visualizerSpotlight',
  labelFallback: '聚光',
  previewSeed: 'spotlight',
  previewStartOffset: 0,
  tuningKind: 'none',
  render: (props) => <VisualizerSpotlight {...props} />,
});
