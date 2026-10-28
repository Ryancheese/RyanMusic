import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { DAYLIGHT_THEME, MIDNIGHT_THEME, type AppView, type MusicSource, type SearchAlbumHit, type SearchArtistHit, type SearchBundle, type SearchCategory, type SearchPlaylistHit, type Track, type VisualizerMode } from './types';
import { buildDownloadUrl, canNativeSave, coverImageUrl, coverRefreshUrl, fetchKugouStatus, fetchNeteaseQualities, fetchNeteaseStatus, fetchQishuiStatus, fetchQqStatus, fetchSpotifyStatus, fetchSignedMedia, fetchTrackLyrics, nativeSave, searchMusic, type AccountStatus, type CloudPlaylist, type LyricSearchCandidate, type PlayQuality } from './api';
import { accentWashVars, contrastText, extractAccentFromImage } from './lib/color';
import {
  canUseAppleMusic,
  fetchAppleArtistSongs,
  isAppleTrack,
  pauseAppleMusic,
  playAppleMusic,
  resumeAppleMusic,
  searchAppleMusic,
  seekAppleMusic,
  stopAppleMusic,
  subscribeAppleMusic,
} from './lib/appleMusic';
import { isMobileViewport, isNativeApp, isWindowsApp, prefersLightweightVisualizer, useIsMobile } from './lib/media';
import { useWebFullscreen } from './lib/webFullscreen';
import WindowControls from './components/WindowControls';
import TitlebarDragZone from './components/TitlebarDragZone';
import { peekTrackProfile, plainBlend, planAutomix, primeTrackProfile, profileFromTail } from './lib/automix';
import { attachAudioGraph, beginAudioWake, parkAudioGraph, readMixRms, rearmDeckOutput, resetDeckTone, scheduleBlend, snapDeckGain, unlockAudio } from './lib/audioGraph';
import { createAudioBands, pulseAudioBands, readBackgroundConfig, readVisualizerMode, writeBackgroundConfig } from './lib/visualizer';
import { useRandomVisualizerMode } from './hooks/useRandomVisualizerMode';
import { useBeatFxWantedRef } from './hooks/useBeatFxTrack';
import { tickBeatFx } from './services/beatFx/beatFxLive';
import { useVisualizerSettingsStore } from './store/visualizerSettingsStore';
import { loadCustomBackgroundImage } from './lib/customBackgroundImage';
import { useLibraryStore } from './store/libraryStore';
import { useAppleMusicStore } from './store/appleMusicStore';
import { useCloudStore } from './store/cloudStore';
import { touchPlaylistRecent } from './store/playlistRecentStore';
import { useSearchHistoryStore } from './store/searchHistoryStore';
import { usePlayerStore } from './store/playerStore';
import { useThemeAccentStore } from './store/themeStore';
import { LYRIC_SOURCE_OPTIONS, useLyricSettingsStore } from './store/lyricSettingsStore';
import { useLyricMatchStore } from './store/lyricMatchStore';
import { hasUsableTrackLyrics, isWordByWordLyricText } from './lib/lyrics';
import { showToast } from './store/toastStore';
import { usePlaybackSettingsStore } from './store/playbackSettingsStore';
import { trackKey } from './types';
import { AUTO_AUDIO_QUALITY, estimateNetworkQualityCeiling } from './lib/audioQuality';
import FloatingPlayerControls from './components/FloatingPlayerControls';
import HomeView from './components/HomeView';
import PlayerView from './components/PlayerView';
import SearchWorkspace from './components/SearchWorkspace';
import SidePanel from './components/SidePanel';
import AccountModal from './components/AccountModal';
import LyricMatchModal from './components/LyricMatchModal';
import LegalModal from './components/LegalModal';
import UpdateModal from './components/UpdateModal';
import WhatsNewModal from './components/WhatsNewModal';
import ToastHost from './components/ToastHost';
import ThemeAccentPicker from './components/ThemeAccentPicker';
import AppSettingsPanel from './components/AppSettingsPanel';
import OnboardingTour from './components/OnboardingTour';
import { parseLegalTab, type LegalTab } from './legal';
import { checkAppUpdate, installAppUpdate, type AppUpdateInfo } from './lib/update';
import type { AccountProviderId } from './lib/accountProviders';
import { hasCompletedOnboarding, useOnboardingStore } from './store/onboardingStore';
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

/** 已登录即走 Cookie 官方链（对齐 Folia）；音质面板仍用 vip 判断 */
function trackAuthedPlay(track: Track | null, netease: AccountStatus | null, qq: AccountStatus | null) {
  return Boolean(
    (track?.type === 'netease' && netease?.loggedIn)
    || (track?.type === 'qq' && qq?.loggedIn),
  );
}

function trackVipPlay(track: Track | null, netease: AccountStatus | null, qq: AccountStatus | null) {
  return Boolean(
    (track?.type === 'netease' && netease?.loggedIn && Number(netease.vip) > 0)
    || (track?.type === 'qq' && qq?.loggedIn && Number(qq.vip) > 0),
  );
}

function buildPlayMediaUrl(
  track: Track | null,
  options: {
    authed: boolean;
    audioQuality: string;
    crossPlayFallback: boolean;
    freePlaySource?: string;
    fresh?: number;
  },
): string {
  if (!track?.url || isAppleTrack(track)) return '';
  const params = new URLSearchParams();
  if (options.authed) {
    params.set('auth', '1');
    if (track.type === 'netease') {
      const level = options.audioQuality === AUTO_AUDIO_QUALITY
        ? estimateNetworkQualityCeiling()
        : options.audioQuality;
      if (level) params.set('level', level);
    }
  }
  if (options.crossPlayFallback || track.delisted) {
    params.set('cross', '1');
    if (track.title) params.set('title', track.title);
    if (track.author) params.set('artist', track.author);
  }
  if (track.delisted) params.set('delisted', '1');
  if (options.fresh) params.set('fresh', '1');
  if (options.freePlaySource && options.freePlaySource !== 'auto') {
    params.set('free', options.freePlaySource);
  }
  const query = params.toString();
  if (!query) return track.url;
  const join = track.url.includes('?') ? '&' : '?';
  return `${track.url}${join}${query}`;
}

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const activeDeckRef = useRef(0);
  const blendTokenRef = useRef(0);
  const blendRef = useRef<{
    token: number;
    incomingDeck: number;
    incomingKey: string;
    timer: number;
  } | null>(null);
  const tailSamplesRef = useRef<number[]>([]);
  const tailStampRef = useRef(0);
  /** 汽水电台会话：切歌将近末尾时续拉 feed */
  const qishuiRadioRef = useRef<{ scene?: string; extending: boolean } | null>(null);
  const currentTime = useMotionValue(0);
  const audioPower = useMotionValue(0);
  const audioBands = useMemo(() => createAudioBands(), []);
  const [view, setView] = useState<AppView>('home');
  const [isDaylight, setIsDaylight] = useState(readTheme);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(readVisualizerMode);
  const [backgroundConfig, setBackgroundConfig] = useState(() => readBackgroundConfig(prefersLightweightVisualizer()));
  const randomVisualizerModePerSong = useVisualizerSettingsStore((state) => state.randomVisualizerModePerSong);
  const randomVisualizerModes = useVisualizerSettingsStore((state) => state.randomVisualizerModes);
  const applyVisualizerMode = useCallback((mode: VisualizerMode, options?: { preserveRandom?: boolean }) => {
    useVisualizerSettingsStore.getState().handleSetVisualizerMode(mode, options);
    setVisualizerMode(mode);
  }, []);
  const randomTrack = usePlayerStore((state) => state.queue[state.index] || null);
  useRandomVisualizerMode({
    currentSong: randomTrack,
    enabled: randomVisualizerModePerSong,
    visualizerMode,
    modes: randomVisualizerModes,
    setVisualizerMode: applyVisualizerMode,
  });
  useEffect(() => {
    useVisualizerSettingsStore.getState().setVisualizerMode(visualizerMode);
  }, [visualizerMode]);
  useEffect(() => {
    useVisualizerSettingsStore.getState().setVisualizerBackgroundMode(backgroundConfig.mode ?? null);
  }, [backgroundConfig.mode]);
  const [buffering, setBuffering] = useState(false);
  const [audioQuality, setAudioQuality] = useState('');
  const [qualityOptions, setQualityOptions] = useState<PlayQuality[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searchBundle, setSearchBundle] = useState<SearchBundle | null>(null);
  const [searchPlaylists, setSearchPlaylists] = useState<SearchPlaylistHit[]>([]);
  const [searchAlbums, setSearchAlbums] = useState<SearchAlbumHit[]>([]);
  const [searchArtists, setSearchArtists] = useState<SearchArtistHit[]>([]);
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('all');
  const [searchSource, setSearchSource] = useState<MusicSource>('netease');
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [lyricsSwitching, setLyricsSwitching] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricMatchOpen, setLyricMatchOpen] = useState(false);
  const lyricRequestGen = useRef(0);
  const durationRef = useRef(0);
  const [accent, setAccent] = useState<string | null>(null);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountIntent, setAccountIntent] = useState<AccountProviderId>('netease');
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('help');
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateProgressStage, setUpdateProgressStage] = useState('');
  const [netease, setNetease] = useState<AccountStatus | null>(null);
  const [qq, setQq] = useState<AccountStatus | null>(null);
  const [kugou, setKugou] = useState<AccountStatus | null>(null);
  const [qishui, setQishui] = useState<AccountStatus | null>(null);
  const [spotify, setSpotify] = useState<AccountStatus | null>(null);
  const appleAccount = useAppleMusicStore((state) => state.account);
  const nativeClockRef = useRef({
    active: false,
    playing: false,
    time: 0,
    stamp: 0,
    duration: 0,
    songId: '',
  });
  const playbackIntentRef = useRef<'playing' | 'paused'>('paused');
  const appleCommandGenRef = useRef(0);
  const lastQueryRef = useRef('');
  const returnToSearchRef = useRef(false);

  const queue = usePlayerStore((state) => state.queue);
  const index = usePlayerStore((state) => state.index);
  const status = usePlayerStore((state) => state.status);
  const playerError = usePlayerStore((state) => state.error);
  const duration = usePlayerStore((state) => state.duration);
  durationRef.current = duration;
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
  const neteaseLibrarySection = useLibraryStore((state) => state.neteaseLibrarySection);
  const setNeteaseLibrarySection = useLibraryStore((state) => state.setNeteaseLibrarySection);
  const layoutMode = useLibraryStore((state) => state.layoutMode);
  const cardStyle = useLibraryStore((state) => state.cardStyle);
  const setLayoutMode = useLibraryStore((state) => state.setLayoutMode);
  const preferredLyricSource = useLyricSettingsStore((state) => state.preferredSource);
  const autoUseBestLyrics = useLyricSettingsStore((state) => state.autoUseBest);
  const getManualLyricSelection = useLyricMatchStore((state) => state.getManualSelection);
  const hasManualLyricSelection = useLyricMatchStore((state) => state.hasManualSelection);
  const setManualLyricSelection = useLyricMatchStore((state) => state.setManualSelection);

  const neteasePlaylists = useCloudStore((state) => state.neteasePlaylists);
  const qqPlaylists = useCloudStore((state) => state.qqPlaylists);
  const qishuiPlaylists = useCloudStore((state) => state.qishuiPlaylists);
  const spotifyPlaylists = useCloudStore((state) => state.spotifyPlaylists);
  const neteaseRecommendItems = useCloudStore((state) => state.neteaseRecommendItems);
  const qqRecommendItems = useCloudStore((state) => state.qqRecommendItems);
  const qishuiRecommendItems = useCloudStore((state) => state.qishuiRecommendItems);
  const spotifyRecommendItems = useCloudStore((state) => state.spotifyRecommendItems);
  const neteaseOpen = useCloudStore((state) => state.neteaseOpen);
  const qqOpen = useCloudStore((state) => state.qqOpen);
  const qishuiOpen = useCloudStore((state) => state.qishuiOpen);
  const spotifyOpen = useCloudStore((state) => state.spotifyOpen);
  const neteaseTracks = useCloudStore((state) => state.neteaseTracks);
  const qqTracks = useCloudStore((state) => state.qqTracks);
  const qishuiTracks = useCloudStore((state) => state.qishuiTracks);
  const spotifyTracks = useCloudStore((state) => state.spotifyTracks);
  const neteaseSyncing = useCloudStore((state) => state.neteaseSyncing);
  const qqSyncing = useCloudStore((state) => state.qqSyncing);
  const qishuiSyncing = useCloudStore((state) => state.qishuiSyncing);
  const spotifySyncing = useCloudStore((state) => state.spotifySyncing);
  const neteaseRecommendSyncing = useCloudStore((state) => state.neteaseRecommendSyncing);
  const qqRecommendSyncing = useCloudStore((state) => state.qqRecommendSyncing);
  const qishuiRecommendSyncing = useCloudStore((state) => state.qishuiRecommendSyncing);
  const spotifyRecommendSyncing = useCloudStore((state) => state.spotifyRecommendSyncing);
  const neteaseLoading = useCloudStore((state) => state.neteaseLoading);
  const qqLoading = useCloudStore((state) => state.qqLoading);
  const qishuiLoading = useCloudStore((state) => state.qishuiLoading);
  const spotifyLoading = useCloudStore((state) => state.spotifyLoading);
  const neteaseError = useCloudStore((state) => state.neteaseError);
  const qqError = useCloudStore((state) => state.qqError);
  const qishuiError = useCloudStore((state) => state.qishuiError);
  const spotifyError = useCloudStore((state) => state.spotifyError);
  const neteaseRecommendError = useCloudStore((state) => state.neteaseRecommendError);
  const qqRecommendError = useCloudStore((state) => state.qqRecommendError);
  const qishuiRecommendError = useCloudStore((state) => state.qishuiRecommendError);
  const spotifyRecommendError = useCloudStore((state) => state.spotifyRecommendError);
  const syncNetease = useCloudStore((state) => state.syncNetease);
  const syncNeteaseRecommend = useCloudStore((state) => state.syncNeteaseRecommend);
  const syncQqRecommend = useCloudStore((state) => state.syncQqRecommend);
  const syncQq = useCloudStore((state) => state.syncQq);
  const syncQishui = useCloudStore((state) => state.syncQishui);
  const syncQishuiRecommend = useCloudStore((state) => state.syncQishuiRecommend);
  const syncSpotify = useCloudStore((state) => state.syncSpotify);
  const syncSpotifyRecommend = useCloudStore((state) => state.syncSpotifyRecommend);
  const openNeteasePlaylist = useCloudStore((state) => state.openNeteasePlaylist);
  const openNeteaseRecommend = useCloudStore((state) => state.openNeteaseRecommend);
  const playNeteasePersonalFm = useCloudStore((state) => state.playNeteasePersonalFm);
  const openQqPlaylist = useCloudStore((state) => state.openQqPlaylist);
  const openQqRecommend = useCloudStore((state) => state.openQqRecommend);
  const openQqRadar = useCloudStore((state) => state.openQqRadar);
  const playQqPersonalFm = useCloudStore((state) => state.playQqPersonalFm);
  const openQishuiPlaylist = useCloudStore((state) => state.openQishuiPlaylist);
  const openQishuiRecommend = useCloudStore((state) => state.openQishuiRecommend);
  const playQishuiRecent = useCloudStore((state) => state.playQishuiRecent);
  const playQishuiPersonalFm = useCloudStore((state) => state.playQishuiPersonalFm);
  const closeNeteasePlaylist = useCloudStore((state) => state.closeNeteasePlaylist);
  const closeQqPlaylist = useCloudStore((state) => state.closeQqPlaylist);
  const closeQishuiPlaylist = useCloudStore((state) => state.closeQishuiPlaylist);
  const openSpotifyPlaylist = useCloudStore((state) => state.openSpotifyPlaylist);
  const openSpotifyRecommend = useCloudStore((state) => state.openSpotifyRecommend);
  const closeSpotifyPlaylist = useCloudStore((state) => state.closeSpotifyPlaylist);
  const syncAppleLibrary = useAppleMusicStore((state) => state.syncLibrary);
  const syncAppleRecommend = useAppleMusicStore((state) => state.syncRecommend);
  const openApplePlaylist = useAppleMusicStore((state) => state.openPlaylist);
  const openAppleAlbum = useAppleMusicStore((state) => state.openAlbum);
  const closeApplePlaylist = useAppleMusicStore((state) => state.closePlaylist);
  const rememberAppleTracks = useAppleMusicStore((state) => state.rememberTracks);
  const refreshAppleStatus = useAppleMusicStore((state) => state.refreshStatus);
  const appleLoading = useAppleMusicStore((state) => state.loading);
  const appleSyncing = useAppleMusicStore((state) => state.syncing);
  const appleRecommendSyncing = useAppleMusicStore((state) => state.recommendSyncing);
  const appleError = useAppleMusicStore((state) => state.error);
  const appleRecommendError = useAppleMusicStore((state) => state.recommendError);
  const appleOpen = useAppleMusicStore((state) => state.open);

  const [authFallback, setAuthFallback] = useState(false);
  const [streamFresh, setStreamFresh] = useState(0);
  const crossPlayFallback = usePlaybackSettingsStore((state) => state.crossPlayFallback);
  const freePlaySource = usePlaybackSettingsStore((state) => state.freePlaySource);
  const preferredQuality = usePlaybackSettingsStore((state) => state.preferredQuality);
  const transitionEnabled = usePlaybackSettingsStore((state) => state.transitionEnabled);
  const transitionMode = usePlaybackSettingsStore((state) => state.transitionMode);
  const transitionSeconds = usePlaybackSettingsStore((state) => state.transitionSeconds);
  const track = queue[index] || null;
  const vipPlay = trackVipPlay(track, netease, qq);
  const authedPlay = !authFallback && trackAuthedPlay(track, netease, qq);
  // Prefer store quality immediately — waiting for the effect to fill `audioQuality`
  // used to rebuild mediaUrl (no level → level=exhigh) and restart the audio element.
  const playQuality = vipPlay ? (audioQuality || preferredQuality) : '';
  const mediaUrl = useMemo(
    () => buildPlayMediaUrl(track, {
      authed: authedPlay,
      audioQuality: playQuality,
      crossPlayFallback,
      freePlaySource,
      fresh: streamFresh,
    }),
    [authedPlay, crossPlayFallback, freePlaySource, playQuality, streamFresh, track],
  );
  const beatFxWantedRef = useBeatFxWantedRef(mediaUrl || null);
  const prefetchTrackMedia = useCallback((item: Track) => {
    const url = buildPlayMediaUrl(item, {
      authed: !authFallback && trackAuthedPlay(item, netease, qq),
      audioQuality: trackVipPlay(item, netease, qq) ? preferredQuality : '',
      crossPlayFallback,
      freePlaySource,
    });
    if (!url) return;
    void fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
      cache: 'no-store',
    }).catch(() => {});
  }, [authFallback, crossPlayFallback, freePlaySource, netease, preferredQuality, qq]);
  const deckList = useCallback((): Array<HTMLAudioElement | null> => (
    [audioRef.current, audioBRef.current]
  ), []);
  const clockAudio = useCallback((): HTMLAudioElement | null => {
    const blend = blendRef.current;
    const state = usePlayerStore.getState();
    const item = state.queue[state.index];
    const key = item ? `${item.type}:${item.songid}` : '';
    const els = deckList();
    if (blend && blend.incomingKey === key) return els[blend.incomingDeck] || els[activeDeckRef.current];
    return els[activeDeckRef.current] || audioRef.current;
  }, [deckList]);
  const fadeOf = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return null;
    try {
      return attachAudioGraph(audio, isWindowsApp() ? 128 : 256);
    } catch {
      return null;
    }
  }, []);
  const finishBlend = useCallback((token: number) => {
    const blend = blendRef.current;
    if (!blend || blend.token !== token) return;
    window.clearTimeout(blend.timer);
    const els = deckList();
    const outgoing = els[1 - blend.incomingDeck];
    const incoming = els[blend.incomingDeck];
    activeDeckRef.current = blend.incomingDeck;
    blendRef.current = null;
    if (outgoing) {
      outgoing.pause();
      const graph = fadeOf(outgoing);
      if (graph?.fade) {
        snapDeckGain(graph.fade, 0);
        resetDeckTone(graph);
      }
    }
    if (incoming) {
      const graph = fadeOf(incoming);
      if (graph?.fade) {
        snapDeckGain(graph.fade, 1);
        resetDeckTone(graph);
      }
    }
  }, [deckList, fadeOf]);
  const beginCrossfade = useCallback((nextIndex: number) => {
    if (blendRef.current) return;
    const state = usePlayerStore.getState();
    const next = state.queue[nextIndex];
    const current = state.queue[state.index];
    if (!next?.url || !current || isAppleTrack(next) || isAppleTrack(current)) return;
    if (`${next.type}:${next.songid}` === `${current.type}:${current.songid}`) return;
    const els = deckList();
    const outgoingDeck = activeDeckRef.current;
    const incomingDeck = 1 - outgoingDeck;
    const outgoing = els[outgoingDeck];
    const incoming = els[incomingDeck];
    if (!outgoing || !incoming) return;
    const outGraph = fadeOf(outgoing);
    const inGraph = fadeOf(incoming);
    if (!outGraph || !inGraph) return;
    const key = `${next.type}:${next.songid}`;
    const currentKey = `${current.type}:${current.songid}`;
    const remain = Number.isFinite(outgoing.duration)
      ? Math.max(0, outgoing.duration - outgoing.currentTime)
      : transitionSeconds;
    const room = Math.min(remain || transitionSeconds, Number.isFinite(outgoing.duration) ? outgoing.duration / 4 : 12, 14);
    const mode = usePlaybackSettingsStore.getState().transitionMode;
    const cachedFrom = peekTrackProfile(currentKey);
    const fromProfile = cachedFrom || profileFromTail(tailSamplesRef.current, 0.05);
    const plan = mode === 'automix'
      ? planAutomix(fromProfile, peekTrackProfile(key), Math.max(0.8, room), transitionSeconds)
      : plainBlend(Math.max(0.8, room), transitionSeconds);
    const token = ++blendTokenRef.current;
    const media = buildPlayMediaUrl(next, {
      authed: trackAuthedPlay(next, netease, qq),
      audioQuality: trackVipPlay(next, netease, qq) ? (audioQuality || preferredQuality) : '',
      crossPlayFallback,
      freePlaySource,
    });
    blendRef.current = { token, incomingDeck, incomingKey: key, timer: 0 };
    snapDeckGain(inGraph.fade, 0);
    resetDeckTone(inGraph);
    incoming.setAttribute('data-src', media);
    incoming.setAttribute('data-songid', key);
    incoming.src = media;
    try {
      if (plan.inStart > 0.05) incoming.currentTime = plan.inStart;
    } catch {
      // 元数据还没到，play 之后再对一次。
    }
    unlockAudio();
    void incoming.play().then(() => {
      if (blendRef.current?.token !== token) return;
      if (playbackIntentRef.current !== 'playing') {
        incoming.pause();
        blendRef.current = null;
        snapDeckGain(inGraph.fade, 0);
        resetDeckTone(inGraph);
        return;
      }
      if (plan.inStart > 0.2 && incoming.currentTime < plan.inStart * 0.5) {
        try { incoming.currentTime = plan.inStart; } catch { /* ignore */ }
      }
      let span = plan.overlap;
      try {
        span = scheduleBlend(outGraph, inGraph, plan);
      } catch {
        snapDeckGain(outGraph.fade, 0);
        snapDeckGain(inGraph.fade, 1);
      }
      playbackIntentRef.current = 'playing';
      const live = usePlayerStore.getState();
      live.playTracks(live.queue, nextIndex);
      const timer = window.setTimeout(() => finishBlend(token), span * 1000 + 80);
      if (blendRef.current?.token === token) blendRef.current.timer = timer;
    }).catch(() => {
      if (blendRef.current?.token !== token) return;
      blendRef.current = null;
      incoming.pause();
      snapDeckGain(inGraph.fade, 0);
      resetDeckTone(inGraph);
    });
  }, [audioQuality, crossPlayFallback, deckList, fadeOf, finishBlend, freePlaySource, netease, preferredQuality, qq, transitionSeconds]);
  const maybeCrossfadeRef = useRef<() => void>(() => {});
  maybeCrossfadeRef.current = () => {
    if (!transitionEnabled || blendRef.current) return;
    if (playbackIntentRef.current !== 'playing') return;
    if (transitionMode === 'automix' && performance.now() - tailStampRef.current > 50) {
      tailStampRef.current = performance.now();
      const level = readMixRms();
      if (level > 0) {
        tailSamplesRef.current.push(level);
        if (tailSamplesRef.current.length > 360) tailSamplesRef.current.shift();
      }
    }
    const state = usePlayerStore.getState();
    if (state.loopMode === 'one') return;
    const item = state.queue[state.index];
    if (!item || isAppleTrack(item)) return;
    const outgoing = deckList()[activeDeckRef.current];
    if (!outgoing || outgoing.paused) return;
    const dur = outgoing.duration;
    if (!Number.isFinite(dur) || dur < 8) return;
    const remain = dur - outgoing.currentTime;
    const room = Math.min(remain, dur / 4, 14);
    const nextIndex = state.index + 1 < state.queue.length
      ? state.index + 1
      : state.loopMode === 'all' && state.queue.length > 1
        ? 0
        : -1;
    if (nextIndex < 0) return;
    const next = state.queue[nextIndex];
    if (!next?.url || isAppleTrack(next)) return;
    const fromKey = `${item.type}:${item.songid}`;
    const nextKey = `${next.type}:${next.songid}`;
    if (transitionMode === 'automix') {
      const from = peekTrackProfile(fromKey) || profileFromTail(tailSamplesRef.current, 0.05);
      const to = peekTrackProfile(nextKey);
      if ((from === undefined || to === undefined) && remain > transitionSeconds + 0.6) return;
      const plan = planAutomix(from ?? null, to ?? null, Math.max(0.8, room), transitionSeconds);
      if (remain > plan.overlap + 0.35) return;
      if (plan.style !== 'beatCut' && remain < 0.45) return;
    } else if (room < 0.8 || remain > transitionSeconds + 0.3) {
      return;
    }
    beginCrossfade(nextIndex);
  };
  const theme = isDaylight ? DAYLIGHT_THEME : MIDNIGHT_THEME;
  const resolveAccent = useThemeAccentStore((state) => state.resolveAccent);
  const presetId = useThemeAccentStore((state) => state.presetId);
  const customColor = useThemeAccentStore((state) => state.customColor);
  const uiTint = useThemeAccentStore((state) => state.uiTint);
  const bgWash = useThemeAccentStore((state) => state.bgWash);
  const coverAccentEnabled = useThemeAccentStore((state) => state.coverAccentEnabled);
  const userAccent = useMemo(
    () => resolveAccent(isDaylight),
    [customColor, isDaylight, presetId, resolveAccent],
  );
  const effectiveAccent = useMemo(
    () => (coverAccentEnabled && accent ? accent : userAccent),
    [accent, coverAccentEnabled, userAccent],
  );

  const onAccent = useMemo(() => contrastText(effectiveAccent), [effectiveAccent]);
  const washVars = useMemo(() => accentWashVars(bgWash), [bgWash]);

  useEffect(() => {
    let cancelled = false;
    void loadCustomBackgroundImage().then((image) => {
      if (cancelled || !image?.url) return;
      setBackgroundConfig((prev) => {
        if (prev.customImage?.url) return prev;
        return { ...prev, customImage: image };
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-color', theme.backgroundColor);
    root.style.setProperty('--text-primary', theme.primaryColor);
    root.style.setProperty('--text-secondary', theme.secondaryColor);
    root.style.setProperty('--text-accent', effectiveAccent);
    root.style.setProperty('--text-on-accent', onAccent);
    root.style.setProperty('--accent-ui-mix', `${uiTint}%`);
    root.style.setProperty('--accent-ui-soft', `${Math.round(uiTint * 0.38)}%`);
    root.style.setProperty('--accent-ui-border', `${Math.round(uiTint * 0.55)}%`);
    root.style.setProperty('--accent-wash-a', washVars['--accent-wash-a']);
    root.style.setProperty('--accent-wash-b', washVars['--accent-wash-b']);
    root.style.setProperty('--accent-wash-c', washVars['--accent-wash-c']);
    root.style.setProperty('--accent-wash-d', washVars['--accent-wash-d']);
    root.style.colorScheme = isDaylight ? 'light' : 'dark';
    root.classList.toggle('theme-daylight', isDaylight);
    root.style.backgroundColor = theme.backgroundColor;
    document.body.style.backgroundColor = theme.backgroundColor;
    try {
      window.webkit?.messageHandlers?.ryanChrome?.postMessage({
        daylight: isDaylight,
        titlebarPassthrough: searchOpen,
      });
    } catch {
      // non-mac / no bridge
    }
  }, [bgWash, effectiveAccent, isDaylight, onAccent, searchOpen, theme.backgroundColor, theme.primaryColor, theme.secondaryColor, uiTint, washVars]);

  const isMobile = useIsMobile();
  const { active: webFullscreen } = useWebFullscreen();

  useEffect(() => {
    const root = document.documentElement;
    const dockVisible = Boolean(track);
    const dockExpanded = dockVisible && (view === 'player' ? !chromeHidden : true);
    root.classList.toggle('mobile-web-browser', isMobile && !isNativeApp());
    root.classList.toggle('web-fullscreen', webFullscreen);
    root.classList.toggle('player-dock-visible', dockVisible);
    root.classList.toggle('player-dock-expanded', dockExpanded);
  }, [chromeHidden, isMobile, track, view, webFullscreen]);

  // WKWebView：祖先 CSS user-select:none 会让搜索框也无法选中；改用 selectstart 只拦非输入区
  useEffect(() => {
    const canSelect = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ryan-allow-select'));
    };
    const onSelectStart = (event: Event) => {
      if (canSelect(event.target)) return;
      event.preventDefault();
    };
    document.addEventListener('selectstart', onSelectStart);
    return () => document.removeEventListener('selectstart', onSelectStart);
  }, []);

  const appStyle = useMemo(
    () =>
      ({
        '--bg-color': theme.backgroundColor,
        '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor,
        '--text-accent': effectiveAccent,
        '--text-on-accent': onAccent,
        '--accent-ui-mix': `${uiTint}%`,
        '--accent-ui-soft': `${Math.round(uiTint * 0.38)}%`,
        '--accent-ui-border': `${Math.round(uiTint * 0.55)}%`,
        ...washVars,
        backgroundColor: theme.backgroundColor,
        color: theme.primaryColor,
      }) as React.CSSProperties,
    [bgWash, effectiveAccent, onAccent, theme, uiTint, washVars],
  );

  const preferredQualityRef = useRef(preferredQuality);
  preferredQualityRef.current = preferredQuality;

  useEffect(() => {
    let cancelled = false;
    setQualityOptions([]);
    if (!track || track.type !== 'netease' || !vipPlay || authFallback) {
      setAudioQuality('');
      return;
    }
    setAudioQuality(preferredQualityRef.current);
    const timer = window.setTimeout(() => {
      void fetchNeteaseQualities(track.songid).then((res) => {
        if (cancelled) return;
        setQualityOptions(res.data?.qualities || []);
      }).catch(() => {
        if (!cancelled) setQualityOptions([]);
      });
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authFallback, vipPlay, track?.songid, track?.type]);

  useEffect(() => {
    if (!track || track.type !== 'netease' || !vipPlay || authFallback) return;
    setAudioQuality(preferredQuality);
  }, [authFallback, preferredQuality, track?.songid, track?.type, vipPlay]);


  const goHome = useCallback(() => {
    setStyleOpen(false);
    setPanelOpen(false);
    setChromeHidden(false);
    setView('home');
    if (returnToSearchRef.current) {
      returnToSearchRef.current = false;
      setSearchOpen(true);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const current = usePlayerStore.getState().queue[usePlayerStore.getState().index];
    if (isAppleTrack(current)) {
      nativeClockRef.current.time = time;
      nativeClockRef.current.stamp = performance.now();
      currentTime.set(time);
      void seekAppleMusic(time);
      return;
    }
    if (blendRef.current) finishBlend(blendRef.current.token);
    const audio = clockAudio();
    if (!audio) return;
    audio.currentTime = time;
    currentTime.set(time);
  }, [clockAudio, currentTime, finishBlend]);

  const startAppleQueue = useCallback((current: Track) => {
    const gen = ++appleCommandGenRef.current;
    const liveQueue = usePlayerStore.getState().queue.filter((item) => isAppleTrack(item));
    const start = Math.max(0, liveQueue.findIndex((item) => String(item.songid) === String(current.songid)));
    void playAppleMusic(liveQueue.length ? liveQueue : [current], start < 0 ? 0 : start)
      .catch((error) => {
        if (gen !== appleCommandGenRef.current) return;
        if (playbackIntentRef.current !== 'playing') return;
        setBuffering(false);
        setStatus('paused');
        playbackIntentRef.current = 'paused';
        usePlayerStore.getState().setError(error instanceof Error ? error.message : 'Apple Music 播放失败');
      });
  }, [setStatus]);

  const resumeWebAudioPlayback = useCallback(async () => {
    const wake = beginAudioWake();
    const audio = clockAudio();
    if (!audio) return;
    const blend = blendRef.current;
    const incoming = blend ? deckList()[blend.incomingDeck] : audio;
    const incomingGraph = fadeOf(incoming);
    if (incomingGraph?.fade) {
      rearmDeckOutput(incomingGraph.fade);
      resetDeckTone(incomingGraph);
    }
    if (!blend) {
      const idle = deckList().find((item) => item && item !== audio) || null;
      const idleGraph = fadeOf(idle);
      if (idleGraph?.fade) snapDeckGain(idleGraph.fade, 0);
    }
    const playTarget = incoming;
    if (!playTarget) return;
    if (wake.longPause) {
      const keep = Number.isFinite(playTarget.currentTime) ? playTarget.currentTime : 0;
      try { playTarget.currentTime = Math.max(0, keep - 0.03); } catch { /* 还不能 seek */ }
    }
    try {
      await playTarget.play();
    } catch {
      beginAudioWake();
      try { await playTarget.play(); } catch { /* ignore */ }
    }
    if (blend) {
      const outgoing = deckList()[1 - blend.incomingDeck];
      if (outgoing?.paused) void outgoing.play();
    }
  }, [clockAudio, deckList, fadeOf]);

  const togglePlay = useCallback(() => {
    const current = usePlayerStore.getState().queue[usePlayerStore.getState().index];
    if (!current) return;
    const liveStatus = usePlayerStore.getState().status;
    const shouldPause = playbackIntentRef.current === 'playing'
      || liveStatus === 'playing'
      || liveStatus === 'loading';
    if (shouldPause) {
      playbackIntentRef.current = 'paused';
      appleCommandGenRef.current += 1;
      setBuffering(false);
      setStatus('paused');
      nativeClockRef.current.playing = false;
      nativeClockRef.current.stamp = performance.now();
      if (isAppleTrack(current)) void pauseAppleMusic();
      else {
        deckList().forEach((audio) => audio?.pause());
        parkAudioGraph();
      }
      return;
    }
    playbackIntentRef.current = 'playing';
    setStatus('loading');
    setBuffering(true);
    if (isAppleTrack(current)) {
      const canResume = nativeClockRef.current.active
        && nativeClockRef.current.songId === String(current.songid);
      if (canResume) {
        void resumeAppleMusic().catch(() => {
          if (playbackIntentRef.current !== 'playing') return;
          startAppleQueue(current);
        });
        return;
      }
      startAppleQueue(current);
      return;
    }
    void resumeWebAudioPlayback();
  }, [deckList, resumeWebAudioPlayback, setStatus, startAppleQueue]);

  const playIndex = useCallback(
    (nextIndex: number, options?: { keepIntent?: boolean }) => {
      if (!queue.length) return;
      if (!options?.keepIntent) playbackIntentRef.current = 'playing';
      playTracks(queue, nextIndex);
    },
    [playTracks, queue],
  );

  const playNext = useCallback(
    (fromEnded = false) => {
      if (!queue.length) return;
      if (blendRef.current) {
        const incomingKey = blendRef.current.incomingKey;
        finishBlend(blendRef.current.token);
        if (fromEnded) return;
        // 自动交叉淡入已切到下一首时，手动再点「下一首」不应再跳一首。
        const live = usePlayerStore.getState();
        const current = live.queue[live.index];
        const currentKey = current ? `${current.type}:${current.songid}` : '';
        if (incomingKey && currentKey === incomingKey) return;
        const follow = live.index + 1 < live.queue.length
          ? live.index + 1
          : live.loopMode === 'all' && live.queue.length > 1
            ? 0
            : -1;
        if (follow >= 0) playIndex(follow, { keepIntent: true });
        return;
      }
      if (loopMode === 'one' && fromEnded) {
        playbackIntentRef.current = 'playing';
        seek(0);
        const current = usePlayerStore.getState().queue[usePlayerStore.getState().index];
        if (isAppleTrack(current)) startAppleQueue(current);
        else void clockAudio()?.play();
        return;
      }
      if (fromEnded) playbackIntentRef.current = 'playing';
      const keepIntent = !fromEnded;
      // 手动切歌硬切，避免交叉淡入半路上要点两次才到下一首。
      if (index + 1 < queue.length) {
        playIndex(index + 1, { keepIntent });
        return;
      }
      // 汽水电台：到队尾时续拉，不要按循环模式跳回第一首。
      if (qishuiRadioRef.current) {
        const session = qishuiRadioRef.current;
        if (session.extending) return;
        session.extending = true;
        void playQishuiPersonalFm({ scene: session.scene, first: false, limit: 20 })
          .then(async (entries) => {
            const live = usePlayerStore.getState();
            const known = new Set(live.queue.map((item) => `${item.type}:${item.songid}`));
            let appended = 0;
            for (const entry of entries) {
              const key = `${entry.type}:${entry.songid}`;
              if (known.has(key)) continue;
              known.add(key);
              try {
                const signed = await fetchSignedMedia(entry.type, entry.songid, {
                  title: entry.title,
                  author: entry.author,
                  delisted: entry.delisted,
                });
                if (!signed?.url || !qishuiRadioRef.current) continue;
                usePlayerStore.getState().addToQueue({
                  type: entry.type,
                  songid: String(entry.songid),
                  title: entry.title || '未知曲目',
                  author: entry.author || '',
                  lrc: '',
                  url: signed.url,
                  pic: signed.pic || entry.pic || '',
                  ...(signed.delisted || entry.delisted ? { delisted: true } : {}),
                });
                appended += 1;
              } catch {
                // skip
              }
            }
            if (!appended || !qishuiRadioRef.current) return;
            const next = usePlayerStore.getState();
            if (next.index + 1 < next.queue.length) {
              playIndex(next.index + 1, { keepIntent: true });
            }
          })
          .catch(() => {})
          .finally(() => {
            if (qishuiRadioRef.current) qishuiRadioRef.current.extending = false;
          });
        return;
      }
      if (loopMode === 'all') playIndex(0, { keepIntent });
    },
    [clockAudio, finishBlend, index, loopMode, playIndex, playQishuiPersonalFm, queue, seek, startAppleQueue],
  );

  const playPrev = useCallback(() => {
    if (index > 0) playIndex(index - 1, { keepIntent: true });
    else if (loopMode === 'all' && queue.length > 1) playIndex(queue.length - 1, { keepIntent: true });
  }, [index, loopMode, playIndex, queue.length]);

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
    setUpdateProgress(0);
    setUpdateProgressStage('准备下载…');
    try {
      const info = await installAppUpdate((progress) => {
        if (typeof progress.percent === 'number') {
          setUpdateProgress(progress.percent);
        }
        if (progress.stage) {
          setUpdateProgressStage(progress.stage);
        }
      });
      setUpdateInfo(info);
      if (info.installing) {
        setUpdateProgress(100);
        setUpdateProgressStage('即将重启…');
      }
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
      setUpdateProgress(null);
      setUpdateProgressStage('');
    }
  }, [updateInfo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasCompletedOnboarding()) {
        useOnboardingStore.getState().start();
        markWhatsNewSeen(APP_VERSION);
      } else if (shouldShowWhatsNew(APP_VERSION)) {
        setWhatsNewOpen(true);
      }
      void checkAppUpdate().then((info) => {
        if (info.ok && info.hasUpdate) setUpdateInfo(info);
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  const closeWhatsNew = useCallback(() => {
    markWhatsNewSeen(APP_VERSION);
    setWhatsNewOpen(false);
  }, []);

  const startGuide = useCallback(() => {
    setSettingsOpen(false);
    setLegalOpen(false);
    writeLegalQuery(null);
    setSearchOpen(false);
    setAccountOpen(false);
    setAccentPickerOpen(false);
    setUpdateOpen(false);
    setWhatsNewOpen(false);
    setLyricMatchOpen(false);
    setStyleOpen(false);
    setChromeHidden(false);
    setView('home');
    useOnboardingStore.getState().start();
  }, [writeLegalQuery]);

  const onGuideScene = useCallback((scene: 'home' | 'player') => {
    if (scene === 'player' && queue[index]) {
      setView('player');
      setChromeHidden(false);
      return;
    }
    setView('home');
  }, [index, queue]);

  const onGuideOpenPanel = useCallback(() => {
    setView('player');
    setChromeHidden(false);
    setPanelOpen(true);
  }, []);

  const runSearch = useCallback(
    async (
      text: string,
      page = 1,
      append = false,
      sourceOverride?: MusicSource,
      categoryOverride?: SearchCategory,
    ) => {
      const input = text.trim();
      if (!input) return;
      lastQueryRef.current = input;
      const activeSource = sourceOverride || searchSource;
      const activeCategory = categoryOverride || searchCategory;
      const clearResults = () => {
        setResults([]);
        setSearchBundle(null);
        setSearchPlaylists([]);
        setSearchAlbums([]);
        setSearchArtists([]);
      };
      if (append) setLoadingMore(true);
      else {
        setSearching(true);
        setSearchError('');
        if (page === 1) clearResults();
      }
      try {
        if (activeSource === 'apple') {
          const bundle = await searchAppleMusic(input, activeCategory);
          rememberAppleTracks(bundle.songs);
          const empty = !bundle.songs.length && !bundle.playlists.length && !bundle.albums.length && !bundle.artists.length;
          if (empty) {
            if (!append) setSearchError('没有找到相关信息');
            setHasMore(false);
            return;
          }
          if (activeCategory === 'all') {
            setSearchBundle((prev) => {
              if (!append || !prev) return bundle;
              return { ...prev, songs: [...prev.songs, ...bundle.songs] };
            });
            setResults((prev) => (append ? [...prev, ...bundle.songs] : bundle.songs));
          } else if (activeCategory === 'song') {
            setResults((prev) => (append ? [...prev, ...bundle.songs] : bundle.songs));
          } else if (activeCategory === 'playlist') {
            setSearchPlaylists((prev) => (append ? [...prev, ...bundle.playlists] : bundle.playlists));
          } else if (activeCategory === 'album') {
            setSearchAlbums((prev) => (append ? [...prev, ...bundle.albums] : bundle.albums));
          } else if (activeCategory === 'artist') {
            setSearchArtists((prev) => (append ? [...prev, ...bundle.artists] : bundle.artists));
          }
          setHasMore(false);
          setSearchPage(page);
          if (!append && page === 1) useSearchHistoryStore.getState().push(input);
          window.history.replaceState(null, '', `?name=${encodeURIComponent(input)}&type=apple&category=${activeCategory}`);
          return;
        }
        const filter = /^https?:\/\//i.test(input) ? 'url' as const : 'name' as const;
        const result = await searchMusic({
          input,
          filter,
          type: filter === 'url' ? '_' : activeSource,
          page,
          category: filter === 'name' ? activeCategory : 'song',
        });
        const empty = (() => {
          if (activeCategory === 'all' && result.data && typeof result.data === 'object' && 'songs' in result.data) {
            const bundle = result.data;
            return !bundle.songs.length && !bundle.playlists.length && !bundle.albums.length && !bundle.artists.length;
          }
          return !Array.isArray(result.data) || !result.data.length;
        })();
        if (result.code !== 200 || empty) {
          if (!append) setSearchError(result.error || '没有找到相关信息');
          setHasMore(false);
          return;
        }
        if (activeCategory === 'all' && result.data && typeof result.data === 'object' && 'songs' in result.data) {
          const bundle = result.data;
          setSearchBundle((prev) => {
            if (!append || !prev) return bundle;
            return { ...prev, songs: [...prev.songs, ...bundle.songs] };
          });
          setResults((prev) => (append ? [...prev, ...bundle.songs] : bundle.songs));
        } else if (activeCategory === 'song' && Array.isArray(result.data)) {
          setResults((prev) => (append ? [...prev, ...result.data as Track[]] : result.data as Track[]));
        } else if (activeCategory === 'playlist' && Array.isArray(result.data)) {
          setSearchPlaylists((prev) => (append ? [...prev, ...result.data as SearchPlaylistHit[]] : result.data as SearchPlaylistHit[]));
        } else if (activeCategory === 'album' && Array.isArray(result.data)) {
          setSearchAlbums((prev) => (append ? [...prev, ...result.data as SearchAlbumHit[]] : result.data as SearchAlbumHit[]));
        } else if (activeCategory === 'artist' && Array.isArray(result.data)) {
          setSearchArtists((prev) => (append ? [...prev, ...result.data as SearchArtistHit[]] : result.data as SearchArtistHit[]));
        }
        setHasMore(Boolean(result.has_more) && filter === 'name');
        setSearchPage(page);
        if (!append && page === 1 && filter === 'name') {
          useSearchHistoryStore.getState().push(input);
        }
        const url = filter === 'url'
          ? `?url=${encodeURIComponent(input)}`
          : `?name=${encodeURIComponent(input)}&type=${activeSource}&category=${activeCategory}`;
        window.history.replaceState(null, '', url);
      } catch (error) {
        if (!append) setSearchError(error instanceof Error ? error.message : '搜索失败');
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [rememberAppleTracks, searchCategory, searchSource],
  );

  useEffect(() => {
    tailSamplesRef.current = [];
  }, [track?.songid, track?.type]);

  useEffect(() => {
    if (!transitionEnabled || transitionMode !== 'automix' || !track || isAppleTrack(track) || !mediaUrl) return;
    const key = `${track.type}:${track.songid}`;
    const url = mediaUrl;
    const timer = window.setTimeout(() => primeTrackProfile(key, url), 12_000);
    return () => window.clearTimeout(timer);
  }, [mediaUrl, track, transitionEnabled, transitionMode]);

  useEffect(() => {
    if (!transitionEnabled || transitionMode !== 'automix') return;
    const next = index + 1 < queue.length
      ? queue[index + 1]
      : loopMode === 'all' && queue.length > 1
        ? queue[0]
        : null;
    if (!next?.url || isAppleTrack(next)) return;
    if (track && next.type === track.type && String(next.songid) === String(track.songid)) return;
    const url = buildPlayMediaUrl(next, {
      authed: trackAuthedPlay(next, netease, qq),
      audioQuality: trackVipPlay(next, netease, qq) ? (audioQuality || preferredQuality) : '',
      crossPlayFallback,
      freePlaySource,
    });
    if (url) primeTrackProfile(`${next.type}:${next.songid}`, url);
  }, [
    audioQuality,
    crossPlayFallback,
    freePlaySource,
    index,
    loopMode,
    netease,
    preferredQuality,
    qq,
    queue,
    track,
    transitionEnabled,
    transitionMode,
  ]);

  useEffect(() => {
    const loop = loopMode === 'one';
    deckList().forEach((audio) => {
      if (audio) audio.loop = loop;
    });
  }, [deckList, loopMode]);

  useEffect(() => {
    const primary = audioRef.current;
    const secondary = audioBRef.current;
    if (!primary) return;
    let graph: ReturnType<typeof attachAudioGraph> = null;
    try {
      graph = attachAudioGraph(primary, isWindowsApp() ? 128 : 256);
    } catch {
      graph = null;
    }
    if (secondary) {
      try {
        const idle = attachAudioGraph(secondary, isWindowsApp() ? 128 : 256);
        if (idle?.fade && !blendRef.current) snapDeckGain(idle.fade, 0);
      } catch {
        // 第二路接不上时仍保留单路播放。
      }
    }
    const analyser = graph?.analyser || null;

    let frame = 0;
    const syncClock = () => {
      const audio = clockAudio() || primary;
      const clock = nativeClockRef.current;
      const next = clock.active
        ? clock.time + (clock.playing ? (performance.now() - clock.stamp) / 1000 : 0)
        : audio.currentTime;
      currentTime.set(clock.duration > 0 ? Math.min(next, clock.duration) : next);
      pulseAudioBands(audioBands, analyser, clock.active ? clock.playing : !audio.paused);
      if (beatFxWantedRef.current) {
        const heardEl = clock.active ? null : audio;
        tickBeatFx(heardEl, graph?.context ?? null);
      }
      audioPower.set((
        audioBands.bass.get()
        + audioBands.lowMid.get()
        + audioBands.mid.get()
        + audioBands.vocal.get()
        + audioBands.treble.get()
      ) / 5);
      if (graph && graph.context.state !== 'running' && graph.context.state !== 'closed' && !audio.paused) {
        void graph.context.resume();
      }
      maybeCrossfadeRef.current();
      frame = requestAnimationFrame(syncClock);
    };
    frame = requestAnimationFrame(syncClock);

    const snapClock = () => {
      if (nativeClockRef.current.active) return;
      const audio = clockAudio() || primary;
      currentTime.set(audio.currentTime);
    };
    for (const audio of [primary, secondary]) {
      audio?.addEventListener('seeking', snapClock);
      audio?.addEventListener('seeked', snapClock);
      audio?.addEventListener('timeupdate', snapClock);
    }

    return () => {
      cancelAnimationFrame(frame);
      for (const audio of [primary, secondary]) {
        audio?.removeEventListener('seeking', snapClock);
        audio?.removeEventListener('seeked', snapClock);
        audio?.removeEventListener('timeupdate', snapClock);
      }
    };
  }, [audioBands, audioPower, clockAudio, currentTime]);

  useEffect(() => {
    setAuthFallback(false);
    setStreamFresh(0);
  }, [track?.songid, track?.type, netease?.loggedIn, netease?.vip, qq?.loggedIn, qq?.vip]);

  useEffect(() => {
    if (!track) return;
    if (isAppleTrack(track)) {
      if (blendRef.current) finishBlend(blendRef.current.token);
      deckList().forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.removeAttribute('src');
        audio.removeAttribute('data-src');
        audio.removeAttribute('data-songid');
      });
      return;
    }
    nativeClockRef.current.active = false;
    const songKey = `${track.type}:${track.songid}`;
    const blend = blendRef.current;
    if (blend?.incomingKey === songKey) {
      if (playbackIntentRef.current === 'paused') {
        deckList().forEach((audio) => audio?.pause());
        setBuffering(false);
        setStatus('paused');
        return;
      }
      setBuffering(false);
      setStatus('playing');
      return;
    }
    if (blend) finishBlend(blend.token);
    const audio = deckList()[activeDeckRef.current] || audioRef.current;
    const other = deckList()[1 - activeDeckRef.current];
    if (other && other !== audio) {
      other.pause();
      const idle = fadeOf(other);
      if (idle?.fade) {
        snapDeckGain(idle.fade, 0);
        resetDeckTone(idle);
      }
    }
    const activeFade = audio ? fadeOf(audio) : null;
    if (activeFade?.fade) {
      snapDeckGain(activeFade.fade, 1);
      resetDeckTone(activeFade);
    }
    if (!audio || !mediaUrl || !track) return;
    const previous = audio.getAttribute('data-src') || '';
    if (previous !== mediaUrl) {
      const sameSong = audio.getAttribute('data-songid') === songKey;
      const keep = sameSong ? audio.currentTime : 0;
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
    if (playbackIntentRef.current === 'paused') {
      audio.pause();
      setBuffering(false);
      setStatus('paused');
      return;
    }
    setBuffering(true);
    setStatus('loading');
    const startPlayback = async () => {
      await unlockAudio();
      const graph = fadeOf(audio);
      if (graph?.fade) {
        snapDeckGain(graph.fade, 1);
        resetDeckTone(graph);
      }
      if (graph?.context.state !== 'running' && graph?.context.state !== 'closed') {
        try { await graph.context.resume(); } catch { /* ignore */ }
      }
      try {
        await audio.play();
      } catch {
        if (playbackIntentRef.current !== 'playing') return;
        await unlockAudio();
        try { await audio.play(); } catch {
          if (playbackIntentRef.current === 'paused') setStatus('paused');
        }
      }
    };
    void startPlayback();
  }, [clockAudio, currentTime, deckList, fadeOf, finishBlend, mediaUrl, setDuration, setStatus, track?.songid, track?.type]);

  useEffect(() => {
    if (!isAppleTrack(track)) {
      if (nativeClockRef.current.active) {
        nativeClockRef.current.active = false;
        nativeClockRef.current.playing = false;
        void stopAppleMusic();
      }
      return;
    }
    const durationSec = (track.durationMs || 0) / 1000;
    nativeClockRef.current = {
      active: true,
      playing: false,
      time: 0,
      stamp: performance.now(),
      duration: durationSec,
      songId: String(track.songid),
    };
    currentTime.set(0);
    if (durationSec > 0) setDuration(durationSec);
    if (playbackIntentRef.current === 'paused') {
      appleCommandGenRef.current += 1;
      setBuffering(false);
      setStatus('paused');
      void pauseAppleMusic();
      return;
    }
    setBuffering(true);
    setStatus('loading');
    startAppleQueue(track);
  }, [currentTime, setDuration, setStatus, startAppleQueue, track?.songid, track?.type]);

  useEffect(() => {
    return subscribeAppleMusic((event) => {
      const type = String(event.type || '');
      const songId = String(event.songId || '');
      const time = Number(event.time) || 0;
      const nextDuration = Number(event.duration) || 0;
      const statusText = String(event.status || '');
      const clock = nativeClockRef.current;
      clock.time = time;
      clock.stamp = performance.now();
      clock.playing = statusText === 'playing';
      if (nextDuration > 0) clock.duration = nextDuration;
      if (songId) clock.songId = songId;
      if (playbackIntentRef.current === 'paused') {
        clock.playing = false;
        if (type === 'ended') return;
        if (statusText === 'playing' || statusText === 'loading') return;
        currentTime.set(time);
        setBuffering(false);
        setStatus('paused');
        return;
      }
      if (type === 'ended') {
        clock.playing = false;
        currentTime.set(time);
        setBuffering(false);
        playNext(true);
        return;
      }
      if (nextDuration > 0 && Math.abs(nextDuration - durationRef.current) > 0.25) {
        setDuration(nextDuration);
      }
      if (statusText === 'playing') {
        setBuffering(false);
        setStatus('playing');
      } else if (statusText === 'paused') {
        currentTime.set(time);
        setBuffering(false);
        setStatus('paused');
      } else if (statusText === 'loading') {
        setBuffering(true);
        setStatus('loading');
      }
    });
  }, [currentTime, playNext, setDuration, setStatus]);

  useEffect(() => {
    if (!queue.length) return;
    const currentKey = track ? `${track.type}:${track.songid}` : '';
    const upcoming: Track[] = [];
    if (index + 1 < queue.length) upcoming.push(queue[index + 1]);
    else if (loopMode === 'all' && queue[0]) upcoming.push(queue[0]);
    if (index + 2 < queue.length) upcoming.push(queue[index + 2]);
    for (const item of upcoming) {
      if (`${item.type}:${item.songid}` === currentKey) continue;
      prefetchTrackMedia(item);
    }
  }, [index, loopMode, prefetchTrackMedia, queue, track]);

  useEffect(() => {
    const list = homeTab === 'qq'
      ? qqTracks
      : homeTab === 'qishui'
        ? qishuiTracks
        : homeTab === 'spotify'
          ? spotifyTracks
          : neteaseTracks;
    if (!list.length) return;
    let cancelled = false;
    void (async () => {
      for (const item of list.slice(0, 3)) {
        if (cancelled) return;
        const signed = await fetchSignedMedia(item.type, item.songid, {
          title: item.title,
          author: item.author,
        });
        if (cancelled || !signed?.url) continue;
        await fetch(signed.url, {
          method: 'GET',
          headers: { Range: 'bytes=0-1' },
          cache: 'no-store',
        }).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homeTab, neteaseTracks, qishuiTracks, qqTracks, spotifyTracks]);

  // 汽水电台：队列剩不到 3 首时续拉一页，避免下一首要点到末尾才失效。
  useEffect(() => {
    const session = qishuiRadioRef.current;
    if (!session || session.extending) return;
    if (!track || track.type !== 'qishui') return;
    const remain = queue.length - index - 1;
    if (remain > 2) return;
    session.extending = true;
    void playQishuiPersonalFm({
      scene: session.scene,
      first: false,
      limit: 20,
    })
      .then(async (entries) => {
        const live = usePlayerStore.getState();
        const known = new Set(live.queue.map((item) => `${item.type}:${item.songid}`));
        for (const entry of entries) {
          const key = `${entry.type}:${entry.songid}`;
          if (known.has(key)) continue;
          known.add(key);
          try {
            const signed = await fetchSignedMedia(entry.type, entry.songid, {
              title: entry.title,
              author: entry.author,
              delisted: entry.delisted,
            });
            if (!signed?.url) continue;
            if (!qishuiRadioRef.current) return;
            usePlayerStore.getState().addToQueue({
              type: entry.type,
              songid: String(entry.songid),
              title: entry.title || '未知曲目',
              author: entry.author || '',
              lrc: '',
              url: signed.url,
              pic: signed.pic || entry.pic || '',
              ...(signed.delisted || entry.delisted ? { delisted: true } : {}),
            });
          } catch {
            // skip
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (qishuiRadioRef.current) qishuiRadioRef.current.extending = false;
      });
  }, [index, playQishuiPersonalFm, queue.length, track]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [ne, qqStatus, kgStatus, qsStatus, spStatus] = await Promise.all([
        fetchNeteaseStatus(),
        fetchQqStatus(),
        fetchKugouStatus(),
        fetchQishuiStatus(),
        fetchSpotifyStatus(),
      ]);
      void refreshAppleStatus();
      if (!alive) return;
      setNetease(ne.code === 200 ? ne.data : { loggedIn: false });
      setQq(qqStatus.code === 200 ? qqStatus.data : { loggedIn: false });
      setKugou(kgStatus.code === 200 ? kgStatus.data : { loggedIn: false });
      setQishui(qsStatus.code === 200 ? qsStatus.data : { loggedIn: false });
      setSpotify(spStatus.code === 200 ? spStatus.data : { loggedIn: false });
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const refreshAccounts = useCallback(() => {
    void Promise.all([
      fetchNeteaseStatus(),
      fetchQqStatus(),
      fetchKugouStatus(),
      fetchQishuiStatus(),
      fetchSpotifyStatus(),
      refreshAppleStatus(),
    ]).then(([ne, qqStatus, kgStatus, qsStatus, spStatus]) => {
      setNetease(ne.code === 200 ? ne.data : { loggedIn: false });
      setQq(qqStatus.code === 200 ? qqStatus.data : { loggedIn: false });
      setKugou(kgStatus.code === 200 ? kgStatus.data : { loggedIn: false });
      setQishui(qsStatus.code === 200 ? qsStatus.data : { loggedIn: false });
      setSpotify(spStatus.code === 200 ? spStatus.data : { loggedIn: false });
    });
  }, [refreshAppleStatus]);

  useEffect(() => {
    if (netease?.loggedIn) void syncNetease();
  }, [netease?.loggedIn, syncNetease]);

  useEffect(() => {
    if (netease?.loggedIn && neteaseLibrarySection === 'recommend') {
      void syncNeteaseRecommend();
    }
  }, [netease?.loggedIn, neteaseLibrarySection, syncNeteaseRecommend]);

  useEffect(() => {
    if (qq?.loggedIn && neteaseLibrarySection === 'recommend') {
      void syncQqRecommend();
    }
  }, [qq?.loggedIn, neteaseLibrarySection, syncQqRecommend]);

  useEffect(() => {
    if (qq?.loggedIn) void syncQq();
  }, [qq?.loggedIn, syncQq]);

  useEffect(() => {
    if (qishui?.loggedIn) void syncQishui();
  }, [qishui?.loggedIn, syncQishui]);

  useEffect(() => {
    if (qishui?.loggedIn && neteaseLibrarySection === 'recommend') {
      void syncQishuiRecommend();
    }
  }, [qishui?.loggedIn, neteaseLibrarySection, syncQishuiRecommend]);

  useEffect(() => {
    if (spotify?.loggedIn) void syncSpotify();
  }, [spotify?.loggedIn, syncSpotify]);

  useEffect(() => {
    if (spotify?.loggedIn && neteaseLibrarySection === 'recommend') {
      void syncSpotifyRecommend();
    }
  }, [spotify?.loggedIn, neteaseLibrarySection, syncSpotifyRecommend]);

  useEffect(() => {
    if (appleAccount.loggedIn) void syncAppleLibrary();
  }, [appleAccount.loggedIn, syncAppleLibrary]);

  useEffect(() => {
    if (appleAccount.loggedIn && neteaseLibrarySection === 'recommend') {
      void syncAppleRecommend();
    }
  }, [appleAccount.loggedIn, neteaseLibrarySection, syncAppleRecommend]);

  useEffect(() => {
    if (homeTab === 'apple' && !canUseAppleMusic()) {
      setHomeTab('netease');
      return;
    }
    if (homeTab === 'apple' || homeTab === 'qishui' || homeTab === 'spotify') return;
    const neIn = Boolean(netease?.loggedIn);
    const qqIn = Boolean(qq?.loggedIn);
    if (neIn && !qqIn && homeTab !== 'netease') setHomeTab('netease');
    else if (qqIn && !neIn && homeTab !== 'qq') setHomeTab('qq');
  }, [homeTab, netease?.loggedIn, qq?.loggedIn, setHomeTab]);

  useEffect(() => {
    if (!track) {
      setLyricsLoading(false);
      return;
    }
    const type = track.type;
    const id = track.songid;
    const title = track.title;
    const artist = track.author;
    const preferred = preferredLyricSource;
    const manualKey = trackKey({ type, songid: id });
    const manualSelection = hasManualLyricSelection(manualKey)
      ? getManualLyricSelection(manualKey)
      : null;
    let alive = true;
    const gen = ++lyricRequestGen.current;
    setLyricsLoading(true);

    const applyLyrics = (
      lyrics: Pick<Track, 'lrc' | 'yrc' | 'tlyric' | 'lyricSource' | 'lyricProviderSongId'> | null,
      fallbackSource?: Track['lyricSource'],
      providerSongId?: string,
    ) => {
      if (!alive || gen !== lyricRequestGen.current || !lyrics || !hasUsableTrackLyrics(lyrics)) return false;
      patchCurrentLyrics({
        ...lyrics,
        lyricSource: lyrics.lyricSource || fallbackSource,
        lyricProviderSongId: lyrics.lyricProviderSongId || providerSongId,
      }, { replace: true });
      return true;
    };

    const fetchExactLyrics = async (
      provider: 'netease' | 'qq' | 'kugou' | 'amll',
      providerSongId: string,
      durationMs: number,
    ) => fetchTrackLyrics({
      type,
      songid: id,
      title,
      artist,
      durationMs,
      preferred: provider,
      providerSongId,
      forceSource: true,
    });

    const applyManualSelection = async (durationMs: number) => {
      if (!manualSelection) return false;
      const lyrics = await fetchTrackLyrics({
        type,
        songid: id,
        title: manualSelection.title,
        artist: manualSelection.artist,
        album: manualSelection.album,
        durationMs: manualSelection.durationMs || durationMs,
        preferred: manualSelection.provider,
        providerSongId: manualSelection.providerSongId,
        kgHash: manualSelection.kgHash,
        amllPlatform: manualSelection.amllPlatform,
        forceSource: true,
      });
      return applyLyrics(lyrics, manualSelection.provider, manualSelection.providerSongId);
    };

    const runMatch = async (durationMs: number) => {
      const exactPromise = (type === 'netease' || type === 'qq')
        ? fetchExactLyrics(type, id, durationMs)
        : Promise.resolve(null);
      const bestPromise = fetchTrackLyrics({
        type,
        songid: id,
        title,
        artist,
        preferred,
        autoUseBest: autoUseBestLyrics,
        forceSource: !autoUseBestLyrics,
        durationMs,
      });

      const exact = await exactPromise;
      const showedNative = applyLyrics(exact, type, id);
      if (showedNative && alive && gen === lyricRequestGen.current) {
        setLyricsLoading(false);
        const current = usePlayerStore.getState().queue[usePlayerStore.getState().index];
        if (!autoUseBestLyrics || (current && isWordByWordLyricText(current.yrc))) return true;
      }

      const best = await bestPromise;
      if (
        best
        && (!showedNative || isWordByWordLyricText(best.yrc))
        && applyLyrics(best, best.lyricSource || preferred)
      ) {
        return true;
      }
      return showedNative;
    };

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const durationMs = durationRef.current > 0 ? durationRef.current * 1000 : 0;
          if (manualSelection && await applyManualSelection(durationMs)) return;
          if (await runMatch(durationMs)) return;

          if (type === 'netease' || type === 'qq') {
            const native = await fetchTrackLyrics({
              type,
              songid: id,
              title,
              artist,
              nativeOnly: true,
              durationMs,
            });
            applyLyrics(native, type);
          }
        } finally {
          if (alive && gen === lyricRequestGen.current) setLyricsLoading(false);
        }
      })();
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [
    autoUseBestLyrics,
    getManualLyricSelection,
    hasManualLyricSelection,
    patchCurrentLyrics,
    preferredLyricSource,
    track?.author,
    track?.songid,
    track?.title,
    track?.type,
  ]);

  const applyLyricCandidate = useCallback(async (candidate: LyricSearchCandidate) => {
    if (!track) return;
    const type = track.type;
    const id = track.songid;
    const durationMs = candidate.durationMs || (duration > 0 ? duration * 1000 : 0);
    const gen = ++lyricRequestGen.current;
    setLyricsSwitching(true);
    try {
      const lyrics = await fetchTrackLyrics({
        type,
        songid: id,
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        durationMs,
        preferred: candidate.provider,
        providerSongId: candidate.providerSongId,
        kgHash: candidate.kgHash,
        amllPlatform: candidate.amllPlatform,
        forceSource: true,
      });
      if (gen !== lyricRequestGen.current) return;
      if (!lyrics || !hasUsableTrackLyrics(lyrics)) {
        showToast({ kind: 'error', title: '未能应用歌词', detail: '该候选没有可用歌词' });
        return;
      }
      setManualLyricSelection(trackKey(track), candidate);
      patchCurrentLyrics(
        {
          ...lyrics,
          lyricSource: lyrics.lyricSource || candidate.provider,
          lyricProviderSongId: candidate.providerSongId,
        },
        { replace: true },
      );
      const sourceLabel = LYRIC_SOURCE_OPTIONS.find((item) => item.id === candidate.provider)?.label || candidate.provider;
      showToast({
        kind: 'success',
        title: '歌词已更新',
        detail: `${sourceLabel} · ${candidate.title}`,
      });
    } finally {
      if (gen === lyricRequestGen.current) setLyricsSwitching(false);
    }
  }, [duration, patchCurrentLyrics, setManualLyricSelection, track]);

  useEffect(() => {
    const next = queue[index + 1];
    if (!next?.url) return;
    const nextAuthed = trackAuthedPlay(next, netease, qq);
    try {
      const url = new URL(next.url, window.location.origin);
      url.searchParams.set('probe', '1');
      if (nextAuthed) url.searchParams.set('auth', '1');
      if (crossPlayFallback || next.delisted) {
        url.searchParams.set('cross', '1');
        if (next.title) url.searchParams.set('title', next.title);
        if (next.author) url.searchParams.set('artist', next.author);
      }
      if (next.delisted) url.searchParams.set('delisted', '1');
      const controller = new AbortController();
      void fetch(url, { signal: controller.signal }).catch(() => undefined);
      return () => controller.abort();
    } catch {
      return undefined;
    }
  }, [crossPlayFallback, index, netease?.loggedIn, qq?.loggedIn, queue]);

  useEffect(() => {
    if (!track) {
      setAccent(null);
      return;
    }
    const raw = track.pic || coverRefreshUrl(track.type, track.songid);
    const src = coverImageUrl(raw, 128);
    if (!src) {
      setAccent(null);
      return;
    }
    let cancelled = false;
    void extractAccentFromImage(src).then((color) => {
      if (!cancelled) setAccent(color);
    });
    return () => {
      cancelled = true;
    };
  }, [track?.pic, track?.songid, track?.type]);

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
    navigator.mediaSession.setActionHandler('play', () => {
      playbackIntentRef.current = 'playing';
      if (isAppleTrack(track)) {
        void resumeAppleMusic().catch(() => startAppleQueue(track));
      } else {
        void resumeWebAudioPlayback();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      playbackIntentRef.current = 'paused';
      appleCommandGenRef.current += 1;
      setStatus('paused');
      setBuffering(false);
      if (isAppleTrack(track)) void pauseAppleMusic();
      else {
        deckList().forEach((audio) => audio?.pause());
        parkAudioGraph();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
  }, [deckList, playNext, playPrev, resumeWebAudioPlayback, seek, setStatus, startAppleQueue, status, track]);

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
        const playlistOpen = homeTab === 'apple'
          ? appleOpen
          : homeTab === 'qq'
            ? qqOpen
            : homeTab === 'qishui'
              ? qishuiOpen
              : homeTab === 'spotify'
                ? spotifyOpen
                : neteaseOpen;
        if (view === 'home' && playlistOpen) {
          if (homeTab === 'apple') closeApplePlaylist();
          else if (homeTab === 'qq') closeQqPlaylist();
          else if (homeTab === 'qishui') closeQishuiPlaylist();
          else if (homeTab === 'spotify') closeSpotifyPlaylist();
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
    appleOpen,
    closeApplePlaylist,
    closeNeteasePlaylist,
    closeQishuiPlaylist,
    closeSpotifyPlaylist,
    closeQqPlaylist,
    currentTime,
    duration,
    goHome,
    homeTab,
    neteaseOpen,
    panelOpen,
    qishuiOpen,
    spotifyOpen,
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
    const category = params.get('category');
    const doc = parseLegalTab(params.get('doc'));
    if (type === 'qq' || type === 'netease' || type === 'qishui' || type === 'spotify' || (type === 'apple' && canUseAppleMusic())) {
      setHomeTab(type);
      setSearchSource(type);
    }
    if (
      category === 'all'
      || category === 'song'
      || category === 'playlist'
      || category === 'album'
      || category === 'artist'
    ) {
      setSearchCategory(category);
    }
    if (url || name) {
      const text = url || name || '';
      setQuery(text);
      setSearchOpen(true);
      void runSearch(
        text,
        1,
        false,
        type === 'qq' || type === 'netease' || type === 'qishui' || type === 'spotify' || type === 'apple' ? type : undefined,
      );
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
    if (!track || isAppleTrack(track)) return;
    const name = `${track.title}-${track.author}`;
    const playUrl = buildPlayMediaUrl(track, {
      authed: authedPlay,
      audioQuality: playQuality,
      crossPlayFallback,
      freePlaySource,
      fresh: streamFresh,
    }) || track.url;
    const download = new URL(buildDownloadUrl(playUrl, name), window.location.origin);
    if (track.title) download.searchParams.set('title', track.title);
    if (track.author) download.searchParams.set('artist', track.author);
    const url = download.toString();
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
      <TitlebarDragZone disabled={searchOpen} />
      <WindowControls isDaylight={isDaylight} autoHide={view === 'player'} />
      <div className="ryan-accent-wash" aria-hidden />
      {[audioRef, audioBRef].map((deckRef, deck) => (
        <audio
          key={deck}
          ref={deckRef}
          preload="auto"
          onPlay={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            if (isAppleTrack(usePlayerStore.getState().queue[usePlayerStore.getState().index])) return;
            setBuffering(false);
            setStatus('playing');
          }}
          onPause={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            if (isAppleTrack(usePlayerStore.getState().queue[usePlayerStore.getState().index])) return;
            setBuffering(false);
            setStatus('paused');
          }}
          onWaiting={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            if (!event.currentTarget.paused) setBuffering(true);
          }}
          onStalled={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            if (!event.currentTarget.paused) setBuffering(true);
          }}
          onPlaying={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            setBuffering(false);
          }}
          onCanPlay={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            setBuffering(false);
          }}
          onDurationChange={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            setDuration(event.currentTarget.duration || 0);
          }}
          onEnded={(event) => {
            if (isAppleTrack(usePlayerStore.getState().queue[usePlayerStore.getState().index])) return;
            const blend = blendRef.current;
            if (blend && event.currentTarget !== deckList()[blend.incomingDeck]) {
              finishBlend(blend.token);
              return;
            }
            playNext(true);
          }}
          onError={(event) => {
            if (event.currentTarget !== clockAudio()) return;
            if (isAppleTrack(usePlayerStore.getState().queue[usePlayerStore.getState().index])) return;
            setBuffering(false);
            if (authedPlay) setAuthFallback(true);
            if (streamFresh < 1) setStreamFresh(1);
          }}
        />
      ))}

      <div className={`absolute inset-0 z-10 ${view === 'home' ? '' : 'hidden'}`} aria-hidden={view !== 'home'}>
        <HomeView
          theme={theme}
          isDaylight={isDaylight}
          homeTab={homeTab}
          neteaseLibrarySection={neteaseLibrarySection}
          layoutMode={layoutMode}
          cardStyle={cardStyle}
          neteasePlaylists={neteasePlaylists}
          qqPlaylists={qqPlaylists}
          qishuiPlaylists={qishuiPlaylists}
          spotifyPlaylists={spotifyPlaylists}
          neteaseRecommendItems={neteaseRecommendItems}
          qqRecommendItems={qqRecommendItems}
          qishuiRecommendItems={qishuiRecommendItems}
          spotifyRecommendItems={spotifyRecommendItems}
          neteaseOpen={neteaseOpen}
          qqOpen={qqOpen}
          qishuiOpen={qishuiOpen}
          spotifyOpen={spotifyOpen}
          neteaseTracks={neteaseTracks}
          qqTracks={qqTracks}
          qishuiTracks={qishuiTracks}
          spotifyTracks={spotifyTracks}
          cloudLoading={homeTab === 'apple' ? appleLoading : homeTab === 'netease' ? neteaseLoading : homeTab === 'qq' ? qqLoading : homeTab === 'qishui' ? qishuiLoading : homeTab === 'spotify' ? spotifyLoading : false}
          cloudSyncing={homeTab === 'apple' ? appleSyncing : homeTab === 'netease' ? neteaseSyncing : homeTab === 'qq' ? qqSyncing : homeTab === 'qishui' ? qishuiSyncing : homeTab === 'spotify' ? spotifySyncing : false}
          recommendSyncing={homeTab === 'apple' ? appleRecommendSyncing : homeTab === 'netease' ? neteaseRecommendSyncing : homeTab === 'qq' ? qqRecommendSyncing : homeTab === 'qishui' ? qishuiRecommendSyncing : homeTab === 'spotify' ? spotifyRecommendSyncing : false}
          cloudError={homeTab === 'apple' ? appleError : homeTab === 'netease' ? neteaseError : homeTab === 'qq' ? qqError : homeTab === 'qishui' ? qishuiError : homeTab === 'spotify' ? spotifyError : ''}
          recommendError={homeTab === 'apple' ? appleRecommendError : homeTab === 'netease' ? neteaseRecommendError : homeTab === 'qq' ? qqRecommendError : homeTab === 'qishui' ? qishuiRecommendError : homeTab === 'spotify' ? spotifyRecommendError : ''}
          apple={appleAccount}
          qishui={qishui}
          spotify={spotify}
          hasCurrentTrack={Boolean(track)}
          searchQuery={query}
          updateAvailable={Boolean(updateInfo?.hasUpdate)}
          onSearchQueryChange={setQuery}
          onOpenSearch={(submit) => {
            setSearchSource(homeTab);
            setSearchOpen(true);
            if (submit && query.trim()) void runSearch(query, 1, false, homeTab);
          }}
          onHomeTabChange={setHomeTab}
          onNeteaseLibrarySectionChange={(section) => {
            if (neteaseOpen) closeNeteasePlaylist();
            if (qqOpen) closeQqPlaylist();
            if (qishuiOpen) closeQishuiPlaylist();
            if (spotifyOpen) closeSpotifyPlaylist();
            if (appleOpen) closeApplePlaylist();
            setNeteaseLibrarySection(section);
          }}
          onLayoutModeChange={setLayoutMode}
          onSelectEntry={(entry, queueEntries) => {
            unlockAudio();
            if (homeTab === 'netease' && neteaseOpen) {
              touchPlaylistRecent('netease', neteaseOpen.id);
            } else if (homeTab === 'qq' && qqOpen) {
              touchPlaylistRecent('qq', qqOpen.id);
            } else if (homeTab === 'qishui' && qishuiOpen) {
              touchPlaylistRecent('qishui', qishuiOpen.id);
            } else if (homeTab === 'spotify' && spotifyOpen) {
              touchPlaylistRecent('spotify', spotifyOpen.id);
            }
            returnToSearchRef.current = false;
            playbackIntentRef.current = 'playing';
            qishuiRadioRef.current = null;
            void playLibraryEntry(entry, queueEntries);
            setView('player');
            setChromeHidden(false);
          }}
          onOpenPlaylist={(item) => {
            if (homeTab === 'apple') {
              const id = String(item.id || '');
              const kind = item.kind
                || (id.startsWith('pl.') || id.startsWith('apple-chart-') ? 'catalog' : undefined);
              void openApplePlaylist(kind ? { ...item, kind } : item);
              return;
            }
            if (homeTab === 'qq') {
              if (item.recommendKind === 'daily' || item.id === '__qq_daily__') {
                void openQqRecommend({ ...item, recommendKind: 'daily' });
                return;
              }
              if (item.recommendKind === 'radar' || item.id === '__qq_radar__') {
                void openQqRadar({ ...item, recommendKind: 'radar' });
                return;
              }
              void openQqPlaylist(item);
            } else if (homeTab === 'qishui') {
              void openQishuiPlaylist(item);
            } else if (homeTab === 'spotify') {
              void openSpotifyPlaylist(item);
            } else {
              void openNeteasePlaylist(item);
            }
          }}
          onOpenRecommend={(item) => {
            if (homeTab === 'apple') {
              if (item.kind === 'album') {
                void openAppleAlbum(item.id, item.name, item.cover);
                return;
              }
              void openApplePlaylist({ ...item, kind: item.kind || 'catalog' });
              return;
            }
            if (homeTab === 'netease') {
              void openNeteaseRecommend(item);
            } else if (homeTab === 'qq') {
              if (item.recommendKind === 'daily') {
                void openQqRecommend(item);
              } else if (item.recommendKind === 'radar') {
                void openQqRadar(item);
              } else if (item.recommendKind === 'playlist') {
                void openQqPlaylist(item);
              }
            } else if (homeTab === 'qishui') {
              if (item.recommendKind === 'radio') {
                const scene = String(item.sceneId || '').trim()
                  || (String(item.id || '').startsWith('scene-') ? String(item.id).slice('scene-'.length) : '');
                void playQishuiPersonalFm({ scene: scene || undefined })
                  .then((entries) => {
                    if (!entries.length) return;
                    qishuiRadioRef.current = { scene: scene || undefined, extending: false };
                    returnToSearchRef.current = false;
                    playbackIntentRef.current = 'playing';
                    void playLibraryEntry(entries[0], entries);
                    setView('player');
                    setChromeHidden(false);
                  })
                  .catch((error) => {
                    showToast({ kind: 'error', title: error instanceof Error ? error.message : '拉取场景电台失败' });
                  });
                return;
              }
              if (item.recommendKind === 'daily') {
                void playQishuiRecent()
                  .then((entries) => {
                    if (!entries.length) return;
                    qishuiRadioRef.current = null;
                    returnToSearchRef.current = false;
                    playbackIntentRef.current = 'playing';
                    void playLibraryEntry(entries[0], entries);
                    setView('player');
                    setChromeHidden(false);
                  })
                  .catch((error) => {
                    showToast({ kind: 'error', title: error instanceof Error ? error.message : '拉取最近播放失败' });
                  });
                return;
              }
              void openQishuiRecommend(item);
            } else if (homeTab === 'spotify') {
              void openSpotifyRecommend(item);
            }
          }}
          onPlayPersonalFm={() => {
            if (homeTab === 'apple') {
              const items = useAppleMusicStore.getState().recommendItems;
              if (items[0]) void openApplePlaylist({ ...items[0], kind: items[0].kind || 'catalog' });
              return;
            }
            const fm = homeTab === 'qq'
              ? playQqPersonalFm
              : homeTab === 'qishui'
                ? () => playQishuiPersonalFm()
                : homeTab === 'spotify'
                  ? () => Promise.reject(new Error('Spotify 暂不提供私人电台'))
                  : playNeteasePersonalFm;
            void fm()
              .then((entries) => {
                if (!entries.length) return;
                qishuiRadioRef.current = homeTab === 'qishui' ? { extending: false } : null;
                returnToSearchRef.current = false;
                playbackIntentRef.current = 'playing';
                void playLibraryEntry(entries[0], entries);
                setView('player');
                setChromeHidden(false);
              })
              .catch((error) => {
                showToast({ kind: 'error', title: error instanceof Error ? error.message : '拉取推荐失败' });
              });
          }}
          onBackPlaylist={() => {
            if (homeTab === 'apple') closeApplePlaylist();
            else if (homeTab === 'qq') closeQqPlaylist();
            else if (homeTab === 'qishui') closeQishuiPlaylist();
            else if (homeTab === 'spotify') closeSpotifyPlaylist();
            else closeNeteasePlaylist();
          }}
          onToggleTheme={() => {
            const next = !isDaylight;
            setIsDaylight(next);
            localStorage.setItem(THEME_KEY, next ? 'daylight' : 'midnight');
          }}
          onOpenAccount={(provider) => {
            setAccountIntent((provider || homeTab) as AccountProviderId);
            setAccountOpen(true);
          }}
          onAccountsChanged={refreshAccounts}
          onOpenLegal={openLegal}
          onCheckUpdate={() => void openUpdate()}
          onOpenAccentPicker={() => setAccentPickerOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          netease={netease}
          qq={qq}
          kugou={kugou}
        />
      </div>

      {view === 'player' && (
        <PlayerView
          track={track}
          currentTime={currentTime}
          chromeHidden={chromeHidden}
          isDaylight={isDaylight}
          theme={theme}
          accent={effectiveAccent}
          visualizerMode={visualizerMode}
          background={backgroundConfig}
          onVisualizerModeChange={(mode) => {
            applyVisualizerMode(mode);
          }}
          audioPower={audioPower}
          audioBands={audioBands}
          paused={status !== 'playing'}
          buffering={(buffering || status === 'loading') && status !== 'paused'}
          lyricsLoading={lyricsLoading || lyricsSwitching}
          playerStatus={status}
          playerError={playerError}
          onBack={() => {
            if (styleOpen) {
              setStyleOpen(false);
              return;
            }
            goHome();
          }}
          isPanelOpen={panelOpen && !chromeHidden}
          onOpenPanel={() => {
            setPanelOpen(true);
          }}
          onLyricLineSeek={seek}
          onToggleChrome={() => {
            setChromeHidden((hidden) => {
              const nextHidden = !hidden;
              if (isMobileViewport() && nextHidden) setPanelOpen(false);
              return nextHidden;
            });
          }}
        />
      )}

      <SearchWorkspace
        open={searchOpen}
        query={query}
        source={searchSource}
        category={searchCategory}
        isDaylight={isDaylight}
        theme={theme}
        isSearching={searching}
        isLoadingMore={loadingMore}
        error={searchError}
        bundle={searchBundle}
        tracks={results}
        playlists={searchPlaylists}
        albums={searchAlbums}
        artists={searchArtists}
        hasMore={hasMore}
        onQueryChange={setQuery}
        onSourceChange={(next) => {
          setSearchSource(next);
          if (query.trim()) void runSearch(query, 1, false, next);
        }}
        onCategoryChange={(next) => {
          setSearchCategory(next);
          if (query.trim()) void runSearch(query, 1, false, undefined, next);
        }}
        onSubmit={() => void runSearch(query)}
        onClose={() => {
          returnToSearchRef.current = false;
          setQuery('');
          setResults([]);
          setSearchBundle(null);
          setSearchPlaylists([]);
          setSearchAlbums([]);
          setSearchArtists([]);
          setSearchError('');
          setSearchOpen(false);
        }}
        onPlay={(item, playAt) => {
          unlockAudio();
          returnToSearchRef.current = true;
          playbackIntentRef.current = 'playing';
          playTracks(results, playAt);
          setSearchOpen(false);
          setView('player');
          setChromeHidden(false);
        }}
        onPrefetch={prefetchTrackMedia}
        onAddQueue={(item) => {
          addToQueue(item);
        }}
        onLoadMore={() => {
          if (hasMore && !loadingMore) void runSearch(lastQueryRef.current, searchPage + 1, true);
        }}
        onHistorySelect={(text) => {
          setQuery(text);
          void runSearch(text);
        }}
        onOpenPlaylist={(playlist) => {
          const cloudPlaylist: CloudPlaylist = {
            id: playlist.id,
            name: playlist.name,
            cover: playlist.cover,
            trackCount: playlist.trackCount,
            kind: playlist.type === 'apple' ? 'catalog' : undefined,
          };
          returnToSearchRef.current = true;
          setSearchOpen(false);
          setView('home');
          setHomeTab(playlist.type);
          if (playlist.type === 'apple') void openApplePlaylist(cloudPlaylist);
          else if (playlist.type === 'qq') void openQqPlaylist(cloudPlaylist);
          else void openNeteasePlaylist(cloudPlaylist);
        }}
        onOpenAlbum={(album) => {
          if (album.type === 'apple') {
            returnToSearchRef.current = true;
            setSearchOpen(false);
            setView('home');
            setHomeTab('apple');
            void openAppleAlbum(album.id, album.name, album.cover);
            return;
          }
          setSearchCategory('song');
          void runSearch([album.artist, album.name].filter(Boolean).join(' '), 1, false, album.type, 'song');
        }}
        onOpenArtist={(artist) => {
          if (artist.type === 'apple') {
            void fetchAppleArtistSongs(artist.id).then((detail) => {
              rememberAppleTracks(detail.tracks);
              setSearchCategory('song');
              setResults(detail.tracks);
              setSearchBundle(null);
              setSearchPlaylists([]);
              setSearchAlbums([]);
              setSearchArtists([]);
              setHasMore(false);
            }).catch((error) => {
              setSearchError(error instanceof Error ? error.message : '加载艺人歌曲失败');
            });
            return;
          }
          setSearchCategory('song');
          void runSearch(artist.name, 1, false, artist.type, 'song');
        }}
      />

      <AccountModal
        open={accountOpen}
        isDaylight={isDaylight}
        theme={theme}
        netease={netease}
        qq={qq}
        kugou={kugou}
        apple={appleAccount}
        qishui={qishui}
        spotify={spotify}
        initialProvider={accountIntent}
        onClose={() => setAccountOpen(false)}
        onChanged={refreshAccounts}
        onLoggedIn={(provider) => {
          if (provider === 'netease' || provider === 'qq' || provider === 'apple' || provider === 'qishui' || provider === 'spotify') {
            setHomeTab(provider);
            if (provider === 'netease') {
              void syncNetease();
              if (neteaseLibrarySection === 'recommend') void syncNeteaseRecommend();
            } else if (provider === 'qq') {
              void syncQq();
            } else if (provider === 'qishui') {
              void syncQishui();
              if (neteaseLibrarySection === 'recommend') void syncQishuiRecommend();
            } else if (provider === 'spotify') {
              void syncSpotify();
              if (neteaseLibrarySection === 'recommend') void syncSpotifyRecommend();
            } else if (provider === 'apple') {
              void syncAppleLibrary();
              if (neteaseLibrarySection === 'recommend') void syncAppleRecommend();
            }
          }
        }}
        onSync={async (provider) => {
          if (provider !== 'netease' && provider !== 'qq' && provider !== 'apple' && provider !== 'qishui' && provider !== 'spotify') return;
          setHomeTab(provider);
          if (provider === 'netease') {
            await syncNetease();
            if (neteaseLibrarySection === 'recommend') await syncNeteaseRecommend();
          } else if (provider === 'qq') {
            await syncQq();
          } else if (provider === 'qishui') {
            await syncQishui();
            if (neteaseLibrarySection === 'recommend') await syncQishuiRecommend();
          } else if (provider === 'spotify') {
            await syncSpotify();
            if (neteaseLibrarySection === 'recommend') await syncSpotifyRecommend();
          } else {
            await syncAppleLibrary();
            if (neteaseLibrarySection === 'recommend') await syncAppleRecommend();
          }
        }}
        syncing={neteaseSyncing || qqSyncing || qishuiSyncing || spotifySyncing || neteaseRecommendSyncing || appleSyncing || appleRecommendSyncing || qishuiRecommendSyncing || spotifyRecommendSyncing}
        syncMessage={
          neteaseSyncing || qqSyncing || qishuiSyncing || spotifySyncing || neteaseRecommendSyncing || qishuiRecommendSyncing || spotifyRecommendSyncing
            ? '正在同步…'
            : [neteaseError, qqError, qishuiError, spotifyError, neteaseRecommendError, qishuiRecommendError, spotifyRecommendError].filter(Boolean).join(' ')
        }
      />

      <LyricMatchModal
        open={lyricMatchOpen}
        isDaylight={isDaylight}
        theme={theme}
        track={track}
        currentTime={currentTime}
        durationSec={duration}
        onClose={() => setLyricMatchOpen(false)}
        onSave={applyLyricCandidate}
      />

      <LegalModal
        open={legalOpen}
        tab={legalTab}
        isDaylight={isDaylight}
        theme={theme}
        onClose={closeLegal}
        onTabChange={openLegal}
        onReplayGuide={startGuide}
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
        progress={updateProgress}
        progressStage={updateProgressStage}
        onClose={() => setUpdateOpen(false)}
        onInstall={() => void runInstallUpdate()}
      />

      <ThemeAccentPicker
        open={accentPickerOpen}
        isDaylight={isDaylight}
        onClose={() => setAccentPickerOpen(false)}
      />
      <AppSettingsPanel
        open={settingsOpen}
        isDaylight={isDaylight}
        onClose={() => setSettingsOpen(false)}
        onReplayGuide={startGuide}
      />

      <FloatingPlayerControls
        status={status}
        currentTime={currentTime}
        duration={duration}
        loopMode={loopMode}
        currentView={view}
        canTogglePlay={Boolean(track)}
        canPrev={Boolean(track) && (index > 0 || (loopMode === 'all' && queue.length > 1))}
        canNext={Boolean(track) && (index + 1 < queue.length || Boolean(qishuiRadioRef.current) || loopMode === 'all')}
        isDaylight={isDaylight}
        buffering={(buffering || status === 'loading') && status !== 'paused'}
        isHidden={view === 'player' && chromeHidden}
        panelOpen={panelOpen}
        onSeek={seek}
        onTogglePlay={togglePlay}
        onToggleLoop={toggleLoop}
        onPrev={playPrev}
        onNext={() => playNext(false)}
        onNavigateToPlayer={() => {
          if (track) setView('player');
        }}
        onBack={() => {
          if (styleOpen) {
            setStyleOpen(false);
            return;
          }
          goHome();
        }}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        trackTitle={track?.title || ''}
        track={track}
      >
        {view === 'player' ? (
          <SidePanel
            open={panelOpen}
            visible={!chromeHidden}
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
            lyricsSwitching={lyricsSwitching}
            lyricsLoading={lyricsLoading}
            onStyleOpenChange={setStyleOpen}
            onVisualizerModeChange={(mode) => {
              applyVisualizerMode(mode);
            }}
            onBackgroundChange={(config) => {
              setBackgroundConfig(config);
              writeBackgroundConfig(config);
            }}
            onClose={() => setPanelOpen(false)}
            onOpen={() => setPanelOpen(true)}
            onHome={goHome}
            onDownloadSong={downloadSong}
            onDownloadLrc={downloadLrc}
            onPlayIndex={playIndex}
            onLyricLineSeek={seek}
            onOpenLyricMatch={() => setLyricMatchOpen(true)}
            qualityOptions={authedPlay && track?.type === 'netease' ? qualityOptions : []}
            audioQuality={audioQuality}
            onAudioQualityChange={setAudioQuality}
          />
        ) : null}
      </FloatingPlayerControls>
      <OnboardingTour
        isDaylight={isDaylight}
        loggedIn={Boolean(netease?.loggedIn || qq?.loggedIn || appleAccount.loggedIn)}
        hasTrack={Boolean(track)}
        onScene={onGuideScene}
        onOpenPanel={onGuideOpenPanel}
      />
      <ToastHost />
    </div>
  );
};

export default App;
