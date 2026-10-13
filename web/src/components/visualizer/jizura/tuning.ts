import { defineVisualizerTuning } from '../tuningRegistry';

export default defineVisualizerTuning({
  mode: 'jizura',
  settingsKey: 'jizuraTuning',
  settingsSetterKey: 'handleSetJizuraTuning',
  apply: (props, tuning) => ({ ...props, jizuraTuning: tuning }),
});
