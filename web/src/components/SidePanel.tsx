import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { AudioLines, ChevronDown, Download, FileDown, Home, Image, ListMusic, Palette, RefreshCw, ScrollText, X } from 'lucide-react';
import type { LyricProviderSource, ThemeTokens, Track, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from './visualizer/backgrounds/definition';
import { coverRefreshUrl } from '../api';
import { findLatestActiveLineIndex, resolveVisualizerLyrics } from '../lib/lyrics';
import { LYRIC_SOURCE_OPTIONS, useLyricSettingsStore } from '../store/lyricSettingsStore';
import { useIsMobile } from '../lib/media';
import LyricsStylePicker, { type StageSettingsTab } from './LyricsStylePicker';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';
import InterludeDots from './InterludeDots';
import WordByWordBadge from './WordByWordBadge';
import { isInterludeLine } from '../utils/lyrics/parserCore';

function lyricSourceLabel(source?: Track['lyricSource']): string {
  if (!source || source === 'native') return '歌曲自带';
  return LYRIC_SOURCE_OPTIONS.find((item) => item.id === source)?.label || source;
}

interface SidePanelProps {
  open: boolean;
  visible?: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  track: Track | null;
  queue: Track[];
  index: number;
  currentTime: MotionValue<number>;
  visualizerMode: VisualizerMode;
  background: VisualizerBackgroundConfig;
  styleOpen: boolean;
  buffering?: boolean;
  lyricsSwitching?: boolean;
  qualityOptions?: Array<{ level: string; label: string; br?: number }>;
  audioQuality?: string;
  onAudioQualityChange?: (level: string) => void;
  onStyleOpenChange: (open: boolean) => void;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  onBackgroundChange: (config: VisualizerBackgroundConfig) => void;
  onClose: () => void;
  onOpen?: () => void;
  onHome: () => void;
  onDownloadSong: () => void;
  onDownloadLrc: () => void;
  onPlayIndex: (index: number) => void;
  onLyricLineSeek?: (time: number) => void;
  onSwitchLyricSource?: (source: LyricProviderSource) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  open,
  visible = true,
  isDaylight,
  theme,
  track,
  queue,
  index,
  currentTime,
  visualizerMode,
  background,
  styleOpen,
  buffering = false,
  lyricsSwitching = false,
  qualityOptions = [],
  audioQuality = '',
  onAudioQualityChange,
  onStyleOpenChange,
  onVisualizerModeChange,
  onBackgroundChange,
  onClose,
  onHome,
  onDownloadSong,
  onDownloadLrc,
  onPlayIndex,
  onLyricLineSeek,
  onSwitchLyricSource,
}) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [settingsTab, setSettingsTab] = useState<StageSettingsTab>('lyrics');
  const [lineIndex, setLineIndex] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [lyricSourceOpen, setLyricSourceOpen] = useState(false);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lyricFilterPattern = useLyricSettingsStore((state) => (
    state.filterEnabled ? state.filterPattern : ''
  ));
  const resolvedLyrics = useMemo(
    () => resolveVisualizerLyrics(track, lyricFilterPattern),
    [lyricFilterPattern, track],
  );
  const lines = resolvedLyrics.lines;
  const isWordByWord = resolvedLyrics.isWordByWord;
  const coverUrl = track?.pic || (track ? coverRefreshUrl(track.type, track.songid) : '');
  const capsule = isDaylight
    ? 'bg-black/6 hover:bg-black/10 text-black'
    : 'bg-white/10 hover:bg-white/16 text-white';
  const showExpanded = isMobile ? open : visible && open;
  const selectedQuality = qualityOptions.find((item) => item.level === audioQuality)
    || qualityOptions.find((item) => item.level === 'exhigh')
    || qualityOptions[0];

  useEffect(() => {
    if (!showExpanded) return;
    let frame = 0;
    const tick = () => {
      const next = findLatestActiveLineIndex(lines, currentTime.get());
      setLineIndex((prev) => (prev === next ? prev : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentTime, lines, showExpanded]);

  useEffect(() => {
    if (tab !== 'lyrics' || lineIndex < 0) return;
    const container = lyricScrollRef.current;
    const active = container?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [lineIndex, tab]);

  useEffect(() => {
    if (!showExpanded) {
      setQualityOpen(false);
      setLyricSourceOpen(false);
    }
  }, [showExpanded]);

  useEffect(() => {
    setLyricSourceOpen(false);
  }, [track?.songid, track?.type]);

  const openSettings = (next: StageSettingsTab) => {
    setSettingsTab(next);
    onStyleOpenChange(true);
  };

  const panel = (
    <>
      {isMobile && open ? (
        <motion.button
          type="button"
          aria-label="关闭播放队列"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/45"
          onClick={onClose}
        />
      ) : null}

      <AnimatePresence>
        {(isMobile || showExpanded) ? (
          <motion.aside
            key="now-playing-panel"
            initial={isMobile ? false : { opacity: 0, scale: 0.94, y: 10 }}
            animate={isMobile
              ? { opacity: 1, y: open ? 0 : '110%' }
              : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? undefined : { opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            aria-hidden={!showExpanded}
            className={`z-40 flex flex-col overflow-hidden shadow-2xl backdrop-blur-xl theme-glass-panel titlebar-no-drag ${
              isMobile
                ? 'fixed inset-x-0 bottom-0 h-[min(78dvh,calc(100%-4rem))] rounded-t-3xl border-0'
                : 'relative w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl border border-white/10'
            }`}
            style={{
              ...(isMobile
                ? { paddingBottom: 'var(--safe-bottom)' }
                : {
                    height: 'min(28rem, calc(100dvh - 9.5rem))',
                    maxHeight: '58vh',
                  }),
              backgroundColor: isDaylight
                ? 'color-mix(in srgb, var(--bg-color) 88%, transparent)'
                : 'color-mix(in srgb, var(--bg-color) 78%, transparent)',
              pointerEvents: showExpanded ? 'auto' : 'none',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {isMobile && (
              <div className="flex justify-center pt-2">
                <span className={`h-1 w-10 rounded-full ${isDaylight ? 'bg-black/20' : 'bg-white/25'}`} />
              </div>
            )}
            <div className="titlebar-no-drag flex items-center justify-between px-4 py-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onHome();
                }}
                className="titlebar-no-drag relative z-10 rounded-full p-2 hover:bg-white/10"
                aria-label="返回主页"
              >
                <Home size={16} />
              </button>
              <span className="text-xs opacity-50">正在播放</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                className="titlebar-no-drag relative z-10 rounded-full p-2 hover:bg-white/10"
                aria-label="收起"
              >
                <X size={16} />
              </button>
            </div>

            <div className={`flex gap-3 px-4 pb-2 ${isMobile ? '' : 'px-5'}`}>
              <div className={`relative overflow-hidden bg-zinc-800/30 shadow-inner ${isMobile ? 'h-14 w-14 shrink-0 rounded-xl' : 'h-14 w-14 shrink-0 rounded-2xl'}`}>
                <CoverArt src={coverUrl} />
                {buffering ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <RyanLoader size={28} />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold" style={{ color: theme.primaryColor }}>
                  {track?.title || '未播放'}
                </div>
                <div className="mt-0.5 truncate text-sm opacity-55">{track?.author}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openSettings('lyrics')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${capsule}`}
                    >
                      <Palette size={13} style={{ color: 'var(--text-accent)' }} />
                      歌词样式
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettings('background')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${capsule}`}
                    >
                      <Image size={13} style={{ color: 'var(--text-accent)' }} />
                      舞台背景
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadSong}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${capsule}`}
                      title="下载歌曲"
                    >
                      <Download size={13} />
                      下载歌曲
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadLrc}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${capsule}`}
                      title="下载歌词"
                    >
                      <FileDown size={13} />
                      下载歌词
                    </button>
                    {qualityOptions.length > 0 ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setQualityOpen((prev) => !prev)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${capsule}`}
                          aria-haspopup="listbox"
                          aria-expanded={qualityOpen}
                        >
                          <AudioLines size={13} style={{ color: 'var(--text-accent)' }} />
                          音质 {selectedQuality?.label || '选择'}
                          <ChevronDown size={12} className={qualityOpen ? 'rotate-180' : ''} />
                        </button>
                        {qualityOpen ? (
                          <div
                            className={`absolute right-0 z-50 mt-1.5 min-w-[8.5rem] overflow-hidden rounded-2xl border py-1 shadow-xl ${
                              isDaylight ? 'border-black/10 bg-[var(--bg-color)]' : 'border-white/12 bg-[var(--bg-color)]'
                            }`}
                            role="listbox"
                          >
                            {qualityOptions.map((item) => {
                              const active = item === selectedQuality;
                              return (
                                <button
                                  key={item.level}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onClick={() => {
                                    onAudioQualityChange?.(item.level);
                                    setQualityOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] ${
                                    active ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                                  }`}
                                  style={active ? { color: 'var(--text-accent)' } : undefined}
                                >
                                  <span>{item.label}</span>
                                  {item.br ? (
                                    <span className="ml-3 opacity-40">{Math.round(item.br / 1000)}k</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                </div>
              </div>
            </div>

            <div className={`mx-4 mt-2 flex rounded-full p-1 ${isDaylight ? 'bg-black/6' : 'bg-white/10'}`}>
              {([
                { key: 'lyrics' as const, label: '歌词', Icon: ScrollText },
                { key: 'queue' as const, label: '队列', Icon: ListMusic },
              ]).map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition ${
                      active
                        ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/18 text-white shadow-sm')
                        : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <Icon size={14} strokeWidth={active ? 2.25 : 2} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className={`min-h-0 flex-1 overflow-hidden border-t ${isDaylight ? 'border-black/10' : 'border-white/10'}`}>
              {tab === 'lyrics' ? (
                <div className="flex h-full min-h-0 flex-col">
                  {track ? (
                    <div className="relative flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-2.5">
                      <div className="flex min-w-0 items-center gap-1.5 text-[11px] opacity-45">
                        <span className="shrink-0">歌词来源</span>
                        <span className="truncate font-medium opacity-90" style={{ color: 'var(--text-accent)' }}>
                          {lyricSourceLabel(track.lyricSource)}
                        </span>
                        {isWordByWord ? <WordByWordBadge compact className="shrink-0" /> : null}
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          disabled={!onSwitchLyricSource || lyricsSwitching}
                          onClick={() => setLyricSourceOpen((prev) => !prev)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${capsule} disabled:opacity-40`}
                          aria-haspopup="listbox"
                          aria-expanded={lyricSourceOpen}
                        >
                          {lyricsSwitching ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          切换来源
                          <ChevronDown size={11} className={lyricSourceOpen ? 'rotate-180' : ''} />
                        </button>
                        {lyricSourceOpen ? (
                          <div
                            className={`absolute right-0 z-50 mt-1.5 min-w-[9.5rem] overflow-hidden rounded-2xl border py-1 shadow-xl ${
                              isDaylight ? 'border-black/10 bg-[var(--bg-color)]' : 'border-white/12 bg-[var(--bg-color)]'
                            }`}
                            role="listbox"
                          >
                            {LYRIC_SOURCE_OPTIONS.map((item) => {
                              const active = track.lyricSource === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  disabled={lyricsSwitching}
                                  onClick={() => {
                                    setLyricSourceOpen(false);
                                    onSwitchLyricSource?.(item.id);
                                  }}
                                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] ${
                                    active ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                                  }`}
                                  style={active ? { color: 'var(--text-accent)' } : undefined}
                                >
                                  <span>{item.label}</span>
                                  {active ? <span className="ml-3 opacity-50">当前</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1">
                    <div ref={lyricScrollRef} className="hide-scrollbar h-full overflow-y-auto px-4 py-2">
                    {lines.length ? (
                      lines.map((line, i) => {
                        const active = i === lineIndex;
                        return (
                          <button
                            key={`${line.startTime}-${i}`}
                            type="button"
                            data-active={active ? 'true' : undefined}
                            onClick={() => onLyricLineSeek?.(line.startTime)}
                            className={`mb-3 block w-full text-left text-sm leading-relaxed transition ${
                              active ? 'scale-[1.02] font-semibold opacity-100' : 'opacity-45 hover:opacity-70'
                            }`}
                            style={active ? { color: theme.primaryColor } : undefined}
                          >
                            {isInterludeLine(line) ? (
                              <InterludeDots
                                size={active ? 5 : 4}
                                gap={active ? 7 : 5}
                                color="currentColor"
                                activeColor="var(--text-accent)"
                                activeIndex={active ? 5 : undefined}
                              />
                            ) : (
                              line.fullText || line.words.map((w) => w.text).join('')
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm opacity-40">
                        {track ? (lyricsSwitching ? '正在切换歌词源…' : '暂无歌词') : '选择一首歌开始播放'}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hide-scrollbar h-full overflow-y-auto">
                  {queue.map((item, i) => (
                    <button
                      key={`${item.type}-${item.songid}-${i}`}
                      type="button"
                      onClick={() => onPlayIndex(i)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm md:py-2.5 ${
                        i === index ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="w-5 text-right font-mono text-[10px] opacity-40">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="max-w-[40%] truncate text-xs opacity-40">{item.author}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <LyricsStylePicker
              open={styleOpen}
              mode={visualizerMode}
              background={background}
              isDaylight={isDaylight}
              theme={theme}
              initialTab={settingsTab}
              onClose={() => onStyleOpenChange(false)}
              onChange={(nextMode) => {
                onVisualizerModeChange(nextMode);
              }}
              onBackgroundChange={onBackgroundChange}
            />
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );

  if (isMobile && typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }
  return panel;
};

export default SidePanel;
