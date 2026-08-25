import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { ArrowLeft, ListMusic, Maximize2, Minimize2, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react';
import ProgressBar from './ProgressBar';
import RyanLoader from './RyanLoader';
import { isWebBrowser, useWebFullscreen } from '../lib/webFullscreen';
import { useCoarsePointer, useIsMobile } from '../lib/media';
import { chromeButtonStyle, chromeCapsuleStyle } from '../lib/controlGlass';
import { findLatestActiveLineIndex, resolveVisualizerLyrics } from '../lib/lyrics';
import { useControlAppearanceStore } from '../store/controlAppearanceStore';
import { useLyricSettingsStore } from '../store/lyricSettingsStore';
import { showToast } from '../store/toastStore';
import type { LoopMode, PlayerStatus, Track } from '../types';
import { isInterludeLine } from '../utils/lyrics/parserCore';

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

/** 间奏时回退到最近一句实词；开头无词则空串 */
function dockLineText(lines: ReturnType<typeof resolveVisualizerLyrics>['lines'], time: number): string {
  const index = findLatestActiveLineIndex(lines, time);
  if (index < 0) return '';
  for (let i = index; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line || isInterludeLine(line)) continue;
    const text = (line.fullText || '').trim();
    if (text) return text;
  }
  return '';
}

interface HomeDockNowPlayingProps {
  title: string;
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null;
  currentTime: MotionValue<number>;
  color: string;
  className?: string;
  asButton?: boolean;
  onNavigate?: () => void;
}

const HomeDockNowPlaying: React.FC<HomeDockNowPlayingProps> = ({
  title,
  track,
  currentTime,
  color,
  className = '',
  asButton = false,
  onNavigate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const lyricFilterPattern = useLyricSettingsStore((state) => (
    state.filterEnabled ? state.filterPattern : ''
  ));
  const lines = useMemo(
    () => resolveVisualizerLyrics(track, lyricFilterPattern).lines,
    [lyricFilterPattern, track],
  );
  const [lyric, setLyric] = useState(() => dockLineText(lines, currentTime.get()));
  const [showTitle, setShowTitle] = useState(false);

  useEffect(() => {
    setLyric(dockLineText(lines, currentTime.get()));
    let frame = 0;
    let last = dockLineText(lines, currentTime.get());
    const tick = () => {
      const next = dockLineText(lines, currentTime.get());
      if (next !== last) {
        last = next;
        setLyric(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentTime, lines]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const measure = measureRef.current;
    if (!el || !measure) return;

    const sync = () => {
      const width = el.clientWidth;
      if (width <= 0) {
        setShowTitle(false);
        return;
      }
      if (!title.trim() || !lyric.trim()) {
        setShowTitle(false);
        return;
      }
      measure.textContent = title;
      const titleWidth = measure.offsetWidth;
      // 歌名完整露出 + 分隔 + 至少约 6 字歌词空间，才并排
      const minLyricSlot = 72;
      const sep = 18;
      setShowTitle(width >= titleWidth + sep + minLyricSlot);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [title, lyric]);

  const primary = (lyric || title || '未播放').trim() || '未播放';
  const body = (
    <div
      ref={containerRef}
      className={`relative flex w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden text-center ${className}`}
    >
      <span
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 whitespace-nowrap text-[12px] font-semibold opacity-0"
        aria-hidden
      />
      {showTitle ? (
        <>
          <span
            className="max-w-[38%] shrink-0 truncate text-[12px] font-semibold opacity-55"
            style={{ color }}
          >
            {title}
          </span>
          <span className="shrink-0 text-[12px] opacity-30" style={{ color }} aria-hidden>
            ·
          </span>
        </>
      ) : null}
      <span className="min-w-0 truncate text-sm font-semibold" style={{ color }}>
        {primary}
      </span>
    </div>
  );

  if (asButton) {
    return (
      <button
        type="button"
        className="block w-full min-w-0"
        onClick={(event) => {
          event.stopPropagation();
          onNavigate?.();
        }}
      >
        {body}
      </button>
    );
  }

  return body;
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
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null;
  children?: React.ReactNode;
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
  track = null,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [sideHover, setSideHover] = useState<'left' | 'right' | null>(null);
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const expandTimeoutRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const coarsePointer = useCoarsePointer();
  const isMobile = useIsMobile();
  const isMobileWeb = isMobile && isWebBrowser();
  const { active: webFullscreen, supported: webFullscreenSupported, toggle: toggleWebFullscreen } = useWebFullscreen();
  const opacity = useControlAppearanceStore((state) => state.opacity);
  const blur = useControlAppearanceStore((state) => state.blur);
  const hoverBoost = useControlAppearanceStore((state) => state.hoverBoost);
  // 中间胶囊悬停放大
  const hoverScale = 1 + hoverBoost / 100;
  // 左右小圆钮面积更小，同一滑杆下提高倍率，观感与中间同步
  const sideHoverScale = hoverBoost <= 0 ? 1 : 1 + (hoverBoost / 100) * 2.5;
  const SIDE_BTN_SIZE = isMobile ? 40 : 48;
  const sideBtnClass = isMobile ? 'h-10 w-10' : 'h-12 w-12';
  const playBtnClass = isMobile ? 'h-10 w-10' : 'h-12 w-12';
  const playIconSize = isMobile ? 18 : 20;
  const skipIconSize = isMobile ? 16 : 18;
  // 悬停侧钮时，把邻居往外挤开（约等于放大后伸出的半径 + 一点间距）
  const sidePush = (SIDE_BTN_SIZE * (sideHoverScale - 1)) / 2 + (isMobile ? 6 : 8);
  // 默认与暂停保持缩小；悬停/触摸/缓冲加载时才展开
  const showExpanded =
    isHovered
    || coarsePointer
    || (buffering && status === 'loading');
  const mobilePlayerExpanded = isMobile && currentView === 'player' && showExpanded;
  const showSideChrome = currentView === 'player' && Boolean(onBack || onTogglePanel);
  const playerCapsuleWidth = showSideChrome
    ? (
      isMobile
        ? (mobilePlayerExpanded ? 'min(100%, calc(100vw - 6.25rem))' : 'min(100%, calc(100vw - 6.25rem))')
        : (showExpanded ? 'min(34rem, calc(100vw - 7.5rem))' : 'min(24rem, calc(100vw - 7.5rem))')
    )
    : (showExpanded ? '100%' : (isMobile ? 'min(100%, calc(100vw - 1.5rem))' : 'min(26rem, 94%)'));
  const trackColor = isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
  const primaryColor = 'color-mix(in srgb, var(--text-accent) var(--accent-ui-mix, 45%), var(--text-primary))';
  const secondaryColor = 'var(--text-secondary)';
  const glassStyle: React.CSSProperties = chromeCapsuleStyle(opacity, blur, showExpanded);
  const dockHoverScaleStyle = {
    '--dock-hover-scale': String(sideHoverScale),
  } as React.CSSProperties;
  const skipClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 hover:[transform:scale(var(--dock-hover-scale))] ${
    isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/12'
  }`;
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

  const showFullscreenBtn = isMobileWeb && currentView === 'player' && !hideDock;
  const onFullscreenClick = () => {
    if (!webFullscreenSupported) {
      showToast({
        kind: 'info',
        title: '当前浏览器不支持网页全屏',
        detail: '可尝试用系统浏览器的全屏，或添加到主屏幕以获得沉浸体验',
      });
      return;
    }
    void toggleWebFullscreen();
  };

  return (
    <>
      <motion.div
      className={`pointer-events-none absolute left-1/2 z-60 flex w-full -translate-x-1/2 justify-center transition-all duration-300 ${
        currentView === 'home'
          ? 'max-w-[calc(100vw-1.5rem)] md:max-w-lg'
          : (isMobile ? 'max-w-[calc(100vw-0.75rem)] px-1.5' : 'max-w-[calc(100vw-1.25rem)] px-3')
      }`}
      data-tour="dock"
      initial={false}
      animate={{ opacity: hideDock ? 0 : 1, y: hideDock ? 24 : 0, scale: hideDock ? 0.97 : 1 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{
        pointerEvents: hideDock ? 'none' : 'auto',
        bottom: isMobileWeb
          ? 'max(0.85rem, calc(var(--safe-bottom) + 0.65rem))'
          : 'max(1.25rem, calc(var(--safe-bottom) + 0.5rem))',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={`pointer-events-auto flex items-center justify-center overflow-visible ${
          showSideChrome ? `w-fit max-w-full ${isMobile ? 'gap-1.5' : 'gap-2'}` : `w-full max-w-lg ${isMobile ? 'gap-2' : 'gap-3'}`
        }`}
      >
        {showSideChrome && onBack ? (
          <motion.button
            type="button"
            aria-label="返回"
            className={`flex ${sideBtnClass} shrink-0 items-center justify-center rounded-full outline-none ring-0`}
            data-tour="player-back"
            style={chromeButtonStyle(opacity, blur)}
            initial={false}
            animate={{
              x: leftX,
              scale: sideHover === 'left' ? sideHoverScale : 1,
            }}
            whileTap={{ scale: Math.max(0.92, sideHoverScale - 0.1) }}
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
            width: playerCapsuleWidth,
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
              showExpanded ? `w-full ${isMobile ? 'p-2' : 'p-3'}` : `w-full ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'}`
            }`}
            style={{ ...glassStyle, ...dockHoverScaleStyle }}
            initial={false}
            animate={{ scale: isHovered && !sideHover ? hoverScale : 1 }}
            whileTap={{ scale: Math.max(0.96, hoverScale - 0.055) }}
            transition={CONTROL_HOVER_SPRING}
          >
            <div className="w-full">
            {showExpanded ? (
              <div className={`flex w-full items-center ${isMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'}`} style={dockHoverScaleStyle}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePlay();
                  }}
                  disabled={!canTogglePlay}
                  className={`flex ${playBtnClass} shrink-0 items-center justify-center rounded-full border-none shadow-lg outline-none ring-0 transition-transform duration-200 ${
                    canTogglePlay
                      ? 'hover:[transform:scale(var(--dock-hover-scale))]'
                      : 'cursor-not-allowed opacity-45'
                  }`}
                  style={{
                    backgroundColor: primaryColor,
                    color: 'var(--bg-color)',
                  }}
                >
                  {buffering || status === 'loading' ? (
                    <RyanLoader size={isMobile ? 18 : 22} />
                  ) : status === 'playing' ? (
                    <Pause size={playIconSize} fill="currentColor" />
                  ) : (
                    <Play size={playIconSize} fill="currentColor" className="ml-0.5" />
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
                  className={`${skipClass} ${canPrev ? 'opacity-80' : 'cursor-not-allowed opacity-30'} ${isMobile ? 'h-8 w-8' : 'h-9 w-9'}`}
                  style={{ color: primaryColor }}
                >
                  <SkipBack size={skipIconSize} fill="currentColor" />
                </button>
                <div className={`flex min-w-0 flex-[1.65] items-center ${isMobile ? 'gap-1 px-0' : 'gap-1.5 px-0.5'}`}>
                  <div className={isMobile ? 'min-w-0 flex-1' : 'min-w-[10rem] flex-1'}>
                    {showSongTitle ? (
                      <HomeDockNowPlaying
                        title={trackTitle}
                        track={track}
                        currentTime={currentTime}
                        color={primaryColor}
                        asButton
                        onNavigate={onNavigateToPlayer}
                      />
                    ) : (
                      <ProgressBar
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={onSeek}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        trackColor={trackColor}
                        disabled={!canTogglePlay}
                        compact={isMobile}
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
                  className={`${skipClass} ${canNext ? 'opacity-80' : 'cursor-not-allowed opacity-30'} ${isMobile ? 'h-8 w-8' : 'h-9 w-9'}`}
                  style={{ color: primaryColor }}
                >
                  <SkipForward size={skipIconSize} fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLoop();
                  }}
                  className={`rounded-full outline-none ring-0 transition-transform duration-200 hover:[transform:scale(var(--dock-hover-scale))] ${
                    isMobile ? 'p-1.5' : 'p-2'
                  } ${
                    loopMode !== 'off'
                      ? isDaylight
                        ? 'bg-black/10 text-black'
                        : 'bg-white/20'
                      : 'opacity-40 hover:opacity-100'
                  }`}
                  style={{ color: primaryColor }}
                >
                  {loopMode === 'one' ? (
                    <Repeat1 size={skipIconSize} />
                  ) : (
                    <Repeat size={skipIconSize} />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex h-8 w-full items-center gap-2 px-2">
                <div className="min-w-0 flex-1">
                  {showSongTitle ? (
                    <HomeDockNowPlaying
                      title={trackTitle}
                      track={track}
                      currentTime={currentTime}
                      color={primaryColor}
                    />
                  ) : (
                    <ProgressBar
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={onSeek}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      trackColor={trackColor}
                      disabled={!canTogglePlay}
                      compact={isMobile}
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
            className="relative flex shrink-0 flex-col items-center gap-1.5"
            initial={false}
            animate={{ x: rightX }}
            transition={CONTROL_HOVER_SPRING}
          >
            <div className="pointer-events-auto absolute bottom-[calc(100%+1.55rem)] left-0 z-10 origin-bottom-left">
              {children}
            </div>
            {showFullscreenBtn ? (
              <motion.button
                type="button"
                aria-label={webFullscreen ? '退出网页全屏' : '网页全屏'}
                title={webFullscreen ? '退出网页全屏' : '网页全屏'}
                className={`player-web-fullscreen-btn relative z-20 flex ${sideBtnClass} items-center justify-center rounded-full outline-none ring-0`}
                style={chromeButtonStyle(opacity, blur, webFullscreen)}
                initial={false}
                animate={{ scale: sideHover === 'right' ? sideHoverScale : 1 }}
                whileTap={{ scale: Math.max(0.92, sideHoverScale - 0.1) }}
                transition={CONTROL_HOVER_SPRING}
                onMouseEnter={() => setSideHover('right')}
                onMouseLeave={() => setSideHover((prev) => (prev === 'right' ? null : prev))}
                onClick={(event) => {
                  event.stopPropagation();
                  onFullscreenClick();
                }}
              >
                {webFullscreen
                  ? <Minimize2 size={18} strokeWidth={1.8} />
                  : <Maximize2 size={18} strokeWidth={1.8} />}
              </motion.button>
            ) : null}
            <motion.button
              type="button"
              aria-label={panelOpen ? '收起正在播放' : '展开正在播放'}
              className={`relative z-20 flex ${sideBtnClass} items-center justify-center rounded-full outline-none ring-0`}
              data-tour="player-panel"
              style={chromeButtonStyle(opacity, blur, panelOpen)}
              initial={false}
              animate={{ scale: sideHover === 'right' ? sideHoverScale : 1 }}
              whileTap={{ scale: Math.max(0.92, sideHoverScale - 0.1) }}
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
    </>
  );
};

export default FloatingPlayerControls;
