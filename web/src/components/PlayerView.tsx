import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type MotionValue } from 'framer-motion';
import type { AudioBands, PlayerStatus, ThemeTokens, Track, VisualizerMode } from '../types';
import type { VisualizerBackgroundConfig } from './visualizer/backgrounds/definition';
import { findLatestActiveLineIndex, resolveVisualizerLyrics } from '../lib/lyrics';
import { useLyricSettingsStore } from '../store/lyricSettingsStore';
import { useTemperaTuningStore } from '../store/temperaTuningStore';
import { coverRefreshUrl } from '../api';
import { toFoliaTheme } from '../lib/visualizer';
import VisualizerRenderer from './visualizer/VisualizerRenderer';
import CommentAtmosphereOverlay from './CommentAtmosphereOverlay';
import RyanLoader from './RyanLoader';

interface PlayerViewProps {
  track: Track | null;
  currentTime: MotionValue<number>;
  chromeHidden: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  accent?: string | null;
  visualizerMode: VisualizerMode;
  background: VisualizerBackgroundConfig;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  audioPower: MotionValue<number>;
  audioBands: AudioBands;
  paused?: boolean;
  buffering?: boolean;
  /** 歌词首次拉取 / 切源中 */
  lyricsLoading?: boolean;
  playerStatus?: PlayerStatus;
  playerError?: string;
  isPanelOpen?: boolean;
  onToggleChrome: () => void;
  onOpenPanel?: () => void;
  onBack?: () => void;
  onLyricLineSeek?: (time: number) => void;
}

const PlayerView: React.FC<PlayerViewProps> = ({
  track,
  currentTime,
  chromeHidden,
  isDaylight,
  theme,
  accent,
  visualizerMode,
  background,
  audioPower,
  audioBands,
  paused = false,
  buffering = false,
  lyricsLoading = false,
  playerStatus = 'idle',
  playerError = '',
  isPanelOpen = false,
  onToggleChrome,
  onLyricLineSeek,
}) => {
  const lyricFilterPattern = useLyricSettingsStore((state) => (
    state.filterEnabled ? state.filterPattern : ''
  ));
  const temperaTuning = useTemperaTuningStore((state) => state.tuning);
  const resolvedLyrics = useMemo(
    () => resolveVisualizerLyrics(track, lyricFilterPattern),
    [lyricFilterPattern, track],
  );
  const lines = resolvedLyrics.lines;
  const foliaTheme = useMemo(() => toFoliaTheme(theme, accent), [accent, theme]);
  const [lineIndex, setLineIndex] = useState(-1);
  const coverUrl = track ? (track.pic || coverRefreshUrl(track.type, track.songid)) : undefined;
  const showSongLoading = Boolean(track && (buffering || (playerStatus === 'loading' && !track.url)));
  const showLyricsLoading = Boolean(track && track.url && lyricsLoading && !buffering);
  const loadingHint = showSongLoading ? '歌曲加载中' : showLyricsLoading ? '歌词加载中' : null;
  const showPlayError = Boolean(track && !track.url && playerStatus === 'idle' && playerError);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const next = findLatestActiveLineIndex(lines, currentTime.get());
      setLineIndex((prev) => (prev === next ? prev : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentTime, lines]);

  return (
    <div className="absolute inset-0 z-20 h-full w-full overflow-hidden" onClick={onToggleChrome}>
      {track && track.url ? (
        <div className="absolute inset-0 h-full w-full">
          <VisualizerRenderer
            mode={visualizerMode}
            currentTime={currentTime}
            currentLineIndex={lineIndex}
            lines={lines}
            theme={foliaTheme}
            isDaylight={isDaylight}
            audioPower={audioPower}
            audioBands={audioBands}
            showText
            songTitle={track.title}
            songArtist={track.author}
            coverUrl={coverUrl}
            seed={track.songid}
            paused={paused}
            isPanelOpen={isPanelOpen}
            isPlayerChromeHidden={chromeHidden}
            onLyricLineSeek={onLyricLineSeek}
            background={background}
            visualizerTunings={{ tempera: temperaTuning }}
          />
          <CommentAtmosphereOverlay
            track={track}
            isDaylight={isDaylight}
            chromeHidden={chromeHidden}
            isPanelOpen={isPanelOpen}
          />
        </div>
      ) : showPlayError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-sm font-medium opacity-70">{track?.title || '无法播放'}</p>
          <p className="text-sm opacity-45">{playerError}</p>
        </div>
      ) : track && playerStatus === 'loading' ? (
        <div className="flex h-full items-center justify-center">
          <RyanLoader size={36} label="正在加载歌曲" />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm opacity-40">
          选择一首歌开始播放
        </div>
      )}

      <AnimatePresence>
        {loadingHint ? (
          <motion.div
            key={loadingHint}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 backdrop-blur-md"
              style={{
                backgroundColor: isDaylight ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.48)',
                boxShadow: isDaylight
                  ? '0 10px 28px rgba(0,0,0,0.12)'
                  : '0 12px 32px rgba(0,0,0,0.35)',
                color: isDaylight ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.92)',
              }}
            >
              <RyanLoader size={18} />
              <span className="text-[12px] font-medium tracking-wide">{loadingHint}</span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default PlayerView;
