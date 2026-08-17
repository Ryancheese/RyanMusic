import React, { useEffect, useMemo, useState } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import { ListMusic, Palette } from 'lucide-react';
import type { ThemeTokens, Track, VisualizerMode } from '../types';
import { findLatestActiveLineIndex, lrcToVisualizerLines } from '../lib/lyrics';
import { createAudioBands, toFoliaTheme } from '../lib/visualizer';
import VisualizerRenderer from './visualizer/VisualizerRenderer';
import LyricsStylePicker from './LyricsStylePicker';

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
  onToggleChrome: () => void;
  onOpenPanel?: () => void;
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
  onToggleChrome,
  onOpenPanel,
}) => {
  const lines = useMemo(() => lrcToVisualizerLines(track?.lrc), [track?.lrc]);
  const audioBands = useMemo(() => createAudioBands(), []);
  const foliaTheme = useMemo(() => toFoliaTheme(theme, accent), [accent, theme]);
  const [lineIndex, setLineIndex] = useState(-1);
  const [styleOpen, setStyleOpen] = useState(false);

  useMotionValueEvent(audioPower, 'change', (power) => {
    audioBands.bass.set(power);
    audioBands.lowMid.set(power * 0.85);
    audioBands.mid.set(power * 0.7);
    audioBands.vocal.set(power * 0.8);
    audioBands.treble.set(power * 0.6);
  });

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
    <div className="absolute inset-0 z-0 overflow-hidden" onClick={onToggleChrome}>
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
          coverUrl={track.pic}
          seed={track.songid}
          paused={false}
          isPlayerChromeHidden={chromeHidden}
          background={{ mode: 'common', common: { useCoverColorBg: true } }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm opacity-40">
          {track ? '暂无歌词' : '选择一首歌开始播放'}
        </div>
      )}

      {!chromeHidden && (
        <>
          <button
            type="button"
            className={`absolute left-4 z-40 rounded-full px-3 py-2 text-xs backdrop-blur-xl md:left-6 ${
              isDaylight ? 'bg-white/70' : 'bg-black/40'
            }`}
            style={{ top: 'max(1rem, calc(var(--safe-top) + 0.75rem))' }}
            onClick={(event) => {
              event.stopPropagation();
              setStyleOpen(true);
            }}
          >
            <span className="flex items-center gap-1.5">
              <Palette size={14} />
              歌词样式
            </span>
          </button>
          {onOpenPanel && (
            <button
              type="button"
              className={`absolute right-4 z-40 rounded-full p-2.5 backdrop-blur-xl md:hidden ${
                isDaylight ? 'bg-white/70' : 'bg-black/40'
              }`}
              style={{ top: 'max(1rem, calc(var(--safe-top) + 0.75rem))' }}
              onClick={(event) => {
                event.stopPropagation();
                onOpenPanel();
              }}
              aria-label="打开播放队列"
            >
              <ListMusic size={16} />
            </button>
          )}
        </>
      )}

      <LyricsStylePicker
        open={styleOpen}
        mode={visualizerMode}
        isDaylight={isDaylight}
        onClose={() => setStyleOpen(false)}
        onChange={(mode) => {
          onVisualizerModeChange(mode);
          setStyleOpen(false);
        }}
      />
    </div>
  );
};

export default PlayerView;
