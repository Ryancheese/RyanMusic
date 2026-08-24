import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { coverImageUrl, fetchSongComments, type SongComment } from '../api';
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
const CROWD_WAVE_MS = 4200;
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
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\[em\]e?\d+\[\/em\]/gi, '')
    .replace(/\[emot\][^\]]*\[\/emot\]/gi, '')
    .replace(/\[[A-Za-z]{1,12}\]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 同屏气泡的离散锚点：优先左右错开、上下拉开，避免大气泡叠在一起 */
function placementSlots(chromeHidden: boolean, panelOpen: boolean): BubblePlacement[] {
  const leftEdge = 4;
  const rightEdge = 4;
  const slots: BubblePlacement[] = [
    { side: 'left', edgePct: leftEdge, topPct: 10 },
    { side: 'left', edgePct: leftEdge + 4, topPct: 36 },
  ];
  if (!panelOpen) {
    slots.push(
      { side: 'right', edgePct: rightEdge, topPct: 12 },
      { side: 'right', edgePct: rightEdge + 4, topPct: 38 },
    );
  }
  if (chromeHidden) {
    slots.push({ side: 'left', edgePct: leftEdge + 2, topPct: 62 });
    if (!panelOpen) {
      slots.push({ side: 'right', edgePct: rightEdge + 2, topPct: 64 });
    }
  }
  return slots;
}

function placementConflict(a: BubblePlacement, b: BubblePlacement): boolean {
  if (a.side === b.side) {
    return Math.abs(a.topPct - b.topPct) < 24;
  }
  // 对侧也要拉开垂直距离，避免视觉上“贴在同一条水平带”
  return Math.abs(a.topPct - b.topPct) < 12;
}

/** 避开中部歌词带、底栏胶囊、右侧「正在播放」卡片；找不到空位时返回 null */
function pickPlacement(
  existing: BubblePlacement[],
  chromeHidden: boolean,
  panelOpen: boolean,
): BubblePlacement | null {
  const slots = shuffle(placementSlots(chromeHidden, panelOpen));
  const free = slots.filter((slot) => existing.every((item) => !placementConflict(item, slot)));
  if (free.length) {
    // 轻微已有气泡最远的空位
    free.sort((a, b) => {
      const score = (slot: BubblePlacement) => {
        if (!existing.length) return 0;
        return Math.min(
          ...existing.map((item) => {
            const sidePenalty = item.side === slot.side ? 0 : 18;
            return Math.abs(item.topPct - slot.topPct) + sidePenalty;
          }),
        );
      };
      return score(b) - score(a);
    });
    const best = free[0];
    return {
      side: best.side,
      edgePct: best.edgePct + rand(-1.2, 1.2),
      topPct: best.topPct + rand(-2.5, 2.5),
    };
  }
  return null;
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

const PAGE_LIMIT = 50;
const PREFETCH_AHEAD = 12;
const MIX_WINDOW = 10;
const MIX_PREFERRED = 7;

function usableComments(list: SongComment[]): SongComment[] {
  return list.filter((item) => normalizeContent(item.content).length >= 8);
}

function uniqueById(list: SongComment[]): SongComment[] {
  const seen = new Set<string>();
  const out: SongComment[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function orderComments(list: SongComment[], order: CommentReadOrder): SongComment[] {
  const usable = uniqueById(usableComments(list));
  if (order === 'reverse') return usable.reverse();
  if (order === 'random') return shuffle(usable);
  return usable;
}

function appendUnique(
  target: SongComment[],
  incoming: SongComment[],
  seen: Set<string>,
  order: CommentReadOrder,
): SongComment[] {
  const next = orderComments(incoming, order).filter((item) => !seen.has(item.id));
  for (const item of next) seen.add(item.id);
  return target.concat(next);
}

const CommentBubble: React.FC<{
  item: ActiveBubble;
  isDaylight: boolean;
  typewriter: boolean;
  scale: number;
  onHoverChange: (key: string, hovering: boolean) => void;
}> = ({ item, isDaylight, typewriter, scale, onHoverChange }) => {
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
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  const avatarPx = px(AVATAR_PX);
  const arrowTop = Math.max(6, Math.round(avatarPx / 2 - 7));
  const nicknamePx = px(12);
  const hotPx = px(10);
  const replyPx = px(11);
  const bodyPx = px(13);

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
          gap: px(AVATAR_GAP_PX),
        }}
      >
        <div
          className="relative z-10 shrink-0 overflow-hidden rounded-full shadow-md"
          style={{
            width: avatarPx,
            height: avatarPx,
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
          className="relative rounded-[1.15rem] shadow-lg backdrop-blur-md"
          style={{
            display: 'inline-block',
            width: 'fit-content',
            maxWidth: `min(${18.5 * scale}rem, 48vw)`,
            padding: `${px(12)}px ${px(14)}px ${px(12)}px`,
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
            <span className="truncate font-semibold tracking-wide" style={{ color: mute, fontSize: nicknamePx }}>
              {item.comment.nickname || '匿名'}
            </span>
            {item.hot ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-medium"
                style={{
                  color: '#d9480f',
                  background: 'rgba(255, 146, 84, 0.22)',
                  fontSize: hotPx,
                }}
              >
                <Flame size={hotPx} />
                热评
              </span>
            ) : null}
          </div>

          {item.comment.reply ? (
            <div
              className="hide-scrollbar mb-2 overflow-y-auto rounded-xl px-2.5 py-2 text-left leading-[1.5]"
              style={{
                background: replyBoxBg,
                color: mute,
                maxHeight: px(88),
                fontSize: replyPx,
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
            style={{ maxHeight: px(BODY_MAX_HEIGHT_PX) }}
          >
            <div
              ref={contentRef}
              className="whitespace-pre-wrap break-words text-left leading-[1.55]"
              style={{
                wordBreak: 'break-word',
                direction: 'ltr',
                unicodeBidi: 'plaintext',
                minHeight: '1.55em',
                fontSize: bodyPx,
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
  const fontScale = useCommentAtmosphereStore((state) => state.fontScale);
  const mixBias = useCommentAtmosphereStore((state) => state.mixBias);
  const commentSource = useCommentAtmosphereStore((state) => state.commentSource);
  const autoBestComment = useCommentAtmosphereStore((state) => state.autoBestComment);
  const maxVisible = crowdMode ? crowdCount : 1;
  const bubbleScale = fontScale / 100;

  const [feedReady, setFeedReady] = useState(false);
  const [active, setActive] = useState<ActiveBubble[]>([]);
  const hotRef = useRef<SongComment[]>([]);
  const latestRef = useRef<SongComment[]>([]);
  const latestSeenRef = useRef<Set<string>>(new Set());
  const hotCursorRef = useRef(0);
  const latestCursorRef = useRef(0);
  const nextOffsetRef = useRef(0);
  const moreRef = useRef(false);
  const fetchingRef = useRef(false);
  const prefetchPromiseRef = useRef<Promise<void> | null>(null);
  const fetchFailsRef = useRef(0);
  const mixTickRef = useRef(0);
  const sourceLockRef = useRef<'netease' | 'qq' | 'kugou' | undefined>(undefined);
  const activeRef = useRef<ActiveBubble[]>([]);
  const timersRef = useRef<number[]>([]);
  const removeTimersRef = useRef<Map<string, number>>(new Map());
  const hoveringRef = useRef<Set<string>>(new Set());
  const trackKey = track ? `${track.type}:${track.songid}` : '';
  const trackRef = useRef(track);
  trackRef.current = track;
  const readOrderRef = useRef(readOrder);
  readOrderRef.current = readOrder;
  const mixBiasRef = useRef(mixBias);
  mixBiasRef.current = mixBias;

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
      activeRef.current = activeRef.current.filter((item) => item.key !== key);
      setActive(activeRef.current);
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
    hotRef.current = [];
    latestRef.current = [];
    latestSeenRef.current = new Set();
    hotCursorRef.current = 0;
    latestCursorRef.current = 0;
    nextOffsetRef.current = 0;
    moreRef.current = false;
    fetchingRef.current = false;
    prefetchPromiseRef.current = null;
    fetchFailsRef.current = 0;
    mixTickRef.current = 0;
    sourceLockRef.current = undefined;
    setFeedReady(false);
    setActive([]);
    clearTimers();

    if (!enabled || !track) return;

    let cancelled = false;
    const currentTrack = track;

    const loadPage = async (offset: number) => {
      const result = await fetchSongComments({
        type: currentTrack.type,
        id: currentTrack.songid,
        title: currentTrack.title,
        artist: currentTrack.author,
        offset,
        limit: PAGE_LIMIT,
        preferred: commentSource,
        source: offset > 0
          ? sourceLockRef.current
          : (autoBestComment ? undefined : commentSource),
        mode: autoBestComment && offset === 0 ? 'best' : '',
      });
      if (cancelled) return null;
      if (result.code !== 200 || !result.data) return null;
      if (offset === 0) sourceLockRef.current = result.data.source;
      return result.data;
    };

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await loadPage(0);
          if (cancelled) return;
          if (!data) {
            setFeedReady(false);
            return;
          }
          const order = readOrderRef.current;
          hotRef.current = orderComments(data.hotComments || [], order);
          latestSeenRef.current = new Set(hotRef.current.map((item) => item.id));
          latestRef.current = appendUnique([], data.comments || [], latestSeenRef.current, order);
          nextOffsetRef.current = PAGE_LIMIT;
          moreRef.current = Boolean(data.more) && (data.comments || []).length > 0;
          fetchFailsRef.current = 0;
          if (moreRef.current) {
            const extra = await loadPage(PAGE_LIMIT);
            if (cancelled) return;
            if (extra) {
              latestRef.current = appendUnique(
                latestRef.current,
                extra.comments || [],
                latestSeenRef.current,
                order,
              );
              nextOffsetRef.current = PAGE_LIMIT * 2;
              moreRef.current = Boolean(extra.more) && (extra.comments || []).length > 0;
            }
          }
          setFeedReady(hotRef.current.length + latestRef.current.length > 0);
        } catch {
          if (!cancelled) setFeedReady(false);
        }
      })();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clearTimers, autoBestComment, commentSource, enabled, readOrder, trackKey]);

  const prefetchLatest = useCallback(async () => {
    if (prefetchPromiseRef.current) {
      await prefetchPromiseRef.current;
      return;
    }
    const current = trackRef.current;
    if (!current || !moreRef.current) return;
    const unused = latestRef.current.length - latestCursorRef.current;
    if (unused >= PREFETCH_AHEAD) return;
    const startedKey = `${current.type}:${current.songid}`;
    fetchingRef.current = true;
    const work = (async () => {
      try {
        const result = await fetchSongComments({
          type: current.type,
          id: current.songid,
          title: current.title,
          artist: current.author,
          offset: nextOffsetRef.current,
          limit: PAGE_LIMIT,
          preferred: commentSource,
          source: sourceLockRef.current,
        });
        const now = trackRef.current;
        if (!now || `${now.type}:${now.songid}` !== startedKey) return;
        if (result.code !== 200 || !result.data) {
          fetchFailsRef.current += 1;
          if (fetchFailsRef.current >= 3) moreRef.current = false;
          return;
        }
        fetchFailsRef.current = 0;
        const page = result.data.comments || [];
        latestRef.current = appendUnique(
          latestRef.current,
          page,
          latestSeenRef.current,
          readOrderRef.current,
        );
        nextOffsetRef.current += PAGE_LIMIT;
        moreRef.current = Boolean(result.data.more) && page.length > 0;
      } catch {
        fetchFailsRef.current += 1;
        if (fetchFailsRef.current >= 3) moreRef.current = false;
      } finally {
        fetchingRef.current = false;
        prefetchPromiseRef.current = null;
      }
    })();
    prefetchPromiseRef.current = work;
    await work;
  }, [autoBestComment, commentSource]);

  useEffect(() => {
    clearTimers();
    setActive([]);
    hotCursorRef.current = 0;
    latestCursorRef.current = 0;
    mixTickRef.current = 0;
    if (!enabled || !feedReady) return;

    let alive = true;
    let waveLeft = maxVisible;

    const takeHot = (): { comment: SongComment; hot: true } | null => {
      const list = hotRef.current;
      if (!list.length) return null;
      const item = list[hotCursorRef.current % list.length];
      hotCursorRef.current += 1;
      return { comment: item, hot: true };
    };

    const takeLatest = (): { comment: SongComment; hot: false } | null => {
      const list = latestRef.current;
      if (latestCursorRef.current >= list.length) return null;
      const item = list[latestCursorRef.current];
      latestCursorRef.current += 1;
      return { comment: item, hot: false };
    };

    const pickNext = (avoidIds: Set<string>): { comment: SongComment; hot: boolean } | null => {
      const wantPreferred = (mixTickRef.current % MIX_WINDOW) < MIX_PREFERRED;
      mixTickRef.current += 1;
      const preferHot = mixBiasRef.current === 'hot';
      const wantHot = preferHot ? wantPreferred : !wantPreferred;
      const primary = wantHot ? takeHot() : takeLatest();
      const fallback = wantHot ? takeLatest() : takeHot();
      const candidates = [primary, fallback].filter(Boolean) as Array<{ comment: SongComment; hot: boolean }>;
      return candidates.find((item) => !avoidIds.has(item.comment.id)) || candidates[0] || null;
    };

    const scheduleNext = (delayMs: number) => {
      const timer = window.setTimeout(() => {
        if (!alive) return;
        void spawnOne();
      }, delayMs);
      timersRef.current.push(timer);
    };

    const spawnOne = async () => {
      if (!alive) return;
      const current = activeRef.current;
      if (current.length >= maxVisible) {
        scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        return;
      }

      const unused = latestRef.current.length - latestCursorRef.current;
      if (unused < PREFETCH_AHEAD && moreRef.current) {
        const pending = prefetchLatest();
        if (unused <= 0) {
          await pending;
          if (!alive) return;
        }
      }

      const onScreen = new Set(current.map((item) => item.comment.id));
      let entry = pickNext(onScreen);

      if (!entry && latestRef.current.length && latestCursorRef.current >= latestRef.current.length && !moreRef.current) {
        latestCursorRef.current = 0;
        entry = pickNext(onScreen);
      }

      if (!entry) {
        if (moreRef.current || fetchingRef.current) {
          scheduleNext(900);
          return;
        }
        if (hotRef.current.length || latestRef.current.length) {
          hotCursorRef.current = 0;
          latestCursorRef.current = 0;
          scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        }
        return;
      }

      const placement = pickPlacement(
        current.map((item) => item.placement),
        chromeHidden,
        isPanelOpen,
      );
      if (!placement) {
        // 没有空位就不硬叠，等已有气泡散开后再出下一条
        scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        return;
      }
      const key = `${entry.comment.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const bubble: ActiveBubble = {
        key,
        comment: entry.comment,
        hot: entry.hot,
        placement,
      };

      // 同步更新 ref，避免群像连发时仍读到旧布局
      activeRef.current = [...current, bubble].slice(-maxVisible);
      setActive(activeRef.current);

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
        && onScreenAfter < maxVisible;

      if (continueWave) {
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
    feedReady,
    isPanelOpen,
    maxVisible,
    mixBias,
    prefetchLatest,
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
            scale={bubbleScale}
            onHoverChange={handleHoverChange}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommentAtmosphereOverlay;
