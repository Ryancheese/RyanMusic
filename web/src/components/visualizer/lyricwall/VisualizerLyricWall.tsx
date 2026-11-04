import React from 'react';
import { normalizeLyricWallTuning } from '../../../types';
import type { VisualizerSharedProps } from '../definition';
import VisualizerJmgo from '../jmgo/VisualizerJmgo';

const VisualizerLyricWall: React.FC<VisualizerSharedProps> = (props) => {
  const tuning = normalizeLyricWallTuning(props.lyricWallTuning);
  return <VisualizerJmgo {...props} lyricWallTuning={tuning} scene={tuning.mode} />;
};

export default VisualizerLyricWall;
