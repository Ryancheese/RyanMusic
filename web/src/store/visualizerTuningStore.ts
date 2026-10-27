import { create } from 'zustand';
import {
  DEFAULT_CAPPELLA_TUNING,
  DEFAULT_CADENZA_TUNING,
  DEFAULT_CLASSIC_TUNING,
  DEFAULT_CLADDAGH_TUNING,
  DEFAULT_DIORAMA_TUNING,
  DEFAULT_FUME_TUNING,
  DEFAULT_MONET_TUNING,
  DEFAULT_PARTITA_TUNING,
  DEFAULT_PENDOLO_TUNING,
  DEFAULT_LUMIERE_TUNING,
  DEFAULT_HANABI_TUNING,
  DEFAULT_JIZURA_TUNING,
  DEFAULT_LAKE_TUNING,
  DEFAULT_SONNET_TUNING,
  DEFAULT_TEMPERA_TUNING,
  DEFAULT_TILT_TUNING,
  type CappellaTuning,
  type CadenzaTuning,
  type ClassicTuning,
  type CladdaghTuning,
  type DioramaTuning,
  type FumeTuning,
  type MonetTuning,
  type PartitaTuning,
  type PendoloTuning,
  type LumiereTuning,
  type HanabiTuning,
  type JizuraTuning,
  type LakeTuning,
  type SonnetTuning,
  type TemperaTuning,
  type TiltTuning,
} from '../types';
import { normalizeHanabiTuning } from '../components/visualizer/hanabi/hanabiTuning';
import type { VisualizerTuningBundle } from '../components/visualizer/tuningRegistry';

const KEY = 'ryanmusic-visualizer-tunings-v1';
const TEMPERA_LEGACY_KEY = 'ryanmusic-tempera-tuning-v1';

export interface VisualizerTuningsState {
  classic: ClassicTuning;
  cadenza: CadenzaTuning;
  partita: PartitaTuning;
  fume: FumeTuning;
  claddagh: CladdaghTuning;
  cappella: CappellaTuning;
  tilt: TiltTuning;
  diorama: DioramaTuning;
  monet: MonetTuning;
  pendolo: PendoloTuning;
  sonnet: SonnetTuning;
  tempera: TemperaTuning;
  lumiere: LumiereTuning;
  hanabi: HanabiTuning;
  lake: LakeTuning;
  jizura: JizuraTuning;
}

export const VISUALIZER_TUNING_DEFAULTS: VisualizerTuningsState = {
  classic: { ...DEFAULT_CLASSIC_TUNING },
  cadenza: { ...DEFAULT_CADENZA_TUNING },
  partita: { ...DEFAULT_PARTITA_TUNING },
  fume: { ...DEFAULT_FUME_TUNING },
  claddagh: { ...DEFAULT_CLADDAGH_TUNING },
  cappella: { ...DEFAULT_CAPPELLA_TUNING },
  tilt: { ...DEFAULT_TILT_TUNING },
  diorama: {
    ...DEFAULT_DIORAMA_TUNING,
    geometryVisibility: { ...DEFAULT_DIORAMA_TUNING.geometryVisibility },
  },
  monet: { ...DEFAULT_MONET_TUNING },
  pendolo: { ...DEFAULT_PENDOLO_TUNING },
  sonnet: { ...DEFAULT_SONNET_TUNING },
  lumiere: { ...DEFAULT_LUMIERE_TUNING },
  hanabi: { ...DEFAULT_HANABI_TUNING },
  lake: { ...DEFAULT_LAKE_TUNING },
  jizura: { ...DEFAULT_JIZURA_TUNING },
  tempera: {
    ...DEFAULT_TEMPERA_TUNING,
    layerImages: [],
  },
};

const mergeTempera = (parsed?: Partial<TemperaTuning> | null): TemperaTuning => ({
  ...DEFAULT_TEMPERA_TUNING,
  ...parsed,
  layerImages: Array.isArray(parsed?.layerImages) ? parsed.layerImages : [],
});

const readTunings = (): VisualizerTuningsState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<VisualizerTuningsState> | null;
    let tempera = mergeTempera(parsed?.tempera);
    if (!parsed?.tempera) {
      try {
        const legacy = JSON.parse(localStorage.getItem(TEMPERA_LEGACY_KEY) || 'null') as Partial<TemperaTuning> | null;
        if (legacy) tempera = mergeTempera(legacy);
      } catch {
        // ignore
      }
    }
    return {
      classic: { ...DEFAULT_CLASSIC_TUNING, ...parsed?.classic },
      cadenza: { ...DEFAULT_CADENZA_TUNING, ...parsed?.cadenza },
      partita: { ...DEFAULT_PARTITA_TUNING, ...parsed?.partita },
      fume: { ...DEFAULT_FUME_TUNING, ...parsed?.fume },
      claddagh: { ...DEFAULT_CLADDAGH_TUNING, ...parsed?.claddagh },
      cappella: { ...DEFAULT_CAPPELLA_TUNING, ...parsed?.cappella },
      tilt: { ...DEFAULT_TILT_TUNING, ...parsed?.tilt },
      diorama: {
        ...DEFAULT_DIORAMA_TUNING,
        ...parsed?.diorama,
        geometryVisibility: {
          ...DEFAULT_DIORAMA_TUNING.geometryVisibility,
          ...parsed?.diorama?.geometryVisibility,
        },
      },
      monet: { ...DEFAULT_MONET_TUNING, ...parsed?.monet },
      pendolo: { ...DEFAULT_PENDOLO_TUNING, ...parsed?.pendolo },
      sonnet: { ...DEFAULT_SONNET_TUNING, ...parsed?.sonnet },
      lumiere: { ...DEFAULT_LUMIERE_TUNING, ...parsed?.lumiere },
      hanabi: normalizeHanabiTuning(parsed?.hanabi),
      lake: { ...DEFAULT_LAKE_TUNING, ...parsed?.lake },
      jizura: { ...DEFAULT_JIZURA_TUNING, ...parsed?.jizura },
      tempera,
    };
  } catch {
    return {
      ...VISUALIZER_TUNING_DEFAULTS,
      diorama: {
        ...DEFAULT_DIORAMA_TUNING,
        geometryVisibility: { ...DEFAULT_DIORAMA_TUNING.geometryVisibility },
      },
      tempera: mergeTempera(null),
    };
  }
};

interface VisualizerTuningStore extends VisualizerTuningsState {
  bundle: () => VisualizerTuningBundle;
  patchClassic: (patch: Partial<ClassicTuning>) => void;
  patchCadenza: (patch: Partial<CadenzaTuning>) => void;
  patchPartita: (patch: Partial<PartitaTuning>) => void;
  patchFume: (patch: Partial<FumeTuning>) => void;
  patchCladdagh: (patch: Partial<CladdaghTuning>) => void;
  patchCappella: (patch: Partial<CappellaTuning>) => void;
  patchTilt: (patch: Partial<TiltTuning>) => void;
  patchDiorama: (patch: Partial<DioramaTuning>) => void;
  patchMonet: (patch: Partial<MonetTuning>) => void;
  patchLumiere: (patch: Partial<LumiereTuning>) => void;
  patchHanabi: (patch: Partial<HanabiTuning>) => void;
  patchLake: (patch: Partial<LakeTuning>) => void;
  patchJizura: (patch: Partial<JizuraTuning>) => void;
  patchPendolo: (patch: Partial<PendoloTuning>) => void;
  patchSonnet: (patch: Partial<SonnetTuning>) => void;
  patchTempera: (patch: Partial<TemperaTuning>) => void;
  resetMode: (mode: keyof VisualizerTuningsState) => void;
  resetAll: () => void;
}

const persist = (state: VisualizerTuningsState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota
  }
};

const pick = (state: VisualizerTuningStore): VisualizerTuningsState => ({
  classic: state.classic,
  cadenza: state.cadenza,
  partita: state.partita,
  fume: state.fume,
  claddagh: state.claddagh,
  cappella: state.cappella,
  tilt: state.tilt,
  diorama: state.diorama,
  monet: state.monet,
  pendolo: state.pendolo,
  sonnet: state.sonnet,
  lumiere: state.lumiere,
  hanabi: state.hanabi,
  lake: state.lake,
  jizura: state.jizura,
  tempera: state.tempera,
});

export const useVisualizerTuningStore = create<VisualizerTuningStore>((set, get) => ({
  ...readTunings(),
  bundle: () => pick(get()),
  patchClassic: (patch) => {
    const next = { ...pick(get()), classic: { ...get().classic, ...patch } };
    set(next);
    persist(next);
  },
  patchCadenza: (patch) => {
    const next = { ...pick(get()), cadenza: { ...get().cadenza, ...patch } };
    set(next);
    persist(next);
  },
  patchPartita: (patch) => {
    const next = { ...pick(get()), partita: { ...get().partita, ...patch } };
    set(next);
    persist(next);
  },
  patchFume: (patch) => {
    const next = { ...pick(get()), fume: { ...get().fume, ...patch } };
    set(next);
    persist(next);
  },
  patchCladdagh: (patch) => {
    const next = { ...pick(get()), claddagh: { ...get().claddagh, ...patch } };
    set(next);
    persist(next);
  },
  patchCappella: (patch) => {
    const next = { ...pick(get()), cappella: { ...get().cappella, ...patch } };
    set(next);
    persist(next);
  },
  patchTilt: (patch) => {
    const next = { ...pick(get()), tilt: { ...get().tilt, ...patch } };
    set(next);
    persist(next);
  },
  patchDiorama: (patch) => {
    const next = {
      ...pick(get()),
      diorama: {
        ...get().diorama,
        ...patch,
        geometryVisibility: {
          ...get().diorama.geometryVisibility,
          ...patch.geometryVisibility,
        },
      },
    };
    set(next);
    persist(next);
  },
  patchMonet: (patch) => {
    const next = { ...pick(get()), monet: { ...get().monet, ...patch } };
    set(next);
    persist(next);
  },
  patchPendolo: (patch) => {
    const next = { ...pick(get()), pendolo: { ...get().pendolo, ...patch } };
    set(next);
    persist(next);
  },
  patchSonnet: (patch) => {
    const next = { ...pick(get()), sonnet: { ...get().sonnet, ...patch } };
    set(next);
    persist(next);
  },
  patchTempera: (patch) => {
    const next = {
      ...pick(get()),
      tempera: {
        ...get().tempera,
        ...patch,
        layerImages: patch.layerImages ?? get().tempera.layerImages,
      },
    };
    set(next);
    persist(next);
  },
  patchLumiere: (patch) => {
    const next = { ...pick(get()), lumiere: { ...get().lumiere, ...patch } };
    set(next);
    persist(next);
  },
  patchHanabi: (patch) => {
    const next = { ...pick(get()), hanabi: normalizeHanabiTuning({ ...get().hanabi, ...patch }) };
    set(next);
    persist(next);
  },
  patchLake: (patch) => {
    const next = { ...pick(get()), lake: { ...get().lake, ...patch } };
    set(next);
    persist(next);
  },
  patchJizura: (patch) => {
    const next = { ...pick(get()), jizura: { ...get().jizura, ...patch } };
    set(next);
    persist(next);
  },
  resetMode: (mode) => {
    const defaults = VISUALIZER_TUNING_DEFAULTS[mode];
    const next = {
      ...pick(get()),
      [mode]: mode === 'diorama'
        ? {
            ...DEFAULT_DIORAMA_TUNING,
            geometryVisibility: { ...DEFAULT_DIORAMA_TUNING.geometryVisibility },
          }
        : mode === 'tempera'
          ? mergeTempera(null)
          : { ...defaults },
    } as VisualizerTuningsState;
    set(next);
    persist(next);
  },
  resetAll: () => {
    const fresh: VisualizerTuningsState = {
      classic: { ...DEFAULT_CLASSIC_TUNING },
      cadenza: { ...DEFAULT_CADENZA_TUNING },
      partita: { ...DEFAULT_PARTITA_TUNING },
      fume: { ...DEFAULT_FUME_TUNING },
      claddagh: { ...DEFAULT_CLADDAGH_TUNING },
      cappella: { ...DEFAULT_CAPPELLA_TUNING },
      tilt: { ...DEFAULT_TILT_TUNING },
      diorama: {
        ...DEFAULT_DIORAMA_TUNING,
        geometryVisibility: { ...DEFAULT_DIORAMA_TUNING.geometryVisibility },
      },
      monet: { ...DEFAULT_MONET_TUNING },
      pendolo: { ...DEFAULT_PENDOLO_TUNING },
      sonnet: { ...DEFAULT_SONNET_TUNING },
      lumiere: { ...DEFAULT_LUMIERE_TUNING },
      hanabi: { ...DEFAULT_HANABI_TUNING },
      lake: { ...DEFAULT_LAKE_TUNING },
      jizura: { ...DEFAULT_JIZURA_TUNING },
      tempera: mergeTempera(null),
    };
    set(fresh);
    persist(fresh);
  },
}));
