import type { SmartBeatSettings, VisualizerBackgroundMode, VisualizerMode } from '../../types';
import { DEFAULT_VISUALIZER_BACKGROUND_MODE } from './backgrounds/registry';
import { getVisualizerRegistryEntry } from './registry';
import { getVisualizerBackgroundRegistryEntry } from './backgrounds/registry';
import { isBeatEffectLive, resolveBeatEffectSetting, type BeatEffectDef, type BeatEffectSource } from '../../services/beatFx/beatEffects';

export interface BeatClockSettings {
    smartBeat: SmartBeatSettings;
    visualizerMode: VisualizerMode;
    visualizerBackgroundMode: VisualizerBackgroundMode | null;
}

const effectsOnScreen = (settings: BeatClockSettings): readonly BeatEffectDef[] => {
    const entry = getVisualizerRegistryEntry(settings.visualizerMode);
    const own = entry.beatEffects ?? [];
    if (entry.background === false) return own;
    const background = settings.visualizerBackgroundMode ?? DEFAULT_VISUALIZER_BACKGROUND_MODE;
    const behind = getVisualizerBackgroundRegistryEntry(background).beatEffects ?? [];
    return behind.length ? [...own, ...behind] : own;
};

export const liveBeatEffects = (settings: BeatClockSettings): BeatEffectDef[] =>
    effectsOnScreen(settings).filter(effect => isBeatEffectLive(settings.smartBeat, effect));

export const visualizerWantsBeats = (settings: BeatClockSettings): boolean =>
    liveBeatEffects(settings).some(effect => effect.source === 'beats');

export const visualizerWantsDrumHits = (settings: BeatClockSettings): boolean =>
    liveBeatEffects(settings).some(effect => effect.source === 'drums');

export const visualizerWantsBeatClock = (settings: BeatClockSettings): boolean =>
    visualizerWantsBeats(settings) || visualizerWantsDrumHits(settings);

export const liveBeatEffectStrength = (settings: BeatClockSettings, source: BeatEffectSource): number => {
    const effect = liveBeatEffects(settings).find(candidate => candidate.source === source);
    return effect ? resolveBeatEffectSetting(settings.smartBeat, effect.id).strength : 0;
};
