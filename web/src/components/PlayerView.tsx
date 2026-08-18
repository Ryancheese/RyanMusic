import React, { useEffect, useMemo, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import { ListMusic } from 'lucide-react';
import type { AudioBands, ThemeTokens, Track, VisualizerMode } from '../types';
import { findLatestActiveLineIndex, trackToVisualizerLines } from '../lib/lyrics';
import { prefersLightweightVisualizer } from '../lib/media';
import { coverRefreshUrl } from '../api';
import { toFoliaTheme } from '../lib/visualizer';
import VisualizerRenderer from './visualizer/VisualizerRenderer';

interface PlayerViewProps {
  track: Track | null;
  currentTime: MotionValue<number>;
  chromeHidden: boolean;
  isDaylight: boolean;
  theme: ThemeTokens;
  accent?: string | null;
  visualizerMode: VisualizerMode;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  audioPower: MotionValue<number>;
  audioBands: AudioBands;
  paused?: boolean;
  isPanelOpen?: boolean;
  onToggleChrome: () => void;
  onOpenPanel?: () => void;
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
  onVisualizerModeChange,
  audioPower,
  audioBands,
  paused = false,
  isPanelOpen = false,
  onToggleChrome,
  onOpenPanel,
  onLyricLineSeek,
}) => {
  const lines = useMemo(() => trackToVisualizerLines(track), [track]);
  const foliaTheme = useMemo(() => toFoliaTheme(theme, accent), [accent, theme]);
  const lightweight = useMemo(() => prefersLightweightVisualizer(), []);
  const [lineIndex, setLineIndex] = useState(-1);

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
    <div className="absolute inset-0 z-20 overflow-hidden" onClick={onToggleChrome}>
      {track && lines.length > 0 ? (
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
          coverUrl={track.pic || coverRefreshUrl(track.type, track.songid)}
          seed={track.songid}
          paused={paused}
          isPanelOpen={isPanelOpen}
          isPlayerChromeHidden={chromeHidden}
          onLyricLineSeek={onLyricLineSeek}
          background={{
            mode: 'common',
            common: {
              useCoverColorBg: true,
              disableGeometricBackground: lightweight,
            },
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm opacity-40">
          {track ? '暂无歌词' : '选择一首歌开始播放'}
        </div>
      )}

      {!chromeHidden && onOpenPanel && (
        <button
          type="button"
          className={`absolute right-4 z-40 rounded-full p-2.5 backdrop-blur-md md:hidden ${
            isDaylight ? 'bg-white/70' : 'bg-black/40'
          }`}
          style={{ top: 'max(1rem, calc(var(--safe-top) + 0.75rem))' }}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPanel();
          }}
          aria-label="打开正在播放"
        >
          <ListMusic size={16} />
        </button>
      )}
    </div>
  );
};

export default PlayerView;
