import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { coverImageUrl, fetchNeteaseComments, type SongComment } from '../api';
import type { Track } from '../types';
import { useCommentAtmosphereStore } from '../store/commentAtmosphereStore';

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

const MAX_VISIBLE = 2;
const SHOW_MS_MIN = 7200;
const SHOW_MS_MAX = 11000;
const HOLD_MS_MIN = 4200;
const HOLD_MS_MAX = 6800;
const GAP_MS_MIN = 2800;
const GAP_MS_MAX = 5200;
const MAX_CONTENT_CHARS = 110;
const MAX_CONTENT_LINES = 6;
const TYPEWRITER_MS = 38;
const AVATAR_PX = 40;
const AVATAR_GAP_PX = 10;

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

function clipContent(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').trim();
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const limitedLines = lines.slice(0, MAX_CONTENT_LINES);
  let clipped = limitedLines.join('\n');
  if (clipped.length > MAX_CONTENT_CHARS) {
    clipped = `${clipped.slice(0, MAX_CONTENT_CHARS).trim()}…`;
  } else if (lines.length > MAX_CONTENT_LINES) {
    clipped = `${clipped}\n…`;
  }
  return clipped;
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
  };
}

/** 避开中部歌词带、底栏胶囊、右侧「正在播放」卡片 */
function pickPlacement(
  existing: BubblePlacement[],
  chromeHidden: boolean,
  panelOpen: boolean,
): BubblePlacement {
  const topBand: [number, number] = [10, 26];
  const zones: Array<{ side: 'left' | 'right'; edge: [number, number]; top: [number, number] }> = [
    { side: 'left', edge: [4, 16], top: topBand },
  ];
  if (!panelOpen) {
    zones.push({ side: 'right', edge: [5, 16], top: topBand });
  }

  // 底栏可见时只用地台上沿，避免叠到播放胶囊 / 「正在播放」卡片
  if (chromeHidden) {
    zones.push({ side: 'left', edge: [4, 16], top: [58, 76] });
    if (!panelOpen) {
      zones.push({ side: 'right', edge: [5, 16], top: [58, 76] });
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
      if (item.side !== candidate.side) {
        return Math.abs(item.topPct - candidate.topPct) > 14;
      }
      const dx = Math.abs(item.edgePct - candidate.edgePct);
      const dy = Math.abs(item.topPct - candidate.topPct);
      return dx > 12 || dy > 18;
    });
    if (ok) return candidate;
  }
  return candidates[0] || { side: 'left', edgePct: 6, topPct: 14 };
}

function buildPool(hot: SongComment[], latest: SongComment[]): Array<{ comment: SongComment; hot: boolean }> {
  const hotIds = new Set(hot.map((item) => item.id));
  const preferred = hot
    .filter((item) => item.content.trim().length >= 8)
    .map((item) => ({ comment: item, hot: true as const }));
  const rest = latest
    .filter((item) => !hotIds.has(item.id) && item.content.trim().length >= 8)
    .map((item) => ({ comment: item, hot: false as const }));
  return shuffle([...preferred, ...preferred, ...rest]);
}

const CommentBubble: React.FC<{
  item: ActiveBubble;
  isDaylight: boolean;
  typewriter: boolean;
}> = ({ item, isDaylight, typewriter }) => {
  const fullText = clipContent(item.comment.content);
  const { shown, typing } = useTypewriter(fullText, typewriter);
  const avatar = coverImageUrl(item.comment.avatar, 96);
  const bubbleBg = isDaylight
    ? 'rgba(255,252,248,0.88)'
    : 'rgba(28,26,34,0.78)';
  const ink = isDaylight ? 'rgba(36,32,40,0.92)' : 'rgba(255,248,255,0.92)';
  const mute = isDaylight ? 'rgba(36,32,40,0.48)' : 'rgba(255,248,255,0.48)';
  const border = isDaylight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.12)';
  const avatarOnLeft = item.placement.side === 'left';
  const arrowTop = Math.max(6, Math.round(AVATAR_PX / 2 - 7));

  return (
    <motion.div
      className="pointer-events-none absolute"
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
            maxWidth: 'min(17.5rem, 42vw)',
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

          <div
            className="mb-1.5 flex min-w-0 items-center gap-1.5"
            style={{
              justifyContent: avatarOnLeft ? 'flex-start' : 'flex-end',
              flexDirection: avatarOnLeft ? 'row' : 'row-reverse',
            }}
          >
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

          <p
            className="whitespace-pre-wrap break-words text-[13px] leading-[1.55]"
            style={{
              wordBreak: 'break-word',
              textAlign: avatarOnLeft ? 'left' : 'right',
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
          </p>
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
  const [pool, setPool] = useState<Array<{ comment: SongComment; hot: boolean }>>([]);
  const [active, setActive] = useState<ActiveBubble[]>([]);
  const cursorRef = useRef(0);
  const activeRef = useRef<ActiveBubble[]>([]);
  const timersRef = useRef<number[]>([]);
  const trackKey = track ? `${track.type}:${track.songid}` : '';

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!enabled || !track) {
      setPool([]);
      setActive([]);
      clearTimers();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchNeteaseComments({
          type: track.type,
          id: track.songid,
          title: track.title,
          artist: track.author,
          offset: 0,
          limit: 30,
        });
        if (cancelled) return;
        if (result.code !== 200 || !result.data) {
          setPool([]);
          return;
        }
        setPool(buildPool(result.data.hotComments || [], result.data.comments || []));
        cursorRef.current = 0;
      } catch {
        if (!cancelled) setPool([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearTimers, enabled, trackKey]);

  useEffect(() => {
    clearTimers();
    setActive([]);
    if (!enabled || pool.length === 0) return;

    let alive = true;

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
      if (current.length >= MAX_VISIBLE) {
        scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
        return;
      }
      if (!pool.length) return;
      const index = cursorRef.current % pool.length;
      cursorRef.current += 1;
      const entry = pool[index];
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
      setActive((prev) => [...prev, bubble].slice(-MAX_VISIBLE));

      const textLen = Array.from(clipContent(entry.comment.content)).length;
      const showMs = typewriter
        ? textLen * TYPEWRITER_MS + rand(HOLD_MS_MIN, HOLD_MS_MAX)
        : rand(SHOW_MS_MIN, SHOW_MS_MAX);
      const removeTimer = window.setTimeout(() => {
        setActive((prev) => prev.filter((item) => item.key !== key));
      }, showMs);
      timersRef.current.push(removeTimer);
      scheduleNext(rand(GAP_MS_MIN, GAP_MS_MAX));
    };

    scheduleNext(900);
    if (pool.length > 1) scheduleNext(2600);

    return () => {
      alive = false;
      clearTimers();
    };
  }, [chromeHidden, clearTimers, enabled, isPanelOpen, pool, typewriter]);

  const visible = useMemo(() => active, [active]);

  if (!enabled || !track) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[24] overflow-hidden">
      <style>
        {`@keyframes ryan-comment-caret { 0%, 49% { opacity: 0.78; } 50%, 100% { opacity: 0; } }`}
      </style>
      <AnimatePresence>
        {visible.map((item) => (
          <CommentBubble
            key={item.key}
            item={item}
            isDaylight={isDaylight}
            typewriter={typewriter}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommentAtmosphereOverlay;
