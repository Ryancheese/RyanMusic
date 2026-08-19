import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValueEvent } from 'framer-motion';
import type { Line, Word } from '../../../types';
import { buildWordGraphemeTimings, type GraphemeTiming } from '../../../utils/lyrics/graphemeTiming';
import { resolveThemeFontStack, resolveThemeFontWeight, resolveThemeTranslationFontStack } from '../../../utils/fontStacks';
import { isInterludeLine } from '../../../utils/lyrics/parserCore';
import { resolveLyricAlternateText, resolveSubtitleContentMode } from '../../../utils/lyrics/alternateText';
import { type VisualizerSharedProps } from '../definition';
import { colorWithAlpha, mixColors } from '../colorMix';
import VisualizerShell from '../VisualizerShell';
import InterludeDots from '../../InterludeDots';

const hasReadableLyricText = (text?: string | null) => !!text && /[\p{L}\p{N}]/u.test(text);

interface SpotlightGlyph {
  id: string;
  char: string;
  startTime: number;
  endTime: number;
  wordIndex?: number;
  /** 渲染时长超过本句平均 → 放大再缩小 */
  pulse: boolean;
  /** 超过平均 1.5 倍 → 额外侧栏式高光 */
  glow: boolean;
  pulseStart: number;
  pulseEnd: number;
}

interface SpotlightVisibleEntry {
  line: Line;
  index: number;
  /** 相对焦点：-2 … +2 */
  offset: number;
}

/** 当前句上下各两句（不再显示底部字幕叠层） */
const NEIGHBOR_RADIUS = 2;

/** 超过平均时长的字/词：渲染中途约 1.42 倍，起止均为 1 */
const PULSE_PEAK = 0.42;
/** 超过平均这么多倍才叠加侧栏高光 */
const GLOW_DURATION_RATIO = 1.5;
const GLOW_RISE_DURATION_SCALE = 1.18;
const GLOW_PASS_TAIL_SECONDS = 1.05;
const DOCK_RESERVE_PX = 120;
const FOCUS_CENTER_RATIO = 0.5;

const SPOTLIGHT_SCROLL_TRANSITION = {
  type: 'spring' as const,
  stiffness: 160,
  damping: 28,
  mass: 0.9,
};

/** 按轨道宽高自适应字号 / 行距（随窗口变化） */
function resolveSpotlightTypeScale(
  railWidth: number,
  railHeight: number,
  lyricsFontScale: number,
  subtitleFontScale: number,
) {
  const w = Math.max(320, railWidth || 960);
  const h = Math.max(280, railHeight || 640);
  const vmin = Math.min(w, h);

  // 以 vmin 为主，宽度略参与；再乘用户歌词字号缩放
  const activePx = Math.round(
    Math.min(76, Math.max(28, vmin * 0.072 + w * 0.008)) * lyricsFontScale,
  );
  const nearPx = Math.round(Math.max(16, activePx * 0.48));
  const farPx = Math.round(Math.max(14, activePx * 0.36));
  const titlePx = Math.round(Math.min(84, Math.max(32, activePx * 1.08)));
  const translationPx = Math.round(
    Math.min(30, Math.max(13, activePx * 0.34)) * subtitleFontScale,
  );
  const lineGapPx = Math.round(Math.max(14, activePx * 0.42));
  const contentMaxWidthPx = Math.round(Math.min(w * 0.92, Math.max(420, w * 0.72)));

  return { activePx, nearPx, farPx, titlePx, translationPx, lineGapPx, contentMaxWidthPx };
}

function isBlankChar(char: string) {
  return char === '\u00A0' || /^\s+$/.test(char);
}

function buildSpotlightGlyphs(line: Line): SpotlightGlyph[] {
  const words = line.words?.length
    ? line.words
    : [{ text: line.fullText || '', startTime: line.startTime, endTime: line.endTime } as Word];

  const timings: GraphemeTiming[] = [];
  words.forEach((word, wordIndex) => {
    timings.push(...buildWordGraphemeTimings(word, wordIndex));
  });

  let glyphs: SpotlightGlyph[];
  if (!timings.length) {
    const raw = (line.fullText || '').replace(/\s+/g, ' ').trim();
    const chars = Array.from(raw);
    if (!chars.length) return [];
    const dur = Math.max(0.05, line.endTime - line.startTime);
    glyphs = chars.map((char, i) => {
      const startTime = line.startTime + (dur * i) / chars.length;
      const endTime = line.startTime + (dur * (i + 1)) / chars.length;
      return {
        id: `${line.startTime}-f-${i}`,
        char: char === ' ' ? '\u00A0' : char,
        startTime,
        endTime,
        pulse: false,
        glow: false,
        pulseStart: startTime,
        pulseEnd: endTime,
      };
    });
  } else {
    glyphs = timings.map((t, i) => {
      const startTime = t.startTime;
      const endTime = Math.max(t.endTime, t.startTime + 0.04);
      return {
        id: `${line.startTime}-${i}-${t.char}`,
        char: /^\s+$/.test(t.char) ? '\u00A0' : t.char,
        startTime,
        endTime,
        wordIndex: t.wordIndex,
        pulse: false,
        glow: false,
        pulseStart: startTime,
        pulseEnd: endTime,
      };
    });
  }

  markLongRenderPulses(glyphs, words);
  return glyphs;
}

/**
 * - 超过平均：放大再缩小
 * - 超过平均 1.5 倍：额外侧栏式高光（上升 smoothstep + 拖尾衰减）
 */
function markLongRenderPulses(glyphs: SpotlightGlyph[], words: Word[]) {
  const markUnit = (
    targets: SpotlightGlyph[],
    start: number,
    end: number,
    duration: number,
    average: number,
  ) => {
    if (duration <= average + 1e-4) return;
    const glow = duration > average * GLOW_DURATION_RATIO + 1e-4;
    for (const glyph of targets) {
      glyph.pulse = true;
      if (glow) glyph.glow = true;
      glyph.pulseStart = start;
      glyph.pulseEnd = end;
    }
  };

  const content = glyphs.filter((g) => !isBlankChar(g.char));
  if (content.length >= 2) {
    const avgGlyph =
      content.reduce((sum, g) => sum + (g.endTime - g.startTime), 0) / content.length;
    for (const glyph of content) {
      const dur = glyph.endTime - glyph.startTime;
      markUnit([glyph], glyph.startTime, glyph.endTime, dur, avgGlyph);
    }
  }

  const contentWords = words
    .map((word, wordIndex) => ({ word, wordIndex }))
    .filter(({ word }) => (word.text || '').trim().length > 0);
  if (contentWords.length < 2) return;

  const avgWord =
    contentWords.reduce(
      (sum, { word }) => sum + Math.max(0.04, word.endTime - word.startTime),
      0,
    ) / contentWords.length;

  for (const { word, wordIndex } of contentWords) {
    const dur = Math.max(0.04, word.endTime - word.startTime);
    const targets = glyphs.filter(
      (glyph) => glyph.wordIndex === wordIndex && !isBlankChar(glyph.char),
    );
    markUnit(
      targets,
      word.startTime,
      Math.max(word.endTime, word.startTime + 0.04),
      dur,
      avgWord,
    );
  }
}

function glyphFillProgress(glyph: SpotlightGlyph, time: number): number {
  if (time <= glyph.startTime) return 0;
  if (time >= glyph.endTime) return 1;
  return (time - glyph.startTime) / Math.max(0.001, glyph.endTime - glyph.startTime);
}

/** 在 pulse 时间窗内：0→1 进度对应放大再缩小（sin 半波） */
function glyphPulseScale(glyph: SpotlightGlyph, time: number): number {
  if (!glyph.pulse) return 1;
  const span = Math.max(0.001, glyph.pulseEnd - glyph.pulseStart);
  if (time <= glyph.pulseStart || time >= glyph.pulseEnd) return 1;
  const p = (time - glyph.pulseStart) / span;
  return 1 + PULSE_PEAK * Math.sin(Math.PI * p);
}

/** 侧栏同款高光，但用 drop-shadow 跟字形轮廓，避免 text-shadow + clip 变成矩形光斑 */
function glyphGlowFilter(
  glyph: SpotlightGlyph,
  time: number,
  baseColor: string,
  accentColor: string,
  fontPx: number,
): string {
  if (!glyph.glow || time <= glyph.pulseStart) return 'none';

  const startTime = glyph.pulseStart;
  const endTime = glyph.pulseEnd;
  const duration = Math.max(0.001, endTime - startTime);
  const glowRiseDuration = duration * GLOW_RISE_DURATION_SCALE;
  const glowPeakTime = startTime + glowRiseDuration;
  const glowTailEndTime = endTime + GLOW_PASS_TAIL_SECONDS;

  let intensity: number;
  if (time <= glowPeakTime) {
    const progress = Math.min(1, Math.max(0, (time - startTime) / glowRiseDuration));
    intensity = progress * progress * (3 - 2 * progress);
  } else {
    const decayDuration = Math.max(0.18, glowTailEndTime - glowPeakTime);
    const decayProgress = Math.min(1, Math.max(0, (time - glowPeakTime) / decayDuration));
    const remaining = 1 - decayProgress;
    intensity = remaining * remaining * (3 - 2 * remaining);
  }

  if (intensity <= 0) return 'none';

  const radiusOne = Math.max(2, Math.round(fontPx * 0.18));
  const radiusTwo = Math.max(4, Math.round(fontPx * 0.42));
  const glowColor = mixColors(baseColor, accentColor, intensity, intensity * 0.9);
  const softColor = mixColors(baseColor, accentColor, intensity, intensity * 0.45);
  return `drop-shadow(0 0 ${radiusOne}px ${glowColor}) drop-shadow(0 0 ${radiusTwo}px ${softColor})`;
}

/** 软擦除遮罩：避免硬 clip-path 矩形切边 */
function glyphWipeMask(progress01: number): string {
  const wipe = Math.max(0, Math.min(100, progress01 * 100));
  const feather = 10;
  const solid = Math.max(0, wipe - feather * 0.35);
  const soft = Math.min(100, wipe + feather * 0.65);
  return `linear-gradient(90deg, #000 0%, #000 ${solid}%, transparent ${soft}%, transparent 100%)`;
}

function findFocusIndex(lines: Line[], time: number, currentLineIndex: number): number {
  if (!lines.length) return -1;
  if (currentLineIndex >= 0 && currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];
    const end = line.renderHints?.renderEndTime ?? line.endTime;
    if (time >= line.startTime - 0.25 && time <= end + 0.55) return currentLineIndex;
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (time >= lines[i].startTime) return i;
  }
  return 0;
}

const SpotlightWipeChar: React.FC<{
  glyph: SpotlightGlyph;
  time: number;
  mode: 'future' | 'active' | 'past';
  dimColor: string;
  litColor: string;
  accentColor: string;
  fontPx: number;
}> = ({ glyph, time, mode, dimColor, litColor, accentColor, fontPx }) => {
  if (mode === 'past') {
    return <span className="inline-block" style={{ color: litColor }}>{glyph.char}</span>;
  }
  if (mode === 'future') {
    return <span className="inline-block" style={{ color: dimColor }}>{glyph.char}</span>;
  }

  const p = glyphFillProgress(glyph, time);
  const scale = glyphPulseScale(glyph, time);
  const glowFilter = glyphGlowFilter(glyph, time, litColor, accentColor, fontPx);
  const wipeMask = glyphWipeMask(p);

  return (
    <span
      className="relative inline-block will-change-transform"
      style={{
        color: dimColor,
        transform: `scale(${scale})`,
        transformOrigin: 'center bottom',
        zIndex: scale > 1.05 || glowFilter !== 'none' ? 3 : 1,
        // drop-shadow 跟着字形 alpha，不会出现矩形光斑
        filter: glowFilter === 'none' ? undefined : glowFilter,
      }}
    >
      {glyph.char}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          color: litColor,
          // 只用遮罩做软擦除，不要 clip-path + text-shadow（会被裁成矩形）
          WebkitMaskImage: wipeMask,
          maskImage: wipeMask,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      >
        {glyph.char}
      </span>
    </span>
  );
};

const SpotlightKaraokeLine: React.FC<{
  line: Line;
  time: number;
  mode: 'future' | 'active' | 'past';
  dimColor: string;
  litColor: string;
  accentColor: string;
  fontPx: number;
}> = ({ line, time, mode, dimColor, litColor, accentColor, fontPx }) => {
  const glyphs = useMemo(() => buildSpotlightGlyphs(line), [line]);
  if (!glyphs.length) {
    return <span style={{ color: mode === 'future' ? dimColor : litColor }}>{line.fullText || ''}</span>;
  }
  return (
    <span className="inline">
      {glyphs.map((glyph) => (
        <SpotlightWipeChar
          key={glyph.id}
          glyph={glyph}
          time={time}
          mode={mode}
          dimColor={dimColor}
          litColor={litColor}
          accentColor={accentColor}
          fontPx={fontPx}
        />
      ))}
    </span>
  );
};

const VisualizerSpotlight: React.FC<VisualizerSharedProps> = (props) => {
  const {
    currentTime,
    currentLineIndex,
    lines,
    theme,
    subtitleTheme,
    audioPower,
    audioBands,
    showText = true,
    lyricsFontScale = 1,
    subtitleFontScale = 1,
    showSubtitleTranslation = true,
    subtitleContentMode,
    hideTranslationSubtitle = false,
    songTitle,
    songArtist,
    onLyricLineSeek,
    isPlayerChromeHidden,
  } = props;

  const railRef = useRef<HTMLDivElement>(null);
  const lineNodeRefs = useRef(new Map<number, HTMLButtonElement>());
  const [time, setTime] = useState(() => currentTime.get());
  const [railSize, setRailSize] = useState({ width: 0, height: 0 });
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});
  const gate = useRef(0);

  useMotionValueEvent(currentTime, 'change', (value) => {
    const now = performance.now();
    if (now - gate.current < 16) return;
    gate.current = now;
    setTime(value);
  });

  const focusIndex = useMemo(
    () => findFocusIndex(lines, time, currentLineIndex),
    [currentLineIndex, lines, time],
  );

  const dockPx = isPlayerChromeHidden ? 24 : DOCK_RESERVE_PX;
  const typeScale = useMemo(
    () => resolveSpotlightTypeScale(
      railSize.width,
      railSize.height,
      lyricsFontScale,
      subtitleFontScale,
    ),
    [railSize.width, railSize.height, lyricsFontScale, subtitleFontScale],
  );
  const resolvedSubtitleMode = useMemo(
    () => resolveSubtitleContentMode(subtitleContentMode, showSubtitleTranslation),
    [showSubtitleTranslation, subtitleContentMode],
  );

  const resolveLineTranslation = useCallback((line: Line, isActive: boolean) => {
    if (!isActive || hideTranslationSubtitle || isInterludeLine(line)) return null;
    const text = resolveLyricAlternateText(line, resolvedSubtitleMode);
    return hasReadableLyricText(text) ? text : null;
  }, [hideTranslationSubtitle, resolvedSubtitleMode]);

  /** 只渲染当前句 ±2，去掉底部字幕叠层避免重复 */
  const visibleEntries = useMemo((): SpotlightVisibleEntry[] => {
    if (focusIndex < 0 || !lines.length) return [];
    const entries: SpotlightVisibleEntry[] = [];
    for (let offset = -NEIGHBOR_RADIUS; offset <= NEIGHBOR_RADIUS; offset += 1) {
      const index = focusIndex + offset;
      if (index < 0 || index >= lines.length) continue;
      entries.push({ line: lines[index], index, offset });
    }
    return entries;
  }, [focusIndex, lines]);

  useEffect(() => {
    const node = railRef.current;
    if (!node) return;
    const update = () => {
      setRailSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const measureLineHeights = () => {
    const next: Record<number, number> = {};
    lineNodeRefs.current.forEach((el, index) => {
      next[index] = el.offsetHeight;
    });
    setLineHeights((prev) => {
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(prev).length
        && keys.every((key) => Math.abs((prev[Number(key)] || 0) - next[Number(key)]) < 1)
      ) {
        return prev;
      }
      return next;
    });
  };

  useLayoutEffect(() => {
    measureLineHeights();
  }, [
    visibleEntries,
    typeScale.activePx,
    typeScale.nearPx,
    typeScale.farPx,
    typeScale.translationPx,
    hideTranslationSubtitle,
    resolvedSubtitleMode,
    time,
  ]);

  const positioned = useMemo(() => {
    const usable = Math.max(160, (railSize.height || 600) - dockPx);
    const focusCenterY = usable * FOCUS_CENTER_RATIO;
    const heightOf = (index: number, isActive: boolean) => {
      if (lineHeights[index]) return lineHeights[index];
      const translationExtra = isActive && resolveLineTranslation(lines[index], true)
        ? typeScale.translationPx * 1.55
        : 0;
      return (isActive ? typeScale.activePx * 1.35 : typeScale.nearPx * 1.35) + translationExtra;
    };

    const withY = visibleEntries.map((entry) => ({
      ...entry,
      y: 0,
      height: heightOf(entry.index, entry.offset === 0),
    }));

    const anchor = withY.find((entry) => entry.offset === 0);
    if (!anchor) return withY;

    anchor.y = focusCenterY - anchor.height / 2;

    const after = withY.filter((entry) => entry.offset > 0).sort((a, b) => a.offset - b.offset);
    let cursor = anchor.y + anchor.height;
    after.forEach((entry) => {
      cursor += typeScale.lineGapPx;
      entry.y = cursor;
      cursor += entry.height;
    });

    const before = withY.filter((entry) => entry.offset < 0).sort((a, b) => b.offset - a.offset);
    cursor = anchor.y;
    before.forEach((entry) => {
      cursor -= typeScale.lineGapPx + entry.height;
      entry.y = cursor;
    });

    return withY;
  }, [visibleEntries, railSize.height, dockPx, lineHeights, lines, resolveLineTranslation, typeScale]);

  const fontFamily = resolveThemeFontStack(theme);
  const fontWeight = resolveThemeFontWeight(theme, 700);
  const translationFontFamily = resolveThemeTranslationFontStack(subtitleTheme ?? theme);
  const translationFontWeight = resolveThemeFontWeight(subtitleTheme ?? theme, 500);
  const litColor = theme.primaryColor || '#FFFFFF';
  const dimColor = theme.secondaryColor || 'rgba(255,255,255,0.34)';
  const accent = theme.accentColor || litColor;

  return (
    <VisualizerShell
      theme={theme}
      audioPower={audioPower}
      audioBands={audioBands}
      sharedProps={props}
    >
      <div className="pointer-events-none absolute inset-0 z-10 flex h-full w-full">
        <div
          ref={railRef}
          className="pointer-events-auto relative h-full w-full overflow-hidden px-[min(8vw,4.5rem)]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
          }}
        >
          {showText && positioned.length > 0 ? (
            <div
              className="relative mx-auto h-full w-full"
              style={{ maxWidth: typeScale.contentMaxWidthPx }}
            >
              {positioned.map((entry) => {
                const isActive = entry.offset === 0;
                const dist = Math.abs(entry.offset);
                const mode: 'future' | 'active' | 'past' = isActive
                  ? 'active'
                  : entry.offset < 0
                    ? 'past'
                    : 'future';
                const fontPx = isActive
                  ? typeScale.activePx
                  : dist === 1
                    ? typeScale.nearPx
                    : typeScale.farPx;
                const translation = resolveLineTranslation(entry.line, isActive);
                return (
                  <motion.button
                    key={`${entry.line.startTime}-${entry.index}`}
                    ref={(node) => {
                      if (node) lineNodeRefs.current.set(entry.index, node);
                      else lineNodeRefs.current.delete(entry.index);
                    }}
                    type="button"
                    data-spotlight-active={isActive ? 'true' : undefined}
                    onClick={() => onLyricLineSeek?.(entry.line.startTime)}
                    initial={false}
                    animate={{
                      y: entry.y,
                      opacity: isActive ? 1 : dist === 1 ? 0.42 : 0.28,
                      scale: isActive ? 1 : dist === 1 ? 0.92 : 0.86,
                      filter: isActive ? 'blur(0px)' : dist === 1 ? 'blur(0.6px)' : 'blur(1px)',
                    }}
                    transition={SPOTLIGHT_SCROLL_TRANSITION}
                    className="absolute left-0 top-0 w-full origin-left text-left will-change-transform"
                    style={{
                      fontSize: fontPx,
                      fontFamily,
                      fontWeight: isActive ? fontWeight : 560,
                      letterSpacing: isActive ? '-0.01em' : '0',
                      lineHeight: 1.25,
                    }}
                  >
                    <div
                      style={{
                        textShadow: isActive
                          ? `0 2px 28px rgba(0,0,0,0.28), 0 0 24px color-mix(in srgb, ${accent} 22%, transparent)`
                          : 'none',
                      }}
                    >
                      {isInterludeLine(entry.line) ? (
                        <InterludeDots
                          count={5}
                          size={isActive ? Math.max(8, Math.round(fontPx * 0.18)) : Math.max(6, Math.round(fontPx * 0.2))}
                          gap={isActive ? Math.round(fontPx * 0.22) : Math.round(fontPx * 0.28)}
                          color={dimColor}
                          activeColor={accent}
                          activeIndex={isActive ? 4 : undefined}
                        />
                      ) : (
                        <SpotlightKaraokeLine
                          line={entry.line}
                          time={time}
                          mode={mode}
                          dimColor={dimColor}
                          litColor={litColor}
                          accentColor={accent}
                          fontPx={fontPx}
                        />
                      )}
                    </div>
                    {translation ? (
                      <div
                        className="whitespace-pre-wrap break-words"
                        style={{
                          marginTop: '0.32em',
                          color: colorWithAlpha(dimColor, 0.88),
                          fontFamily: translationFontFamily,
                          fontWeight: translationFontWeight,
                          fontSize: typeScale.translationPx,
                          letterSpacing: '0.01em',
                          lineHeight: 1.35,
                          textShadow: 'none',
                        }}
                      >
                        {translation}
                      </div>
                    ) : null}
                  </motion.button>
                );
              })}
            </div>
          ) : showText ? (
            <div
              className="flex h-full w-full flex-col items-start justify-center px-0"
              style={{ maxWidth: typeScale.contentMaxWidthPx }}
            >
              <div
                style={{
                  color: litColor,
                  fontSize: typeScale.titlePx,
                  fontFamily,
                  fontWeight,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {songTitle || '未播放'}
              </div>
              {songArtist ? (
                <div
                  className="mt-4 opacity-40"
                  style={{
                    color: litColor,
                    fontFamily,
                    fontWeight: 500,
                    fontSize: Math.max(16, Math.round(typeScale.nearPx * 0.95)),
                  }}
                >
                  {songArtist}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </VisualizerShell>
  );
};

export default VisualizerSpotlight;
