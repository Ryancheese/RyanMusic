import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Download, Home, Image, Palette, X } from 'lucide-react';
import type { ThemeTokens, Track, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from './visualizer/backgrounds/definition';
import { coverRefreshUrl } from '../api';
import { findLatestActiveLineIndex, trackToVisualizerLines } from '../lib/lyrics';
import { useIsMobile, isMacosApp } from '../lib/media';
import LyricsStylePicker, { type StageSettingsTab } from './LyricsStylePicker';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';
import InterludeDots from './InterludeDots';
import { isInterludeLine } from '../utils/lyrics/parserCore';

interface SidePanelProps {
  open: boolean;
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
  qualityOptions?: Array<{ level: string; label: string; br?: number }>;
  audioQuality?: string;
  onAudioQualityChange?: (level: string) => void;
  onStyleOpenChange: (open: boolean) => void;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  onBackgroundChange: (config: VisualizerBackgroundConfig) => void;
  onClose: () => void;
  onHome: () => void;
  onDownloadSong: () => void;
  onDownloadLrc: () => void;
  onPlayIndex: (index: number) => void;
  onLyricLineSeek?: (time: number) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  open,
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
}) => {
  const isMobile = useIsMobile();
  const macApp = isMacosApp();
  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [settingsTab, setSettingsTab] = useState<StageSettingsTab>('lyrics');
  const [lineIndex, setLineIndex] = useState(-1);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => trackToVisualizerLines(track), [track]);
  const coverUrl = track?.pic || (track ? coverRefreshUrl(track.type, track.songid) : '');
  const capsule = isDaylight
    ? 'bg-black/6 hover:bg-black/10 text-black'
    : 'bg-white/10 hover:bg-white/16 text-white';

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const tick = () => {
      const next = findLatestActiveLineIndex(lines, currentTime.get());
      setLineIndex((prev) => (prev === next ? prev : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentTime, lines, open]);

  useEffect(() => {
    if (tab !== 'lyrics' || lineIndex < 0) return;
    const container = lyricScrollRef.current;
    const active = container?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [lineIndex, tab]);

  const openSettings = (next: StageSettingsTab) => {
    setSettingsTab(next);
    onStyleOpenChange(true);
  };

  return (
    <>
      {isMobile && open ? (
        <motion.button
          type="button"
          aria-label="关闭播放队列"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 bg-black/45"
          onClick={onClose}
        />
      ) : null}
      <motion.aside
        initial={false}
        animate={isMobile
          ? { opacity: 1, y: open ? 0 : '110%' }
          : { opacity: open ? 1 : 0, x: open ? 0 : 28 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        aria-hidden={!open}
        className={`absolute z-40 flex flex-col overflow-hidden shadow-2xl backdrop-blur-xl theme-glass-panel titlebar-no-drag ${
          isMobile
            ? 'inset-x-0 bottom-0 h-[min(78dvh,calc(100%-4rem))] rounded-t-3xl border-0'
            : macApp
              ? 'top-14 right-0 bottom-0 w-[min(380px,calc(100%-1rem))] rounded-l-3xl border-y-0 border-r-0 border-l border-white/10'
              : 'top-4 right-0 bottom-0 w-[min(380px,calc(100%-1rem))] rounded-l-3xl border-y-0 border-r-0 border-l border-white/10'
        }`}
        style={{
          ...(isMobile ? { paddingBottom: 'var(--safe-bottom)' } : undefined),
          backgroundColor: isDaylight
            ? 'color-mix(in srgb, var(--bg-color) 88%, transparent)'
            : 'color-mix(in srgb, var(--bg-color) 78%, transparent)',
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
            {isMobile && (
              <div className="flex justify-center pt-2">
                <span className={`h-1 w-10 rounded-full ${isDaylight ? 'bg-black/20' : 'bg-white/25'}`} />
              </div>
            )}
            <div className="titlebar-no-drag flex items-center justify-between px-4 py-3">
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
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>

            <div className={`flex gap-3 px-4 pb-3 ${isMobile ? '' : 'px-5'}`}>
              <div className={`relative overflow-hidden bg-zinc-800/30 shadow-inner ${isMobile ? 'h-16 w-16 shrink-0 rounded-xl' : 'h-20 w-20 shrink-0 rounded-2xl'}`}>
                <CoverArt src={coverUrl} />
                {buffering ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <RyanLoader size={28} />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold" style={{ color: theme.primaryColor }}>
                  {track?.title || '未播放'}
                </div>
                <div className="mt-1 truncate text-sm opacity-55">{track?.author}</div>
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSettings('lyrics')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${capsule}`}
                    >
                      <Palette size={13} style={{ color: 'var(--text-accent)' }} />
                      歌词样式
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettings('background')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${capsule}`}
                    >
                      <Image size={13} style={{ color: 'var(--text-accent)' }} />
                      舞台背景
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onDownloadSong}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${capsule}`}
                      title="下载歌曲"
                    >
                      <Download size={13} />
                      下载歌曲
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadLrc}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${capsule}`}
                      title="下载歌词"
                    >
                      下载歌词
                    </button>
                  </div>
                  {qualityOptions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] opacity-45">音质</span>
                      {qualityOptions.map((item) => {
                        const active = item.level === audioQuality
                          || (!audioQuality && item.level === 'exhigh');
                        return (
                          <button
                            key={item.level}
                            type="button"
                            onClick={() => onAudioQualityChange?.(item.level)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                              active
                                ? 'text-white'
                                : capsule
                            }`}
                            style={active ? { background: 'var(--text-accent)', color: '#fff' } : undefined}
                            title={item.br ? `${Math.round(item.br / 1000)} kbps` : item.label}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={`mx-4 flex gap-1 rounded-full p-1 ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}>
              {(['lyrics', 'queue'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-full py-1.5 text-xs transition ${
                    tab === key ? (isDaylight ? 'bg-white shadow' : 'bg-white/15') : 'opacity-55'
                  }`}
                >
                  {key === 'lyrics' ? '歌词' : '队列'}
                </button>
              ))}
            </div>

            <div className={`min-h-0 flex-1 overflow-hidden border-t ${isDaylight ? 'border-black/10' : 'border-white/10'}`}>
              {tab === 'lyrics' ? (
                <div ref={lyricScrollRef} className="app-scroll hide-scrollbar h-full overflow-y-auto px-4 py-3">
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
                      {track ? '暂无歌词' : '选择一首歌开始播放'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="app-scroll hide-scrollbar h-full overflow-y-auto">
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
    </>
  );
};

export default SidePanel;
