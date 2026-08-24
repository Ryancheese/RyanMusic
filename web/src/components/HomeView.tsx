import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, CircleHelp, Hexagon, LayoutGrid, List, LogOut, Palette, RefreshCw, Search, Settings, SunMoon, UserRound } from 'lucide-react';
import { AlbumWaterfall, type AlbumWaterfallItem } from './AlbumWaterfall';
import GlassChromeButton from './GlassChromeButton';
import type { HomeTab, LibraryCardStyle, LibraryLayoutMode, NeteaseLibrarySection, ThemeTokens } from '../types';
import { coverImageUrl, coverRefreshUrl, postAction } from '../api';
import type { CloudPlaylist, NeteaseRecommendItem } from '../api';
import type { LibraryEntry } from '../store/libraryStore';
import type { AccountStatus } from '../api';
import type { LegalTab } from '../legal';
import { chromeButtonStyle } from '../lib/controlGlass';
import { useControlAppearanceStore } from '../store/controlAppearanceStore';
import { useCloudStore } from '../store/cloudStore';
import {
  ACCOUNT_PROVIDERS,
  accountOf,
  capsuleDisplayName,
  platformStatusLine,
  providerMeta,
  type AccountProviderId,
} from '../lib/accountProviders';

const LIBRARY_SLIDE = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 48,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -36,
  }),
};

const LIBRARY_SLIDE_TRANSITION = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

interface HomeViewProps {
  theme: ThemeTokens;
  isDaylight: boolean;
  homeTab: HomeTab;
  neteaseLibrarySection: NeteaseLibrarySection;
  layoutMode: LibraryLayoutMode;
  cardStyle: LibraryCardStyle;
  neteasePlaylists: CloudPlaylist[];
  qqPlaylists: CloudPlaylist[];
  neteaseRecommendItems: NeteaseRecommendItem[];
  qqRecommendItems: NeteaseRecommendItem[];
  neteaseOpen: CloudPlaylist | null;
  qqOpen: CloudPlaylist | null;
  neteaseTracks: LibraryEntry[];
  qqTracks: LibraryEntry[];
  cloudLoading: boolean;
  cloudSyncing: boolean;
  recommendSyncing: boolean;
  cloudError: string;
  recommendError: string;
  hasCurrentTrack: boolean;
  searchQuery: string;
  updateAvailable?: boolean;
  onSearchQueryChange: (query: string) => void;
  onOpenSearch: (submit?: boolean) => void;
  onHomeTabChange: (tab: HomeTab) => void;
  onNeteaseLibrarySectionChange: (section: NeteaseLibrarySection) => void;
  onLayoutModeChange: (mode: LibraryLayoutMode) => void;
  onSelectEntry: (entry: LibraryEntry, queue: LibraryEntry[]) => void;
  onOpenPlaylist: (playlist: CloudPlaylist) => void;
  onOpenRecommend: (item: NeteaseRecommendItem) => void;
  onPlayPersonalFm: () => void;
  onBackPlaylist: () => void;
  onToggleTheme: () => void;
  onOpenAccount: (provider?: AccountProviderId) => void;
  onAccountsChanged: () => void;
  onOpenLegal: (tab: LegalTab) => void;
  onCheckUpdate: () => void;
  onOpenAccentPicker: () => void;
  onOpenSettings: () => void;
  netease: AccountStatus | null;
  qq: AccountStatus | null;
  kugou?: AccountStatus | null;
}

const NETEASE_LIBRARY_SECTIONS: { id: NeteaseLibrarySection; label: string }[] = [
  { id: 'playlists', label: '歌单' },
  { id: 'recommend', label: '推荐' },
];

const LAYOUT_MODES: { id: LibraryLayoutMode; label: string; icon: React.ReactNode }[] = [
  { id: 'honeycomb', label: '蜂窝', icon: <Hexagon size={13} /> },
  { id: 'square', label: '方形', icon: <LayoutGrid size={13} /> },
  { id: 'list', label: '列表', icon: <List size={13} /> },
];

const HomeView: React.FC<HomeViewProps> = ({
  theme,
  isDaylight,
  homeTab,
  neteaseLibrarySection,
  layoutMode,
  cardStyle,
  neteasePlaylists,
  qqPlaylists,
  neteaseRecommendItems,
  qqRecommendItems,
  neteaseOpen,
  qqOpen,
  neteaseTracks,
  qqTracks,
  cloudLoading,
  cloudSyncing,
  recommendSyncing,
  cloudError,
  recommendError,
  hasCurrentTrack,
  searchQuery,
  updateAvailable = false,
  onSearchQueryChange,
  onOpenSearch,
  onHomeTabChange,
  onNeteaseLibrarySectionChange,
  onLayoutModeChange,
  onSelectEntry,
  onOpenPlaylist,
  onOpenRecommend,
  onPlayPersonalFm,
  onBackPlaylist,
  onToggleTheme,
  onOpenAccount,
  onAccountsChanged,
  onOpenLegal,
  onCheckUpdate,
  onOpenAccentPicker,
  onOpenSettings,
  netease,
  qq,
  kugou = null,
}) => {
  const [tabDir, setTabDir] = useState(1);
  const [sectionDir, setSectionDir] = useState(1);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const glassOpacity = useControlAppearanceStore((state) => state.opacity);
  const glassBlur = useControlAppearanceStore((state) => state.blur);
  const openPlaylist = homeTab === 'netease' ? neteaseOpen : qqOpen;
  const cloudPlaylists = homeTab === 'netease' ? neteasePlaylists : qqPlaylists;
  const cloudTracks = homeTab === 'netease' ? neteaseTracks : qqTracks;
  const activeRecommendItems = homeTab === 'netease' ? neteaseRecommendItems : qqRecommendItems;
  const librarySection = neteaseLibrarySection;
  const browsingRecommend = librarySection === 'recommend' && !openPlaylist;
  const loggedIn = homeTab === 'netease' ? Boolean(netease?.loggedIn) : Boolean(qq?.loggedIn);
  const activeAccount = homeTab === 'qq' ? qq : netease;
  const activeAvatar = activeAccount?.loggedIn && activeAccount.avatar
    ? (coverImageUrl(activeAccount.avatar, 72) || activeAccount.avatar)
    : '';
  const platformLabel = !activeAccount?.loggedIn
    ? '登录'
    : homeTab === 'qq'
      ? 'QQ'
      : '网易云';
  const ownerLabel = activeAccount?.nickname?.trim() || '';
  const capsuleLabel = capsuleDisplayName(activeAccount, platformLabel);
  const activeMeta = providerMeta(homeTab);

  const switchHomeTab = (next: HomeTab) => {
    if (next === homeTab) return;
    setTabDir(next === 'qq' ? 1 : -1);
    onHomeTabChange(next);
  };

  const switchLibrarySection = (next: NeteaseLibrarySection) => {
    if (next === neteaseLibrarySection) return;
    setSectionDir(next === 'recommend' ? 1 : -1);
    onNeteaseLibrarySectionChange(next);
  };

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  const logoutProvider = async (provider: AccountProviderId) => {
    const meta = providerMeta(provider);
    if (provider === 'netease' || provider === 'qq') {
      useCloudStore.getState().clearProvider(provider);
    }
    onAccountsChanged();
    await postAction(meta.logoutAction);
    onAccountsChanged();
  };

  const playlistItems: AlbumWaterfallItem[] = useMemo(() => (
    cloudPlaylists.map((item) => ({
      id: `pl-${item.id}`,
      name: item.name,
      description: ownerLabel
        ? (item.subscribed
          ? `${ownerLabel} · 收藏`
          : `${ownerLabel}${item.trackCount ? ` · ${item.trackCount} 首` : ''}`)
        : `${item.trackCount || 0} 首${item.subscribed ? ' · 收藏' : ''}`,
      coverUrl: coverImageUrl(item.cover, 400),
    }))
  ), [cloudPlaylists, ownerLabel]);

  const recommendItems: AlbumWaterfallItem[] = useMemo(() => (
    activeRecommendItems.map((item) => ({
      id: `rc-${item.id}`,
      name: item.name,
      description: item.description
        || (item.recommendKind === 'daily'
          ? '根据你的口味生成，每天更新'
          : item.recommendKind === 'fm'
            ? '无限私人电台'
            : `${item.trackCount || 0} 首`),
      coverUrl: coverImageUrl(item.cover, 400),
    }))
  ), [activeRecommendItems]);

  const trackItems: AlbumWaterfallItem[] = useMemo(() => (
    cloudTracks.map((item) => ({
      id: `${item.type}-${item.songid}`,
      name: item.title,
      description: item.author || '',
      coverUrl: coverRefreshUrl(item.type, item.songid),
      delisted: item.delisted,
    }))
  ), [cloudTracks]);

  const inputBg = isDaylight ? 'bg-black/[0.04]' : 'bg-white/[0.06]';
  const layoutRailStyle = chromeButtonStyle(glassOpacity, glassBlur);
  const syncCopy = cloudSyncing || cloudLoading || recommendSyncing ? '正在同步…' : '';
  const playlistEmptyCopy = !loggedIn
    ? '登录后即可同步账号歌单'
    : syncCopy || cloudError || '还没有歌单，打开登录面板可重新同步';
  const recommendEmptyCopy = !loggedIn
    ? '登录后即可查看每日推荐与私人 FM'
    : syncCopy || recommendError || '暂无推荐内容';
  const trackEmptyCopy = syncCopy || cloudError || recommendError || '这个歌单是空的';
  const listSummary = openPlaylist
    ? openPlaylist.name
    : browsingRecommend
      ? `${activeRecommendItems.length} 个推荐`
      : loggedIn
        ? `${cloudPlaylists.length} 个歌单`
        : '未登录';

  const themeButtons = (
    <>
      <div className="relative" ref={accountMenuRef}>
        <GlassChromeButton
          size="pill"
          onClick={() => setAccountMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setAccountMenuOpen((open) => !open);
          }}
          title="切换平台或打开账号"
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          className="h-10 min-w-[8.5rem] gap-2 overflow-hidden px-3.5 text-xs sm:min-w-[10rem]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`${homeTab}-${activeAvatar || 'none'}-${capsuleLabel}`}
              className="inline-flex h-full w-full items-center gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeAvatar ? (
                <img
                  src={activeAvatar}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-black/10"
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                    const sibling = event.currentTarget.nextElementSibling as HTMLElement | null;
                    if (sibling) sibling.hidden = false;
                  }}
                />
              ) : null}
              <span
                hidden={Boolean(activeAvatar)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  activeAccount?.loggedIn
                    ? activeMeta.markClass
                    : (isDaylight ? 'bg-black/5' : 'bg-white/10')
                }`}
              >
                {activeAccount?.loggedIn ? activeMeta.mark : <UserRound size={14} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium tracking-wide">
                {capsuleLabel}
              </span>
              <motion.span
                animate={{ rotate: accountMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 opacity-45"
              >
                <ChevronDown size={14} />
              </motion.span>
            </motion.span>
          </AnimatePresence>
        </GlassChromeButton>

        <AnimatePresence>
          {accountMenuOpen ? (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute top-[calc(100%+0.45rem)] right-0 z-40 w-[15.5rem] overflow-hidden rounded-2xl border border-white/10 p-1.5 shadow-2xl ${
                isDaylight ? 'bg-white text-black' : 'bg-zinc-900 text-white'
              }`}
            >
              {ACCOUNT_PROVIDERS.map((provider) => {
                const account = accountOf(provider.id, netease, qq, kugou);
                const active = provider.hasCloudLibrary && homeTab === provider.id;
                const avatar = account?.loggedIn && account.avatar
                  ? (coverImageUrl(account.avatar, 72) || account.avatar)
                  : '';
                const rowName = capsuleDisplayName(account, provider.shortLabel);
                return (
                  <div
                    key={provider.id}
                    className={`flex h-12 items-center gap-1 rounded-xl px-1.5 ${
                      active
                        ? (isDaylight ? 'bg-black/5' : 'bg-white/8')
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        if (provider.hasCloudLibrary && (provider.id === 'netease' || provider.id === 'qq')) {
                          if (account?.loggedIn) {
                            switchHomeTab(provider.id);
                          } else {
                            onHomeTabChange(provider.id);
                            onOpenAccount(provider.id);
                          }
                          return;
                        }
                        onOpenAccount(provider.id);
                      }}
                      className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 text-left"
                    >
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.hidden = false;
                          }}
                        />
                      ) : null}
                      <span
                        hidden={Boolean(avatar)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${provider.markClass}`}
                      >
                        {provider.mark}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium leading-tight">{rowName}</span>
                        <span className="mt-0.5 block truncate text-[10px] leading-tight opacity-50">
                          {account?.loggedIn ? provider.label : platformStatusLine(account)}
                        </span>
                      </span>
                    </button>
                    {account?.loggedIn ? (
                      <button
                        type="button"
                        title={`退出 ${provider.label}`}
                        aria-label={`退出 ${provider.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void logoutProvider(provider.id);
                        }}
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-55 transition hover:opacity-100 ${
                          isDaylight ? 'bg-black/5' : 'bg-white/8'
                        }`}
                      >
                        <LogOut size={13} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountMenuOpen(false);
                  onOpenAccount();
                }}
                className={`mt-1 flex h-10 w-full items-center justify-center rounded-xl px-3 text-[11px] font-medium opacity-70 transition hover:opacity-100 ${
                  isDaylight ? 'bg-black/4' : 'bg-white/6'
                }`}
              >
                账号与同步
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <GlassChromeButton size="sm" onClick={onToggleTheme} title="切换日夜主题" aria-label="切换日夜主题">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDaylight ? 'day' : 'night'}
            className="inline-flex"
            initial={{ rotate: -80, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 80, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <SunMoon size={16} />
          </motion.span>
        </AnimatePresence>
      </GlassChromeButton>
      <GlassChromeButton size="sm" onClick={onOpenSettings} title="设置" aria-label="设置">
        <Settings size={16} />
      </GlassChromeButton>
      <GlassChromeButton size="sm" onClick={onOpenAccentPicker} title="主题色" aria-label="主题色">
        <Palette size={16} style={{ color: 'var(--text-accent)' }} />
      </GlassChromeButton>
      <GlassChromeButton size="sm" onClick={onCheckUpdate} title="检查更新" aria-label="检查更新" className="relative">
        <RefreshCw size={16} />
        {updateAvailable ? (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
        ) : null}
      </GlassChromeButton>
      <GlassChromeButton size="sm" onClick={() => onOpenLegal('help')} title="使用帮助" aria-label="使用帮助">
        <CircleHelp size={16} />
      </GlassChromeButton>
    </>
  );

  return (
    <div
      className="app-theme-surface relative flex h-full w-full flex-col"
      style={{ color: theme.primaryColor }}
    >
      <div className="titlebar-drag pointer-events-none absolute inset-x-0 top-0 z-20 h-8" />
      <div
        className="relative z-10 px-4 pb-2 md:px-8"
        style={{ paddingTop: 'max(2.5rem, calc(var(--safe-top) + 0.75rem))' }}
      >
        <div className="titlebar-no-drag flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="shrink-0">
              <div className="text-[11px] tracking-[0.35em] opacity-50">RYAN</div>
              <div className="text-lg font-semibold tracking-[0.18em]">MUSIC</div>
            </div>
            {loggedIn ? (
              <div
                className="mx-auto inline-flex items-center gap-0.5 rounded-full p-0.5 md:mx-0"
                style={layoutRailStyle}
              >
                <LayoutGroup id="home-netease-section-tabs">
                  {NETEASE_LIBRARY_SECTIONS.map((section) => {
                    const active = librarySection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => switchLibrarySection(section.id)}
                        className="relative rounded-full px-3.5 py-1.5 text-[11px] transition sm:text-xs"
                      >
                        {active ? (
                          <motion.span
                            layoutId="home-active-netease-section-pill"
                            className={`absolute inset-0 rounded-full shadow-sm ${
                              isDaylight ? 'bg-white/90' : 'bg-white/20'
                            }`}
                            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                          />
                        ) : null}
                        <span className={`relative z-10 ${
                          active ? (isDaylight ? 'text-black' : 'text-white') : 'opacity-55 hover:opacity-90'
                        }`}
                        >
                          {section.label}
                        </span>
                      </button>
                    );
                  })}
                </LayoutGroup>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-2 md:hidden">{themeButtons}</div>
          </div>

          <div className="flex items-center gap-2 md:justify-end">
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
                className={`ryan-allow-select w-full rounded-full border border-white/10 py-2.5 pr-4 pl-10 text-base outline-none transition-[background-color,color,border-color] duration-500 md:py-2 md:text-sm ${inputBg}`}
              />
            </form>
            <div className="hidden items-center gap-2 md:flex">{themeButtons}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {openPlaylist ? (
            <GlassChromeButton
              size="pill"
              onClick={() => onBackPlaylist()}
              aria-label="返回歌单"
            >
              <ArrowLeft size={12} />
              返回歌单
            </GlassChromeButton>
          ) : null}
          <span className="truncate text-[11px] opacity-60">
            {listSummary}
          </span>
          <div
            className="ml-auto inline-flex items-center gap-0.5 rounded-full p-0.5"
            style={layoutRailStyle}
          >
            <LayoutGroup id="home-layout-tabs">
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
                    className="relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition"
                  >
                    {active ? (
                      <motion.span
                        layoutId="home-active-layout-pill"
                        className={`absolute inset-0 rounded-full shadow-sm ${
                          isDaylight ? 'bg-white/90' : 'bg-white/20'
                        }`}
                        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      />
                    ) : null}
                    <span className={`relative z-10 inline-flex items-center gap-1 ${
                      active ? (isDaylight ? 'text-black' : 'text-white') : 'opacity-55 hover:opacity-90'
                    }`}
                    >
                      {mode.icon}
                      <span className="hidden sm:inline">{mode.label}</span>
                    </span>
                  </button>
                );
              })}
            </LayoutGroup>
          </div>
        </div>
      </div>

      <div className="relative z-[2] min-h-0 w-full flex-1 overflow-hidden" style={{ isolation: 'isolate' }}>
        {/* 歌单列表：平台切换带动画；进详情时隐藏保活层由下方 tracks 覆盖 */}
        <AnimatePresence mode="wait" initial={false} custom={tabDir}>
          {!openPlaylist && !browsingRecommend ? (
            <motion.div
              key={`playlists-${homeTab}`}
              className="absolute inset-0 flex flex-col overflow-hidden"
              custom={tabDir}
              variants={LIBRARY_SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={LIBRARY_SLIDE_TRANSITION}
            >
              <AlbumWaterfall
                key={`playlists-${layoutMode}-${homeTab}`}
                scrollKey={`${layoutMode}:${homeTab}:playlists`}
                items={playlistItems}
                onSelect={(item, index) => {
                  const playlistItem = cloudPlaylists.find((entry) => `pl-${entry.id}` === item.id)
                    || cloudPlaylists[index];
                  if (playlistItem) onOpenPlaylist(playlistItem);
                }}
                isDaylight={isDaylight}
                isLoading={cloudSyncing || cloudLoading}
                emptyMessage={playlistEmptyCopy}
                hasFloatingPlayer={hasCurrentTrack}
                layoutMode={layoutMode}
                cardStyle={cardStyle}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false} custom={sectionDir}>
          {browsingRecommend ? (
            <motion.div
              key="netease-recommend"
              className="absolute inset-0 flex flex-col overflow-hidden"
              custom={sectionDir}
              variants={LIBRARY_SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={LIBRARY_SLIDE_TRANSITION}
            >
              <AlbumWaterfall
                key={`recommend-${layoutMode}`}
                scrollKey={`${layoutMode}:netease:recommend`}
                items={recommendItems}
                onSelect={(item, index) => {
                  const recommendItem = activeRecommendItems.find((entry) => `rc-${entry.id}` === item.id)
                    || activeRecommendItems[index];
                  if (!recommendItem) return;
                  if (recommendItem.recommendKind === 'fm') {
                    onPlayPersonalFm();
                    return;
                  }
                  if (recommendItem.recommendKind === 'daily') {
                    onOpenRecommend(recommendItem);
                    return;
                  }
                  onOpenPlaylist(recommendItem);
                }}
                isDaylight={isDaylight}
                isLoading={recommendSyncing || cloudLoading}
                emptyMessage={recommendEmptyCopy}
                hasFloatingPlayer={hasCurrentTrack}
                layoutMode={layoutMode}
                cardStyle={cardStyle}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false} custom={tabDir}>
          {openPlaylist ? (
            <motion.div
              key={`tracks-${homeTab}-${openPlaylist.id}`}
              className="absolute inset-0 flex flex-col overflow-hidden"
              custom={tabDir}
              variants={LIBRARY_SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={LIBRARY_SLIDE_TRANSITION}
            >
              <AlbumWaterfall
                key={`tracks-${layoutMode}-${homeTab}-${openPlaylist.id}`}
                scrollKey={`${layoutMode}:${homeTab}:tracks-${openPlaylist.id}`}
                items={trackItems}
                onSelect={(item, index) => {
                  const entry = cloudTracks.find((row) => `${row.type}-${row.songid}` === item.id)
                    || cloudTracks[index];
                  if (entry) onSelectEntry(entry, cloudTracks);
                }}
                isDaylight={isDaylight}
                isLoading={cloudSyncing || cloudLoading}
                emptyMessage={trackEmptyCopy}
                hasFloatingPlayer={hasCurrentTrack}
                layoutMode={layoutMode}
                cardStyle={cardStyle}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

    </div>
  );
};

export default HomeView;
