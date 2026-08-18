import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CircleHelp, Cloud, Hexagon, LayoutGrid, List, Music2, Palette, RefreshCw, Search, SunMoon, UserRound } from 'lucide-react';
import { AlbumWaterfall, type AlbumWaterfallItem } from './AlbumWaterfall';
import ThemeAccentPicker from './ThemeAccentPicker';
import type { HomeTab, LibraryLayoutMode, ThemeTokens } from '../types';
import { coverRefreshUrl } from '../api';
import type { CloudPlaylist } from '../api';
import type { LibraryEntry } from '../store/libraryStore';
import type { AccountStatus } from '../api';
import type { LegalTab } from '../legal';

interface HomeViewProps {
  theme: ThemeTokens;
  isDaylight: boolean;
  homeTab: HomeTab;
  layoutMode: LibraryLayoutMode;
  neteasePlaylists: CloudPlaylist[];
  qqPlaylists: CloudPlaylist[];
  neteaseOpen: CloudPlaylist | null;
  qqOpen: CloudPlaylist | null;
  neteaseTracks: LibraryEntry[];
  qqTracks: LibraryEntry[];
  cloudLoading: boolean;
  cloudSyncing: boolean;
  cloudError: string;
  hasCurrentTrack: boolean;
  searchQuery: string;
  updateAvailable?: boolean;
  onSearchQueryChange: (query: string) => void;
  onOpenSearch: (submit?: boolean) => void;
  onHomeTabChange: (tab: HomeTab) => void;
  onLayoutModeChange: (mode: LibraryLayoutMode) => void;
  onSelectEntry: (entry: LibraryEntry, queue: LibraryEntry[]) => void;
  onOpenPlaylist: (playlist: CloudPlaylist) => void;
  onBackPlaylist: () => void;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onOpenLegal: (tab: LegalTab) => void;
  onCheckUpdate: () => void;
  netease: AccountStatus | null;
  qq: AccountStatus | null;
}

const TABS: { id: HomeTab; label: string; icon: React.ReactNode }[] = [
  { id: 'netease', label: '网易云', icon: <Cloud size={14} /> },
  { id: 'qq', label: 'QQ', icon: <Music2 size={14} /> },
];

const LAYOUT_MODES: { id: LibraryLayoutMode; label: string; icon: React.ReactNode }[] = [
  { id: 'honeycomb', label: '蜂窝', icon: <Hexagon size={13} /> },
  { id: 'square', label: '方形', icon: <LayoutGrid size={13} /> },
  { id: 'list', label: '列表', icon: <List size={13} /> },
];

function httpsUrl(url?: string) {
  if (!url) return undefined;
  return url.replace(/^http:\/\//i, 'https://');
}

const HomeView: React.FC<HomeViewProps> = ({
  theme,
  isDaylight,
  homeTab,
  layoutMode,
  neteasePlaylists,
  qqPlaylists,
  neteaseOpen,
  qqOpen,
  neteaseTracks,
  qqTracks,
  cloudLoading,
  cloudSyncing,
  cloudError,
  hasCurrentTrack,
  searchQuery,
  updateAvailable = false,
  onSearchQueryChange,
  onOpenSearch,
  onHomeTabChange,
  onLayoutModeChange,
  onSelectEntry,
  onOpenPlaylist,
  onBackPlaylist,
  onToggleTheme,
  onOpenAccount,
  onOpenLegal,
  onCheckUpdate,
  netease,
  qq,
}) => {
  const [accentOpen, setAccentOpen] = useState(false);
  const openPlaylist = homeTab === 'netease' ? neteaseOpen : qqOpen;
  const cloudPlaylists = homeTab === 'netease' ? neteasePlaylists : qqPlaylists;
  const cloudTracks = homeTab === 'netease' ? neteaseTracks : qqTracks;
  const loggedIn = homeTab === 'netease' ? Boolean(netease?.loggedIn) : Boolean(qq?.loggedIn);
  const showingPlaylists = !openPlaylist;
  const showingCloudTracks = Boolean(openPlaylist);

  const items: AlbumWaterfallItem[] = useMemo(() => {
    if (showingPlaylists) {
      return cloudPlaylists.map((item) => ({
        id: `pl-${item.id}`,
        name: item.name,
        description: `${item.trackCount || 0} 首${item.subscribed ? ' · 收藏' : ''}`,
        coverUrl: httpsUrl(item.cover),
      }));
    }
    return cloudTracks.map((item) => ({
      id: `${item.type}-${item.songid}`,
      name: item.title,
      description: `${item.author} · ${item.type === 'qq' ? 'QQ' : '网易云'}`,
      coverUrl: coverRefreshUrl(item.type, item.songid),
    }));
  }, [cloudPlaylists, cloudTracks, showingPlaylists]);

  const navPillBg = isDaylight ? 'bg-black/5' : 'bg-white/8';
  const inputBg = isDaylight ? 'bg-black/[0.04]' : 'bg-white/[0.06]';
  const emptyCopy = !loggedIn
    ? '登录后即可同步账号歌单'
    : cloudSyncing || cloudLoading
      ? '正在同步歌单…'
      : cloudError || (showingPlaylists ? '还没有歌单，打开登录面板可重新同步' : '这个歌单是空的');

  const tabPills = (
    <div className={`relative rounded-full p-1 backdrop-blur-md ${navPillBg}`}>
      <div className="inline-flex items-center">
        {TABS.map((tab) => {
          const active = homeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onHomeTabChange(tab.id)}
              className="relative inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-medium md:px-4 md:text-sm"
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
        onClick={onOpenAccount}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title={netease?.loggedIn || qq?.loggedIn ? "账号与同步" : "登录网易云 / QQ"}
      >
        <UserRound size={16} className="shrink-0" />
        <span className="hidden sm:inline">
          {netease?.loggedIn && qq?.loggedIn
            ? '已登录'
            : netease?.loggedIn
              ? '网易云'
              : qq?.loggedIn
                ? 'QQ'
                : '登录'}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleTheme}
        className={`rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="切换日夜主题"
      >
        <SunMoon size={16} />
      </button>
      <button
        type="button"
        onClick={() => setAccentOpen(true)}
        className={`rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="主题色"
        aria-label="主题色"
      >
        <Palette size={16} style={{ color: 'var(--text-accent)' }} />
      </button>
      <button
        type="button"
        onClick={onCheckUpdate}
        className={`relative rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="检查更新"
        aria-label="检查更新"
      >
        <RefreshCw size={16} />
        {updateAvailable ? (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onOpenLegal('help')}
        className={`rounded-full p-2 ${isDaylight ? 'bg-black/5' : 'bg-white/10'}`}
        title="使用帮助"
        aria-label="使用帮助"
      >
        <CircleHelp size={16} />
      </button>
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
            <div className="ml-auto flex items-center gap-2 md:hidden">{themeButtons}</div>
          </div>

          <div className="order-3 flex justify-center overflow-x-auto md:order-none">{tabPills}</div>

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
                placeholder="搜索歌曲"
                className={`w-full rounded-full border border-white/10 py-2.5 pr-4 pl-10 text-base outline-none md:py-2 md:text-sm ${inputBg}`}
              />
            </form>
            <div className="hidden items-center gap-2 md:flex">{themeButtons}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {openPlaylist ? (
            <button
              type="button"
              onClick={onBackPlaylist}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}
            >
              <ArrowLeft size={12} />
              返回歌单
            </button>
          ) : null}
          <span className="truncate text-[11px] opacity-60">
            {openPlaylist
              ? openPlaylist.name
              : loggedIn
                ? `${cloudPlaylists.length} 个歌单`
                : '未登录'}
          </span>
          <div className={`ml-auto inline-flex items-center gap-0.5 rounded-full p-0.5 ${isDaylight ? 'bg-black/5' : 'bg-white/8'}`}>
            {LAYOUT_MODES.map((mode) => {
              const active = layoutMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.label}
                  aria-label={mode.label}
                  aria-pressed={active}
                  onClick={() => onLayoutModeChange(mode.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
                    active
                      ? (isDaylight ? 'bg-white text-black shadow-sm' : 'bg-white/18 text-white')
                      : 'opacity-55 hover:opacity-90'
                  }`}
                >
                  {mode.icon}
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AlbumWaterfall
        key={layoutMode}
        items={items}
        onSelect={(item, index) => {
          if (showingPlaylists) {
            const playlistItem = cloudPlaylists.find((entry) => `pl-${entry.id}` === item.id)
              || cloudPlaylists[index];
            if (playlistItem) onOpenPlaylist(playlistItem);
            return;
          }
          const entry = cloudTracks.find((row) => `${row.type}-${row.songid}` === item.id) || cloudTracks[index];
          if (entry) onSelectEntry(entry, cloudTracks);
        }}
        isDaylight={isDaylight}
        isLoading={cloudSyncing || cloudLoading}
        emptyMessage={emptyCopy}
        hasFloatingPlayer={hasCurrentTrack}
        layoutMode={layoutMode}
      />

      <ThemeAccentPicker
        open={accentOpen}
        isDaylight={isDaylight}
        onClose={() => setAccentOpen(false)}
      />
    </div>
  );
};

export default HomeView;
