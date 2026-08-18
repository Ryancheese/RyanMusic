import React, { useEffect, useMemo, useState } from 'react';
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
  MonetBackgroundImage,
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

export type StageSettingsTab = 'lyrics' | 'background';

const BG_LABELS: Record<string, string> = {
  common: '通用',
  monet: 'Monet',
  nomand: 'Nomand',
  latent: 'Latent',
  url: '网页嵌入',
  sora: 'Sora 星空',
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

async function fileToBackgroundImage(file: File): Promise<MonetBackgroundImage> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
  return {
    id: `bg-${Date.now()}`,
    name: file.name || 'background',
    url,
  };
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
    boxShadow: '0 0 0 2px var(--text-accent)',
    background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
  } as React.CSSProperties;

  const labelForBg = (itemMode: VisualizerBackgroundMode) => {
    return BG_LABELS[itemMode] || getVisualizerBackgroundModeLabel(itemMode, t);
  };

  const patchBackground = (patch: Partial<VisualizerBackgroundConfig>) => {
    onBackgroundChange({
      ...background,
      ...patch,
      common: { ...background.common, ...patch.common },
      monet: patch.monet
        ? { tuning: { ...DEFAULT_MONET_BACKGROUND_TUNING, ...background.monet?.tuning, ...patch.monet.tuning } }
        : background.monet,
      nomand: patch.nomand
        ? { tuning: { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...background.nomand?.tuning, ...patch.nomand.tuning } }
        : background.nomand,
      latent: patch.latent
        ? { tuning: { ...DEFAULT_LATENT_BACKGROUND_TUNING, ...background.latent?.tuning, ...patch.latent.tuning } }
        : background.latent,
      customImage: patch.customImage !== undefined ? patch.customImage : background.customImage,
    });
  };

  const bgActions = {
    onModeChange: (next: VisualizerBackgroundMode) => {
      patchBackground({ mode: next });
    },
    common: {
      onCoverColorChange: (enabled: boolean) => {
        patchBackground({ common: { ...background.common, useCoverColorBg: enabled } });
      },
      onOpacityChange: (opacity: number) => {
        patchBackground({ common: { ...background.common, opacity } });
      },
      onDisableGeometricChange: (disabled: boolean) => {
        patchBackground({ common: { ...background.common, disableGeometricBackground: disabled } });
      },
      onDisableVignetteChange: (disabled: boolean) => {
        patchBackground({ common: { ...background.common, disableVignette: disabled } });
      },
    },
    customImage: {
      onUpload: async (files: File[]) => {
        const file = files[0];
        if (!file) return { ok: false, error: '没有选择文件' };
        setUploading(true);
        try {
          const image = await fileToBackgroundImage(file);
          patchBackground({ customImage: image });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : '上传失败' };
        } finally {
          setUploading(false);
        }
      },
      onClear: () => {
        patchBackground({ customImage: null });
      },
      isLoading: uploading,
    },
    monet: {
      onTuningChange: (patch: Partial<MonetBackgroundTuning>) => {
        patchBackground({
          monet: {
            tuning: {
              ...DEFAULT_MONET_BACKGROUND_TUNING,
              ...background.monet?.tuning,
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
              ...background.nomand?.tuning,
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
              ...background.latent?.tuning,
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

  return (
    <div
      className={`absolute inset-0 z-50 flex ${isMobile ? 'items-end' : 'items-start justify-start'}`}
      onClick={onClose}
    >
      <aside
        className={`flex flex-col overflow-hidden border shadow-2xl ${panel} ${
          isMobile
            ? 'max-h-[min(78dvh,100%)] w-full rounded-t-3xl'
            : 'ml-4 mt-[max(4.5rem,calc(var(--safe-top)+3.75rem))] h-auto max-h-[min(78vh,40rem)] w-[min(380px,calc(100vw-2rem))] rounded-3xl'
        }`}
        style={isMobile
          ? { paddingBottom: 'max(var(--safe-bottom), var(--player-dock-safe))' }
          : undefined}
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
            { id: 'lyrics' as const, label: '歌词样式' },
            { id: 'background' as const, label: '舞台背景' },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${
                tab === item.id
                  ? (isDaylight ? 'bg-white text-black shadow' : 'bg-white/18 text-white')
                  : 'opacity-55'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'lyrics' ? (
          <>
            <div className="px-5 pb-2 text-xs opacity-50">选择歌词动画风格</div>
            <div className="app-scroll grid grid-cols-2 gap-2 overflow-y-auto px-5 pb-5">
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
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <div className="pb-2 text-xs opacity-50">参考 Folia 的舞台背景模式</div>
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
};

export default LyricsStylePicker;
