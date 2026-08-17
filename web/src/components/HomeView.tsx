import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Heart, ListMusic, Search, Settings, SunMoon } from 'lucide-react';
import { Grid3DSlider, type Grid3DSliderItem } from './Grid3DSlider';
import type { HomeTab, MusicSource, ThemeTokens } from '../types';
import { coverRefreshUrl } from '../api';
import type { LibraryEntry } from '../store/libraryStore';

interface HomeViewProps {
  theme: ThemeTokens;
  isDaylight: boolean;
  source: MusicSource;
  homeTab: HomeTab;
  channel: 'all' | MusicSource;
  liked: LibraryEntry[];
  recent: LibraryEntry[];
  playlist: LibraryEntry[];
  hasCurrentTrack: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onOpenSearch: (submit?: boolean) => void;
  onSourceChange: (source: MusicSource) => void;
  onHomeTabChange: (tab: HomeTab) => void;
  onChannelChange: (channel: 'all' | MusicSource) => void;
  onSelectEntry: (entry: LibraryEntry, queue: LibraryEntry[]) => void;
  onToggleTheme: () => void;
}

const TABS: { id: HomeTab; label: string; icon: React.ReactNode }[] = [
  { id: 'liked', label: '喜欢', icon: <Heart size={14} /> },
  { id: 'recent', label: '最近', icon: <Clock3 size={14} /> },
  { id: 'playlist', label: '播放列表', icon: <ListMusic size={14} /> },
];

const HomeView: React.FC<HomeViewProps> = ({
  theme,
  isDaylight,
  source,
  homeTab,
  channel,
  liked,
  recent,
  playlist,
  hasCurrentTrack,
  searchQuery,
  onSearchQueryChange,
  onOpenSearch,
  onSourceChange,
  onHomeTabChange,
  onChannelChange,
  onSelectEntry,
  onToggleTheme,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const lists: Record<HomeTab, LibraryEntry[]> = { liked, recent, playlist };
  const filtered = lists[homeTab].filter((item) => channel === 'all' || item.type === channel);
  const items: Grid3DSliderItem[] = useMemo(
    () =>
      filtered.map((item) => ({
        id: `${item.type}-${item.songid}`,
        name: item.title,
        description: `${item.author} · ${item.type === 'qq' ? 'QQ' : '网易云'}`,
        coverUrl: coverRefreshUrl(item.type, item.songid),
      })),
    [filtered],
  );

  const navPillBg = isDaylight ? 'bg-black/5' : 'bg-white/8';
  const inputBg = isDaylight ? 'bg-black/[0.04]' : 'bg-white/[0.06]';
  const emptyCopy =
    homeTab === 'liked' ? '还没有喜欢的歌曲，搜索后点红心即可收藏' : homeTab === 'recent' ? '播放过的歌曲会出现在这里' : '把歌曲加入播放列表后在这里浏览';

  const sourcePills = (
    <div className={`flex rounded-full p-1 ${navPillBg}`}>
      {(['netease', 'qq'] as MusicSource[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSourceChange(item)}
          className={`rounded-full px-3 py-1 text-xs ${source === item ? (isDaylight ? 'bg-white shadow-sm text-black' : 'bg-white text-black') : 'opacity-55'}`}
        >
          {item === 'netease' ? '网易云' : 'QQ'}
        </button>
      ))}
    </div>
  );

  const tabPills = (
    <div className={`relative rounded-full p-1 backdrop-blur-md ${navPillBg}`}>
      <div className="inline-flex items-center">
        {TABS.map((tab) => {
          const active = homeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFocusedIndex(0);
                onHomeTabChange(tab.id);
              }}
              className="relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium md:px-4 md:text-sm"
            >
              {active && (
                <motion.span
                  layoutId="home-active-tab-pill"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${active ? 'text-black' : 'opacity-60'}`}>
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const themeButtons = (
    <>
      <button
        type="button"
        onClick={onToggleTheme}
        className={`rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="切换日夜主题"
      >
        <SunMoon size={16} />
      </button>
      <a
        href="help.php"
        className={`rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="帮助"
      >
        <Settings size={16} />
      </a>
    </>
  );

  return (
    <div className="relative flex h-full w-full flex-col" style={{ color: theme.primaryColor }}>
      <div className="titlebar-drag pointer-events-none absolute inset-x-0 top-0 z-20 h-8" />
      <div
        className="relative z-10 px-4 pb-2 md:px-8"
        style={{ paddingTop: 'max(2.5rem, calc(var(--safe-top) + 0.75rem))' }}
      >
        <div className="titlebar-no-drag flex flex-col gap-3 md:grid md:grid-cols-3 md:items-center">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[11px] tracking-[0.35em] opacity-50">RYAN</div>
              <div className="text-lg font-semibold tracking-[0.18em]">MUSIC</div>
            </div>
            {sourcePills}
            <div className="ml-auto flex items-center gap-2 md:hidden">{themeButtons}</div>
          </div>

          <div className="order-3 flex justify-center md:order-none">{tabPills}</div>

          <div className="order-2 flex items-center gap-2 md:order-none md:justify-end">
            <form
              className="relative min-w-0 flex-1 md:w-56 md:flex-none md:focus-within:w-72"
              onSubmit={(event) => {
                event.preventDefault();
                onOpenSearch(true);
              }}
            >
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-40" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onFocus={() => onOpenSearch(false)}
                placeholder="搜索网易云 / QQ"
                className={`w-full rounded-full border border-white/10 py-2.5 pr-4 pl-10 text-base outline-none md:py-2 md:text-sm ${inputBg}`}
              />
            </form>
            <div className="hidden items-center gap-2 md:flex">{themeButtons}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {(['all', 'netease', 'qq'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setFocusedIndex(0);
                onChannelChange(item);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
                channel === item
                  ? isDaylight
                    ? 'bg-black text-white'
                    : 'bg-white text-black'
                  : isDaylight
                    ? 'bg-black/5 opacity-70'
                    : 'bg-white/8 opacity-70'
              }`}
            >
              {item === 'all' ? '全部' : item === 'netease' ? '网易云' : 'QQ'}
            </button>
          ))}
        </div>
      </div>

      <Grid3DSlider
        items={items}
        focusedIndex={focusedIndex}
        onFocusedIndexChange={setFocusedIndex}
        onSelect={(_, index) => {
          const entry = filtered[index];
          if (entry) onSelectEntry(entry, filtered);
        }}
        isDaylight={isDaylight}
        emptyMessage={emptyCopy}
        hasFloatingPlayer={hasCurrentTrack}
      />
    </div>
  );
};

export default HomeView;
