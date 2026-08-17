import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { DAYLIGHT_THEME, MIDNIGHT_THEME, type AppView, type MusicSource, type Track, type VisualizerMode } from './types';
import { buildDownloadUrl, canNativeSave, nativeSave, searchMusic } from './api';
import { extractAccentFromImage } from './lib/color';
import { isMobileViewport } from './lib/media';
import { readVisualizerMode, writeVisualizerMode } from './lib/visualizer';
import { useLibraryStore } from './store/libraryStore';
import { usePlayerStore } from './store/playerStore';
import FloatingPlayerControls from './components/FloatingPlayerControls';
import HomeView from './components/HomeView';
import PlayerView from './components/PlayerView';
import SearchWorkspace from './components/SearchWorkspace';
import SidePanel from './components/SidePanel';

const THEME_KEY = 'ryanmusic-theme';

function readTheme(): boolean {
  return localStorage.getItem(THEME_KEY) === 'daylight';
}

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTime = useMotionValue(0);
  const audioPower = useMotionValue(0);
  const [view, setView] = useState<AppView>('home');
  const [isDaylight, setIsDaylight] = useState(readTheme);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(readVisualizerMode);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [panelOpen, setPanelOpen] = useState(() => !isMobileViewport());
  const [chromeHidden, setChromeHidden] = useState(false);
  const [accent, setAccent] = useState<string | null>(null);
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
  const toggleLoop = usePlayerStore((state) => state.toggleLoop);
  const setStatus = usePlayerStore((state) => state.setStatus);
  const setDuration = usePlayerStore((state) => state.setDuration);

  const liked = useLibraryStore((state) => state.liked);
  const recent = useLibraryStore((state) => state.recent);
  const playlist = useLibraryStore((state) => state.playlist);
  const homeTab = useLibraryStore((state) => state.homeTab);
  const channel = useLibraryStore((state) => state.channel);
  const setHomeTab = useLibraryStore((state) => state.setHomeTab);
  const setChannel = useLibraryStore((state) => state.setChannel);
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const isLiked = useLibraryStore((state) => state.isLiked);
  const addToPlaylist = useLibraryStore((state) => state.addToPlaylist);

  const track = queue[index] || null;
  const theme = isDaylight ? DAYLIGHT_THEME : MIDNIGHT_THEME;
  const appStyle = useMemo(
    () =>
      ({
        '--bg-color': theme.backgroundColor,
        '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor,
        '--text-accent': accent || theme.accentColor,
        backgroundColor: theme.backgroundColor,
        color: theme.primaryColor,
      }) as React.CSSProperties,
    [accent, theme],
  );

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
    let context: AudioContext;
    let analyser: AnalyserNode;
    try {
      context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(context.destination);
    } catch {
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      audioPower.set(sum / data.length / 255);
      if (context.state === 'suspended' && !audio.paused) {
        void context.resume();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioPower]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.url) return;
    if (audio.src !== track.url) {
      audio.src = track.url;
      currentTime.set(0);
      setDuration(0);
    }
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => setStatus('playing')).catch(() => setStatus('paused'));
    }
  }, [currentTime, setDuration, setStatus, track?.url]);

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
        if (searchOpen) setSearchOpen(false);
        else setView('home');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTime, duration, searchOpen, seek, togglePlay]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const url = params.get('url');
    const type = params.get('type');
    if (type === 'qq' || type === 'netease') setSource(type);
    if (url || name) {
      const text = url || name || '';
      setQuery(text);
      setSearchOpen(true);
      void runSearch(text, 1, false, type === 'qq' || type === 'netease' ? type : undefined);
    }
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
    <div className="fixed inset-0 flex h-full w-full flex-col overflow-hidden font-sans transition-colors duration-500" style={appStyle}>
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setStatus('playing')}
        onPause={() => setStatus('paused')}
        onTimeUpdate={(event) => currentTime.set(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => playNext(true)}
      />

      <div className={`absolute inset-0 z-10 ${view === 'home' ? '' : 'pointer-events-none opacity-0'}`}>
        <HomeView
          theme={theme}
          isDaylight={isDaylight}
          source={source}
          homeTab={homeTab}
          channel={channel}
          liked={liked}
          recent={recent}
          playlist={playlist}
          hasCurrentTrack={Boolean(track)}
          searchQuery={query}
          onSearchQueryChange={setQuery}
          onOpenSearch={(submit) => {
            setSearchOpen(true);
            if (submit && query.trim()) void runSearch(query);
          }}
          onSourceChange={setSource}
          onHomeTabChange={setHomeTab}
          onChannelChange={setChannel}
          onSelectEntry={(entry, queueEntries) => {
            void playLibraryEntry(entry, queueEntries);
            setView('player');
            setPanelOpen(!isMobileViewport());
            setChromeHidden(false);
          }}
          onToggleTheme={() => {
            const next = !isDaylight;
            setIsDaylight(next);
            localStorage.setItem(THEME_KEY, next ? 'daylight' : 'midnight');
          }}
        />
      </div>

      {view === 'player' && (
        <PlayerView
          track={track}
          currentTime={currentTime}
          chromeHidden={chromeHidden}
          isDaylight={isDaylight}
          theme={theme}
          accent={accent}
          visualizerMode={visualizerMode}
          onVisualizerModeChange={(mode) => {
            setVisualizerMode(mode);
            writeVisualizerMode(mode);
          }}
          audioPower={audioPower}
          onOpenPanel={() => setPanelOpen(true)}
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
          addToPlaylist(item);
          setSearchOpen(false);
          setView('player');
          setPanelOpen(!isMobileViewport());
          setChromeHidden(false);
        }}
        onAddQueue={(item) => {
          addToQueue(item);
          addToPlaylist(item);
        }}
        onLoadMore={() => {
          if (hasMore && !loadingMore) void runSearch(lastQueryRef.current, searchPage + 1, true);
        }}
      />

      {view === 'player' && !chromeHidden && (
        <SidePanel
          open={panelOpen}
          isDaylight={isDaylight}
          theme={theme}
          track={track}
          queue={queue}
          index={index}
          liked={isLiked(track)}
          onClose={() => setPanelOpen(false)}
          onHome={() => setView('home')}
          onLike={() => track && toggleLike(track)}
          onDownloadSong={downloadSong}
          onDownloadLrc={downloadLrc}
          onPlayIndex={playIndex}
          onPrev={playPrev}
          onNext={() => playNext(false)}
        />
      )}

      <FloatingPlayerControls
        title={track ? `${track.title} · ${track.author}` : 'RyanMusic'}
        status={status}
        currentTime={currentTime}
        duration={duration}
        loopMode={loopMode}
        currentView={view}
        canTogglePlay={Boolean(track)}
        isDaylight={isDaylight}
        isHidden={view === 'player' && chromeHidden}
        onSeek={seek}
        onTogglePlay={togglePlay}
        onToggleLoop={toggleLoop}
        onNavigateToPlayer={() => {
          if (track) setView('player');
        }}
      />
    </div>
  );
};

export default App;
