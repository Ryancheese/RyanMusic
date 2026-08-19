import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { ArrowLeft, ListMusic, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react';
import ProgressBar from './ProgressBar';
import RyanLoader from './RyanLoader';
import { useCoarsePointer } from '../lib/media';
import { useControlAppearanceStore } from '../store/controlAppearanceStore';
import type { LoopMode, PlayerStatus } from '../types';

const CONTROL_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 24,
};

const CONTROL_HOVER_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
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
  panelOpen?: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNavigateToPlayer: () => void;
  onBack?: () => void;
  onTogglePanel?: () => void;
  trackTitle?: string;
  children?: React.ReactNode;
}

const glassFill = (opacity: number, extra = 0) => (
  `color-mix(in srgb, var(--text-accent) var(--accent-ui-soft, 18%), color-mix(in srgb, var(--bg-color) ${Math.min(90, Math.max(12, opacity + extra))}%, transparent))`
);

const chromeButtonStyle = (opacity: number, blur: number, active = false): React.CSSProperties => ({
  backgroundColor: glassFill(opacity, active ? 8 : 0),
  color: 'color-mix(in srgb, var(--text-accent) var(--accent-ui-mix, 45%), var(--text-primary))',
  border: '1px solid color-mix(in srgb, var(--text-accent) var(--accent-ui-border, 25%), transparent)',
  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.22)',
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
});

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
  panelOpen = false,
  onSeek,
  onTogglePlay,
  onToggleLoop,
  onPrev,
  onNext,
  onNavigateToPlayer,
  onBack,
  onTogglePanel,
  trackTitle = '',
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [sideHover, setSideHover] = useState<'left' | 'right' | null>(null);
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const expandTimeoutRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const coarsePointer = useCoarsePointer();
  const opacity = useControlAppearanceStore((state) => state.opacity);
  const blur = useControlAppearanceStore((state) => state.blur);
  const hoverBoost = useControlAppearanceStore((state) => state.hoverBoost);
  // 左右与中间用同一放大倍率，观感一致
  const hoverScale = 1 + hoverBoost / 100;
  const SIDE_BTN_SIZE = 48;
  // 悬停侧钮时，把邻居往外挤开（约等于放大后伸出的半径 + 一点间距）
  const sidePush = (SIDE_BTN_SIZE * (hoverScale - 1)) / 2 + 8;
  // 默认与暂停保持缩小；悬停/触摸/缓冲加载时才展开
  const showExpanded =
    isHovered
    || coarsePointer
    || (buffering && status === 'loading');
  const trackColor = isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
  const primaryColor = 'color-mix(in srgb, var(--text-accent) var(--accent-ui-mix, 45%), var(--text-primary))';
  const secondaryColor = 'var(--text-secondary)';
  const glassStyle: React.CSSProperties = {
    backgroundColor: glassFill(opacity, showExpanded ? 4 : -6),
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    isolation: 'isolate',
    border: '1px solid color-mix(in srgb, var(--text-accent) var(--accent-ui-border, 25%), transparent)',
  };
  const skipClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
    isDaylight ? 'hover:scale-125 hover:bg-black/10' : 'hover:scale-125 hover:bg-white/12'
  }`;
  const showSideChrome = currentView === 'player' && Boolean(onBack || onTogglePanel);
  const hideDock = isHidden || !canTogglePlay;
  const showSongTitle = currentView === 'home';
  // 悬停中间：左右外移，给中间放大让位
  const centerOutShift = showSideChrome && isHovered && !sideHover
    ? (capsuleWidth * (hoverScale - 1)) / 2
    : 0;
  // 悬停左边 → 中间+右边右移；悬停右边 → 中间+左边左移
  const leftX = sideHover === 'right' ? -sidePush : -centerOutShift;
  const centerX = sideHover === 'left' ? sidePush : (sideHover === 'right' ? -sidePush : 0);
  const rightX = sideHover === 'left' ? sidePush : centerOutShift;

  const clearHoverTimers = () => {
    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  };

  const onCapsuleEnter = () => {
    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    if (expandTimeoutRef.current) return;
    expandTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
      expandTimeoutRef.current = null;
    }, 20);
  };

  const onCapsuleLeave = () => {
    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
      collapseTimeoutRef.current = null;
    }, 100);
  };

  useEffect(() => () => clearHoverTimers(), []);

  useEffect(() => {
    if (hideDock) setSideHover(null);
  }, [hideDock]);

  useLayoutEffect(() => {
    const el = capsuleRef.current;
    if (!el || hideDock) return;
    const syncWidth = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setCapsuleWidth(width);
    };
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showSideChrome, hideDock]);

  return (
    <motion.div
      className={`pointer-events-none absolute left-1/2 z-60 flex w-full -translate-x-1/2 justify-center px-3 transition-all duration-300 ${
        currentView === 'home' ? 'max-w-[calc(100vw-1.5rem)] md:max-w-lg' : 'max-w-[calc(100vw-1.25rem)]'
      }`}
      initial={false}
      animate={{ opacity: hideDock ? 0 : 1, y: hideDock ? 24 : 0, scale: hideDock ? 0.97 : 1 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{
        pointerEvents: hideDock ? 'none' : 'auto',
        bottom: 'max(1.25rem, calc(var(--safe-bottom) + 0.5rem))',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={`pointer-events-auto flex items-end justify-center overflow-visible ${
          showSideChrome ? 'w-fit max-w-full gap-2' : 'w-full max-w-lg gap-3'
        }`}
      >
        {showSideChrome && onBack ? (
          <motion.button
            type="button"
            aria-label="返回"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full outline-none ring-0"
            style={chromeButtonStyle(opacity, blur)}
            initial={false}
            animate={{
              x: leftX,
              scale: sideHover === 'left' ? hoverScale : 1,
            }}
            whileTap={{ scale: Math.max(0.94, hoverScale - 0.08) }}
            transition={CONTROL_HOVER_SPRING}
            onMouseEnter={() => setSideHover('left')}
            onMouseLeave={() => setSideHover((prev) => (prev === 'left' ? null : prev))}
            onClick={onBack}
          >
            <ArrowLeft size={18} />
          </motion.button>
        ) : null}

        <motion.div
          ref={capsuleRef}
          className="relative min-w-0 overflow-visible"
          initial={false}
          animate={{
            x: centerX,
            width: showSideChrome
              ? (showExpanded ? 'min(34rem, calc(100vw - 7.5rem))' : 'min(24rem, calc(100vw - 7.5rem))')
              : (showExpanded ? '100%' : 'min(26rem, 94%)'),
          }}
          transition={CONTROL_LAYOUT_SPRING}
          onMouseEnter={onCapsuleEnter}
          onMouseLeave={onCapsuleLeave}
        >
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
            onClick={() => {
              if (currentView === 'home') onNavigateToPlayer();
            }}
            title={currentView === 'home' ? '点击可以返回歌词舞台' : undefined}
            aria-label={currentView === 'home' ? '点击可以返回歌词舞台' : undefined}
            className={`relative cursor-pointer overflow-hidden rounded-full border-0 outline-none ring-0 transition-[background-color] duration-300 ${
              showExpanded ? 'w-full p-3' : 'w-full px-4 py-2'
            }`}
            style={glassStyle}
            initial={false}
            animate={{ scale: isHovered && !sideHover ? hoverScale : 1 }}
            whileTap={{ scale: Math.max(0.96, hoverScale - 0.055) }}
            transition={CONTROL_HOVER_SPRING}
          >
            <div className="w-full">
            {showExpanded ? (
              <div className="flex w-full items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePlay();
                  }}
                  disabled={!canTogglePlay}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-none shadow-lg outline-none ring-0 transition-transform duration-200 ${
                    canTogglePlay ? 'hover:scale-125' : 'cursor-not-allowed opacity-45'
                  }`}
                  style={{
                    backgroundColor: primaryColor,
                    color: 'var(--bg-color)',
                  }}
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
                <div className="flex min-w-0 flex-[1.65] items-center gap-1.5 px-0.5">
                  <div className="min-w-[10rem] flex-1">
                    {showSongTitle ? (
                      <button
                        type="button"
                        className="block w-full truncate text-center text-sm font-semibold"
                        style={{ color: primaryColor }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigateToPlayer();
                        }}
                      >
                        {trackTitle || '未播放'}
                      </button>
                    ) : (
                      <ProgressBar
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={onSeek}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        trackColor={trackColor}
                        disabled={!canTogglePlay}
                      />
                    )}
                  </div>
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
                  className={`rounded-full p-2 outline-none ring-0 transition-transform duration-200 ${
                    loopMode !== 'off'
                      ? isDaylight
                        ? 'bg-black/10 text-black hover:scale-125'
                        : 'bg-white/20 hover:scale-125'
                      : 'opacity-40 hover:scale-125 hover:opacity-100'
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
              <div className="flex h-8 w-full items-center gap-2 px-2">
                <div className="min-w-0 flex-1">
                  {showSongTitle ? (
                    <div className="truncate text-center text-sm font-medium" style={{ color: primaryColor }}>
                      {trackTitle || '未播放'}
                    </div>
                  ) : (
                    <ProgressBar
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={onSeek}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      trackColor={trackColor}
                      disabled={!canTogglePlay}
                    />
                  )}
                </div>
              </div>
            )}
            </div>
          </motion.div>
        </motion.div>

        {showSideChrome && onTogglePanel ? (
          <motion.div
            className="relative shrink-0"
            initial={false}
            animate={{ x: rightX }}
            transition={CONTROL_HOVER_SPRING}
          >
            <div className="pointer-events-auto absolute bottom-[calc(100%+1.55rem)] left-0 z-10 origin-bottom-left">
              {children}
            </div>
            <motion.button
              type="button"
              aria-label={panelOpen ? '收起正在播放' : '展开正在播放'}
              className="relative z-20 flex h-12 w-12 items-center justify-center rounded-full outline-none ring-0"
              style={chromeButtonStyle(opacity, blur, panelOpen)}
              initial={false}
              animate={{ scale: sideHover === 'right' ? hoverScale : 1 }}
              whileTap={{ scale: Math.max(0.94, hoverScale - 0.08) }}
              transition={CONTROL_HOVER_SPRING}
              onMouseEnter={() => setSideHover('right')}
              onMouseLeave={() => setSideHover((prev) => (prev === 'right' ? null : prev))}
              onClick={onTogglePanel}
            >
              <ListMusic size={18} />
            </motion.button>
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
};

export default FloatingPlayerControls;
