import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { coverImageUrl, fetchNeteaseComments, type SongComment } from '../api';
import type { Track } from '../types';
import { useCommentAtmosphereStore, type CommentReadOrder } from '../store/commentAtmosphereStore';

interface CommentAtmosphereOverlayProps {
  track: Track | null;
  isDaylight: boolean;
  chromeHidden?: boolean;
  isPanelOpen?: boolean;
}

interface BubblePlacement {
  side: 'left' | 'right';
  edgePct: number;
  topPct: number;
}

interface ActiveBubble {
  key: string;
  comment: SongComment;
  hot: boolean;
  placement: BubblePlacement;
}

const SHOW_MS_MIN = 7200;
const SHOW_MS_MAX = 11000;
const HOLD_MS_MIN = 4200;
const HOLD_MS_MAX = 6800;
const GAP_MS_MIN = 2800;
const GAP_MS_MAX = 5200;
const HOVER_LEAVE_MS = 3000;
/** 群像：一批评论在该时间窗内先后出现（不是同时弹出） */
const CROWD_WAVE_MS = 3000;
const TYPEWRITER_MS = 38;
const AVATAR_PX = 40;
const AVATAR_GAP_PX = 10;
const BODY_MAX_HEIGHT_PX = 148;
const SCROLL_STEP_MS = 42;
const SCROLL_PX = 1.1;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeContent(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').trim();
}

function useTypewriter(text: string, enabled: boolean) {
  const chars = useMemo(() => Array.from(text), [text]);
  const [count, setCount] = useState(enabled ? 0 : chars.length);

  useEffect(() => {
    if (!enabled) {
      setCount(chars.length);
      return;
    }
    setCount(0);
    if (chars.length === 0) return undefined;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= chars.length) window.clearInterval(id);
    }, TYPEWRITER_MS);
    return () => window.clearInterval(id);
  }, [chars, enabled]);

  const shown = chars.slice(0, count).join('');
  return {
    shown,
    typing: enabled && count < chars.length,
    done: !enabled || count >= chars.length,
  };
}

function useAutoScroll(options: {
  followBottom: boolean;
  cruise: boolean;
  contentKey: string;
  contentLength: number;
}) {
  const { followBottom, cruise, contentKey, contentLength } = options;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stoppedRef = useRef(false);
  const programmaticRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
  }, [contentKey]);

  // 吐字过程中始终贴底，跟上最新内容
  useLayoutEffect(() => {
    if (!followBottom || stoppedRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    programmaticRef.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    programmaticRef.current = false;
  }, [contentKey, contentLength, followBottom]);

  // 吐字结束后：若仍有未读内容，只自动向下缓滚；鼠标介入即停
  useEffect(() => {
    if (!cruise) return undefined;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return undefined;

    let frame = 0;
    let last = 0;

    const stopAuto = () => {
      stoppedRef.current = true;
    };

    const tick = (now: number) => {
      if (!stoppedRef.current && now - last >= SCROLL_STEP_MS) {
        last = now;
        const max = Math.max(0, content.scrollHeight - viewport.clientHeight);
        if (max > 4 && viewport.scrollTop < max - 1) {
          programmaticRef.current = true;
          viewport.scrollTop = Math.min(max, viewport.scrollTop + SCROLL_PX);
          programmaticRef.current = false;
        } else if (max > 4) {
          stoppedRef.current = true;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onWheel = () => stopAuto();
    const onTouch = () => stopAuto();
    const onScroll = () => {
      if (!programmaticRef.current) stopAuto();
    };
    viewport.addEventListener('wheel', onWheel, { passive: true });
    viewport.addEventListener('touchstart', onTouch, { passive: true });
    viewport.addEventListener('pointerdown', onTouch);
    viewport.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouch);
      viewport.removeEventListener('pointerdown', onTouch);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [contentKey, cruise]);

  return { viewportRef, contentRef };
}

/** 避开中部歌词带、底栏胶囊、右侧「正在播放」卡片 */
function pickPlacement(
  existing: BubblePlacement[],
  chromeHidden: boolean,
  panelOpen: boolean,
): BubblePlacement {
  const topBand: [number, number] = [8, 24];
  const midBand: [number, number] = [28, 44];
  const zones: Array<{ side: 'left' | 'right'; edge: [number, number]; top: [number, number] }> = [
    { side: 'left', edge: [3, 14], top: topBand },
    { side: 'left', edge: [3, 14], top: midBand },
  ];
  if (!panelOpen) {
    zones.push({ side: 'right', edge: [3, 14], top: topBand });
    zones.push({ side: 'right', edge: [3, 14], top: midBand });
  }

  if (chromeHidden) {
    zones.push({ side: 'left', edge: [3, 14], top: [58, 76] });
    if (!panelOpen) {
      zones.push({ side: 'right', edge: [3, 14], top: [58, 76] });
    }
  }

  const candidates = shuffle(zones).flatMap((zone) => {
    const samples: BubblePlacement[] = [];
    for (let i = 0; i < 4; i += 1) {
      samples.push({
        side: zone.side,
        edgePct: rand(zone.edge[0], zone.edge[1]),
        topPct: rand(zone.top[0], zone.top[1]),
      });
    }
    return samples;
  });

  for (const candidate of candidates) {
    const ok = existing.every((item) => {
      if (item.side === candidate.side) {
        const dx = Math.abs(item.edgePct - candidate.edgePct);
        const dy = Math.abs(item.topPct - candidate.topPct);
        return dx > 16 || dy > 20;
      }
      return Math.abs(item.topPct - candidate.topPct) > 14;
    });
    if (ok) return candidate;
  }

  if (existing.length > 0) {
    const occupiedSide = existing[0].side;
    const oppositeSide = occupiedSide === 'left' ? 'right' : 'left';
    const fallbackZone = zones.find((zone) => zone.side === oppositeSide) || zones[0];
    return {
      side: fallbackZone.side,
      edgePct: rand(fallbackZone.edge[0], fallbackZone.edge[1]),
      topPct: rand(fallbackZone.top[0], fallbackZone.top[1]),
    };
  }
  return candidates[0] || { side: 'left', edgePct: 6, topPct: 14 };
}

const HOT_SHARE = 7;
const LATEST_SHARE = 3;

function usableComments(list: SongComment[]): SongComment[] {
  return list.filter((item) => item.content.trim().length >= 8);
}

function applySourceOrder(list: SongComment[], order: CommentReadOrder): SongComment[] {
  if (order === 'reverse') return [...list].reverse();
  return list.slice();
}

/** 同一首歌内每条评论只进池一次；热评 70% + 最新 30% 交错，不因循环复用。 */
function buildPool(
  hot: SongComment[],
  latest: SongComment[],
  order: CommentReadOrder,
): Array<{ comment: SongComment; hot: boolean }> {
  const seen = new Set<string>();
  const takeUnique = (list: SongComment[]) => {
    const out: SongComment[] = [];
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  };

  const hotList = takeUnique(applySourceOrder(usableComments(hot), order));
  const latestList = takeUnique(applySourceOrder(usableComments(latest), order));

  if (!hotList.length) {
    const onlyLatest = latestList.map((comment) => ({ comment, hot: false }));
    return order === 'random' ? shuffle(onlyLatest) : onlyLatest;
  }
  if (!latestList.length) {
    const onlyHot = hotList.map((comment) => ({ comment, hot: true }));
    return order === 'random' ? shuffle(onlyHot) : onlyHot;
  }

  const mixed: Array<{ comment: SongComment; hot: boolean }> = [];
  let hi = 0;
  let li = 0;
  while (hi < hotList.length || li < latestList.length) {
    for (let i = 0; i < HOT_SHARE && hi < hotList.length; i += 1) {
      mixed.push({ comment: hotList[hi], hot: true });
      hi += 1;
    }
    for (let i = 0; i < LATEST_SHARE && li < latestList.length; i += 1) {
      mixed.push({ comment: latestList[li], hot: false });
      li += 1;
    }
  }

  if (order === 'random') return shuffle(mixed);

  // 顺序/倒序：有回复的评论按被回复内容相近的时间排在附近，整体仍按时间先后
  return mixed.slice().sort((a, b) => {
    const ta = a.comment.time || 0;
    const tb = b.comment.time || 0;
    if (order === 'reverse') return tb - ta;
    return ta - tb;
  });
}

/** 群像批次：尽量把「带回复」的放在一起，并按时间先后排。 */
function takeNextBatch(
  pool: Array<{ comment: SongComment; hot: boolean }>,
  start: number,
  count: number,
  shownIds: Set<string>,
): { items: Array<{ comment: SongComment; hot: boolean }>; nextCursor: number } {
  const items: Array<{ comment: SongComment; hot: boolean }> = [];
  let cursor = start;
  const maxScan = pool.length;

  while (items.length < count && cursor - start < maxScan) {
    if (cursor >= pool.length) break;
    const entry = pool[cursor];
    cursor += 1;
    if (shownIds.has(entry.comment.id)) continue;
    items.push(entry);
  }

  // 同批按时间升序：先发在前；带回复的自然更靠后
  items.sort((a, b) => (a.comment.time || 0) - (b.comment.time || 0));

  return { items, nextCursor: cursor };
}

const CommentBubble: React.FC<{
  item: ActiveBubble;
  isDaylight: boolean;
  typewriter: boolean;
  onHoverChange: (key: string, hovering: boolean) => void;
}> = ({ item, isDaylight, typewriter, onHoverChange }) => {
  const fullText = normalizeContent(item.comment.content);
  const { shown, typing, done } = useTypewriter(fullText, typewriter);
  const { viewportRef, contentRef } = useAutoScroll({
    followBottom: typing,
    cruise: done,
    contentKey: item.key,
    contentLength: shown.length,
  });
  const avatar = coverImageUrl(item.comment.avatar, 96);
  const bubbleBg = isDaylight
    ? 'rgba(255,252,248,0.88)'
    : 'rgba(28,26,34,0.78)';
  const ink = isDaylight ? 'rgba(36,32,40,0.92)' : 'rgba(255,248,255,0.92)';
  const mute = isDaylight ? 'rgba(36,32,40,0.48)' : 'rgba(255,248,255,0.48)';
  const border = isDaylight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.12)';
  const replyBoxBg = isDaylight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
  const avatarOnLeft = item.placement.side === 'left';
  const arrowTop = Math.max(6, Math.round(AVATAR_PX / 2 - 7));

  return (
    <motion.div
      className="pointer-events-auto absolute"
      style={{
        top: `${item.placement.topPct}%`,
        left: avatarOnLeft ? `${item.placement.edgePct}%` : undefined,
        right: avatarOnLeft ? undefined : `${item.placement.edgePct}%`,
        zIndex: 24,
      }}
      initial={{ opacity: 0, y: 14, scale: 0.88, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, scale: 0.94, filter: 'blur(4px)' }}
      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => onHoverChange(item.key, true)}
      onMouseLeave={() => onHoverChange(item.key, false)}
    >
      <div
        className="flex items-start"
        style={{
          flexDirection: avatarOnLeft ? 'row' : 'row-reverse',
          gap: AVATAR_GAP_PX,
        }}
      >
        <div
          className="relative z-10 shrink-0 overflow-hidden rounded-full shadow-md"
          style={{
            width: AVATAR_PX,
            height: AVATAR_PX,
            boxShadow: isDaylight
              ? '0 6px 16px rgba(0,0,0,0.14)'
              : '0 8px 18px rgba(0,0,0,0.4)',
            border: `2px solid ${isDaylight ? '#fff' : 'rgba(255,255,255,0.2)'}`,
            background: isDaylight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
          }}
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        <div
          className="relative rounded-[1.15rem] px-3.5 pb-3 pt-3 shadow-lg backdrop-blur-md"
          style={{
            display: 'inline-block',
            width: 'fit-content',
            maxWidth: 'min(18.5rem, 44vw)',
            background: bubbleBg,
            color: ink,
            border: `1px solid ${border}`,
            boxShadow: isDaylight
              ? '0 14px 34px rgba(70,50,40,0.12)'
              : '0 16px 36px rgba(0,0,0,0.38)',
          }}
        >
          <div
            aria-hidden
            className="absolute h-0 w-0"
            style={{
              top: arrowTop,
              ...(avatarOnLeft
                ? {
                    left: -7,
                    borderTop: '7px solid transparent',
                    borderBottom: '7px solid transparent',
                    borderRight: `8px solid ${bubbleBg}`,
                    filter: isDaylight
                      ? 'drop-shadow(-1px 0 0 rgba(255,255,255,0.55))'
                      : 'drop-shadow(-1px 0 0 rgba(255,255,255,0.12))',
                  }
                : {
                    right: -7,
                    borderTop: '7px solid transparent',
                    borderBottom: '7px solid transparent',
                    borderLeft: `8px solid ${bubbleBg}`,
                    filter: isDaylight
                      ? 'drop-shadow(1px 0 0 rgba(255,255,255,0.55))'
                      : 'drop-shadow(1px 0 0 rgba(255,255,255,0.12))',
                  }),
            }}
          />

          <div className="mb-1.5 flex min-w-0 items-center justify-start gap-1.5">
            <span className="truncate text-[12px] font-semibold tracking-wide" style={{ color: mute }}>
              {item.comment.nickname || '匿名'}
            </span>
            {item.hot ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium"
                style={{
                  color: '#d9480f',
                  background: 'rgba(255, 146, 84, 0.22)',
                }}
              >
                <Flame size={10} />
                热评
              </span>
            ) : null}
          </div>

          {item.comment.reply ? (
            <div
              className="hide-scrollbar mb-2 overflow-y-auto rounded-xl px-2.5 py-2 text-left text-[11px] leading-[1.5]"
              style={{
                background: replyBoxBg,
                color: mute,
                maxHeight: 88,
              }}
            >
              <span className="font-medium opacity-80">{item.comment.reply.nickname}：</span>
              <span className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>
                {normalizeContent(item.comment.reply.content)}
              </span>
            </div>
          ) : null}

          <div
            ref={viewportRef}
            className="hide-scrollbar overflow-x-hidden overflow-y-auto"
            style={{ maxHeight: BODY_MAX_HEIGHT_PX }}
          >
            <div
              ref={contentRef}
              className="whitespace-pre-wrap break-words text-left text-[13px] leading-[1.55]"
              style={{
                wordBreak: 'break-word',
                direction: 'ltr',
                unicodeBidi: 'plaintext',
                minHeight: '1.55em',
              }}
            >
              {shown}
              {typing ? (
                <span
                  aria-hidden
                  className="ml-px inline-block translate-y-px"
                  style={{
                    width: 1.5,
                    height: '0.95em',
                    background: ink,
                    opacity: 0.72,
                    animation: 'ryan-comment-caret 0.9s steps(1) infinite',
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CommentAtmosphereOverlay: React.FC<CommentAtmosphereOverlayProps> = ({
  track,
  isDaylight,
  chromeHidden = false,
  isPanelOpen = false,
}) => {
  const enabled = useCommentAtmosphereStore((state) => state.enabled);
  const typewriter = useCommentAtmosphereStore((state) => state.typewriter);
  const readOrder = useCommentAtmosphereStore((state) => state.readOrder);
  const crowdMode = useCommentAtmosphereStore((state) => state.crowdMode);
  const crowdCount = useCommentAtmosphereStore((state) => state.crowdCount);
  const maxVisible = crowdMode ? crowdCount : 1;

  const [fetched, setFetched] = useState<{ hot: SongComment[]; latest: SongComment[] } | null>(null);
  const [pool, setPool] = useState<Array<{ comment: SongComment; hot: boolean }>>([]);
  const [active, setActive] = useState<ActiveBubble[]>([]);
  const cursorRef = useRef(0);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const activeRef = useRef<ActiveBubble[]>([]);
  const timersRef = useRef<number[]>([]);
  const removeTimersRef = useRef<Map<string, number>>(new Map());
  const hoveringRef = useRef<Set<string>>(new Set());
  const trackKey = track ? `${track.type}:${track.songid}` : '';

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    removeTimersRef.current.forEach((id) => window.clearTimeout(id));
    removeTimersRef.current.clear();
    hoveringRef.current.clear();
  }, []);

  const clearRemoveTimer = useCallback((key: string) => {
    const id = removeTimersRef.current.get(key);
    if (id != null) {
      window.clearTimeout(id);
      removeTimersRef.current.delete(key);
    }
  }, []);

  const scheduleRemove = useCallback((key: string, delayMs: number) => {
    clearRemoveTimer(key);
    const timer = window.setTimeout(() => {
      removeTimersRef.current.delete(key);
      if (hoveringRef.current.has(key)) return;
      setActive((prev) => prev.filter((item) => item.key !== key));
    }, delayMs);
    removeTimersRef.current.set(key, timer);
  }, [clearRemoveTimer]);

  const handleHoverChange = useCallback((key: string, hovering: boolean) => {
    if (hovering) {
      hoveringRef.current.add(key);
      clearRemoveTimer(key);
      return;
    }
    hoveringRef.current.delete(key);
    scheduleRemove(key, HOVER_LEAVE_MS);
  }, [clearRemoveTimer, scheduleRemove]);

  useEffect(() => {
    if (!enabled || !track) {
      setFetched(null);
      setPool([]);
      setActive([]);
      clearTimers();
      shownIdsRef.current = new Set();
      cursorRef.current = 0;
      return;
    }

    setFetched(null);
    setActive([]);
    clearTimers();
    shownIdsRef.current = new Set();
    cursorRef.current = 0;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchNeteaseComments({
            type: track.type,
            id: track.songid,
            title: track.title,
            artist: track.author,
            offset: 0,
            limit: 40,
          });
          if (cancelled) return;
          if (result.code !== 200 || !result.data) {
            setFetched(null);
            return;
          }
          setFetched({
            hot: result.data.hotComments || [],
            latest: result.data.comments || [],
          });
        } catch {
          if (!cancelled) setFetched(null);
        }
      })();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clearTimers, enabled, trackKey]);

  useEffect(() => {
    if (!fetched) {
      setPool([]);
      return;
    }
    setPool(buildPool(fetched.hot, fetched.latest, readOrder));
    cursorRef.current = 0;
    shownIdsRef.current = new Set();
  }, [fetched, readOrder]);

  useEffect(() => {
    clearTimers();
    setActive([]);
    if (!enabled || pool.length === 0) return;

    let alive = true;
    let waveLeft = maxVisible;

    const scheduleNext = (delayMs: number) => {
      const timer = window.setTimeout(() => {
        if (!alive) return;
        spawnOne();
      }, delayMs);
      timersRef.current.push(timer);
    };

    const spawnOne = () => {
      if (!alive) return;
      const current = activeRef.current;
      if (current.length >= maxVisible) {
        scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        return;
      }

      // 本首歌评论够时：每条只出现一次；全部看完后停止（不再循环复用）
      if (shownIdsRef.current.size >= pool.length) {
        return;
      }

      const { items, nextCursor } = takeNextBatch(
        pool,
        cursorRef.current,
        1,
        shownIdsRef.current,
      );
      cursorRef.current = nextCursor;

      if (!items.length) {
        if (shownIdsRef.current.size < pool.length && cursorRef.current >= pool.length) {
          cursorRef.current = 0;
          scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        }
        return;
      }

      const entry = items[0];
      shownIdsRef.current.add(entry.comment.id);
      const placement = pickPlacement(
        current.map((item) => item.placement),
        chromeHidden,
        isPanelOpen,
      );
      const key = `${entry.comment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const bubble: ActiveBubble = {
        key,
        comment: entry.comment,
        hot: entry.hot,
        placement,
      };

      setActive((prev) => [...prev, bubble].slice(-maxVisible));

      const textLen = Array.from(normalizeContent(bubble.comment.content)).length
        + (bubble.comment.reply
          ? Array.from(normalizeContent(bubble.comment.reply.content)).length
          : 0);
      const showMs = typewriter
        ? textLen * TYPEWRITER_MS + rand(HOLD_MS_MIN, HOLD_MS_MAX)
        : rand(SHOW_MS_MIN, SHOW_MS_MAX);
      const bonus = Math.min(8000, Math.max(0, textLen - 80) * 35);
      scheduleRemove(bubble.key, showMs + bonus);

      waveLeft -= 1;
      const onScreenAfter = current.length + 1;
      const continueWave = maxVisible > 1
        && waveLeft > 0
        && onScreenAfter < maxVisible
        && shownIdsRef.current.size < pool.length;

      if (continueWave) {
        // 一批在约 3s 内先后出现：间隔 = 3s / (本批条数 - 1)
        const stagger = CROWD_WAVE_MS / Math.max(1, maxVisible - 1);
        scheduleNext(stagger);
      } else {
        waveLeft = maxVisible;
        scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
      }
    };

    scheduleNext(900);

    return () => {
      alive = false;
      clearTimers();
    };
  }, [
    chromeHidden,
    clearTimers,
    enabled,
    isPanelOpen,
    maxVisible,
    pool,
    scheduleRemove,
    typewriter,
  ]);

  if (!enabled || !track) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[24] overflow-hidden">
      <style>
        {`@keyframes ryan-comment-caret { 0%, 49% { opacity: 0.78; } 50%, 100% { opacity: 0; } }`}
      </style>
      <AnimatePresence>
        {active.map((item) => (
          <CommentBubble
            key={item.key}
            item={item}
            isDaylight={isDaylight}
            typewriter={typewriter}
            onHoverChange={handleHoverChange}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommentAtmosphereOverlay;
