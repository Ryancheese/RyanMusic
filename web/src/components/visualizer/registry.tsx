import { type VisualizerMode } from '../../types';
import { normalizeRandomVisualizerModes, setRandomVisualizerModeCatalog } from '../../utils/randomVisualizerModes';
import { useVisualizerSettingsStore } from '../../store/visualizerSettingsStore';
import {
    type VisualizerEntryModule,
    type VisualizerRegistryEntry,
} from './definition';

export type {
    VisualizerRegistryEntry,
    VisualizerSettingsPanelProps,
    VisualizerSettingsResetProps,
    VisualizerSharedProps,
    VisualizerTuningKind,
} from './definition';

// Central mode registry. Entries are discovered from each visualizer's local entry file.
const visualizerEntryModules = import.meta.glob<VisualizerEntryModule>('./*/entry.tsx', { eager: true });

const buildVisualizerRegistry = (modules: Record<string, VisualizerEntryModule>) => {
    const entries = Object.entries(modules).map(([path, module]) => {
        if (!module.default) {
            throw new Error(`[VisualizerRegistry] Missing default export in ${path}`);
        }

        return module.default;
    });
    const byMode: Partial<Record<VisualizerMode, VisualizerRegistryEntry>> = {};

    entries.forEach(entry => {
        if (byMode[entry.mode]) {
            throw new Error(`[VisualizerRegistry] Duplicate visualizer mode "${entry.mode}"`);
        }

        byMode[entry.mode] = entry;
    });

    return {
        entries: [...entries].sort((left, right) => left.order - right.order),
        byMode,
    };
};

const { entries: VISUALIZER_REGISTRY, byMode: VISUALIZER_REGISTRY_BY_MODE } =
    buildVisualizerRegistry(visualizerEntryModules);

// Publish the pool catalog after entries finish loading. Entry modules may have created the
// settings store early (via smart-beat / sonnet imports); refresh an empty pool once modes exist.
setRandomVisualizerModeCatalog(VISUALIZER_REGISTRY.map((entry) => entry.mode));
try {
    const key = 'ryanmusic-random-visualizer-modes';
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    const modes = normalizeRandomVisualizerModes(raw);
    if (modes.length > 0) {
        useVisualizerSettingsStore.setState({ randomVisualizerModes: modes });
    }
} catch {
    // ignore quota / private mode
}

export { VISUALIZER_REGISTRY };

export const DEFAULT_VISUALIZER_MODE: VisualizerMode = 'classic';

export const hasVisualizerMode = (mode: string | null | undefined): mode is VisualizerMode =>
    Boolean(mode && VISUALIZER_REGISTRY_BY_MODE[mode as VisualizerMode]);

export const getVisualizerRegistryEntry = (mode: VisualizerMode) =>
    VISUALIZER_REGISTRY_BY_MODE[mode] ?? VISUALIZER_REGISTRY_BY_MODE[DEFAULT_VISUALIZER_MODE]!;

export const getVisualizerModeLabel = (mode: VisualizerMode, t: (key: string) => string) => {
    const entry = getVisualizerRegistryEntry(mode);
    const translated = t(entry.labelKey);
    return !translated || translated === entry.labelKey ? entry.labelFallback : translated;
};

export const getVisualizerSettingsTitle = (mode: VisualizerMode, t: (key: string) => string) =>
    `${getVisualizerModeLabel(mode, t)}参数`;

export const getVisualizerPreviewStartOffset = (mode: VisualizerMode, loopDuration: number) => {
    if (loopDuration <= 0) {
        return 0;
    }

    return getVisualizerRegistryEntry(mode).previewStartOffset % loopDuration;
};

export const getVisualizerScopedSeed = (mode: VisualizerMode, scope: string) =>
    `${scope}-${getVisualizerRegistryEntry(mode).previewSeed}`;
