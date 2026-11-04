import { defineVisualizerTuning } from '../tuningRegistry';

export default defineVisualizerTuning({
  mode: 'lyricwall',
  settingsKey: 'lyricWallTuning',
  settingsSetterKey: 'handleSetLyricWallTuning',
  apply: (props, tuning) => ({ ...props, lyricWallTuning: tuning }),
});
