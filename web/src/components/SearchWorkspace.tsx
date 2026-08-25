import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Clock3, Play, Plus, Search, X } from 'lucide-react';
import type {
  MusicSource,
  SearchAlbumHit,
  SearchArtistHit,
  SearchBundle,
  SearchCategory,
  SearchPlaylistHit,
  ThemeTokens,
  Track,
} from '../types';
import { useSearchHistoryStore } from '../store/searchHistoryStore';
import { isWindowsApp } from '../lib/media';
import CoverArt from './CoverArt';
import DelistedCoverBadge from './DelistedCoverBadge';
import RyanLoader from './RyanLoader';

interface SearchWorkspaceProps {
  open: boolean;
  query: string;
  source: MusicSource;
  category: SearchCategory;
  isDaylight: boolean;
  theme: ThemeTokens;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string;
  bundle: SearchBundle | null;
  tracks: Track[];
  playlists: SearchPlaylistHit[];
  albums: SearchAlbumHit[];
  artists: SearchArtistHit[];
  hasMore: boolean;
  onQueryChange: (query: string) => void;
  onSourceChange: (source: MusicSource) => void;
  onCategoryChange: (category: SearchCategory) => void;
  onSubmit: () => void;
  onClose: () => void;
  onPlay: (track: Track, index: number) => void;
  onPrefetch?: (track: Track) => void;
  onAddQueue: (track: Track) => void;
  onLoadMore: () => void;
  onHistorySelect: (query: string, source: MusicSource) => void;
  onOpenPlaylist: (playlist: SearchPlaylistHit) => void;
  onOpenAlbum: (album: SearchAlbumHit) => void;
  onOpenArtist: (artist: SearchArtistHit) => void;
}

const sources: { id: MusicSource; label: string }[] = [
  { id: 'netease', label: '网易云' },
  { id: 'qq', label: 'QQ 音乐' },
];

const categories: { id: SearchCategory; label: string }[] = [
  { id: 'all', label: '综合' },
  { id: 'song', label: '单曲' },
  { id: 'playlist', label: '歌单' },
  { id: 'album', label: '专辑' },
  { id: 'artist', label: '歌手' },
];

function sourceLabel(type: MusicSource) {
  return type === 'qq' ? 'QQ' : '网易云';
}

function hasSearchResults(
  category: SearchCategory,
  bundle: SearchBundle | null,
  tracks: Track[],
  playlists: SearchPlaylistHit[],
  albums: SearchAlbumHit[],
  artists: SearchArtistHit[],
) {
  if (category === 'all') {
    return Boolean(
      bundle?.songs.length
      || bundle?.playlists.length
      || bundle?.albums.length
      || bundle?.artists.length,
    );
  }
  if (category === 'song') return tracks.length > 0;
  if (category === 'playlist') return playlists.length > 0;
  if (category === 'album') return albums.length > 0;
  return artists.length > 0;
}

const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  open,
  query,
  source,
  category,
  isDaylight,
  theme,
  isSearching,
  isLoadingMore,
  error,
  bundle,
  tracks,
  playlists,
  albums,
  artists,
  hasMore,
  onQueryChange,
  onSourceChange,
  onCategoryChange,
  onSubmit,
  onClose,
  onPlay,
  onPrefetch,
  onAddQueue,
  onLoadMore,
  onHistorySelect,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const history = useSearchHistoryStore((state) => state.items);
  const clearHistory = useSearchHistoryStore((state) => state.clear);
  const removeHistory = useSearchHistoryStore((state) => state.remove);
  const showHistory = !query.trim() && !isSearching && history.length > 0;
  const windowsChrome = isWindowsApp();
  const hasResults = hasSearchResults(category, bundle, tracks, playlists, albums, artists);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onQueryChange('');
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onQueryChange]);

  const cardClass = `group flex items-center gap-3 rounded-2xl border px-3 transition-colors ${
    isDaylight
      ? 'border-black/[0.05] bg-black/[0.035] hover:bg-black/[0.07]'
      : 'border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08]'
  }`;

  const sectionTitleClass = 'mb-2 px-2 text-xs font-semibold tracking-wide opacity-45';

  const renderSongRow = (track: Track, index: number, list: Track[]) => (
    <div key={`${track.type}-${track.songid}-${index}`} className="px-2 py-1.5">
      <div className={`${cardClass} h-[68px]`}>
        <button
          type="button"
          onPointerDown={() => onPrefetch?.(track)}
          onClick={() => onPlay(track, list.indexOf(track))}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-500/15"
        >
          <CoverArt src={track.pic} />
          {track.delisted ? <DelistedCoverBadge /> : null}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Play size={18} fill="currentColor" />
          </span>
        </button>
        <button
          type="button"
          onPointerDown={() => onPrefetch?.(track)}
          onClick={() => onPlay(track, list.indexOf(track))}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm font-semibold">
            {track.title}
            {track.delisted ? (
              <span className="ml-1.5 inline-flex align-middle text-[10px] font-medium text-orange-600/90 dark:text-orange-300/90">
                下架
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            {track.author}
            <span className="mx-1 opacity-40">•</span>
            {sourceLabel(track.type)}
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
  );

  const renderPlaylistRow = (playlist: SearchPlaylistHit) => (
    <div key={`${playlist.type}-${playlist.id}`} className="px-2 py-1.5">
      <button
        type="button"
        onClick={() => onOpenPlaylist(playlist)}
        className={`${cardClass} h-[72px] w-full text-left`}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-500/15">
          <CoverArt src={playlist.cover} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{playlist.name}</div>
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            {playlist.creator || '未知创建者'}
            {playlist.trackCount ? (
              <>
                <span className="mx-1 opacity-40">•</span>
                {playlist.trackCount} 首
              </>
            ) : null}
            <span className="mx-1 opacity-40">•</span>
            {sourceLabel(playlist.type)}
          </div>
        </div>
      </button>
    </div>
  );

  const renderAlbumRow = (album: SearchAlbumHit) => (
    <div key={`${album.type}-${album.id}`} className="px-2 py-1.5">
      <button
        type="button"
        onClick={() => onOpenAlbum(album)}
        className={`${cardClass} h-[72px] w-full text-left`}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-500/15">
          <CoverArt src={album.cover} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{album.name}</div>
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            {album.artist || '未知艺人'}
            <span className="mx-1 opacity-40">•</span>
            {sourceLabel(album.type)}
          </div>
        </div>
      </button>
    </div>
  );

  const renderArtistRow = (artist: SearchArtistHit) => (
    <div key={`${artist.type}-${artist.id}`} className="px-2 py-1.5">
      <button
        type="button"
        onClick={() => onOpenArtist(artist)}
        className={`${cardClass} h-[72px] w-full text-left`}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-500/15">
          <CoverArt src={artist.cover} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{artist.name}</div>
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            歌手
            <span className="mx-1 opacity-40">•</span>
            {sourceLabel(artist.type)}
          </div>
        </div>
      </button>
    </div>
  );

  const renderAllResults = () => {
    if (!bundle) return null;
    return (
      <div className="pb-[max(6rem,calc(var(--safe-bottom)+4rem))]">
        {bundle.songs.length > 0 ? (
          <section className="mb-4">
            <div className={sectionTitleClass}>单曲</div>
            {bundle.songs.map((track, index) => renderSongRow(track, index, bundle.songs))}
          </section>
        ) : null}
        {bundle.playlists.length > 0 ? (
          <section className="mb-4">
            <div className={sectionTitleClass}>歌单</div>
            {bundle.playlists.map(renderPlaylistRow)}
          </section>
        ) : null}
        {bundle.albums.length > 0 ? (
          <section className="mb-4">
            <div className={sectionTitleClass}>专辑</div>
            {bundle.albums.map(renderAlbumRow)}
          </section>
        ) : null}
        {bundle.artists.length > 0 ? (
          <section className="mb-4">
            <div className={sectionTitleClass}>歌手</div>
            {bundle.artists.map(renderArtistRow)}
          </section>
        ) : null}
        {isLoadingMore ? (
          <div className="flex justify-center py-4">
            <RyanLoader size={28} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderCategoryResults = () => (
    <div className="pb-[max(6rem,calc(var(--safe-bottom)+4rem))]">
      {category === 'song' ? tracks.map((track, index) => renderSongRow(track, index, tracks)) : null}
      {category === 'playlist' ? playlists.map(renderPlaylistRow) : null}
      {category === 'album' ? albums.map(renderAlbumRow) : null}
      {category === 'artist' ? artists.map(renderArtistRow) : null}
      {isLoadingMore ? (
        <div className="flex justify-center py-4">
          <RyanLoader size={28} />
        </div>
      ) : null}
    </div>
  );

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
            backgroundColor: isDaylight ? 'rgba(250,250,250,0.96)' : 'rgba(8,8,10,0.94)',
            backdropFilter: 'blur(24px)',
            paddingTop: windowsChrome ? 'max(2.75rem, var(--safe-top))' : 'max(1rem, var(--safe-top))',
            paddingRight: windowsChrome ? '11.75rem' : undefined,
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
                  placeholder="搜索歌曲、歌单、专辑、歌手"
                  className="ryan-allow-select w-full bg-transparent py-3.5 pr-4 pl-11 text-base outline-none md:text-sm"
                  autoFocus
                />
              </form>
              <button
                type="button"
                onClick={() => {
                  onQueryChange('');
                  onClose();
                }}
                className={`rounded-full p-3 ${isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/15'}`}
                aria-label="关闭搜索"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1">
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
                      ? { backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }
                      : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onCategoryChange(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                    item.id === category
                      ? 'shadow-sm'
                      : isDaylight
                        ? 'bg-black/5 text-black/60 hover:bg-black/10'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                  style={
                    item.id === category
                      ? { backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }
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
            className="mx-auto mt-3 min-h-0 w-full max-w-5xl flex-1 overflow-y-auto"
            onScroll={() => {
              const el = listRef.current;
              if (!el || !hasMore || isLoadingMore || isSearching) return;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) onLoadMore();
            }}
          >
            {showHistory ? (
              <div className="px-1 pb-[max(6rem,calc(var(--safe-bottom)+4rem))] pt-2">
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium opacity-55">
                    <Clock3 size={13} />
                    搜索记录
                  </div>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[11px] opacity-45 transition hover:opacity-80"
                  >
                    清空
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {history.map((item) => (
                    <div
                      key={`${item.source}-${item.q}-${item.at}`}
                      className={`group flex items-center gap-2 rounded-2xl px-3 py-2.5 transition ${
                        isDaylight ? 'hover:bg-black/[0.05]' : 'hover:bg-white/[0.07]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onHistorySelect(item.q, item.source)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium">{item.q}</div>
                        <div className="mt-0.5 text-[11px] opacity-40">
                          {item.source === 'qq' ? 'QQ 音乐' : '网易云'}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="删除这条记录"
                        onClick={() => removeHistory(item.q, item.source)}
                        className={`rounded-full p-1.5 opacity-0 transition group-hover:opacity-60 hover:!opacity-100 ${
                          isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/12'
                        }`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : isSearching && !hasResults ? (
              <div className="flex h-full items-center justify-center">
                <RyanLoader size={64} label="搜索中…" />
              </div>
            ) : error && !hasResults ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-65">
                <AlertCircle size={32} />
                <p>{error}</p>
              </div>
            ) : !hasResults ? (
              <div className="flex h-full items-center justify-center text-sm opacity-50">输入关键词开始搜索</div>
            ) : category === 'all' ? (
              renderAllResults()
            ) : (
              renderCategoryResults()
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default SearchWorkspace;
