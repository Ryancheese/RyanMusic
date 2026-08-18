import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Hexagon, LayoutGrid, Link2, List, Palette, SlidersHorizontal, SquareStack, X } from 'lucide-react';
import {
  LYRIC_SOURCE_OPTIONS,
  useLyricSettingsStore,
} from '../store/lyricSettingsStore';
import {
  DEFAULT_LYRIC_FILTER_PATTERN,
  LYRIC_FILTER_REGEX_EXAMPLE,
} from '../utils/lyrics/filtering';
import { useControlAppearanceStore } from '../store/controlAppearanceStore';
import { usePlaybackSettingsStore } from '../store/playbackSettingsStore';
import { useLibraryStore } from '../store/libraryStore';
import {
  LIBRARY_CARD_STYLE_HINT,
  LIBRARY_CARD_STYLE_LABELS,
  LIBRARY_LAYOUT_MODE_LABELS,
} from '../lib/libraryLayout';
import type { LibraryCardStyle, LibraryLayoutMode } from '../types';

interface AppSettingsPanelProps {
  open: boolean;
  isDaylight: boolean;
  onClose: () => void;
}

type SettingsTab = 'lyrics' | 'playback' | 'chrome';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'lyrics', label: '歌词', icon: <AudioLines size={14} /> },
  { id: 'playback', label: '播放', icon: <Link2 size={14} /> },
  { id: 'chrome', label: '外观', icon: <Palette size={14} /> },
];

const SettingSlider: React.FC<{
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}> = ({ label, value, display, min, max, step = 1, onChange }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[11px] tabular-nums opacity-50">{display}</div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full accent-[var(--text-accent)]"
    />
  </div>
);

const ToggleRow: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  isDaylight: boolean;
  card: string;
  idle: string;
  onToggle: () => void;
}> = ({ icon, title, description, enabled, isDaylight, card, idle, onToggle }) => (
  <div className={`flex items-start gap-3 rounded-2xl px-3 py-3 ${card}`}>
    {icon ? (
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
        {icon}
      </div>
    ) : null}
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed opacity-50">{description}</div>
    </div>
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition"
      style={{
        background: enabled
          ? 'color-mix(in srgb, var(--text-accent) 82%, #fff 8%)'
          : (isDaylight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)'),
        boxShadow: enabled
          ? '0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent), 0 0 14px color-mix(in srgb, var(--text-accent) 35%, transparent)'
          : (isDaylight ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.28)'),
      }}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full shadow-md transition ${
          enabled ? 'left-[22px]' : 'left-0.5'
        }`}
        style={{
          background: '#fff',
          boxShadow: enabled
            ? '0 1px 4px rgba(0,0,0,0.35)'
            : '0 1px 3px rgba(0,0,0,0.45)',
        }}
      />
    </button>
  </div>
);

const LAYOUT_MODE_OPTIONS: { id: LibraryLayoutMode; label: string; icon: React.ReactNode }[] = [
  { id: 'honeycomb', label: LIBRARY_LAYOUT_MODE_LABELS.honeycomb, icon: <Hexagon size={13} /> },
  { id: 'square', label: LIBRARY_LAYOUT_MODE_LABELS.square, icon: <LayoutGrid size={13} /> },
  { id: 'list', label: LIBRARY_LAYOUT_MODE_LABELS.list, icon: <List size={13} /> },
];

const CARD_STYLE_OPTIONS: { id: LibraryCardStyle; label: string }[] = [
  { id: 'cover', label: LIBRARY_CARD_STYLE_LABELS.cover },
  { id: 'plaque', label: LIBRARY_CARD_STYLE_LABELS.plaque },
];

const AppSettingsPanel: React.FC<AppSettingsPanelProps> = ({ open, isDaylight, onClose }) => {
  const [tab, setTab] = useState<SettingsTab>('lyrics');
  const preferredSource = useLyricSettingsStore((state) => state.preferredSource);
  const setPreferredSource = useLyricSettingsStore((state) => state.setPreferredSource);
  const autoUseBest = useLyricSettingsStore((state) => state.autoUseBest);
  const setAutoUseBest = useLyricSettingsStore((state) => state.setAutoUseBest);
  const filterEnabled = useLyricSettingsStore((state) => state.filterEnabled);
  const filterPattern = useLyricSettingsStore((state) => state.filterPattern);
  const setFilterEnabled = useLyricSettingsStore((state) => state.setFilterEnabled);
  const setFilterPattern = useLyricSettingsStore((state) => state.setFilterPattern);
  const crossPlayFallback = usePlaybackSettingsStore((state) => state.crossPlayFallback);
  const setCrossPlayFallback = usePlaybackSettingsStore((state) => state.setCrossPlayFallback);
  const opacity = useControlAppearanceStore((state) => state.opacity);
  const blur = useControlAppearanceStore((state) => state.blur);
  const hoverBoost = useControlAppearanceStore((state) => state.hoverBoost);
  const setOpacity = useControlAppearanceStore((state) => state.setOpacity);
  const setBlur = useControlAppearanceStore((state) => state.setBlur);
  const setHoverBoost = useControlAppearanceStore((state) => state.setHoverBoost);
  const layoutMode = useLibraryStore((state) => state.layoutMode);
  const cardStyle = useLibraryStore((state) => state.cardStyle);
  const setLayoutMode = useLibraryStore((state) => state.setLayoutMode);
  const setCardStyle = useLibraryStore((state) => state.setCardStyle);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panel = isDaylight ? 'bg-white/95 text-black' : 'bg-zinc-900/95 text-white';
  const idle = isDaylight ? 'bg-black/5 hover:bg-black/8' : 'bg-white/8 hover:bg-white/12';
  const card = isDaylight ? 'bg-black/5' : 'bg-white/8';
  const inputBg = isDaylight ? 'bg-black/5 border-black/10' : 'bg-white/8 border-white/10';
  const tabRail = isDaylight ? 'bg-black/5' : 'bg-white/8';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative flex h-[min(88vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/10 shadow-2xl backdrop-blur-xl ${panel}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-base font-semibold">设置</div>
            <div className="mt-0.5 text-[11px] opacity-45">歌词、播放保底、歌单样式与底栏外观</div>
          </div>
          <button type="button" className="rounded-full p-1.5 opacity-60 hover:opacity-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className={`flex shrink-0 gap-1 overflow-x-auto p-3 md:w-40 md:flex-col ${tabRail}`}>
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition ${
                    active ? '' : 'opacity-55 hover:opacity-90'
                  }`}
                  style={
                    active
                      ? {
                          background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
                          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
                        }
                      : undefined
                  }
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === 'lyrics' ? (
              <div className="space-y-5">
                <ToggleRow
                  icon={<SlidersHorizontal size={15} />}
                  title="自动使用最佳歌词"
                  description="自动检索网易云、AMLLDB、QQ 和酷狗歌词，若存在完美匹配的逐字歌词则自动优先采用。"
                  enabled={autoUseBest}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setAutoUseBest(!autoUseBest)}
                />

                <div>
                  <div className="text-sm font-semibold">歌词匹配优先级</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    {autoUseBest
                      ? '自动检索时优先从该源开始找逐字歌词；找不到再按网易云 → AMLLDB → QQ → 酷狗回退。'
                      : '关闭自动最佳时，在多个源都匹配时优先采用该源。'}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {LYRIC_SOURCE_OPTIONS.map((item) => {
                      const active = item.id === preferredSource;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPreferredSource(item.id)}
                          className={`rounded-2xl px-3 py-2.5 text-sm transition ${active ? '' : idle}`}
                          style={
                            active
                              ? {
                                  boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--text-accent) 80%, white)',
                                  background: 'color-mix(in srgb, var(--text-accent) 14%, transparent)',
                                }
                              : undefined
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">歌词行过滤</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        用正则去掉词曲制作等信息行，不会默认大段删歌词。
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-pressed={filterEnabled}
                      onClick={() => setFilterEnabled(!filterEnabled)}
                      className="relative h-6 w-11 shrink-0 rounded-full transition"
                      style={{
                        background: filterEnabled
                          ? 'color-mix(in srgb, var(--text-accent) 82%, #fff 8%)'
                          : (isDaylight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)'),
                        boxShadow: filterEnabled
                          ? '0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent), 0 0 14px color-mix(in srgb, var(--text-accent) 35%, transparent)'
                          : (isDaylight ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.28)'),
                      }}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full shadow-md transition ${
                          filterEnabled ? 'left-[22px]' : 'left-0.5'
                        }`}
                        style={{
                          background: '#fff',
                          boxShadow: filterEnabled
                            ? '0 1px 4px rgba(0,0,0,0.35)'
                            : '0 1px 3px rgba(0,0,0,0.45)',
                        }}
                      />
                    </button>
                  </div>
                  <div className={`space-y-2 rounded-2xl px-3 py-3 ${card}`}>
                    <textarea
                      value={filterPattern || DEFAULT_LYRIC_FILTER_PATTERN}
                      disabled={!filterEnabled}
                      onChange={(event) => setFilterPattern(event.target.value)}
                      rows={3}
                      className={`w-full resize-none rounded-xl border px-3 py-2 font-mono text-[11px] outline-none disabled:opacity-40 ${inputBg}`}
                      placeholder={LYRIC_FILTER_REGEX_EXAMPLE}
                    />
                    <div className="text-[10px] leading-relaxed opacity-40">
                      示例：
                      {' '}
                      {LYRIC_FILTER_REGEX_EXAMPLE}
                    </div>
                    <button
                      type="button"
                      disabled={!filterEnabled}
                      onClick={() => setFilterPattern(DEFAULT_LYRIC_FILTER_PATTERN)}
                      className="text-[11px] opacity-55 transition hover:opacity-90 disabled:opacity-30"
                    >
                      恢复默认过滤规则
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'playback' ? (
              <div className="space-y-5">
                <ToggleRow
                  icon={<Link2 size={15} />}
                  title="下架歌曲跨渠道保底"
                  description="原平台下架或无法取流时，自动在另一渠道（网易云 ↔ QQ）搜索同名歌曲，并通过该渠道私链播放。保底走私链，而不是干等报错。"
                  enabled={crossPlayFallback}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setCrossPlayFallback(!crossPlayFallback)}
                />
                <div className={`rounded-2xl px-4 py-3 text-[11px] leading-relaxed opacity-55 ${card}`}>
                  流程简述：先走当前渠道（登录音质 → 同渠道私链）；仍失败且本开关开启时，按歌名+艺人到对端搜索，命中后再用对端私链出流。例如网易云下架的《画中游》，会尝试用 QQ 私链播同名版本。
                </div>
              </div>
            ) : null}

            {tab === 'chrome' ? (
              <div className="space-y-5">
                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] opacity-55">
                    <SquareStack size={14} />
                    歌单卡片样式
                  </div>
                  <div className="text-sm font-semibold">歌单卡片样式</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    {LIBRARY_CARD_STYLE_HINT}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {CARD_STYLE_OPTIONS.map((option) => {
                      const active = cardStyle === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCardStyle(option.id)}
                          className={`rounded-xl px-3 py-3 text-[12px] font-medium transition ${
                            active
                              ? (isDaylight ? 'bg-white text-black shadow-sm ring-2 ring-white/90' : 'bg-white/10 text-white ring-2 ring-white/75')
                              : (isDaylight ? 'bg-black/5 opacity-70 hover:opacity-100' : 'bg-white/5 opacity-70 hover:opacity-100')
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">布局方式</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    铭牌卡片会叠在蜂窝或方形上；列表模式不受卡片样式影响。
                  </div>
                </div>
                <div className={`inline-flex w-full flex-wrap items-center gap-1 rounded-2xl p-1 ${card}`}>
                  {LAYOUT_MODE_OPTIONS.map((mode) => {
                    const active = layoutMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLayoutMode(mode.id)}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium transition ${
                          active
                            ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/16 text-white')
                            : 'opacity-55 hover:opacity-90'
                        }`}
                      >
                        {mode.icon}
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="text-sm font-semibold">底栏控件</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    调整播放条的玻璃质感，以及悬停放大幅度（左右会按观感补强到与中间接近）。
                  </div>
                </div>
                <div className={`space-y-4 rounded-2xl px-3 py-3 ${card}`}>
                  <SettingSlider
                    label="不透明度"
                    value={opacity}
                    display={`${opacity}%`}
                    min={20}
                    max={90}
                    onChange={setOpacity}
                  />
                  <SettingSlider
                    label="模糊度"
                    value={blur}
                    display={`${blur}px`}
                    min={0}
                    max={40}
                    onChange={setBlur}
                  />
                  <SettingSlider
                    label="放大幅度"
                    value={hoverBoost}
                    display={`${hoverBoost}%`}
                    min={0}
                    max={18}
                    onChange={setHoverBoost}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSettingsPanel;
