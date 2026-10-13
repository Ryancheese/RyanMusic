import { defineVisualizerTuning } from '../tuningRegistry';

export default defineVisualizerTuning({
  mode: 'lake',
  settingsKey: 'lakeTuning',
  settingsSetterKey: 'handleSetLakeTuning',
  apply: (props, tuning) => ({ ...props, lakeTuning: tuning }),
});
