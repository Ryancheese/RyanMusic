import { defineVisualizerTuning } from '../tuningRegistry';

export default defineVisualizerTuning({
    mode: 'nebbia',
    settingsKey: 'nebbiaTuning',
    settingsSetterKey: 'patchNebbia',
    apply: (props, tuning) => ({ ...props, nebbiaTuning: tuning }),
});
