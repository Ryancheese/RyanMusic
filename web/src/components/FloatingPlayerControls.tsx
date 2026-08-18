import React, { useEffect, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react';
import ProgressBar from './ProgressBar';
import RyanLoader from './RyanLoader';
import { useCoarsePointer } from '../lib/media';
import type { LoopMode, PlayerStatus } from '../types';

const CONTROL_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 24,
};

interface FloatingPlayerControlsProps {
  status: PlayerStatus;
  currentTime: MotionValue<number>;
  duration: number;
  loopMode: LoopMode;
  currentView: 'home' | 'player';
  canTogglePlay: boolean;
  canPrev: boolean;
  canNext: boolean;
  isDaylight: boolean;
  buffering?: boolean;
  isHidden?: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNavigateToPlayer: () => void;
}

const FloatingPlayerControls: React.FC<FloatingPlayerControlsProps> = ({
  status,
  currentTime,
  duration,
  loopMode,
  currentView,
  canTogglePlay,
  canPrev,
  canNext,
  isDaylight,
  buffering = false,
  isHidden = false,
  onSeek,
  onTogglePlay,
  onToggleLoop,
  onPrev,
  onNext,
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
    || buffering
    || (canAutoExpand && status !== 'playing' && currentView !== 'home');
  const trackColor = isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
  const primaryColor = 'var(--text-primary)';
  const secondaryColor = 'var(--text-secondary)';
  const glassStyle: React.CSSProperties = {
    backgroundColor: showExpanded
      ? (isDaylight
        ? 'color-mix(in srgb, var(--bg-color) 78%, transparent)'
        : 'color-mix(in srgb, var(--bg-color) 52%, transparent)')
      : (isDaylight
        ? 'color-mix(in srgb, var(--bg-color) 62%, transparent)'
        : 'color-mix(in srgb, var(--bg-color) 38%, transparent)'),
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    isolation: 'isolate',
  };
  const skipClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity ${
    isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/12'
  }`;

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
        <div className="relative w-full">
          {currentView === 'home' && isHovered && !coarsePointer ? (
            <div
              className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] shadow-lg"
              style={{
                backgroundColor: isDaylight
                  ? 'color-mix(in srgb, var(--bg-color) 88%, transparent)'
                  : 'color-mix(in srgb, var(--bg-color) 70%, transparent)',
                color: primaryColor,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              点击可以返回歌词舞台
            </div>
          ) : null}
          <motion.div
            layout
            transition={{ layout: CONTROL_LAYOUT_SPRING }}
            onClick={() => {
              if (currentView === 'home') onNavigateToPlayer();
            }}
            title={currentView === 'home' ? '点击可以返回歌词舞台' : undefined}
            aria-label={currentView === 'home' ? '点击可以返回歌词舞台' : undefined}
            className={`relative cursor-pointer overflow-hidden rounded-full border-0 outline-none ring-0 transition-[background-color] duration-300 ${
              showExpanded ? 'w-full p-3' : 'w-[92%] px-4 py-2 md:w-[60%]'
            }`}
            style={{ ...glassStyle, margin: showExpanded ? undefined : '0 auto' }}
          >
            <motion.div layout transition={{ layout: CONTROL_LAYOUT_SPRING }} className="w-full">
            {showExpanded ? (
              <div className="flex w-full items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePlay();
                  }}
                  disabled={!canTogglePlay}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-none shadow-lg outline-none ring-0 transition-transform ${
                    canTogglePlay ? 'hover:scale-105' : 'cursor-not-allowed opacity-45'
                  }`}
                  style={{ backgroundColor: primaryColor, color: 'var(--bg-color)' }}
                >
                  {buffering || status === 'loading' ? (
                    <RyanLoader size={22} />
                  ) : status === 'playing' ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" className="ml-1" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="上一首"
                  disabled={!canPrev}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPrev();
                  }}
                  className={`${skipClass} ${canPrev ? 'opacity-80' : 'cursor-not-allowed opacity-30'}`}
                  style={{ color: primaryColor }}
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>
                <div className="min-w-0 flex-1 px-1">
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
                <button
                  type="button"
                  aria-label="下一首"
                  disabled={!canNext}
                  onClick={(event) => {
                    event.stopPropagation();
                    onNext();
                  }}
                  className={`${skipClass} ${canNext ? 'opacity-80' : 'cursor-not-allowed opacity-30'}`}
                  style={{ color: primaryColor }}
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLoop();
                  }}
                  className={`rounded-full p-2 outline-none ring-0 transition-colors ${
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
      </div>
    </motion.div>
  );
};

export default FloatingPlayerControls;
