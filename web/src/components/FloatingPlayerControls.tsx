import React, { useEffect, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { Pause, Play, Repeat, Repeat1 } from 'lucide-react';
import ProgressBar from './ProgressBar';
import { useCoarsePointer } from '../lib/media';
import type { LoopMode, PlayerStatus } from '../types';

const CONTROL_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 24,
};

interface FloatingPlayerControlsProps {
  title: string;
  status: PlayerStatus;
  currentTime: MotionValue<number>;
  duration: number;
  loopMode: LoopMode;
  currentView: 'home' | 'player';
  canTogglePlay: boolean;
  isDaylight: boolean;
  isHidden?: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onNavigateToPlayer: () => void;
}

const FloatingPlayerControls: React.FC<FloatingPlayerControlsProps> = ({
  title,
  status,
  currentTime,
  duration,
  loopMode,
  currentView,
  canTogglePlay,
  isDaylight,
  isHidden = false,
  onSeek,
  onTogglePlay,
  onToggleLoop,
  onNavigateToPlayer,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const expandTimeoutRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const coarsePointer = useCoarsePointer();
  const canAutoExpand = canTogglePlay && duration > 0;
  const showExpanded =
    isHovered
    || coarsePointer
    || (canAutoExpand && status !== 'playing' && currentView !== 'home');
  const glassBgExpanded = isDaylight
    ? 'bg-white/60 border border-white/20 shadow-xl'
    : 'bg-black/40 border border-white/5';
  const glassBgCollapsed = isDaylight
    ? 'bg-white/40 border border-white/20 shadow-lg hover:bg-white/50'
    : 'bg-black/20 border border-white/5 hover:bg-black/30';
  const trackColor = isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
  const primaryColor = 'var(--text-primary)';
  const secondaryColor = 'var(--text-secondary)';

  useEffect(() => () => {
    if (expandTimeoutRef.current) window.clearTimeout(expandTimeoutRef.current);
    if (collapseTimeoutRef.current) window.clearTimeout(collapseTimeoutRef.current);
  }, []);

  return (
    <motion.div
      className={`pointer-events-none absolute left-1/2 z-60 flex w-full -translate-x-1/2 justify-center px-3 transition-all duration-300 ${
        currentView === 'home' ? 'max-w-[calc(100vw-1.5rem)] md:max-w-lg' : 'max-w-lg md:px-4'
      }`}
      initial={false}
      animate={{ opacity: isHidden ? 0 : 1, y: isHidden ? 24 : 0, scale: isHidden ? 0.97 : 1 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{
        pointerEvents: isHidden ? 'none' : 'auto',
        bottom: 'max(1.25rem, calc(var(--safe-bottom) + 0.5rem))',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="pointer-events-auto flex w-full justify-center"
        onMouseEnter={() => {
          if (collapseTimeoutRef.current) {
            window.clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
          }
          if (expandTimeoutRef.current) return;
          expandTimeoutRef.current = window.setTimeout(() => {
            setIsHovered(true);
            expandTimeoutRef.current = null;
          }, 20);
        }}
        onMouseLeave={() => {
          if (expandTimeoutRef.current) {
            window.clearTimeout(expandTimeoutRef.current);
            expandTimeoutRef.current = null;
          }
          collapseTimeoutRef.current = window.setTimeout(() => {
            setIsHovered(false);
            collapseTimeoutRef.current = null;
          }, 100);
        }}
        style={{ paddingBottom: 32, marginBottom: -32 }}
      >
        <motion.div
          layout
          transition={{ layout: CONTROL_LAYOUT_SPRING }}
          onClick={() => {
            if (currentView === 'home') onNavigateToPlayer();
          }}
          className={`relative cursor-pointer overflow-hidden rounded-full shadow-2xl backdrop-blur-3xl transition-colors duration-300 ${
            showExpanded ? `w-full p-3 ${glassBgExpanded}` : `w-[92%] px-4 py-2 md:w-[60%] ${glassBgCollapsed}`
          }`}
        >
          <motion.div layout transition={{ layout: CONTROL_LAYOUT_SPRING }} className="w-full">
            {showExpanded ? (
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <div
                  className="col-span-3 row-start-1 min-w-0 truncate px-2 text-center text-sm font-bold select-none sm:col-span-1 sm:col-start-2"
                  style={{ color: primaryColor }}
                >
                  {title || 'RyanMusic'}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePlay();
                  }}
                  disabled={!canTogglePlay}
                  className={`col-start-2 row-start-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-none shadow-lg transition-transform sm:col-start-1 sm:row-span-2 sm:row-start-1 ${
                    canTogglePlay ? 'hover:scale-105' : 'cursor-not-allowed opacity-45'
                  }`}
                  style={{ backgroundColor: primaryColor, color: 'var(--bg-color)' }}
                >
                  {status === 'playing' ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" className="ml-1" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLoop();
                  }}
                  className={`col-start-1 row-start-2 justify-self-end rounded-full p-2 transition-colors sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:justify-self-auto ${
                    loopMode !== 'off'
                      ? isDaylight
                        ? 'bg-black/10 text-black'
                        : 'bg-white/20'
                      : 'opacity-40 hover:opacity-100'
                  }`}
                  style={{ color: primaryColor }}
                >
                  {loopMode === 'one' ? (
                    <Repeat1 size={18} />
                  ) : (
                    <Repeat size={18} />
                  )}
                </button>
                <div className="col-span-3 row-start-3 w-full px-2 sm:col-span-1 sm:col-start-2 sm:row-start-2">
                  <ProgressBar
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={onSeek}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    trackColor={trackColor}
                    disabled={!canTogglePlay}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-8 w-full items-center justify-center px-4">
                <ProgressBar
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={onSeek}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  trackColor={trackColor}
                  disabled={!canTogglePlay}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default FloatingPlayerControls;
