import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image, Palette, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel, getVisualizerRegistryEntry, getVisualizerSettingsTitle } from './visualizer/registry';
import { useVisualizerTuningStore } from '../store/visualizerTuningStore';
import { useLyricsAppearanceStore } from '../store/lyricsAppearanceStore';
import FontFallbackStackControl from './visualizer/FontFallbackStackControl';
import {
  VISUALIZER_BACKGROUND_REGISTRY,
  getVisualizerBackgroundModeLabel,
  getVisualizerBackgroundRegistryEntry,
} from './visualizer/backgrounds/registry';
import type { VisualizerBackgroundConfig } from './visualizer/backgrounds/definition';
import type {
  LatentBackgroundTuning,
  MonetBackgroundTuning,
  NomandBackgroundTuning,
  Theme,
  ThemeTokens,
  VisualizerBackgroundMode,
  VisualizerMode,
} from '../types';
import {
  DEFAULT_LATENT_BACKGROUND_TUNING,
  DEFAULT_MONET_BACKGROUND_TUNING,
  DEFAULT_NOMAND_BACKGROUND_TUNING,
} from '../types';
import { useIsMobile } from '../lib/media';
import { toFoliaTheme } from '../lib/visualizer';
import { translateBackgroundOption } from '../lib/backgroundI18n';
import { fileToBackgroundImage } from '../lib/customBackgroundImage';

export type StageSettingsTab = 'lyrics' | 'background';
type LyricsSubTab = 'mode' | 'type' | 'subtitle';

const BG_LABELS: Record<string, string> = {
  common: '通用',
  monet: '封面图',
  nomand: '纸纹',
  latent: '流光',
  sora: '星空',
};

const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.4;

interface LyricsStylePickerProps {
  open: boolean;
  mode: VisualizerMode;
  background: VisualizerBackgroundConfig;
  isDaylight: boolean;
  theme: ThemeTokens;
  initialTab?: StageSettingsTab;
  onClose: () => void;
  onChange: (mode: VisualizerMode) => void;
  onBackgroundChange: (config: VisualizerBackgroundConfig) => void;
}

const SectionCard: React.FC<{
  title: string;
  description?: string;
  controlCardBg: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, controlCardBg, children, action }) => (
  <div className="space-y-3 rounded-[22px] border border-white/10 p-4" style={{ backgroundColor: controlCardBg }}>
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        {description ? <div className="text-[11px] opacity-45">{description}</div> : null}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const ChipRow: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  idle: string;
  activeStyle: React.CSSProperties;
}> = ({ options, value, onChange, idle, activeStyle }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${idle}`}
          style={active ? activeStyle : undefined}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const RangeRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  rangeInputClass: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, display, rangeInputClass, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-[12px]">
      <span className="opacity-70">{label}</span>
      <span className="font-mono opacity-55">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={rangeInputClass}
    />
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDaylight: boolean;
}> = ({ label, description, checked, onChange, isDaylight }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left"
  >
    <div className="min-w-0">
      <div className="text-[13px] font-medium">{label}</div>
      {description ? <div className="text-[11px] opacity-45">{description}</div> : null}
    </div>
    <span
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{
        backgroundColor: checked
          ? 'color-mix(in srgb, var(--text-accent) 70%, transparent)'
          : (isDaylight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)'),
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  </button>
);

const LyricsStylePicker: React.FC<LyricsStylePickerProps> = ({
  open,
  mode,
  background,
  isDaylight,
  theme,
  initialTab = 'lyrics',
  onClose,
  onChange,
  onBackgroundChange,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<StageSettingsTab>(initialTab);
  const [lyricsSubTab, setLyricsSubTab] = useState<LyricsSubTab>('mode');
  const [uploading, setUploading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keywordColor, setKeywordColor] = useState('#f5c518');

  const appearance = useLyricsAppearanceStore(useShallow((state) => ({
    fontStyle: state.fontStyle,
    fontScale: state.fontScale,
    fontWeight: state.fontWeight,
    fontFallbackFamilies: state.fontFallbackFamilies,
    animationIntensity: state.animationIntensity,
    visualizerOpacity: state.visualizerOpacity,
    subtitleContentMode: state.subtitleContentMode,
    subtitleFontScale: state.subtitleFontScale,
    subtitleOverlayOpacity: state.subtitleOverlayOpacity,
    subtitleOverlayBackground: state.subtitleOverlayBackground,
    hideTranslationSubtitle: state.hideTranslationSubtitle,
    showHarmonySubtitle: state.showHarmonySubtitle,
    harmonySubtitleBackground: state.harmonySubtitleBackground,
    keywordColoringEnabled: state.keywordColoringEnabled,
    wordColors: state.wordColors,
    letterSpacingEm: state.letterSpacingEm,
    patch: state.patch,
    addWordColor: state.addWordColor,
    removeWordColor: state.removeWordColor,
    applyPreset: state.applyPreset,
    reset: state.reset,
  })));

  const tunings = useVisualizerTuningStore(useShallow((state) => ({
    classic: state.classic,
    partita: state.partita,
    fume: state.fume,
    claddagh: state.claddagh,
    cappella: state.cappella,
    tilt: state.tilt,
    diorama: state.diorama,
    monet: state.monet,
    pendolo: state.pendolo,
    sonnet: state.sonnet,
    tempera: state.tempera,
    patchClassic: state.patchClassic,
    patchPartita: state.patchPartita,
    patchFume: state.patchFume,
    patchCladdagh: state.patchCladdagh,
    patchCappella: state.patchCappella,
    patchTilt: state.patchTilt,
    patchDiorama: state.patchDiorama,
    patchMonet: state.patchMonet,
    patchPendolo: state.patchPendolo,
    patchSonnet: state.patchSonnet,
    patchTempera: state.patchTempera,
    resetMode: state.resetMode,
  })));

  const foliaTheme = useMemo(
    () => toFoliaTheme(theme, null, appearance),
    [appearance, theme],
  );
  const backgroundRef = useRef(background);
  backgroundRef.current = background;

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  if (!open) return null;

  const panel = isDaylight ? 'bg-white/92 border-black/10 text-stone-900' : 'bg-black/75 border-white/10 text-zinc-100';
  const idle = isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/8 hover:bg-white/14';
  const pill = isDaylight ? 'bg-black/5' : 'bg-white/10';
  const bgMode = (background.mode || 'common') as VisualizerBackgroundMode;
  const bgEntry = getVisualizerBackgroundRegistryEntry(bgMode);
  const modeEntry = getVisualizerRegistryEntry(mode);
  const controlCardBg = isDaylight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
  const rangeInputClass = 'w-full accent-[var(--text-accent)]';
  const activeStyle = {
    boxShadow: '0 0 0 2px color-mix(in srgb, var(--text-accent) var(--accent-ui-mix, 45%), transparent)',
    background: 'color-mix(in srgb, var(--text-accent) var(--accent-ui-soft, 18%), transparent)',
  } as React.CSSProperties;

  const labelForBg = (itemMode: VisualizerBackgroundMode) => {
    return BG_LABELS[itemMode] || getVisualizerBackgroundModeLabel(itemMode, t);
  };

  const patchBackground = (patch: Partial<VisualizerBackgroundConfig>) => {
    const current = backgroundRef.current;
    const next: VisualizerBackgroundConfig = {
      ...current,
      ...patch,
      common: { ...current.common, ...patch.common },
      monet: patch.monet
        ? { tuning: { ...DEFAULT_MONET_BACKGROUND_TUNING, ...current.monet?.tuning, ...patch.monet.tuning } }
        : current.monet,
      nomand: patch.nomand
        ? { tuning: { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...current.nomand?.tuning, ...patch.nomand.tuning } }
        : current.nomand,
      latent: patch.latent
        ? { tuning: { ...DEFAULT_LATENT_BACKGROUND_TUNING, ...current.latent?.tuning, ...patch.latent.tuning } }
        : current.latent,
      customImage: patch.customImage !== undefined ? patch.customImage : current.customImage,
    };
    backgroundRef.current = next;
    onBackgroundChange(next);
  };

  const bgActions = {
    onModeChange: (next: VisualizerBackgroundMode) => {
      patchBackground({ mode: next });
    },
    common: {
      onCoverColorChange: (enabled: boolean) => {
        patchBackground({ common: { ...backgroundRef.current.common, useCoverColorBg: enabled } });
      },
      onOpacityChange: (opacity: number) => {
        patchBackground({ common: { ...backgroundRef.current.common, opacity } });
      },
      onDisableGeometricChange: (disabled: boolean) => {
        patchBackground({ common: { ...backgroundRef.current.common, disableGeometricBackground: disabled } });
      },
      onDisableVignetteChange: (disabled: boolean) => {
        patchBackground({ common: { ...backgroundRef.current.common, disableVignette: disabled } });
      },
    },
    customImage: {
      onUpload: async (files: File[]) => {
        const file = files[0];
        if (!file) return { ok: false, error: '没有选择文件' };
        setUploading(true);
        try {
          const image = await fileToBackgroundImage(file);
          const current = backgroundRef.current;
          patchBackground({
            customImage: image,
            monet: {
              tuning: {
                ...DEFAULT_MONET_BACKGROUND_TUNING,
                ...current.monet?.tuning,
                backgroundSource: 'uploaded-global',
              },
            },
            nomand: {
              tuning: {
                ...DEFAULT_NOMAND_BACKGROUND_TUNING,
                ...current.nomand?.tuning,
                imageSource: 'uploaded-global',
              },
            },
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : '上传失败' };
        } finally {
          setUploading(false);
        }
      },
      onClear: () => {
        const current = backgroundRef.current;
        patchBackground({
          customImage: null,
          monet: {
            tuning: {
              ...DEFAULT_MONET_BACKGROUND_TUNING,
              ...current.monet?.tuning,
              backgroundSource: 'cover-derived',
            },
          },
          nomand: {
            tuning: {
              ...DEFAULT_NOMAND_BACKGROUND_TUNING,
              ...current.nomand?.tuning,
              imageSource: 'cover-derived',
            },
          },
        });
      },
      isLoading: uploading,
    },
    monet: {
      onTuningChange: (patch: Partial<MonetBackgroundTuning>) => {
        patchBackground({
          monet: {
            tuning: {
              ...DEFAULT_MONET_BACKGROUND_TUNING,
              ...backgroundRef.current.monet?.tuning,
              ...patch,
            },
          },
        });
      },
      onResetTuning: () => {
        patchBackground({ monet: { tuning: { ...DEFAULT_MONET_BACKGROUND_TUNING } } });
      },
    },
    nomand: {
      onTuningChange: (patch: Partial<NomandBackgroundTuning>) => {
        patchBackground({
          nomand: {
            tuning: {
              ...DEFAULT_NOMAND_BACKGROUND_TUNING,
              ...backgroundRef.current.nomand?.tuning,
              ...patch,
            },
          },
        });
      },
      onResetTuning: () => {
        patchBackground({ nomand: { tuning: { ...DEFAULT_NOMAND_BACKGROUND_TUNING } } });
      },
    },
    latent: {
      onTuningChange: (patch: Partial<LatentBackgroundTuning>) => {
        patchBackground({
          latent: {
            tuning: {
              ...DEFAULT_LATENT_BACKGROUND_TUNING,
              ...backgroundRef.current.latent?.tuning,
              ...patch,
            },
          },
        });
      },
      onResetTuning: () => {
        patchBackground({ latent: { tuning: { ...DEFAULT_LATENT_BACKGROUND_TUNING } } });
      },
    },
  };

  const resetModeKey = modeEntry.tuningKind === 'none' ? null : modeEntry.tuningKind;

  const settingsPanel = modeEntry.renderSettingsPanel?.({
    t,
    settingsTitle: getVisualizerSettingsTitle(mode, t),
    isDaylight,
    theme: foliaTheme,
    controlCardBg,
    rangeInputClass,
    classicTuning: tunings.classic,
    onClassicTuningChange: tunings.patchClassic,
    partitaTuning: tunings.partita,
    onPartitaTuningChange: tunings.patchPartita,
    fumeTuning: tunings.fume,
    onFumeTuningChange: tunings.patchFume,
    claddaghTuning: tunings.claddagh,
    onCladdaghTuningChange: tunings.patchCladdagh,
    cappellaTuning: tunings.cappella,
    onCappellaTuningChange: tunings.patchCappella,
    cappellaCustomEmojiImages: [],
    cappellaCustomEmojiCount: 0,
    hasCappellaCustomEmojiPack: false,
    isCappellaCustomEmojiPackLoading: false,
    cappellaCustomAvatarImages: [],
    hasCappellaCustomAvatar: false,
    isCappellaCustomAvatarLoading: false,
    tiltTuning: tunings.tilt,
    onTiltTuningChange: tunings.patchTilt,
    dioramaTuning: tunings.diorama,
    onDioramaTuningChange: tunings.patchDiorama,
    monetTuning: tunings.monet,
    onMonetTuningChange: tunings.patchMonet,
    monetPortraitImage: null,
    isLoadingMonetPortraitImage: false,
    pendoloTuning: tunings.pendolo,
    onPendoloTuningChange: tunings.patchPendolo,
    sonnetTuning: tunings.sonnet,
    onSonnetTuningChange: tunings.patchSonnet,
    temperaTuning: tunings.tempera,
    onTemperaTuningChange: tunings.patchTempera,
  });

  const overlay = (
    <div
      className={`fixed inset-0 z-[70] flex ${isMobile ? 'items-end' : 'items-center justify-center'}`}
      onClick={onClose}
    >
      <aside
        className={`hide-scrollbar flex max-h-[min(86vh,46rem)] flex-col overflow-y-auto border shadow-2xl backdrop-blur-xl ${panel} ${
          isMobile
            ? 'max-h-[min(86dvh,100%)] w-full rounded-t-3xl'
            : 'h-auto w-[min(400px,calc(100vw-2rem))] rounded-3xl'
        }`}
        style={isMobile ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile && (
          <div className="flex justify-center pt-2">
            <span className={`h-1 w-10 rounded-full ${isDaylight ? 'bg-black/20' : 'bg-white/25'}`} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <div className="flex items-center gap-2">
            {tab === 'lyrics' ? <Palette size={16} /> : <Image size={16} />}
            <div className="text-sm font-semibold">{tab === 'lyrics' ? t('options.lyricsStyleSettings') : '舞台背景'}</div>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={`mx-5 mb-3 flex rounded-full p-1 ${pill}`}>
          {([
            { id: 'lyrics' as const, label: t('options.lyricsStyleSettings'), Icon: Palette },
            { id: 'background' as const, label: '舞台背景', Icon: Image },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition ${
                tab === item.id
                  ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/18 text-white shadow-sm')
                  : 'opacity-50 hover:opacity-80'
              }`}
            >
              <item.Icon size={14} strokeWidth={tab === item.id ? 2.25 : 2} />
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'lyrics' ? (
          <div className="space-y-4 px-5 pb-5">
            <div className={`flex rounded-full p-1 ${pill}`}>
              {([
                { id: 'mode' as const, label: t('options.lyricsRenderer') },
                { id: 'type' as const, label: t('options.lyricsTypography') },
                { id: 'subtitle' as const, label: t('options.previewSubtitleSettings') },
              ]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLyricsSubTab(item.id)}
                  className={`flex-1 rounded-full py-1.5 text-[12px] font-medium transition ${
                    lyricsSubTab === item.id
                      ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/18 text-white shadow-sm')
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {lyricsSubTab === 'mode' ? (
              <>
                <div className="text-xs opacity-50">{t('options.lyricsRendererDesc')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {VISUALIZER_REGISTRY.map((entry) => {
                    const active = entry.mode === mode;
                    return (
                      <button
                        key={entry.mode}
                        type="button"
                        onClick={() => onChange(entry.mode)}
                        className={`rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors ${idle}`}
                        style={active ? activeStyle : undefined}
                      >
                        {getVisualizerModeLabel(entry.mode, t)}
                      </button>
                    );
                  })}
                </div>

                {settingsPanel ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs opacity-50">{t('options.modeTuningSection')}</div>
                      {resetModeKey ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] opacity-55 hover:opacity-100"
                          onClick={() => tunings.resetMode(resetModeKey)}
                        >
                          <RotateCcw size={12} />
                          {t('options.resetModeTuning')}
                        </button>
                      ) : null}
                    </div>
                    {settingsPanel}
                  </div>
                ) : (
                  <p className="text-xs opacity-45">这个动画模式没有额外参数，切换即可生效。</p>
                )}
              </>
            ) : null}

            {lyricsSubTab === 'type' ? (
              <>
                <SectionCard
                  title={t('options.stylePresets')}
                  description="一键套用字体、字号与动画强度组合"
                  controlCardBg={controlCardBg}
                >
                  <ChipRow
                    options={[
                      { id: 'poetry', label: t('options.stylePresetPoetry') },
                      { id: 'stage', label: t('options.stylePresetStage') },
                      { id: 'rhapsody', label: t('options.stylePresetRhapsody') },
                      { id: 'minimal', label: t('options.stylePresetMinimal') },
                    ]}
                    value=""
                    onChange={(id) => appearance.applyPreset(id as 'poetry' | 'stage' | 'rhapsody' | 'minimal')}
                    idle={idle}
                    activeStyle={activeStyle}
                  />
                </SectionCard>

                <SectionCard
                  title={t('options.lyricsTypography')}
                  description={t('options.lyricsTypographyDesc')}
                  controlCardBg={controlCardBg}
                  action={(
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] opacity-55 hover:opacity-100"
                      onClick={() => appearance.reset()}
                    >
                      <RotateCcw size={12} />
                      {t('options.resetLyricsAppearance')}
                    </button>
                  )}
                >
                  <div className="space-y-1">
                    <div className="text-[12px] opacity-70">{t('options.fontFamily')}</div>
                    <ChipRow
                      options={[
                        { id: 'serif', label: t('options.fontSerif') },
                        { id: 'sans', label: t('options.fontSans') },
                        { id: 'mono', label: t('options.fontMono') },
                      ]}
                      value={appearance.fontStyle}
                      onChange={(id) => appearance.patch({ fontStyle: id as typeof appearance.fontStyle })}
                      idle={idle}
                      activeStyle={activeStyle}
                    />
                  </div>

                  <RangeRow
                    label={t('options.fontSize')}
                    value={appearance.fontScale}
                    min={FONT_SCALE_MIN}
                    max={FONT_SCALE_MAX}
                    step={0.01}
                    display={`${Math.round(appearance.fontScale * 100)}%`}
                    rangeInputClass={rangeInputClass}
                    onChange={(fontScale) => appearance.patch({ fontScale })}
                  />

                  {mode === 'sonnet' ? (
                    <p className="text-[11px] opacity-45">{t('options.sonnetFontSizeAutoNotice')}</p>
                  ) : null}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="opacity-70">{t('options.fontWeight')}</span>
                      <button
                        type="button"
                        className="text-[11px] opacity-55 hover:opacity-100"
                        onClick={() => appearance.patch({
                          fontWeight: appearance.fontWeight == null
                            ? 500
                            : null,
                        })}
                      >
                        {appearance.fontWeight == null ? t('options.fontWeightAuto') : `${appearance.fontWeight}`}
                      </button>
                    </div>
                    {appearance.fontWeight != null ? (
                      <input
                        type="range"
                        min={100}
                        max={900}
                        step={10}
                        value={appearance.fontWeight}
                        onChange={(event) => appearance.patch({ fontWeight: Number(event.target.value) })}
                        className={rangeInputClass}
                      />
                    ) : (
                      <p className="text-[11px] opacity-45">{t('options.fontWeightAutoDesc')}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[12px] opacity-70">{t('options.animationIntensity')}</div>
                    <ChipRow
                      options={[
                        { id: 'calm', label: t('animation.calm') },
                        { id: 'normal', label: t('animation.normal') },
                        { id: 'chaotic', label: t('animation.chaotic') },
                      ]}
                      value={appearance.animationIntensity}
                      onChange={(id) => appearance.patch({
                        animationIntensity: id as typeof appearance.animationIntensity,
                      })}
                      idle={idle}
                      activeStyle={activeStyle}
                    />
                  </div>

                  <RangeRow
                    label={t('options.visualizerOpacity')}
                    value={appearance.visualizerOpacity}
                    min={0.35}
                    max={1}
                    step={0.01}
                    display={`${Math.round(appearance.visualizerOpacity * 100)}%`}
                    rangeInputClass={rangeInputClass}
                    onChange={(visualizerOpacity) => appearance.patch({ visualizerOpacity })}
                  />

                  <RangeRow
                    label={t('options.letterSpacing')}
                    value={appearance.letterSpacingEm}
                    min={-0.08}
                    max={0.2}
                    step={0.01}
                    display={`${appearance.letterSpacingEm >= 0 ? '+' : ''}${appearance.letterSpacingEm.toFixed(2)}em`}
                    rangeInputClass={rangeInputClass}
                    onChange={(letterSpacingEm) => appearance.patch({ letterSpacingEm })}
                  />

                  <FontFallbackStackControl
                    label={t('options.fontFallbackFamilies')}
                    value={appearance.fontFallbackFamilies}
                    onChange={(fontFallbackFamilies) => appearance.patch({ fontFallbackFamilies })}
                    theme={foliaTheme as Theme}
                    placeholder={t('options.fontFallbackFamiliesPlaceholder')}
                  />
                </SectionCard>

                <SectionCard
                  title={t('options.keywordColors')}
                  description={t('options.keywordColorsDesc')}
                  controlCardBg={controlCardBg}
                >
                  <ToggleRow
                    label={t('options.monetKeywordColoring')}
                    checked={appearance.keywordColoringEnabled}
                    onChange={(keywordColoringEnabled) => appearance.patch({ keywordColoringEnabled })}
                    isDaylight={isDaylight}
                  />
                  <div className="flex gap-2">
                    <input
                      value={keywordDraft}
                      onChange={(event) => setKeywordDraft(event.target.value)}
                      placeholder={t('options.keywordWordPlaceholder')}
                      className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none ${idle}`}
                    />
                    <input
                      type="color"
                      value={keywordColor}
                      onChange={(event) => setKeywordColor(event.target.value)}
                      className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent"
                    />
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-xl px-3 text-sm ${idle}`}
                      onClick={() => {
                        if (!keywordDraft.trim()) return;
                        appearance.addWordColor({ word: keywordDraft.trim(), color: keywordColor });
                        setKeywordDraft('');
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {appearance.wordColors.length === 0 ? (
                    <p className="text-[11px] opacity-45">{t('options.keywordColorsEmpty')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {appearance.wordColors.map((item) => (
                        <button
                          key={item.word}
                          type="button"
                          onClick={() => appearance.removeWordColor(item.word)}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${item.color} 28%, transparent)`,
                            color: item.color,
                          }}
                          title="点击移除"
                        >
                          {item.word}
                          <Trash2 size={11} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}

            {lyricsSubTab === 'subtitle' ? (
              <SectionCard
                title={t('options.previewSubtitleSettings')}
                description={t('options.previewSubtitleSettingsDesc')}
                controlCardBg={controlCardBg}
              >
                <div className="space-y-1">
                  <div className="text-[12px] opacity-70">{t('options.subtitleContentMode')}</div>
                  <ChipRow
                    options={[
                      { id: 'translation', label: t('options.subtitleContentTranslation') },
                      { id: 'romanization', label: t('options.subtitleContentRomanization') },
                      { id: 'none', label: t('options.subtitleContentNone') },
                    ]}
                    value={appearance.subtitleContentMode}
                    onChange={(id) => appearance.patch({
                      subtitleContentMode: id as typeof appearance.subtitleContentMode,
                      hideTranslationSubtitle: id === 'none',
                    })}
                    idle={idle}
                    activeStyle={activeStyle}
                  />
                </div>

                <RangeRow
                  label={t('options.subtitleFontScale')}
                  value={appearance.subtitleFontScale}
                  min={FONT_SCALE_MIN}
                  max={FONT_SCALE_MAX}
                  step={0.01}
                  display={`${Math.round(appearance.subtitleFontScale * 100)}%`}
                  rangeInputClass={rangeInputClass}
                  onChange={(subtitleFontScale) => appearance.patch({ subtitleFontScale })}
                />

                <RangeRow
                  label={t('options.subtitleOverlayOpacity')}
                  value={appearance.subtitleOverlayOpacity}
                  min={0.2}
                  max={1}
                  step={0.01}
                  display={`${Math.round(appearance.subtitleOverlayOpacity * 100)}%`}
                  rangeInputClass={rangeInputClass}
                  onChange={(subtitleOverlayOpacity) => appearance.patch({ subtitleOverlayOpacity })}
                />

                <ToggleRow
                  label={t('options.subtitleOverlayBackground')}
                  description={t('options.subtitleOverlayBackgroundDesc')}
                  checked={appearance.subtitleOverlayBackground}
                  onChange={(subtitleOverlayBackground) => appearance.patch({ subtitleOverlayBackground })}
                  isDaylight={isDaylight}
                />

                <ToggleRow
                  label={t('options.hidePlayerTranslationSubtitle')}
                  description={t('options.hidePlayerTranslationSubtitleDesc')}
                  checked={appearance.hideTranslationSubtitle}
                  onChange={(hideTranslationSubtitle) => appearance.patch({ hideTranslationSubtitle })}
                  isDaylight={isDaylight}
                />

                <div className="border-t border-white/10 pt-3">
                  <div className="mb-2 text-[12px] font-medium opacity-70">{t('options.harmonySubtitleSettings')}</div>
                  <ToggleRow
                    label={t('options.showHarmonySubtitle')}
                    description={t('options.showHarmonySubtitleDesc')}
                    checked={appearance.showHarmonySubtitle}
                    onChange={(showHarmonySubtitle) => appearance.patch({ showHarmonySubtitle })}
                    isDaylight={isDaylight}
                  />
                  <ToggleRow
                    label={t('options.harmonySubtitleBackground')}
                    description={t('options.harmonySubtitleBackgroundDesc')}
                    checked={appearance.harmonySubtitleBackground}
                    onChange={(harmonySubtitleBackground) => appearance.patch({ harmonySubtitleBackground })}
                    isDaylight={isDaylight}
                  />
                </div>
              </SectionCard>
            ) : null}
          </div>
        ) : (
          <div className="px-5 pb-5">
            <div className="pb-2 text-xs opacity-50">舞台背景模式</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {VISUALIZER_BACKGROUND_REGISTRY.map((entry) => {
                const active = entry.mode === bgMode;
                return (
                  <button
                    key={entry.mode}
                    type="button"
                    onClick={() => patchBackground({ mode: entry.mode })}
                    className={`rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors ${idle}`}
                    style={active ? activeStyle : undefined}
                  >
                    {labelForBg(entry.mode)}
                  </button>
                );
              })}
            </div>
            {bgEntry.renderSettingsPanel ? (
              <div className="space-y-3">
                <div className="text-xs opacity-50">当前背景参数</div>
                {bgEntry.renderSettingsPanel({
                  config: background,
                  actions: bgActions,
                  t: translateBackgroundOption,
                  isDaylight,
                  theme: foliaTheme as Theme,
                  controlCardBg,
                  rangeInputClass,
                })}
              </div>
            ) : (
              <p className="text-xs opacity-45">这个背景模式没有额外参数，切换即可生效。</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
};

export default LyricsStylePicker;
