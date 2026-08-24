import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { AudioLines, ChevronDown, Download, FileDown, Home, Image, ListMusic, ListPlus, MessageCircle, Palette, RefreshCw, ScrollText, X } from 'lucide-react';
import type { ThemeTokens, Track, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from './visualizer/backgrounds/definition';
import { coverRefreshUrl } from '../api';
import { findLatestActiveLineIndex, hasUsableTrackLyrics, resolveVisualizerLyrics } from '../lib/lyrics';
import { LYRIC_SOURCE_OPTIONS, useLyricSettingsStore } from '../store/lyricSettingsStore';
import { useIsMobile } from '../lib/media';
import LyricsStylePicker, { type StageSettingsTab } from './LyricsStylePicker';
import CoverArt from './CoverArt';
import DelistedCoverBadge from './DelistedCoverBadge';
import RyanLoader from './RyanLoader';
import InterludeDots from './InterludeDots';
import WordByWordBadge from './WordByWordBadge';
import SongComments from './SongComments';
import AddToPlaylistModal from './AddToPlaylistModal';
import GlassChromeButton from './GlassChromeButton';
import { isInterludeLine } from '../utils/lyrics/parserCore';
import { resolveLyricAlternateText } from '../utils/lyrics/alternateText';
import { AUTO_AUDIO_QUALITY, audioQualityLabel, pickPreferredLevel } from '../lib/audioQuality';

const hasReadableLyricText = (text?: string | null) => !!text && /[\p{L}\p{N}]/u.test(text);

function lyricSourceLabel(
  source?: Track['lyricSource'],
  track?: Track | null,
  pending?: boolean,
): string {
  if (pending) return '匹配最佳歌词…';
  if ((!source || source === 'native') && track && !hasUsableTrackLyrics(track)) {
    return '尚未匹配';
  }
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
  lyricsLoading?: boolean;
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
  onOpenLyricMatch?: () => void;
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
  lyricsLoading = false,
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
  onOpenLyricMatch,
}) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'lyrics' | 'queue' | 'comments'>('lyrics');
  const [settingsTab, setSettingsTab] = useState<StageSettingsTab>('lyrics');
  const [lineIndex, setLineIndex] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
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
  const lyricsPending = lyricsLoading || lyricsSwitching;
  const coverUrl = track?.pic || (track ? coverRefreshUrl(track.type, track.songid) : '');
  const capsule = isDaylight
    ? 'bg-black/6 hover:bg-black/10 text-black'
    : 'bg-white/10 hover:bg-white/16 text-white';
  const showExpanded = isMobile ? open : visible && open;
  const resolvedAutoLevel = pickPreferredLevel(qualityOptions, AUTO_AUDIO_QUALITY);
  const selectedQuality = audioQuality === AUTO_AUDIO_QUALITY || !audioQuality
    ? {
        level: AUTO_AUDIO_QUALITY,
        label: resolvedAutoLevel ? `自动 · ${audioQualityLabel(resolvedAutoLevel)}` : '自动',
      }
    : qualityOptions.find((item) => item.level === audioQuality)
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
      setPlaylistOpen(false);
    }
  }, [showExpanded]);

  const canAddToPlaylist = track?.type === 'netease' || track?.type === 'qq';
  const actionCapsule = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition outline-none ${capsule}`;

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
                ? 'fixed inset-x-0 bottom-0 h-[min(82dvh,calc(100%-4rem))] rounded-t-3xl border-0'
                : 'relative w-[min(26rem,calc(100vw-1.5rem))] rounded-3xl border border-white/10'
            }`}
            data-tour="now-playing"
            style={{
              ...(isMobile
                ? { paddingBottom: 'var(--safe-bottom)' }
                : {
                    height: 'min(34rem, calc(100dvh - 8rem))',
                    maxHeight: '68vh',
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
            <div className="titlebar-no-drag flex items-center justify-between px-5 py-3">
              <GlassChromeButton
                size="sm"
                className="titlebar-no-drag relative z-10"
                onClick={(event) => {
                  event.stopPropagation();
                  onHome();
                }}
                aria-label="返回主页"
              >
                <Home size={17} />
              </GlassChromeButton>
              <span className="text-sm opacity-50">正在播放</span>
              <GlassChromeButton
                size="sm"
                className="titlebar-no-drag relative z-10"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                aria-label="收起"
              >
                <X size={17} />
              </GlassChromeButton>
            </div>

            <div className={`flex gap-4 px-5 pb-3 ${isMobile ? '' : 'px-6'}`}>
              <div className={`relative overflow-hidden bg-zinc-800/30 shadow-inner ${isMobile ? 'h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl' : 'h-[4.75rem] w-[4.75rem] shrink-0 rounded-2xl'}`}>
                <CoverArt src={coverUrl} />
                {track?.delisted ? <DelistedCoverBadge /> : null}
                {buffering ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <RyanLoader size={28} />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold leading-snug" style={{ color: theme.primaryColor }}>
                  {track?.title || '未播放'}
                  {track?.delisted ? (
                    <span className="ml-1.5 inline-flex align-middle text-[10px] font-medium text-orange-500/90">
                      下架
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-sm opacity-55">{track?.author}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSettings('lyrics')}
                      className={actionCapsule}
                    >
                      <Palette size={13} style={{ color: 'var(--text-accent)' }} />
                      歌词样式
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettings('background')}
                      className={actionCapsule}
                    >
                      <Image size={13} style={{ color: 'var(--text-accent)' }} />
                      舞台背景
                    </button>
                    {canAddToPlaylist ? (
                      <button
                        type="button"
                        onClick={() => setPlaylistOpen(true)}
                        className={actionCapsule}
                        title="添加到歌单"
                      >
                        <ListPlus size={13} style={{ color: 'var(--text-accent)' }} />
                        添加到歌单
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onDownloadSong}
                      className={actionCapsule}
                      title="下载歌曲"
                    >
                      <Download size={13} />
                      下载歌曲
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadLrc}
                      className={actionCapsule}
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
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition outline-none ${capsule}`}
                          aria-haspopup="listbox"
                          aria-expanded={qualityOpen}
                        >
                          <AudioLines size={13} style={{ color: 'var(--text-accent)' }} />
                          音质 {selectedQuality?.label || '选择'}
                          <ChevronDown size={12} className={qualityOpen ? 'rotate-180' : ''} />
                        </button>
                            {qualityOpen ? (
                          <div
                            className={`absolute right-0 z-50 mt-1.5 min-w-[9.5rem] overflow-hidden rounded-2xl border py-1 shadow-xl ${
                              isDaylight ? 'border-black/10 bg-[var(--bg-color)]' : 'border-white/12 bg-[var(--bg-color)]'
                            }`}
                            role="listbox"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={audioQuality === AUTO_AUDIO_QUALITY || !audioQuality}
                              onClick={() => {
                                onAudioQualityChange?.(AUTO_AUDIO_QUALITY);
                                setQualityOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] ${
                                audioQuality === AUTO_AUDIO_QUALITY || !audioQuality ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                              }`}
                              style={audioQuality === AUTO_AUDIO_QUALITY || !audioQuality ? { color: 'var(--text-accent)' } : undefined}
                            >
                              <span>自动</span>
                              {resolvedAutoLevel ? (
                                <span className="ml-3 opacity-40">{audioQualityLabel(resolvedAutoLevel)}</span>
                              ) : null}
                            </button>
                            {qualityOptions.map((item) => {
                              const active = audioQuality === item.level;
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

            <div className={`mx-5 mt-3 flex rounded-full p-1 ${isDaylight ? 'bg-black/6' : 'bg-white/10'}`}>
              {([
                { key: 'lyrics' as const, label: '歌词', Icon: ScrollText },
                { key: 'queue' as const, label: '队列', Icon: ListMusic },
                { key: 'comments' as const, label: '评论', Icon: MessageCircle },
              ]).map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-medium transition ${
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
              {tab === 'comments' ? (
                <SongComments active={showExpanded && tab === 'comments'} track={track} isDaylight={isDaylight} />
              ) : tab === 'lyrics' ? (
                <div className="flex h-full min-h-0 flex-col">
                  {track ? (
                    <div className="relative flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
                      <div className="flex min-w-0 items-center gap-1.5 text-[12px] opacity-45">
                        <span className="shrink-0">歌词来源</span>
                        <span className="truncate font-medium opacity-90" style={{ color: 'var(--text-accent)' }}>
                          {lyricSourceLabel(track.lyricSource, track, lyricsPending && !lines.length)}
                        </span>
                        {isWordByWord ? <WordByWordBadge compact className="shrink-0" /> : null}
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          disabled={!onOpenLyricMatch || lyricsPending}
                          onClick={() => onOpenLyricMatch?.()}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition outline-none ${capsule} disabled:opacity-40`}
                        >
                          {lyricsPending ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <ScrollText size={12} />
                          )}
                          匹配歌词
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-x-hidden">
                    <div ref={lyricScrollRef} className="side-panel-lyrics hide-scrollbar h-full overflow-x-hidden overflow-y-auto px-5 py-3">
                    {lyricsPending && !lines.length ? (
                      <div className="flex h-full min-h-[12rem] items-center justify-center py-8">
                        <RyanLoader size={36} label="正在匹配最佳歌词…" />
                      </div>
                    ) : lines.length ? (
                      lines.map((line, i) => {
                        const active = i === lineIndex;
                        const translation = isInterludeLine(line)
                          ? null
                          : resolveLyricAlternateText(line, 'translation');
                        const showTranslation = hasReadableLyricText(translation);
                        return (
                          <div
                            key={`${line.startTime}-${i}`}
                            role="button"
                            tabIndex={-1}
                            data-active={active ? 'true' : undefined}
                            onClick={() => onLyricLineSeek?.(line.startTime)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onLyricLineSeek?.(line.startTime);
                              }
                            }}
                            className={`side-panel-lyric-line mb-4 block w-full cursor-pointer text-left text-[15px] leading-[1.75] transition ${
                              active ? 'font-semibold opacity-100' : 'opacity-45 hover:opacity-70'
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
                              <>
                                <span className="block">
                                  {line.fullText || line.words.map((w) => w.text).join('')}
                                </span>
                                {showTranslation ? (
                                  <span className={`mt-1 block text-[11px] font-normal leading-relaxed ${
                                    active ? 'opacity-60' : 'opacity-80'
                                  }`}>
                                    {translation}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-full min-h-[12rem] items-center justify-center py-8 text-sm opacity-40">
                        {track ? '未找到可用歌词' : '选择一首歌开始播放'}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hide-scrollbar h-full overflow-x-hidden overflow-y-auto">
                  {queue.map((item, i) => (
                    <button
                      key={`${item.type}-${item.songid}-${i}`}
                      type="button"
                      onClick={() => onPlayIndex(i)}
                      className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm outline-none md:py-3 ${
                        i === index ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="w-5 text-right font-mono text-[10px] opacity-40">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                        {item.delisted ? (
                          <span className="ml-1 text-[10px] text-orange-400/90">下架</span>
                        ) : null}
                      </span>
                      <span className="max-w-[40%] truncate text-xs opacity-40">{item.author}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <AddToPlaylistModal
              open={playlistOpen}
              isDaylight={isDaylight}
              theme={theme}
              track={track}
              onClose={() => setPlaylistOpen(false)}
            />

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
