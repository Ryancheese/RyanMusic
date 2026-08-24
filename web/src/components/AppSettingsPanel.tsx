import React, { useEffect, useRef, useState } from 'react';
import { ALargeSmall, ArrowDownUp, AudioLines, Clock3, Columns2, Flame, Gauge, HardDrive, Hexagon, Keyboard, LayoutGrid, Link2, List, MessageCircleHeart, Music, Palette, Rows2, SlidersHorizontal, Sparkles, SquareStack, Trash2, Users, X } from 'lucide-react';
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
import { COMMENT_FONT_SCALE_MAX, COMMENT_FONT_SCALE_MIN, COMMENT_MIX_OPTIONS, COMMENT_PLATFORM_OPTIONS, COMMENT_READ_ORDER_OPTIONS, CROWD_COUNT_OPTIONS, useCommentAtmosphereStore } from '../store/commentAtmosphereStore';
import { useLibraryStore } from '../store/libraryStore';
import { useThemeAccentStore } from '../store/themeStore';
import {
  LIBRARY_CARD_STYLE_HINT,
  LIBRARY_CARD_STYLE_LABELS,
  LIBRARY_LAYOUT_MODE_LABELS,
  LIBRARY_LIST_COLUMNS_LABELS,
} from '../lib/libraryLayout';
import { clearAppCache, fetchCacheUsage, type CacheCategoryId, type CacheUsage } from '../api';
import { clearCoverSessionMemory } from './CoverArt';
import { AUDIO_QUALITY_OPTIONS } from '../lib/audioQuality';
import type { LibraryCardStyle, LibraryLayoutMode, LibraryListColumns } from '../types';

const PLAYLIST_TRACK_CACHE_KEY = 'ryanmusic-playlist-tracks-v1';

const CACHE_CATEGORY_META: {
  id: CacheCategoryId | 'playlists' | 'covers';
  label: string;
  hint: string;
}[] = [
  { id: 'play', label: '播放地址', hint: '临时播放链接，清理后下次播放会重新取流' },
  { id: 'lyrics', label: '歌词缓存', hint: '已拉取的歌词文本，清理后下次播放会重新匹配' },
  { id: 'comments', label: '评论缓存', hint: '歌曲评论列表，清理后下次打开会重新加载' },
  { id: 'playlists', label: '歌单曲目', hint: '本机缓存的歌单内歌曲列表与封面地址' },
  { id: 'covers', label: '封面记忆', hint: '本会话封面翻转动画记录，几乎不占空间' },
  { id: 'other', label: '其他缓存', hint: '其余可重建的临时数据' },
];

interface AppSettingsPanelProps {
  open: boolean;
  isDaylight: boolean;
  onClose: () => void;
  onReplayGuide?: () => void;
}

type SettingsTab = 'lyrics' | 'playback' | 'chrome' | 'storage';

type ClearTarget = CacheCategoryId | 'playlists' | 'covers' | 'all';

function formatCacheSize(bytes: number, mb?: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  const value = typeof mb === 'number' ? mb : bytes / (1024 * 1024);
  return `${value.toFixed(1)} MB`;
}

function measureLocalStorageKey(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

function clearPlaylistTrackCache() {
  try {
    localStorage.removeItem(PLAYLIST_TRACK_CACHE_KEY);
  } catch {
    // ignore
  }
}
const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'lyrics', label: '歌词', icon: <AudioLines size={14} /> },
  { id: 'playback', label: '播放', icon: <Link2 size={14} /> },
  { id: 'chrome', label: '外观', icon: <Palette size={14} /> },
  { id: 'storage', label: '存储', icon: <HardDrive size={14} /> },
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

const LIST_COLUMNS_OPTIONS: { id: LibraryListColumns; label: string; icon: React.ReactNode }[] = [
  { id: 'single', label: LIBRARY_LIST_COLUMNS_LABELS.single, icon: <Rows2 size={13} /> },
  { id: 'multi', label: LIBRARY_LIST_COLUMNS_LABELS.multi, icon: <Columns2 size={13} /> },
];

const CARD_STYLE_OPTIONS: { id: LibraryCardStyle; label: string }[] = [
  { id: 'cover', label: LIBRARY_CARD_STYLE_LABELS.cover },
  { id: 'plaque', label: LIBRARY_CARD_STYLE_LABELS.plaque },
];

const AppSettingsPanel: React.FC<AppSettingsPanelProps> = ({ open, isDaylight, onClose, onReplayGuide }) => {
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
  const preferredQuality = usePlaybackSettingsStore((state) => state.preferredQuality);
  const setPreferredQuality = usePlaybackSettingsStore((state) => state.setPreferredQuality);
  const commentAtmosphere = useCommentAtmosphereStore((state) => state.enabled);
  const setCommentAtmosphere = useCommentAtmosphereStore((state) => state.setEnabled);
  const commentTypewriter = useCommentAtmosphereStore((state) => state.typewriter);
  const setCommentTypewriter = useCommentAtmosphereStore((state) => state.setTypewriter);
  const commentReadOrder = useCommentAtmosphereStore((state) => state.readOrder);
  const setCommentReadOrder = useCommentAtmosphereStore((state) => state.setReadOrder);
  const commentCrowdMode = useCommentAtmosphereStore((state) => state.crowdMode);
  const setCommentCrowdMode = useCommentAtmosphereStore((state) => state.setCrowdMode);
  const commentCrowdCount = useCommentAtmosphereStore((state) => state.crowdCount);
  const setCommentCrowdCount = useCommentAtmosphereStore((state) => state.setCrowdCount);
  const commentFontScale = useCommentAtmosphereStore((state) => state.fontScale);
  const setCommentFontScale = useCommentAtmosphereStore((state) => state.setFontScale);
  const commentMixBias = useCommentAtmosphereStore((state) => state.mixBias);
  const setCommentMixBias = useCommentAtmosphereStore((state) => state.setMixBias);
  const commentSource = useCommentAtmosphereStore((state) => state.commentSource);
  const setCommentSource = useCommentAtmosphereStore((state) => state.setCommentSource);
  const autoBestComment = useCommentAtmosphereStore((state) => state.autoBestComment);
  const setAutoBestComment = useCommentAtmosphereStore((state) => state.setAutoBestComment);
  const opacity = useControlAppearanceStore((state) => state.opacity);
  const blur = useControlAppearanceStore((state) => state.blur);
  const hoverBoost = useControlAppearanceStore((state) => state.hoverBoost);
  const setOpacity = useControlAppearanceStore((state) => state.setOpacity);
  const setBlur = useControlAppearanceStore((state) => state.setBlur);
  const setHoverBoost = useControlAppearanceStore((state) => state.setHoverBoost);
  const layoutMode = useLibraryStore((state) => state.layoutMode);
  const cardStyle = useLibraryStore((state) => state.cardStyle);
  const listColumns = useLibraryStore((state) => state.listColumns);
  const setLayoutMode = useLibraryStore((state) => state.setLayoutMode);
  const setCardStyle = useLibraryStore((state) => state.setCardStyle);
  const setListColumns = useLibraryStore((state) => state.setListColumns);
  const bgWash = useThemeAccentStore((state) => state.bgWash);
  const setBgWash = useThemeAccentStore((state) => state.setBgWash);
  const coverAccentEnabled = useThemeAccentStore((state) => state.coverAccentEnabled);
  const setCoverAccentEnabled = useThemeAccentStore((state) => state.setCoverAccentEnabled);
  const panelRef = useRef<HTMLDivElement>(null);
  const [cacheBusy, setCacheBusy] = useState<ClearTarget | null>(null);
  const [cacheMessage, setCacheMessage] = useState('');
  const [cacheUsage, setCacheUsage] = useState<CacheUsage | null>(null);
  const [cacheUsageError, setCacheUsageError] = useState('');
  const [playlistCacheBytes, setPlaylistCacheBytes] = useState(0);

  const refreshLocalCacheStats = () => {
    setPlaylistCacheBytes(measureLocalStorageKey(PLAYLIST_TRACK_CACHE_KEY));
  };

  useEffect(() => {
    if (!open || tab !== 'storage') return;
    let cancelled = false;
    refreshLocalCacheStats();
    void (async () => {
      try {
        const result = await fetchCacheUsage();
        if (cancelled) return;
        if (result.code === 200 && result.data) {
          setCacheUsage(result.data);
          setCacheUsageError('');
        } else {
          setCacheUsageError(result.error || '无法读取占用');
        }
      } catch {
        if (!cancelled) setCacheUsageError('无法读取占用');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  const clearCacheTarget = async (target: ClearTarget) => {
    setCacheBusy(target);
    setCacheMessage('');
    try {
      if (target === 'covers') {
        clearCoverSessionMemory();
        setCacheMessage('已清理封面会话记忆');
        return;
      }
      if (target === 'playlists') {
        clearPlaylistTrackCache();
        refreshLocalCacheStats();
        setCacheMessage('已清理歌单曲目缓存');
        return;
      }
      if (target === 'all') {
        clearPlaylistTrackCache();
        clearCoverSessionMemory();
        refreshLocalCacheStats();
      }
      const result = await clearAppCache(target === 'all' ? 'all' : target);
      if (result.code !== 200 || !result.data) {
        setCacheMessage(result.error || '清理失败，请稍后重试');
        return;
      }
      if (result.data.usage) setCacheUsage(result.data.usage);
      refreshLocalCacheStats();
      const mb = result.data.removedMB ?? 0;
      const entries = result.data.removedEntries ?? 0;
      const label = CACHE_CATEGORY_META.find((item) => item.id === target)?.label || '缓存';
      if (target === 'all') {
        setCacheMessage(
          entries > 0 || mb > 0 || playlistCacheBytes > 0
            ? `已清理约 ${mb} MB（${entries} 项），登录态已保留`
            : '没有可清理的缓存',
        );
      } else {
        setCacheMessage(
          entries > 0 || mb > 0
            ? `已清理「${label}」约 ${formatCacheSize(result.data.removedBytes, mb)}`
            : `「${label}」没有可清理内容`,
        );
      }
    } catch {
      setCacheMessage('清理失败，请稍后重试');
    } finally {
      setCacheBusy(null);
    }
  };

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
            <div className="mt-0.5 text-[11px] opacity-45">歌词、舞台氛围、播放保底与底栏外观</div>
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

                <ToggleRow
                  icon={<MessageCircleHeart size={15} />}
                  title="歌曲评论氛围"
                  description="在歌词舞台边缘随机飘出日式气泡评论（头像 + 昵称 + 热评），会躲开中部歌词、底栏和侧栏卡片。"
                  enabled={commentAtmosphere}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setCommentAtmosphere(!commentAtmosphere)}
                />

                <ToggleRow
                  icon={<Keyboard size={15} />}
                  title="评论打字机效果"
                  description="开启后，评论文字逐字打出，气泡宽度跟着已打出的字变长，头像始终贴在气泡角上。默认关闭。"
                  enabled={commentTypewriter}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setCommentTypewriter(!commentTypewriter)}
                />

                <ToggleRow
                  icon={<Users size={15} />}
                  title="评论群像模式"
                  description="开启后一批评论会在约 3 秒内先后飘出，并可同时留在屏幕上；互相回复的评论按时间先后排列。关闭时仍每次只飘一条。"
                  enabled={commentCrowdMode}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setCommentCrowdMode(!commentCrowdMode)}
                />

                {commentCrowdMode ? (
                  <div className={`rounded-2xl px-3 py-3 ${card}`}>
                    <div className="text-sm font-semibold">同屏最多数量</div>
                    <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                      群像模式下屏幕上最多同时保留的评论条数；同一批会在约 3 秒内逐条出现。
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {CROWD_COUNT_OPTIONS.map((count) => {
                        const active = count === commentCrowdCount;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setCommentCrowdCount(count)}
                            className={`rounded-2xl px-3 py-2.5 text-sm transition ${active ? '' : idle}`}
                            style={
                              active
                                ? {
                                    background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
                                    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
                                  }
                                : undefined
                            }
                          >
                            {count} 条
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      <ALargeSmall size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">评论大小</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        只放大歌词舞台上飘出的评论气泡。正在播放卡片里的评论保持自适应，不受这项控制。
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <SettingSlider
                      label="字号"
                      value={commentFontScale}
                      display={`${commentFontScale}%`}
                      min={COMMENT_FONT_SCALE_MIN}
                      max={COMMENT_FONT_SCALE_MAX}
                      step={5}
                      onChange={setCommentFontScale}
                    />
                  </div>
                </div>

                <ToggleRow
                  icon={<Music size={15} />}
                  title="自动匹配最佳评论平台"
                  description="开启后比较网易云、QQ 音乐、酷狗的评论数量，优先用评论最多的平台；关闭后使用下方指定平台，找不到再兜底。"
                  enabled={autoBestComment}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setAutoBestComment(!autoBestComment)}
                />

                <div className={`rounded-2xl px-3 py-3 ${card} ${autoBestComment ? 'opacity-45' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      <Music size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">评论平台</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        {autoBestComment
                          ? '当前为自动匹配。关闭上方开关后，可在此指定平台（只拉该平台，不再兜底）。'
                          : '只使用所选平台的评论；该平台没有评论时显示空，不会自动换成其它平台。'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {COMMENT_PLATFORM_OPTIONS.map((item) => {
                      const active = item.id === commentSource;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={autoBestComment}
                          onClick={() => setCommentSource(item.id)}
                          className={`rounded-2xl px-3 py-2.5 text-sm transition disabled:cursor-not-allowed ${active && !autoBestComment ? '' : idle}`}
                          style={
                            active && !autoBestComment
                              ? {
                                  background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
                                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
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

                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      {commentMixBias === 'latest' ? <Clock3 size={15} /> : <Flame size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">热评 / 最新偏好</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        最近优先约 70% 最新评论；热度优先约 70% 热评。同一首歌播放过程中每条评论只出现一次，不会回头再飘。
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {COMMENT_MIX_OPTIONS.map((item) => {
                      const active = item.id === commentMixBias;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCommentMixBias(item.id)}
                          className={`rounded-2xl px-3 py-2.5 text-sm transition ${active ? '' : idle}`}
                          style={
                            active
                              ? {
                                  background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
                                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
                                }
                              : undefined
                          }
                        >
                          <div>{item.label}</div>
                          <div className="mt-0.5 text-[10px] leading-snug opacity-45">{item.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      <ArrowDownUp size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">评论读取顺序</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        舞台气泡按此顺序读已经抽到的评论。没有热评时只用最新评论。
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {COMMENT_READ_ORDER_OPTIONS.map((item) => {
                      const active = item.id === commentReadOrder;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCommentReadOrder(item.id)}
                          className={`rounded-2xl px-3 py-2.5 text-sm transition ${active ? '' : idle}`}
                          style={
                            active
                              ? {
                                  background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
                                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
                                }
                              : undefined
                          }
                        >
                          <div>{item.label}</div>
                          <div className="mt-0.5 text-[10px] leading-snug opacity-45">{item.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] opacity-55">
                    <Gauge size={14} />
                    播放音质
                  </div>
                  <div className="text-sm font-semibold">默认播放音质</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    {preferredQuality === 'auto'
                      ? '根据当前网速、延迟和省流模式自动选择。测不到网速时先走极高（约 320k），保证马上出声；当前这首仍可在播放面板里临时改档。'
                      : '新歌曲会优先用这个档位；当前曲目没有该档时会尽快落到可播的 320k，而不是逐档死等。'}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {AUDIO_QUALITY_OPTIONS.map((item) => {
                      const active = item.id === preferredQuality;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          title={item.hint}
                          onClick={() => setPreferredQuality(item.id)}
                          className={`rounded-xl px-2.5 py-2.5 text-[12px] font-medium transition ${
                            active
                              ? (isDaylight ? 'bg-white text-black shadow-sm ring-2 ring-white/90' : 'bg-white/10 text-white ring-2 ring-white/75')
                              : (isDaylight ? 'bg-black/5 opacity-70 hover:opacity-100' : 'bg-white/5 opacity-70 hover:opacity-100')
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                {onReplayGuide ? (
                  <button
                    type="button"
                    onClick={onReplayGuide}
                    className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${card} hover:brightness-110`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      <Sparkles size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">界面引导</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        再走一遍首页按钮、封面墙和歌词舞台上的功能说明。
                      </div>
                    </div>
                  </button>
                ) : null}
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

                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] opacity-55">
                    <Columns2 size={14} />
                    列表列数
                  </div>
                  <div className="text-sm font-semibold">列表单列 / 多列</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    仅在「列表」布局生效：单列铺满阅读更顺，多列在宽屏并排显示更多歌单。
                  </div>
                  <div className="mt-3 inline-flex w-full items-center gap-1 rounded-xl p-1"
                    style={{ background: isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}
                  >
                    {LIST_COLUMNS_OPTIONS.map((option) => {
                      const active = listColumns === option.id;
                      const disabled = layoutMode !== 'list';
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          disabled={disabled}
                          onClick={() => setListColumns(option.id)}
                          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium transition ${
                            disabled
                              ? 'opacity-35'
                              : active
                                ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/16 text-white')
                                : 'opacity-55 hover:opacity-90'
                          }`}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ToggleRow
                  icon={<Palette size={15} />}
                  title="封面取色"
                  description="播放时从当前歌曲封面提取主题色；无封面时仍使用预设主题色"
                  enabled={coverAccentEnabled}
                  isDaylight={isDaylight}
                  card={card}
                  idle={idle}
                  onToggle={() => setCoverAccentEnabled(!coverAccentEnabled)}
                />

                <div>
                  <div className="text-sm font-semibold">主题背景</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    约 50% 接近原先默认；拉到 100% 会明显更浓、铺得更满。
                  </div>
                </div>
                <div className={`rounded-2xl px-3 py-3 ${card}`}>
                  <SettingSlider
                    label="主题色填充度"
                    value={bgWash}
                    display={`${bgWash}%`}
                    min={0}
                    max={100}
                    onChange={setBgWash}
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold">底栏控件</div>
                  <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                    调整播放条的玻璃质感，以及悬停放大幅度（中间与左右同步，小圆钮会按观感补强）。
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

            {tab === 'storage' ? (
              <div className="space-y-5">
                <div className={`rounded-2xl px-4 py-4 ${card}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${idle}`}>
                      <HardDrive size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">内存管理</div>
                      <div className="mt-1 text-[11px] leading-relaxed opacity-50">
                        可按分类清理封面记忆、歌词、播放地址、评论等缓存。登录状态与设置偏好会保留。
                      </div>
                      <div className="mt-2 text-[12px] leading-relaxed">
                        {cacheUsageError ? (
                          <span className="opacity-50">{cacheUsageError}</span>
                        ) : cacheUsage ? (
                          <>
                            <span className="font-medium tabular-nums">
                              当前占用 {formatCacheSize(
                                cacheUsage.totalBytes + playlistCacheBytes,
                                (cacheUsage.totalBytes + playlistCacheBytes) / (1024 * 1024),
                              )}
                            </span>
                            <span className="ml-1.5 opacity-45">
                              可清理 {formatCacheSize(
                                cacheUsage.rebuildableBytes + playlistCacheBytes,
                                (cacheUsage.rebuildableBytes + playlistCacheBytes) / (1024 * 1024),
                              )}
                              {cacheUsage.preservedBytes > 0
                                ? ` · 登录数据 ${formatCacheSize(cacheUsage.preservedBytes, cacheUsage.preservedMB)}`
                                : ''}
                            </span>
                          </>
                        ) : (
                          <span className="opacity-40">正在读取占用…</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {CACHE_CATEGORY_META.map((item) => {
                      const serverCat = cacheUsage?.categories?.find((row) => row.id === item.id);
                      const bytes = item.id === 'playlists'
                        ? playlistCacheBytes
                        : item.id === 'covers'
                          ? 0
                          : (serverCat?.bytes || 0);
                      const busy = cacheBusy === item.id;
                      const disabled = Boolean(cacheBusy) || (
                        item.id !== 'covers' && bytes <= 0 && item.id !== 'playlists'
                      );
                      const empty = item.id === 'covers'
                        ? false
                        : bytes <= 0;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                            isDaylight ? 'bg-black/[0.03]' : 'bg-white/[0.04]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-medium">{item.label}</span>
                              <span className="text-[11px] tabular-nums opacity-45">
                                {item.id === 'covers' ? '会话' : formatCacheSize(bytes, bytes / (1024 * 1024))}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] leading-relaxed opacity-40">{item.hint}</div>
                          </div>
                          <button
                            type="button"
                            disabled={disabled || (empty && item.id !== 'covers')}
                            onClick={() => void clearCacheTarget(item.id)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                              busy || (empty && item.id !== 'covers') ? 'opacity-40' : idle
                            }`}
                          >
                            {busy ? '清理中' : empty && item.id !== 'covers' ? '空' : '清理'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(cacheBusy)}
                    onClick={() => void clearCacheTarget('all')}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      cacheBusy ? 'opacity-50' : idle
                    }`}
                    style={{
                      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 45%, transparent)',
                      background: 'color-mix(in srgb, var(--text-accent) 12%, transparent)',
                    }}
                  >
                    <Trash2 size={15} />
                    {cacheBusy === 'all' ? '正在清理…' : '清理全部可重建缓存'}
                  </button>
                  {cacheMessage ? (
                    <div className="mt-3 text-[11px] leading-relaxed opacity-60">{cacheMessage}</div>
                  ) : (
                    <div className="mt-3 text-[11px] leading-relaxed opacity-40">
                      不会删除网易云 / QQ 登录 Cookie，也不会清空主题与歌词设置。
                    </div>
                  )}
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
