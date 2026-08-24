import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, MessageCircle, ThumbsUp } from 'lucide-react';
import { coverImageUrl, fetchSongComments, type CommentsPayload, type SongComment } from '../api';
import type { Track } from '../types';
import {
  COMMENT_PLATFORM_OPTIONS,
  commentPlatformLabel,
  useCommentAtmosphereStore,
  type CommentPlatform,
} from '../store/commentAtmosphereStore';
import RyanLoader from './RyanLoader';

function formatCount(n: number): string {
  if (n < 10000) return String(n);
  const wan = n / 10000;
  const text = wan >= 100 ? wan.toFixed(0) : wan.toFixed(1);
  return `${text.replace(/\.0$/, '')}万`;
}

function formatTime(comment: SongComment): string {
  if (comment.timeStr) return comment.timeStr;
  if (!comment.time) return '';
  const date = new Date(comment.time);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cleanCommentText(text: string): string {
  return text
    .replace(/\[em\]e?\d+\[\/em\]/gi, '')
    .replace(/\[emot\][^\]]*\[\/emot\]/gi, '')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function CommentRow({
  comment,
  hot,
  isDaylight,
}: {
  comment: SongComment;
  hot?: boolean;
  isDaylight: boolean;
}) {
  const avatar = coverImageUrl(comment.avatar, 80);
  return (
    <article className="flex gap-2.5 px-4 py-3">
      <div className={`h-8 w-8 shrink-0 overflow-hidden rounded-full ${isDaylight ? 'bg-black/8' : 'bg-white/10'}`}>
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-medium opacity-70">{comment.nickname}</span>
          {hot ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium"
              style={{
                color: 'var(--text-accent)',
                background: 'color-mix(in srgb, var(--text-accent) 16%, transparent)',
              }}
            >
              <Flame size={10} />
              热评
            </span>
          ) : null}
        </div>
        {comment.reply ? (
          <div className={`mt-1 rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed opacity-55 ${
            isDaylight ? 'bg-black/5' : 'bg-white/8'
          }`}
          >
            <span className="opacity-70">{comment.reply.nickname}：</span>
            {cleanCommentText(comment.reply.content)}
          </div>
        ) : null}
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
          {cleanCommentText(comment.content)}
        </p>
        <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-40">
          <span className="truncate">
            {[formatTime(comment), comment.location].filter(Boolean).join(' · ')}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <ThumbsUp size={11} />
            {formatCount(comment.likedCount)}
          </span>
        </div>
      </div>
    </article>
  );
}

interface SongCommentsProps {
  active: boolean;
  track: Track | null;
  isDaylight: boolean;
}

const SongComments: React.FC<SongCommentsProps> = ({ active, track, isDaylight }) => {
  const [payload, setPayload] = useState<CommentsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const inflight = useRef(0);
  const sourceLock = useRef<CommentsPayload['source']>(undefined);
  const autoBest = useCommentAtmosphereStore((state) => state.autoBestComment);
  const preferred = useCommentAtmosphereStore((state) => state.commentSource);
  const selectCommentPlatform = useCommentAtmosphereStore((state) => state.selectCommentPlatform);
  const trackKey = track ? `${track.type}:${track.songid}` : '';

  const type = track?.type;
  const songid = track?.songid;
  const title = track?.title;
  const author = track?.author;

  const load = useCallback(async (offset: number) => {
    if (!type || !songid) return;
    const seq = ++inflight.current;
    if (offset === 0) {
      setLoading(true);
      setError('');
      setPayload(null);
      sourceLock.current = undefined;
    } else {
      setLoadingMore(true);
    }
    // 手动选平台时锁定 source，禁止静默兜底到其它平台；自动模式才走 best / 兜底链
    const locked = offset > 0
      ? sourceLock.current
      : (autoBest ? undefined : preferred);
    try {
      const result = await fetchSongComments({
        type,
        id: songid,
        title,
        artist: author,
        offset,
        limit: 20,
        preferred,
        source: locked,
        mode: autoBest && offset === 0 ? 'best' : '',
      });
      if (seq !== inflight.current) return;
      if (result.code !== 200 || !result.data) {
        if (offset === 0) {
          setPayload(null);
          setError(result.error || '评论暂时拉不到');
        }
        return;
      }
      if (offset === 0) sourceLock.current = result.data.source;
      setError('');
      setPayload((prev) => {
        const sameSource = prev
          && (prev.sourceId || prev.neteaseId) === (result.data.sourceId || result.data.neteaseId);
        if (offset === 0 || !prev || !sameSource) return result.data;
        const seen = new Set(prev.comments.map((item) => item.id));
        return {
          ...result.data,
          hotComments: prev.hotComments,
          comments: prev.comments.concat(result.data.comments.filter((item) => !seen.has(item.id))),
        };
      });
    } catch {
      if (seq !== inflight.current) return;
      if (offset === 0) setError('评论暂时拉不到');
    } finally {
      if (seq === inflight.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [author, autoBest, preferred, songid, title, type]);

  useEffect(() => {
    if (!active || !track) return;
    void load(0);
    return () => {
      inflight.current += 1;
    };
  }, [active, load, trackKey]);

  const onPickPlatform = (value: 'auto' | CommentPlatform) => {
    selectCommentPlatform(value);
  };

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!payload?.more || loadingMore || loading) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) {
      void load(payload.comments.length);
    }
  };

  if (!track) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-40">
        选择一首歌开始播放
      </div>
    );
  }

  const chipActive = (value: 'auto' | CommentPlatform) => (
    value === 'auto' ? autoBest : (!autoBest && preferred === value)
  );

  const platformBar = (
    <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2 pt-2.5">
      {([
        { id: 'auto' as const, label: '自动' },
        ...COMMENT_PLATFORM_OPTIONS.map((item) => ({ id: item.id, label: item.short })),
      ]).map((item) => {
        const on = chipActive(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPickPlatform(item.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              on ? '' : (isDaylight ? 'bg-black/5 opacity-55 hover:opacity-80' : 'bg-white/8 opacity-55 hover:opacity-80')
            }`}
            style={
              on
                ? {
                    background: 'color-mix(in srgb, var(--text-accent) 18%, transparent)',
                    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text-accent) 55%, transparent)',
                    color: 'var(--text-accent)',
                  }
                : undefined
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {platformBar}
        <div className="flex flex-1 items-center justify-center">
          <RyanLoader size={36} label="正在拉取评论" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {platformBar}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <MessageCircle size={22} className="opacity-30" />
          <p className="text-sm opacity-50">{error}</p>
          <button
            type="button"
            onClick={() => void load(0)}
            className={`rounded-full px-3 py-1 text-xs ${isDaylight ? 'bg-black/6' : 'bg-white/10'}`}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const hot = payload?.hotComments || [];
  const hotIds = new Set(hot.map((item) => item.id));
  const latest = (payload?.comments || []).filter((item) => !hotIds.has(item.id));
  const empty = !hot.length && !latest.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {platformBar}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 text-[11px] opacity-45">
        <span>
          {payload
            ? `共 ${formatCount(payload.total)} 条 · ${commentPlatformLabel(payload.source)}${autoBest ? '（自动）' : ''}`
            : '歌曲评论'}
        </span>
        {payload?.matched ? (
          <span className="min-w-0 truncate" title={`${payload.matched.title} - ${payload.matched.author}`}>
            匹配 · {payload.matched.title}
          </span>
        ) : (
          <span>热评 + 最新</span>
        )}
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto" onScroll={onScroll}>
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm opacity-40">暂无评论</div>
        ) : (
          <>
            {hot.map((item) => (
              <CommentRow key={`hot-${item.id}`} comment={item} hot isDaylight={isDaylight} />
            ))}
            {hot.length && latest.length ? (
              <div className={`mx-4 my-1 border-t pt-2 text-[11px] opacity-35 ${
                isDaylight ? 'border-black/8' : 'border-white/10'
              }`}
              >
                最新评论
              </div>
            ) : null}
            {latest.map((item) => (
              <CommentRow key={item.id} comment={item} isDaylight={isDaylight} />
            ))}
            {loadingMore ? (
              <div className="flex justify-center py-3">
                <RyanLoader size={24} />
              </div>
            ) : null}
            {payload && !payload.more && latest.length > 0 ? (
              <div className="py-4 text-center text-[11px] opacity-30">没有更多了</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default SongComments;
