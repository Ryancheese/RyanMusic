import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Play, Plus, Search, X } from 'lucide-react';
import type { MusicSource, ThemeTokens, Track } from '../types';
import CoverArt from './CoverArt';
import RyanLoader from './RyanLoader';

interface SearchWorkspaceProps {
  open: boolean;
  query: string;
  source: MusicSource;
  isDaylight: boolean;
  theme: ThemeTokens;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string;
  tracks: Track[];
  hasMore: boolean;
  onQueryChange: (query: string) => void;
  onSourceChange: (source: MusicSource) => void;
  onSubmit: () => void;
  onClose: () => void;
  onPlay: (track: Track, index: number) => void;
  onAddQueue: (track: Track) => void;
  onLoadMore: () => void;
}

const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  open,
  query,
  source,
  isDaylight,
  theme,
  isSearching,
  isLoadingMore,
  error,
  tracks,
  hasMore,
  onQueryChange,
  onSourceChange,
  onSubmit,
  onClose,
  onPlay,
  onAddQueue,
  onLoadMore,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const sources: { id: MusicSource; label: string }[] = [
    { id: 'netease', label: '网易云' },
    { id: 'qq', label: 'QQ 音乐' },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden px-3 sm:px-6"
          style={{
            color: theme.primaryColor,
            backgroundColor: isDaylight ? 'rgb(250, 250, 250)' : 'rgb(9, 9, 11)',
            paddingTop: 'max(1rem, var(--safe-top))',
            paddingBottom: 'max(1rem, var(--safe-bottom))',
          }}
        >
          <header className="mx-auto flex w-full max-w-5xl shrink-0 flex-col gap-3">
            <div className="flex items-center gap-3">
              <form
                className={`relative flex-1 rounded-2xl border ${
                  isDaylight ? 'border-black/10 bg-black/[0.04]' : 'border-white/10 bg-white/[0.05]'
                }`}
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit();
                }}
              >
                {isSearching ? (
                  <span className="absolute top-1/2 left-3.5 -translate-y-1/2">
                    <RyanLoader size={18} />
                  </span>
                ) : (
                  <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 opacity-45" />
                )}
                <input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="搜索歌曲、歌手，或粘贴网易云 / QQ 链接"
                  className="w-full bg-transparent py-3.5 pr-4 pl-11 text-base outline-none md:text-sm"
                  autoFocus
                />
              </form>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full p-3 ${isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15'}`}
                aria-label="关闭搜索"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="app-scroll-x hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              {sources.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onSourceChange(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                    item.id === source
                      ? 'shadow-sm'
                      : isDaylight
                        ? 'bg-black/5 text-black/60 hover:bg-black/10'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                  style={
                    item.id === source
                      ? { backgroundColor: theme.accentColor, color: theme.backgroundColor }
                      : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </header>

          <div
            ref={listRef}
            className="app-scroll hide-scrollbar mx-auto mt-3 min-h-0 w-full max-w-5xl flex-1 overflow-y-auto"
            onScroll={() => {
              const el = listRef.current;
              if (!el || !hasMore || isLoadingMore || isSearching) return;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) onLoadMore();
            }}
          >
            {isSearching && tracks.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <RyanLoader size={64} label="搜索中…" />
              </div>
            ) : error && tracks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-65">
                <AlertCircle size={32} />
                <p>{error}</p>
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm opacity-50">输入关键词开始搜索</div>
            ) : (
              <div className="pb-[max(6rem,calc(var(--safe-bottom)+4rem))]">
                {tracks.map((track, index) => (
                  <div key={`${track.type}-${track.songid}-${index}`} className="app-scroll-item px-2 py-1.5">
                    <div
                      className={`group flex h-[68px] items-center gap-3 rounded-2xl border px-3 transition-colors ${
                        isDaylight
                          ? 'border-black/[0.05] bg-black/[0.035] hover:bg-black/[0.07]'
                          : 'border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlay(track, index)}
                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-500/15"
                      >
                        <CoverArt src={track.pic} />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Play size={18} fill="currentColor" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlay(track, index)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-semibold">{track.title}</div>
                        <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {track.author}
                          <span className="mx-1 opacity-40">•</span>
                          {track.type === 'qq' ? 'QQ' : '网易云'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddQueue(track)}
                        className="shrink-0 rounded-full p-2 opacity-60 transition-all hover:bg-white/10 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="加入播放队列"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {isLoadingMore && (
                  <div className="flex justify-center py-4">
                    <RyanLoader size={28} />
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default SearchWorkspace;
