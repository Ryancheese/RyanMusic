import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User } from 'lucide-react';
import { coverImageUrl, fetchSongComments, type CommentSource, type SongComment } from '../api';
import type { Track } from '../types';
import {
  commentFitsLength,
  COMMENT_PLATFORM_OPTIONS,
  useCommentAtmosphereStore,
} from '../store/commentAtmosphereStore';

interface CommentStageLineProps {
  track: Track;
  chromeHidden?: boolean;
}

interface StageComment {
  id: string;
  source: CommentSource;
  comment: SongComment;
  text: string;
}

const HOLD_MS = 3200;
const FADE_OUT_MS = 320;
const GAP_MS = 340;
const CURATED_CAP = 36;

const BRAND_TINT: Record<CommentSource, string> = {
  netease: 'rgb(236, 65, 65)',
  qq: 'rgb(49, 194, 124)',
  kugou: 'rgb(36, 150, 255)',
};

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

function curated(pages: Array<{ source: CommentSource; items: SongComment[] }>, skipLong: boolean): StageComment[] {
  const pools = pages
    .map(({ source, items }) => {
      const kept = uniqueById(items).flatMap((comment) => {
        const text = normalizeContent(comment.content);
        if (text.length < 8 || !commentFitsLength(text, skipLong)) return [];
        return [{ comment, text }];
      });
      return { source, items: kept };
    })
    .filter((pool) => pool.items.length > 0);
  const total = pools.reduce((sum, pool) => sum + pool.items.length, 0);
  if (total === 0) return [];
  const target = Math.min(CURATED_CAP, total);
  const picked: StageComment[] = [];
  for (const pool of pools) {
    const share = (pool.items.length / total) * target;
    let take = Math.round(share);
    if (take === 0 && share >= 0.35) take = 1;
    take = Math.min(pool.items.length, Math.max(0, take));
    const sample = [...pool.items].sort(() => Math.random() - 0.5).slice(0, take);
    picked.push(...sample.map((item) => ({
      id: `${pool.source}:${item.comment.id}`,
      source: pool.source,
      comment: item.comment,
      text: item.text,
    })));
  }
  return picked.sort(() => Math.random() - 0.5);
}

const CommentLineAvatar: React.FC<{ url: string; tint: string }> = ({ url, tint }) => {
  const src = coverImageUrl(url, 64);
  const [failed, setFailed] = useState(!src);
  useEffect(() => {
    setFailed(!src);
  }, [src]);
  return (
    <span
      className="relative inline-flex h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full"
      style={{ background: `${tint}29` }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <User size={9} className="absolute inset-0 m-auto" style={{ color: tint, opacity: 0.55 }} />
      )}
    </span>
  );
};

const CommentStageLine: React.FC<CommentStageLineProps> = ({ track, chromeHidden = false }) => {
  const skipLongComments = useCommentAtmosphereStore((state) => state.skipLongComments);
  const autoBestComment = useCommentAtmosphereStore((state) => state.autoBestComment);
  const commentSource = useCommentAtmosphereStore((state) => state.commentSource);
  const [comments, setComments] = useState<StageComment[]>([]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const trackKey = `${track.type}:${track.songid}:${track.title}`;

  useEffect(() => {
    let cancelled = false;
    if (!track.title.trim()) {
      setComments([]);
      return undefined;
    }

    const sources = autoBestComment
      ? COMMENT_PLATFORM_OPTIONS.map((item) => item.id)
      : [commentSource];

    void (async () => {
      const pages = await Promise.all(
        sources.map(async (source) => {
          try {
            const result = await fetchSongComments({
              type: track.type,
              id: track.songid,
              title: track.title,
              artist: track.author,
              offset: 0,
              limit: 20,
              preferred: source,
              source,
            });
            if (result.code !== 200 || !result.data) return { source, items: [] as SongComment[] };
            const resolved = result.data.source || source;
            return {
              source: resolved,
              items: [...(result.data.hotComments || []), ...(result.data.comments || [])],
            };
          } catch {
            return { source, items: [] as SongComment[] };
          }
        }),
      );
      if (cancelled) return;
      setComments(curated(pages, skipLongComments));
    })();

    return () => {
      cancelled = true;
    };
  }, [autoBestComment, commentSource, skipLongComments, track.author, track.songid, track.title, track.type, trackKey]);

  useEffect(() => {
    if (comments.length === 0) {
      setShown(false);
      setIndex(0);
      return undefined;
    }
    let cancelled = false;
    let timer = 0;
    setIndex(0);
    setShown(false);

    const wait = (ms: number) => new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, ms);
    });

    void (async () => {
      while (!cancelled) {
        setShown(true);
        await wait(HOLD_MS);
        if (cancelled) return;
        setShown(false);
        await wait(FADE_OUT_MS + GAP_MS);
        if (cancelled) return;
        setIndex((current) => (current + 1) % comments.length);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [comments]);

  const current = comments.length > 0 ? comments[index % comments.length] : null;
  const tint = current ? BRAND_TINT[current.source] : 'transparent';

  if (!current) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-[28] h-7 w-[min(280px,calc(100vw-72px))] min-w-[160px] -translate-x-1/2 md:w-[min(440px,38vw)]"
      style={{ top: chromeHidden ? 64 : 76 }}
    >
      <AnimatePresence mode="wait">
        {shown ? (
          <motion.div
            key={current.id}
            className="flex h-7 w-full items-center justify-center gap-1.5 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <CommentLineAvatar url={current.comment.avatar} tint={tint} />
            <span
              className="shrink-0 text-[11px] font-semibold"
              style={{ color: tint, opacity: 0.82 }}
            >
              {current.comment.nickname || '匿名'}
            </span>
            <span
              className="min-w-0 truncate text-[13px] leading-none"
              style={{ color: tint }}
            >
              {current.text}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default CommentStageLine;
