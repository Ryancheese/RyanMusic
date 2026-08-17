import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Heart, Home, ListMusic, SkipBack, SkipForward, X } from 'lucide-react';
import type { ThemeTokens, Track } from '../types';
import { useIsMobile } from '../lib/media';

interface SidePanelProps {
  open: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  track: Track | null;
  queue: Track[];
  index: number;
  liked: boolean;
  onClose: () => void;
  onHome: () => void;
  onLike: () => void;
  onDownloadSong: () => void;
  onDownloadLrc: () => void;
  onPlayIndex: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  open,
  isDaylight,
  theme,
  track,
  queue,
  index,
  liked,
  onClose,
  onHome,
  onLike,
  onDownloadSong,
  onDownloadLrc,
  onPlayIndex,
  onPrev,
  onNext,
}) => {
  const isMobile = useIsMobile();

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
                ? 'inset-x-0 bottom-0 h-[min(72dvh,calc(100%-4rem))] rounded-t-3xl'
                : 'top-6 right-4 w-[min(360px,calc(100vw-2rem))] rounded-3xl'
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
              <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            <div className={isMobile ? 'flex gap-3 px-4 pb-3' : 'px-5 pb-4'}>
              <div className={`overflow-hidden bg-zinc-800/30 shadow-inner ${isMobile ? 'h-16 w-16 shrink-0 rounded-xl' : 'rounded-2xl'}`}>
                {track?.pic ? (
                  <img src={track.pic} alt="" className={isMobile ? 'h-full w-full object-cover' : 'aspect-square w-full object-cover'} />
                ) : (
                  <div className={`flex items-center justify-center opacity-30 ${isMobile ? 'h-full w-full' : 'aspect-square'}`}>
                    <ListMusic size={isMobile ? 22 : 48} />
                  </div>
                )}
              </div>
              <div className={isMobile ? 'min-w-0 flex-1' : 'mt-4'}>
                <div className="truncate text-lg font-semibold" style={{ color: theme.primaryColor }}>
                  {track?.title || '未播放'}
                </div>
                <div className="mt-1 truncate text-sm opacity-55">{track?.author}</div>
                <div className={`flex items-center ${isMobile ? 'mt-1 justify-between' : 'mt-4 justify-between'}`}>
                  <button type="button" onClick={onPrev} className="rounded-full p-2 hover:bg-white/10">
                    <SkipBack size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={onLike}
                    className={`rounded-full p-2 ${liked ? 'text-rose-400' : 'hover:bg-white/10'}`}
                  >
                    <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
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
            <div className={`min-h-0 flex-1 overflow-y-auto border-t ${isDaylight ? 'border-black/10' : 'border-white/10'} ${isMobile ? '' : 'max-h-64'}`}>
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SidePanel;
