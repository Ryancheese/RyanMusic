import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image, Palette, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from './visualizer/registry';
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

const BG_LABELS: Record<string, string> = {
  common: '通用',
  monet: '封面图',
  nomand: '纸纹',
  latent: '流光',
  sora: '星空',
};

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
  const [uploading, setUploading] = useState(false);
  const foliaTheme = useMemo(() => toFoliaTheme(theme), [theme]);
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

  const overlay = (
    <div
      className={`fixed inset-0 z-[70] flex ${isMobile ? 'items-end' : 'items-center justify-center'}`}
      onClick={onClose}
    >
      <aside
        className={`hide-scrollbar flex max-h-[min(78vh,40rem)] flex-col overflow-y-auto border shadow-2xl backdrop-blur-xl ${panel} ${
          isMobile
            ? 'max-h-[min(78dvh,100%)] w-full rounded-t-3xl'
            : 'h-auto w-[min(380px,calc(100vw-2rem))] rounded-3xl'
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
            <div className="text-sm font-semibold">{tab === 'lyrics' ? '歌词样式' : '舞台背景'}</div>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={`mx-5 mb-3 flex rounded-full p-1 ${pill}`}>
          {([
            { id: 'lyrics' as const, label: '歌词样式', Icon: Palette },
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
          <>
            <div className="px-5 pb-2 text-xs opacity-50">选择歌词动画风格</div>
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
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
          </>
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
