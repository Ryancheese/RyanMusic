import React from 'react';
import { defineVisualizer } from '../definition';
import LyricWallSettingsPanel from './LyricWallSettingsPanel';
import VisualizerLyricWall from './VisualizerLyricWall';

// Registers 无界 with six restored JMGO scenes and shared typography controls.
export default defineVisualizer({
  mode: 'lyricwall',
  order: 76,
  labelKey: 'ui.visualizerLyricWall',
  labelFallback: '无界',
  previewSeed: 'lyricwall',
  previewStartOffset: 0,
  tuningKind: 'lyricwall',
  render: (props) => <VisualizerLyricWall {...props} />,
  renderSettingsPanel: (props) => <LyricWallSettingsPanel {...props} />,
});
