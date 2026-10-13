import React, { useEffect, useRef } from 'react';
import { DEFAULT_JIZURA_TUNING } from '../../../types';
import { type VisualizerSharedProps } from '../definition';
import VisualizerShell from '../VisualizerShell';
import { mountJizuraStage, type JizuraSnap } from './host';

const VisualizerJizura: React.FC<VisualizerSharedProps> = ({
  currentTime,
  lines,
  theme,
  audioPower,
  audioBands,
  songTitle,
  songArtist,
  paused = false,
  staticMode = false,
  background,
  visualizerOpacity,
  isDaylight,
  seed,
  backgroundStaticMode,
  isPanelOpen,
  onPlayerPanelGuideHotspotChange,
  coverUrl,
  jizuraTuning = DEFAULT_JIZURA_TUNING,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef({
    currentTime,
    lines,
    songTitle,
    songArtist,
    jizuraTuning,
  });
  latestRef.current = {
    currentTime,
    lines,
    songTitle,
    songArtist,
    jizuraTuning,
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return mountJizuraStage(host, (): JizuraSnap => {
      const latest = latestRef.current;
      return {
        time: latest.currentTime.get(),
        lines: latest.lines,
        title: latest.songTitle || '',
        artist: latest.songArtist || '',
        style: latest.jizuraTuning.style,
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

export default VisualizerJizura;
