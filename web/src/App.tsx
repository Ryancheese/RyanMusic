import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { DAYLIGHT_THEME, MIDNIGHT_THEME, type AppView, type MusicSource, type Track, type VisualizerMode } from './types';
import { buildDownloadUrl, canNativeSave, fetchNeteaseQualities, fetchNeteaseStatus, fetchQqStatus, fetchTrackLyrics, nativeSave, searchMusic, type AccountStatus, type PlayQuality } from './api';
import { extractAccentFromImage } from './lib/color';
import { isMacosApp, isMobileViewport, isWindowsApp, prefersLightweightVisualizer } from './lib/media';
import { createAudioBands, pulseAudioBands, readBackgroundConfig, readVisualizerMode, writeBackgroundConfig, writeVisualizerMode } from './lib/visualizer';
import { useLibraryStore } from './store/libraryStore';
import { useCloudStore } from './store/cloudStore';
import { usePlayerStore } from './store/playerStore';
import { useThemeAccentStore } from './store/themeStore';
import FloatingPlayerControls from './components/FloatingPlayerControls';
import HomeView from './components/HomeView';
import PlayerView from './components/PlayerView';
import SearchWorkspace from './components/SearchWorkspace';
import SidePanel from './components/SidePanel';
import AccountModal from './components/AccountModal';
import LegalModal from './components/LegalModal';
import UpdateModal from './components/UpdateModal';
import WhatsNewModal from './components/WhatsNewModal';
import { parseLegalTab, type LegalTab } from './legal';
import { checkAppUpdate, installAppUpdate, type AppUpdateInfo } from './lib/update';
import {
  APP_VERSION,
  WHATS_NEW_NOTES,
  markWhatsNewSeen,
  shouldShowWhatsNew,
} from './whatsNew';

const THEME_KEY = 'ryanmusic-theme';

function readTheme(): boolean {
  return localStorage.getItem(THEME_KEY) === 'daylight';
}

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTime = useMotionValue(0);
  const audioPower = useMotionValue(0);
  const audioBands = useMemo(() => createAudioBands(), []);
  const [view, setView] = useState<AppView>('home');
  const [isDaylight, setIsDaylight] = useState(readTheme);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(readVisualizerMode);
  const [backgroundConfig, setBackgroundConfig] = useState(() => readBackgroundConfig(prefersLightweightVisualizer()));
  const [buffering, setBuffering] = useState(false);
  const [audioQuality, setAudioQuality] = useState('');
  const [qualityOptions, setQualityOptions] = useState<PlayQuality[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [panelOpen, setPanelOpen] = useState(() => !isMobileViewport());
  const [styleOpen, setStyleOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [accent, setAccent] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('help');
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [netease, setNetease] = useState<AccountStatus | null>(null);
  const [qq, setQq] = useState<AccountStatus | null>(null);
  const lastQueryRef = useRef('');

  const source = usePlayerStore((state) => state.source);
  const setSource = usePlayerStore((state) => state.setSource);
  const queue = usePlayerStore((state) => state.queue);
  const index = usePlayerStore((state) => state.index);
  const status = usePlayerStore((state) => state.status);
  const duration = usePlayerStore((state) => state.duration);
  const loopMode = usePlayerStore((state) => state.loopMode);
  const playTracks = usePlayerStore((state) => state.playTracks);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const playLibraryEntry = usePlayerStore((state) => state.playLibraryEntry);
  const patchCurrentLyrics = usePlayerStore((state) => state.patchCurrentLyrics);
  const toggleLoop = usePlayerStore((state) => state.toggleLoop);
  const setStatus = usePlayerStore((state) => state.setStatus);
  const setDuration = usePlayerStore((state) => state.setDuration);

  const homeTab = useLibraryStore((state) => state.homeTab);
  const setHomeTab = useLibraryStore((state) => state.setHomeTab);
  const layoutMode = useLibraryStore((state) => state.layoutMode);
  const setLayoutMode = useLibraryStore((state) => state.setLayoutMode);

  const neteasePlaylists = useCloudStore((state) => state.neteasePlaylists);
  const qqPlaylists = useCloudStore((state) => state.qqPlaylists);
  const neteaseOpen = useCloudStore((state) => state.neteaseOpen);
  const qqOpen = useCloudStore((state) => state.qqOpen);
  const neteaseTracks = useCloudStore((state) => state.neteaseTracks);
  const qqTracks = useCloudStore((state) => state.qqTracks);
  const neteaseSyncing = useCloudStore((state) => state.neteaseSyncing);
  const qqSyncing = useCloudStore((state) => state.qqSyncing);
  const neteaseLoading = useCloudStore((state) => state.neteaseLoading);
  const qqLoading = useCloudStore((state) => state.qqLoading);
  const neteaseError = useCloudStore((state) => state.neteaseError);
  const qqError = useCloudStore((state) => state.qqError);
  const syncNetease = useCloudStore((state) => state.syncNetease);
  const syncQq = useCloudStore((state) => state.syncQq);
  const openNeteasePlaylist = useCloudStore((state) => state.openNeteasePlaylist);
  const openQqPlaylist = useCloudStore((state) => state.openQqPlaylist);
  const closeNeteasePlaylist = useCloudStore((state) => state.closeNeteasePlaylist);
  const closeQqPlaylist = useCloudStore((state) => state.closeQqPlaylist);

  const [authFallback, setAuthFallback] = useState(false);
  const [webUseAuth, setWebUseAuth] = useState(false);
  const nativeApp = isWindowsApp() || isMacosApp();
  const viewRef = useRef(view);
  viewRef.current = view;
  const track = queue[index] || null;
  const vipPlay = Boolean(
    (track?.type === 'netease' && netease?.loggedIn && Number(netease.vip) > 0)
    || (track?.type === 'qq' && qq?.loggedIn && Number(qq.vip) > 0),
  );
  const authedPlay = Boolean(vipPlay && (nativeApp ? !authFallback : webUseAuth));
  const mediaUrl = useMemo(() => {
    if (!track?.url) return '';
    if (!authedPlay) return track.url;
    const params = new URLSearchParams();
    params.set('auth', '1');
    if (track.type === 'netease' && audioQuality) params.set('level', audioQuality);
    const join = track.url.includes('?') ? '&' : '?';
    return `${track.url}${join}${params.toString()}`;
  }, [audioQuality, authedPlay, track?.type, track?.url]);
  const theme = isDaylight ? DAYLIGHT_THEME : MIDNIGHT_THEME;
  const resolveAccent = useThemeAccentStore((state) => state.resolveAccent);
  const presetId = useThemeAccentStore((state) => state.presetId);
  const customColor = useThemeAccentStore((state) => state.customColor);
  const userAccent = useMemo(
    () => resolveAccent(isDaylight),
    [customColor, isDaylight, presetId, resolveAccent],
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--bg-color', theme.backgroundColor);
    document.documentElement.style.backgroundColor = theme.backgroundColor;
    document.body.style.backgroundColor = theme.backgroundColor;
    try {
      window.webkit?.messageHandlers?.ryanChrome?.postMessage({ daylight: isDaylight });
    } catch {
      // non-mac / no bridge
    }
  }, [isDaylight, theme.backgroundColor]);

  const appStyle = useMemo(
    () =>
      ({
        '--bg-color': theme.backgroundColor,
        '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor,
        '--text-accent': userAccent,
        backgroundColor: theme.backgroundColor,
        color: theme.primaryColor,
      }) as React.CSSProperties,
    [theme, userAccent],
  );


  useEffect(() => {
    let cancelled = false;
    setQualityOptions([]);
    if (!track || track.type !== 'netease' || !vipPlay || authFallback) {
      setAudioQuality('');
      return;
    }
    void fetchNeteaseQualities(track.songid).then((res) => {
      if (cancelled) return;
      const list = res.data?.qualities || [];
      setQualityOptions(list);
      // 不自动切到最高档：先按无 level（约 320k）出声，用户点选音质才换源
      setAudioQuality((prev) => {
        if (prev && list.some((item) => item.level === prev)) return prev;
        return '';
      });
    }).catch(() => {
      if (!cancelled) {
        setQualityOptions([]);
        setAudioQuality('');
      }
    });
    return () => { cancelled = true; };
  }, [authFallback, vipPlay, track?.songid, track?.type]);


  const goHome = useCallback(() => {
    setStyleOpen(false);
    setPanelOpen(false);
    setChromeHidden(false);
    setView('home');
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    currentTime.set(time);
  }, [currentTime]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [track]);

  const playIndex = useCallback(
    (nextIndex: number) => {
      if (!queue.length) return;
      playTracks(queue, nextIndex);
    },
    [playTracks, queue],
  );

  const playNext = useCallback(
    (fromEnded = false) => {
      if (!queue.length) return;
      if (loopMode === 'one' && fromEnded) {
        seek(0);
        void audioRef.current?.play();
        return;
      }
      if (index + 1 < queue.length) playIndex(index + 1);
      else if (loopMode === 'all') playIndex(0);
    },
    [index, loopMode, playIndex, queue.length, seek],
  );

  const playPrev = useCallback(() => {
    if (currentTime.get() > 3) {
      seek(0);
      return;
    }
    if (index > 0) playIndex(index - 1);
    else if (loopMode === 'all' && queue.length) playIndex(queue.length - 1);
  }, [currentTime, index, loopMode, playIndex, queue.length, seek]);

  const writeLegalQuery = useCallback((tab: LegalTab | null) => {
    const url = new URL(window.location.href);
    if (tab) url.searchParams.set('doc', tab);
    else url.searchParams.delete('doc');
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState(null, '', next || '/');
    }
  }, []);

  const openLegal = useCallback(
    (tab: LegalTab) => {
      setLegalTab(tab);
      setLegalOpen(true);
      writeLegalQuery(tab);
    },
    [writeLegalQuery],
  );

  const closeLegal = useCallback(() => {
    setLegalOpen(false);
    writeLegalQuery(null);
  }, [writeLegalQuery]);

  const openUpdate = useCallback(async () => {
    setUpdateOpen(true);
    setUpdateBusy(true);
    try {
      const info = await checkAppUpdate();
      setUpdateInfo(info);
    } catch (error) {
      setUpdateInfo({
        ok: false,
        hasUpdate: false,
        error: error instanceof Error ? error.message : '检查更新失败',
      });
    } finally {
      setUpdateBusy(false);
    }
  }, []);

  const runInstallUpdate = useCallback(async () => {
    setUpdateBusy(true);
    try {
      const info = await installAppUpdate();
      setUpdateInfo(info);
    } catch (error) {
      setUpdateInfo({
        ok: false,
        hasUpdate: Boolean(updateInfo?.hasUpdate),
        current: updateInfo?.current,
        latest: updateInfo?.latest,
        error: error instanceof Error ? error.message : '安装更新失败',
      });
    } finally {
      setUpdateBusy(false);
    }
  }, [updateInfo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldShowWhatsNew(APP_VERSION)) {
        setWhatsNewOpen(true);
      }
      void checkAppUpdate().then((info) => {
        if (info.ok && info.hasUpdate) setUpdateInfo(info);
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const closeWhatsNew = useCallback(() => {
    markWhatsNewSeen(APP_VERSION);
    setWhatsNewOpen(false);
  }, []);

  const runSearch = useCallback(
    async (text: string, page = 1, append = false, sourceOverride?: MusicSource) => {
      const input = text.trim();
      if (!input) return;
      lastQueryRef.current = input;
      const activeSource = sourceOverride || source;
      if (append) setLoadingMore(true);
      else {
        setSearching(true);
        setSearchError('');
        if (page === 1) setResults([]);
      }
      try {
        const filter = /^https?:\/\//i.test(input) ? 'url' as const : 'name' as const;
        const result = await searchMusic({
          input,
          filter,
          type: filter === 'url' ? '_' : activeSource,
          page,
        });
        if (result.code !== 200 || !result.data?.length) {
          if (!append) setSearchError(result.error || '没有找到相关信息');
          setHasMore(false);
          return;
        }
        setResults((prev) => (append ? [...prev, ...result.data] : result.data));
        setHasMore(Boolean(result.has_more) && filter === 'name');
        setSearchPage(page);
        const url = filter === 'url'
          ? `?url=${encodeURIComponent(input)}`
          : `?name=${encodeURIComponent(input)}&type=${activeSource}`;
        window.history.replaceState(null, '', url);
      } catch (error) {
        if (!append) setSearchError(error instanceof Error ? error.message : '搜索失败');
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [source],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = loopMode === 'one';
  }, [loopMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      analyser = context.createAnalyser();
      analyser.fftSize = isWindowsApp() ? 128 : 256;
      source.connect(analyser);
      analyser.connect(context.destination);
    } catch {
      analyser = null;
    }

    let frame = 0;
    const syncClock = () => {
      const next = audio.currentTime;
      currentTime.set(next);
      if (context && context.state === 'suspended' && !audio.paused) {
        void context.resume();
      }
      if (viewRef.current === 'player') {
        pulseAudioBands(audioBands, analyser, !audio.paused);
        audioPower.set((
          audioBands.bass.get()
          + audioBands.lowMid.get()
          + audioBands.mid.get()
          + audioBands.vocal.get()
          + audioBands.treble.get()
        ) / 5);
      }
      frame = requestAnimationFrame(syncClock);
    };
    frame = requestAnimationFrame(syncClock);

    const snapClock = () => {
      currentTime.set(audio.currentTime);
    };
    audio.addEventListener('seeking', snapClock);
    audio.addEventListener('seeked', snapClock);

    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener('seeking', snapClock);
      audio.removeEventListener('seeked', snapClock);
      void context?.close();
    };
  }, [audioBands, audioPower, currentTime]);

  useEffect(() => {
    setAuthFallback(false);
    setWebUseAuth(false);
  }, [track?.songid, track?.type, netease?.loggedIn, netease?.vip, qq?.loggedIn, qq?.vip]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl || !track) return;
    const previous = audio.getAttribute('data-src') || '';
    const songKey = `${track.type}:${track.songid}`;
    if (previous !== mediaUrl) {
      const sameSong = audio.getAttribute('data-songid') === songKey;
      const keep = sameSong ? audio.currentTime : 0;
      setBuffering(true);
      setStatus('loading');
      audio.setAttribute('data-src', mediaUrl);
      audio.setAttribute('data-songid', songKey);
      audio.src = mediaUrl;
      if (keep > 0.4) {
        const resume = () => {
          audio.removeEventListener('loadedmetadata', resume);
          if (audio.getAttribute('data-songid') !== songKey) return;
          audio.currentTime = keep;
          currentTime.set(keep);
        };
        audio.addEventListener('loadedmetadata', resume);
      } else {
        currentTime.set(0);
        setDuration(0);
      }
    }
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => setStatus('playing')).catch(() => setStatus('paused'));
    }
  }, [currentTime, mediaUrl, setDuration, setStatus, track?.songid, track?.type]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [ne, qqStatus] = await Promise.all([fetchNeteaseStatus(), fetchQqStatus()]);
      if (!alive) return;
      setNetease(ne.code === 200 ? ne.data : { loggedIn: false });
      setQq(qqStatus.code === 200 ? qqStatus.data : { loggedIn: false });
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const refreshAccounts = useCallback(() => {
    void Promise.all([fetchNeteaseStatus(), fetchQqStatus()]).then(([ne, qqStatus]) => {
      setNetease(ne.code === 200 ? ne.data : { loggedIn: false });
      setQq(qqStatus.code === 200 ? qqStatus.data : { loggedIn: false });
    });
  }, []);

  useEffect(() => {
    if (netease?.loggedIn) void syncNetease();
  }, [netease?.loggedIn, syncNetease]);

  useEffect(() => {
    if (qq?.loggedIn) void syncQq();
  }, [qq?.loggedIn, syncQq]);

  useEffect(() => {
    if (!track || status !== 'playing') return;
    if (track.lrc || track.yrc) return;
    const type = track.type;
    const id = track.songid;
    let alive = true;
    void fetchTrackLyrics(type, id).then((lyrics) => {
      if (!alive || !lyrics) return;
      patchCurrentLyrics(lyrics);
    });
    return () => {
      alive = false;
    };
  }, [patchCurrentLyrics, status, track?.lrc, track?.songid, track?.type, track?.yrc]);

  useEffect(() => {
    const next = queue[index + 1];
    if (!next?.url) return;
    const nextVip = Boolean(
      (next.type === 'netease' && netease?.loggedIn && Number(netease.vip) > 0)
      || (next.type === 'qq' && qq?.loggedIn && Number(qq.vip) > 0),
    );
    try {
      const url = new URL(next.url, window.location.origin);
      url.searchParams.set('probe', '1');
      if (nextVip) url.searchParams.set('auth', '1');
      const controller = new AbortController();
      void fetch(url, { signal: controller.signal }).catch(() => undefined);
      return () => controller.abort();
    } catch {
      return undefined;
    }
  }, [index, netease?.loggedIn, netease?.vip, qq?.loggedIn, qq?.vip, queue]);

  useEffect(() => {
    if (!track?.pic) {
      setAccent(null);
      return;
    }
    void extractAccentFromImage(track.pic).then(setAccent);
  }, [track?.pic]);

  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author,
      album: 'RyanMusic',
      artwork: track.pic
        ? [
            { src: track.pic, sizes: '96x96' },
            { src: track.pic, sizes: '256x256' },
            { src: track.pic, sizes: '512x512' },
          ]
        : [],
    });
    navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => void audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
  }, [playNext, playPrev, seek, status, track]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') {
        seek(Math.min(duration, currentTime.get() + 5));
      } else if (event.key === 'ArrowLeft') {
        seek(Math.max(0, currentTime.get() - 5));
      } else if (event.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (styleOpen) {
          setStyleOpen(false);
          return;
        }
        if (panelOpen && view === 'player') {
          setPanelOpen(false);
          return;
        }
        const playlistOpen = homeTab === 'qq' ? qqOpen : neteaseOpen;
        if (view === 'home' && playlistOpen) {
          if (homeTab === 'qq') closeQqPlaylist();
          else closeNeteasePlaylist();
          return;
        }
        if (view === 'player') {
          goHome();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    closeNeteasePlaylist,
    closeQqPlaylist,
    currentTime,
    duration,
    goHome,
    homeTab,
    neteaseOpen,
    panelOpen,
    qqOpen,
    searchOpen,
    seek,
    styleOpen,
    togglePlay,
    view,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const url = params.get('url');
    const type = params.get('type');
    const doc = parseLegalTab(params.get('doc'));
    if (type === 'qq' || type === 'netease') setSource(type);
    if (url || name) {
      const text = url || name || '';
      setQuery(text);
      setSearchOpen(true);
      void runSearch(text, 1, false, type === 'qq' || type === 'netease' ? type : undefined);
    }
    if (doc) {
      setLegalTab(doc);
      setLegalOpen(true);
    }
    const onPopState = () => {
      const next = parseLegalTab(new URLSearchParams(window.location.search).get('doc'));
      if (next) {
        setLegalTab(next);
        setLegalOpen(true);
      } else {
        setLegalOpen(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // Bootstrap from deep links once on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadSong = () => {
    if (!track) return;
    const name = `${track.title}-${track.author}`;
    const url = buildDownloadUrl(track.url, name);
    if (canNativeSave()) nativeSave({ url, filename: `${name}.mp3` });
    else window.location.href = url;
  };

  const downloadLrc = () => {
    if (!track) return;
    const name = `${track.title}-${track.author}.lrc`;
    if (canNativeSave()) {
      nativeSave({ text: track.lrc || '', filename: name });
      return;
    }
    const blob = new Blob([track.lrc || ''], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="app-shell fixed inset-0 flex h-full w-full flex-col overflow-hidden font-sans transition-colors duration-500" style={appStyle}>
      <div className="ryan-accent-wash" aria-hidden />
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setBuffering(false);
          setStatus('playing');
        }}
        onPause={() => {
          setBuffering(false);
          setStatus('paused');
        }}
        onWaiting={() => {
          if (audioRef.current && !audioRef.current.paused) setBuffering(true);
        }}
        onStalled={() => {
          if (audioRef.current && !audioRef.current.paused) setBuffering(true);
        }}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onDurationChange={(event) => {
          const next = event.currentTarget.duration || 0;
          setDuration(next);
          if (Number.isFinite(next) && next > 1 && next <= 50) {
            if (nativeApp && authedPlay) setAuthFallback(true);
            if (!nativeApp && vipPlay && !webUseAuth) setWebUseAuth(true);
          }
        }}
        onEnded={() => playNext(true)}
        onError={() => {
          setBuffering(false);
          if (nativeApp && authedPlay) setAuthFallback(true);
          else if (!nativeApp && webUseAuth) setWebUseAuth(false);
        }}
      />

      <div className={`absolute inset-0 z-10 ${view === 'home' ? '' : 'hidden'}`} aria-hidden={view !== 'home'}>
        <HomeView
          theme={theme}
          isDaylight={isDaylight}
          homeTab={homeTab}
          layoutMode={layoutMode}
          neteasePlaylists={neteasePlaylists}
          qqPlaylists={qqPlaylists}
          neteaseOpen={neteaseOpen}
          qqOpen={qqOpen}
          neteaseTracks={neteaseTracks}
          qqTracks={qqTracks}
          cloudLoading={homeTab === 'netease' ? neteaseLoading : homeTab === 'qq' ? qqLoading : false}
          cloudSyncing={homeTab === 'netease' ? neteaseSyncing : homeTab === 'qq' ? qqSyncing : false}
          cloudError={homeTab === 'netease' ? neteaseError : homeTab === 'qq' ? qqError : ''}
          hasCurrentTrack={Boolean(track)}
          searchQuery={query}
          updateAvailable={Boolean(updateInfo?.hasUpdate)}
          onSearchQueryChange={setQuery}
          onOpenSearch={(submit) => {
            setSearchOpen(true);
            if (submit && query.trim()) void runSearch(query);
          }}
          onHomeTabChange={setHomeTab}
          onLayoutModeChange={setLayoutMode}
          onSelectEntry={(entry, queueEntries) => {
            void playLibraryEntry(entry, queueEntries);
            setView('player');
            setPanelOpen(!isMobileViewport());
            setChromeHidden(false);
          }}
          onOpenPlaylist={(item) => {
            if (homeTab === 'qq') void openQqPlaylist(item);
            else void openNeteasePlaylist(item);
          }}
          onBackPlaylist={() => {
            if (homeTab === 'qq') closeQqPlaylist();
            else closeNeteasePlaylist();
          }}
          onToggleTheme={() => {
            const next = !isDaylight;
            setIsDaylight(next);
            localStorage.setItem(THEME_KEY, next ? 'daylight' : 'midnight');
          }}
          onOpenAccount={() => setAccountOpen(true)}
          onOpenLegal={openLegal}
          onCheckUpdate={() => void openUpdate()}
          netease={netease}
          qq={qq}
        />
      </div>

      {view === 'player' && (
        <PlayerView
          track={track}
          currentTime={currentTime}
          chromeHidden={chromeHidden}
          isDaylight={isDaylight}
          theme={theme}
          accent={accent || userAccent}
          visualizerMode={visualizerMode}
          background={backgroundConfig}
          onVisualizerModeChange={(mode) => {
            setVisualizerMode(mode);
            writeVisualizerMode(mode);
          }}
          audioPower={audioPower}
          audioBands={audioBands}
          paused={status !== 'playing'}
          buffering={(buffering || status === 'loading') && status !== 'paused'}
          onBack={goHome}
          isPanelOpen={panelOpen}
          onOpenPanel={() => {
            setPanelOpen(true);
          }}
          onLyricLineSeek={seek}
          onToggleChrome={() => {
            setChromeHidden((hidden) => {
              const nextHidden = !hidden;
              if (!isMobileViewport()) setPanelOpen(!nextHidden);
              else if (nextHidden) setPanelOpen(false);
              return nextHidden;
            });
          }}
        />
      )}

      <SearchWorkspace
        open={searchOpen}
        query={query}
        source={source}
        isDaylight={isDaylight}
        theme={theme}
        isSearching={searching}
        isLoadingMore={loadingMore}
        error={searchError}
        tracks={results}
        hasMore={hasMore}
        onQueryChange={setQuery}
        onSourceChange={(next: MusicSource) => {
          setSource(next);
          if (query.trim()) void runSearch(query);
        }}
        onSubmit={() => void runSearch(query)}
        onClose={() => setSearchOpen(false)}
        onPlay={(item, playAt) => {
          playTracks(results, playAt);
          setSearchOpen(false);
          setView('player');
          setPanelOpen(!isMobileViewport());
          setChromeHidden(false);
        }}
        onAddQueue={(item) => {
          addToQueue(item);
        }}
        onLoadMore={() => {
          if (hasMore && !loadingMore) void runSearch(lastQueryRef.current, searchPage + 1, true);
        }}
      />

      {view === 'player' && (
        <SidePanel
          open={panelOpen && !chromeHidden}
          isDaylight={isDaylight}
          theme={theme}
          track={track}
          queue={queue}
          index={index}
          currentTime={currentTime}
          visualizerMode={visualizerMode}
          background={backgroundConfig}
          styleOpen={styleOpen}
          buffering={(buffering || status === 'loading') && status !== 'paused'}
          onStyleOpenChange={setStyleOpen}
          onVisualizerModeChange={(mode) => {
            setVisualizerMode(mode);
            writeVisualizerMode(mode);
          }}
          onBackgroundChange={(config) => {
            setBackgroundConfig(config);
            writeBackgroundConfig(config);
          }}
          onClose={() => setPanelOpen(false)}
          onHome={goHome}
          onDownloadSong={downloadSong}
          onDownloadLrc={downloadLrc}
          onPlayIndex={playIndex}
          onLyricLineSeek={seek}
          qualityOptions={authedPlay && track?.type === 'netease' ? qualityOptions : []}
          audioQuality={audioQuality}
          onAudioQualityChange={setAudioQuality}
        />
      )}

      <AccountModal
        open={accountOpen}
        isDaylight={isDaylight}
        theme={theme}
        netease={netease}
        qq={qq}
        onClose={() => setAccountOpen(false)}
        onChanged={refreshAccounts}
        onLoggedIn={(provider) => {
          setHomeTab(provider);
          if (provider === 'netease') void syncNetease();
          else void syncQq();
        }}
        onSync={async (provider) => {
          setHomeTab(provider);
          if (provider === 'netease') await syncNetease();
          else await syncQq();
        }}
        syncing={neteaseSyncing || qqSyncing}
        syncMessage={
          neteaseSyncing || qqSyncing
            ? '正在同步歌单…'
            : [neteaseError, qqError].filter(Boolean).join(' ')
        }
      />

      <LegalModal
        open={legalOpen}
        tab={legalTab}
        isDaylight={isDaylight}
        theme={theme}
        onClose={closeLegal}
        onTabChange={openLegal}
      />

      <WhatsNewModal
        open={whatsNewOpen}
        isDaylight={isDaylight}
        theme={theme}
        version={APP_VERSION}
        notes={WHATS_NEW_NOTES}
        onClose={closeWhatsNew}
      />

      <UpdateModal
        open={updateOpen}
        isDaylight={isDaylight}
        theme={theme}
        info={updateInfo}
        busy={updateBusy}
        onClose={() => setUpdateOpen(false)}
        onInstall={() => void runInstallUpdate()}
      />

      <FloatingPlayerControls
        status={status}
        currentTime={currentTime}
        duration={duration}
        loopMode={loopMode}
        currentView={view}
        canTogglePlay={Boolean(track)}
        canPrev={Boolean(track)}
        canNext={Boolean(track) && (index + 1 < queue.length || loopMode === 'all')}
        isDaylight={isDaylight}
        buffering={(buffering || status === 'loading') && status !== 'paused'}
        isHidden={view === 'player' && chromeHidden}
        onSeek={seek}
        onTogglePlay={togglePlay}
        onToggleLoop={toggleLoop}
        onPrev={playPrev}
        onNext={() => playNext(false)}
        onNavigateToPlayer={() => {
          if (track) setView('player');
        }}
      />
    </div>
  );
};

export default App;
