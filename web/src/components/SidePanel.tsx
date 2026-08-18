import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Download, Home, Palette, SkipBack, SkipForward, X } from 'lucide-react';
import type { ThemeTokens, Track, VisualizerMode } from '../types';
import { coverRefreshUrl } from '../api';
import { findLatestActiveLineIndex, trackToVisualizerLines } from '../lib/lyrics';
import { useIsMobile } from '../lib/media';
import LyricsStylePicker from './LyricsStylePicker';
import CoverArt from './CoverArt';

interface SidePanelProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  track: Track | null;
  queue: Track[];
  index: number;
  currentTime: MotionValue<number>;
  visualizerMode: VisualizerMode;
  styleOpen: boolean;
  onStyleOpenChange: (open: boolean) => void;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  onClose: () => void;
  onHome: () => void;
  onDownloadSong: () => void;
  onDownloadLrc: () => void;
  onPlayIndex: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
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
  styleOpen,
  onStyleOpenChange,
  onVisualizerModeChange,
  onClose,
  onHome,
  onDownloadSong,
  onDownloadLrc,
  onPlayIndex,
  onPrev,
  onNext,
  onLyricLineSeek,
}) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [lineIndex, setLineIndex] = useState(-1);
  const lyricScrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => trackToVisualizerLines(track), [track]);
  const coverUrl = track?.pic || (track ? coverRefreshUrl(track.type, track.songid) : '');

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

  return (
    <AnimatePresence>
      {open && (
        <>
          {isMobile && (
            <motion.button
              type="button"
              aria-label="关闭播放队列"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/45"
              onClick={onClose}
            />
          )}
          <motion.aside
            initial={isMobile ? { opacity: 1, y: '100%' } : { opacity: 0, x: 24 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
            exit={isMobile ? { opacity: 1, y: '100%' } : { opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={`absolute z-40 flex flex-col overflow-hidden border shadow-2xl backdrop-blur-xl theme-glass-panel ${
              isMobile
                ? 'inset-x-0 bottom-0 h-[min(78dvh,calc(100%-4rem))] rounded-t-3xl'
                : 'top-4 right-4 bottom-4 w-[min(380px,calc(100%-2rem))] rounded-3xl'
            }`}
            style={isMobile ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            {isMobile && (
              <div className="flex justify-center pt-2">
                <span className={`h-1 w-10 rounded-full ${isDaylight ? 'bg-black/20' : 'bg-white/25'}`} />
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" onClick={onHome} className="rounded-full p-2 hover:bg-white/10">
                <Home size={16} />
              </button>
              <span className="text-xs opacity-50">正在播放</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onStyleOpenChange(true)}
                  className="rounded-full p-2 hover:bg-white/10"
                  title="歌词样式"
                >
                  <Palette size={16} />
                </button>
                <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={`flex gap-3 px-4 pb-3 ${isMobile ? '' : 'px-5'}`}>
              <div className={`overflow-hidden bg-zinc-800/30 shadow-inner ${isMobile ? 'h-16 w-16 shrink-0 rounded-xl' : 'h-20 w-20 shrink-0 rounded-2xl'}`}>
                <CoverArt src={coverUrl} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold" style={{ color: theme.primaryColor }}>
                  {track?.title || '未播放'}
                </div>
                <div className="mt-1 truncate text-sm opacity-55">{track?.author}</div>
                <div className={`mt-2 flex items-center justify-between ${isMobile ? '' : 'max-w-xs'}`}>
                  <button type="button" onClick={onPrev} className="rounded-full p-2 hover:bg-white/10">
                    <SkipBack size={18} />
                  </button>
                  <button type="button" onClick={onDownloadSong} className="rounded-full p-2 hover:bg-white/10" title="下载歌曲">
                    <Download size={18} />
                  </button>
                  <button type="button" onClick={onDownloadLrc} className="rounded-full p-2 text-xs hover:bg-white/10" title="下载歌词">
                    词
                  </button>
                  <button type="button" onClick={onNext} className="rounded-full p-2 hover:bg-white/10">
                    <SkipForward size={18} />
                  </button>
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
                <div ref={lyricScrollRef} className="h-full overflow-y-auto px-4 py-3">
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
                          {line.fullText || line.words.map((w) => w.text).join('')}
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
                <div className="h-full overflow-y-auto">
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
              isDaylight={isDaylight}
              onClose={() => onStyleOpenChange(false)}
              onChange={(mode) => {
                onVisualizerModeChange(mode);
                onStyleOpenChange(false);
              }}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SidePanel;
