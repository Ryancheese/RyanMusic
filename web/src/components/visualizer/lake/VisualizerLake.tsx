import React, { useEffect, useRef } from 'react';
import { DEFAULT_LAKE_TUNING } from '../../../types';
import { getSizedCoverUrl } from '../../../utils/coverUrl';
import { type VisualizerSharedProps } from '../definition';
import VisualizerShell from '../VisualizerShell';
import { mountUniverseStage, type LakeSnap } from './host';

const VisualizerLake: React.FC<VisualizerSharedProps> = ({
  currentTime,
  lines,
  theme,
  audioPower,
  audioBands,
  showText = true,
  songTitle,
  songArtist,
  songAlbum,
  songDuration,
  coverUrl,
  paused = false,
  staticMode = false,
  background,
  visualizerOpacity,
  isDaylight,
  seed,
  backgroundStaticMode,
  isPanelOpen,
  onPlayerPanelGuideHotspotChange,
  lakeTuning = DEFAULT_LAKE_TUNING,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef({
    currentTime,
    lines,
    theme,
    audioPower,
    audioBands,
    songTitle,
    songArtist,
    songAlbum,
    songDuration,
    coverUrl,
    paused,
    staticMode,
    lakeTuning,
  });
  latestRef.current = {
    currentTime,
    lines,
    theme,
    audioPower,
    audioBands,
    songTitle,
    songArtist,
    songAlbum,
    songDuration,
    coverUrl,
    paused,
    staticMode,
    lakeTuning,
  };
  void showText;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return mountUniverseStage(host, (): LakeSnap => {
      const latest = latestRef.current;
      return {
        time: latest.currentTime.get(),
        lines: latest.lines,
        title: latest.songTitle || '',
        artist: latest.songArtist || '',
        album: latest.songAlbum || '',
        duration: latest.songDuration || 0,
        coverUrl: getSizedCoverUrl(latest.coverUrl, 512) || '',
        accent: latest.theme.accentColor || latest.theme.primaryColor,
        outline: latest.lakeTuning.outline,
        look: latest.lakeTuning.look,
        paused: latest.paused || latest.staticMode,
        power: latest.audioPower.get(),
        bands: latest.audioBands,
      };
    });
  }, []);

  return (
    <VisualizerShell
      theme={theme}
      audioPower={audioPower}
      audioBands={audioBands}
      visualizerOpacity={visualizerOpacity}
      sharedProps={{
        coverUrl,
        isDaylight,
        seed,
        visualizerOpacity,
        background,
        staticMode,
        backgroundStaticMode,
        paused,
        isPanelOpen,
        onPlayerPanelGuideHotspotChange,
      }}
    >
      <div ref={hostRef} className="absolute inset-0 z-10" />
    </VisualizerShell>
  );
};

export default VisualizerLake;
