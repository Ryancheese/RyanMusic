import type { VisualizerMode } from '../types';

/**
 * Catalog of styles that may join the per-song random pool.
 * Filled by registry after entries load — never import registry from here
 * (entry modules import visualizerSettingsStore, which imports this file).
 */
let catalog: VisualizerMode[] = [];

export const setRandomVisualizerModeCatalog = (modes: readonly VisualizerMode[]) => {
  catalog = [...modes];
};

export const getBuiltinVisualizerModes = (): VisualizerMode[] => [...catalog];

/** Live view of the catalog for UI that needs `.length` / `.includes` / spread. */
export const BUILTIN_VISUALIZER_MODES: VisualizerMode[] = new Proxy([] as VisualizerMode[], {
  get(_target, prop, receiver) {
    const modes = getBuiltinVisualizerModes();
    const value = Reflect.get(modes, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(modes) : value;
  },
  ownKeys: () => Reflect.ownKeys(getBuiltinVisualizerModes()),
  getOwnPropertyDescriptor: (_target, prop) => Reflect.getOwnPropertyDescriptor(getBuiltinVisualizerModes(), prop),
  has: (_target, prop) => Reflect.has(getBuiltinVisualizerModes(), prop),
  getPrototypeOf: () => Array.prototype,
});

export type RandomVisualizerMode = VisualizerMode;

export const normalizeRandomVisualizerModes = (value: unknown): VisualizerMode[] => {
  const builtins = getBuiltinVisualizerModes();
  const selected = Array.isArray(value)
    ? value.filter((mode): mode is VisualizerMode => (
      typeof mode === 'string'
      && (builtins.length === 0 || builtins.includes(mode as VisualizerMode))
    ))
    : [];
  if (selected.length > 0) return selected;
  return builtins.length > 0 ? [...builtins] : [];
};

/** Picks within the saved selection, excluding the current style whenever another choice exists. */
export const pickRandomVisualizerMode = (
  modes: readonly VisualizerMode[],
  current: VisualizerMode,
  random: () => number = Math.random,
): VisualizerMode => {
  const selected = normalizeRandomVisualizerModes(modes);
  const alternatives = selected.filter((mode) => mode !== current);
  const candidates = alternatives.length > 0 ? alternatives : selected;
  if (candidates.length === 0) return current;
  return candidates[Math.floor(random() * candidates.length) % candidates.length];
};
