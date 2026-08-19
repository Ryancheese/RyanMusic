import { createHash } from 'node:crypto';
import { FileCache } from './cache.ts';
import { pickBestCrossPlayTrack } from './crossPlay.ts';
import { linuxForward, neteaseApi, weapiRequest } from './crypto/netease.ts';
import type { NeteaseService } from './netease.ts';
import { httpsNeteaseUrl } from './util.ts';

export interface SongComment {
  id: string;
  userId: string;
  nickname: string;
  avatar: string;
  content: string;
  time: number;
  timeStr: string;
  likedCount: number;
  liked: boolean;
  location: string;
  reply: { nickname: string; content: string } | null;
}

export interface CommentsPayload {
  total: number;
  more: boolean;
  offset: number;
  limit: number;
  hotComments: SongComment[];
  comments: SongComment[];
  neteaseId: string;
  matched: { type: 'netease'; songid: string; title: string; author: string } | null;
  via: string;
}

interface ActionResult {
  code: number;
  error: string;
  data: CommentsPayload | '';
}

function ok(data: CommentsPayload): ActionResult {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string): ActionResult {
  return { code, error, data: '' };
}

/** 网易云无法在非移动端展示的占位评论（语音/图片/视频等） */
const MOBILE_ONLY_COMMENT_RE = /\[(?:发布了(?:语音|图片|视频|动态)|语音|图片|视频)[^\]]*?(?:请前往|前往).*?(?:移动端|手机).*?版本[^\]]*\]/u;
const DELETED_COMMENT_RE = /^\[(?:该)?评论已删除\]$/u;

export function isPlaceholderCommentContent(content: string): boolean {
  const text = String(content || '').trim();
  if (!text) return true;
  if (DELETED_COMMENT_RE.test(text)) return true;
  if (MOBILE_ONLY_COMMENT_RE.test(text)) {
    const withoutTags = text.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, '').trim();
    // 「歌名 + 占位符」或纯占位符都过滤
    if (!withoutTags || withoutTags.length <= 24) return true;
  }
  if (/^\[(?:发布了(?:语音|图片|视频|动态)[^\]]+|(?:语音|图片|视频))\]$/u.test(text)) {
    return true;
  }
  return false;
}

function uniqueComments(list: SongComment[]): SongComment[] {
  const seen = new Set<string>();
  const out: SongComment[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function mapList(raw: unknown): SongComment[] {
  if (!Array.isArray(raw)) return [];
  return uniqueComments(raw.map(mapNeteaseComment).filter((item): item is SongComment => Boolean(item)));
}

export function mapNeteaseComment(raw: any): SongComment | null {
  const id = String(raw?.commentId || raw?.commentid || raw?.id || '').trim();
  const content = String(raw?.content || '').trim();
  if (!id || !content || isPlaceholderCommentContent(content)) return null;
  const replied = Array.isArray(raw?.beReplied) ? raw.beReplied[0] : null;
  const replyContent = String(replied?.content || '').trim();
  return {
    id,
    userId: String(raw?.user?.userId || raw?.user?.userIdStr || ''),
    nickname: String(raw?.user?.nickname || '网易云用户'),
    avatar: httpsNeteaseUrl(String(raw?.user?.avatarUrl || '')),
    content,
    time: Number(raw?.time || 0) || 0,
    timeStr: String(raw?.timeStr || ''),
    likedCount: Number(raw?.likedCount || 0) || 0,
    liked: Boolean(raw?.liked),
    location: String(raw?.ipLocation?.location || '').trim(),
    reply: replyContent && !isPlaceholderCommentContent(replyContent)
      ? {
          nickname: String(replied?.user?.nickname || '网易云用户'),
          content: replyContent,
        }
      : null,
  };
}

function isCommentPayload(json: any): boolean {
  return Boolean(
    json
    && Number(json.code) === 200
    && (Array.isArray(json.comments) || Array.isArray(json.hotComments)),
  );
}

export async function fetchNeteaseCommentPage(
  songid: string,
  offset: number,
  limit: number,
  cookie = '',
): Promise<{ json: any; via: string } | null> {
  const data = { rid: songid, limit, offset, beforeTime: 0 };
  const path = `/api/v1/resource/comments/R_SO_4_${songid}`;
  let res = await weapiRequest(`/weapi/v1/resource/comments/R_SO_4_${songid}`, data, cookie);
  if (isCommentPayload(res.json)) return { json: res.json, via: 'weapi' };
  res = await linuxForward(path, data, cookie);
  if (isCommentPayload(res.json)) return { json: res.json, via: 'linux' };
  res = await neteaseApi(path, data, cookie, 'POST');
  if (isCommentPayload(res.json)) return { json: res.json, via: 'api' };
  return null;
}

function pageCacheKey(songid: string, offset: number, limit: number): string {
  return `${songid}_${offset}_${limit}`;
}

function hashKey(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

async function resolveNeteaseSong(
  netease: NeteaseService,
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
): Promise<{ songid: string; matched: CommentsPayload['matched'] } | { error: ActionResult }> {
  const type = (post.type || 'netease').trim();
  const id = String(post.id || '').trim();
  if (type === 'netease' || (!type && /^\d+$/.test(id))) {
    if (!/^\d+$/.test(id)) return { error: fail(400, '歌曲 ID 无效') };
    return { songid: id, matched: null };
  }

  const title = String(post.title || '').trim();
  const artist = String(post.artist || '').trim();
  if (!title) return { error: fail(400, '缺少歌名，无法匹配网易云评论') };

  const matchKey = hashKey(`${type}:${title}|${artist}`);
  const cachedMatch = cache.read<{ expires: number; songid: string; title: string; author: string }>(
    'netease_comment_match_v1',
    matchKey,
  );
  if (cachedMatch && cachedMatch.expires > Date.now() / 1000 && /^\d+$/.test(cachedMatch.songid)) {
    return {
      songid: cachedMatch.songid,
      matched: { type: 'netease', songid: cachedMatch.songid, title: cachedMatch.title, author: cachedMatch.author },
    };
  }

  const query = [title, artist].filter(Boolean).join(' ');
  const found = await netease.searchByName(query, 1).catch(() => null);
  const best = pickBestCrossPlayTrack({ title, artist }, found?.tracks || []);
  if (!best?.songid || !/^\d+$/.test(String(best.songid))) {
    return { error: fail(404, '未找到对应的网易云歌曲评论') };
  }
  cache.write('netease_comment_match_v1', matchKey, {
    expires: Math.floor(Date.now() / 1000) + 6 * 3600,
    songid: String(best.songid),
    title: best.title,
    author: best.author,
  });
  return {
    songid: String(best.songid),
    matched: { type: 'netease', songid: String(best.songid), title: best.title, author: best.author },
  };
}

export async function loadSongComments(
  netease: NeteaseService,
  cache: FileCache,
  post: Record<string, string>,
  cookie = '',
): Promise<ActionResult> {
  const id = String(post.id || post.songid || '').trim();
  const title = String(post.title || '').trim();
  const artist = String(post.artist || post.author || '').trim();
  const type = String(post.type || '').trim();
  if (!id && !title) return fail(400, '缺少歌曲信息');

  let offset = Math.max(0, Number(post.offset || 0) || 0);
  let limit = Number(post.limit || 20) || 20;
  if (limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  const resolved = await resolveNeteaseSong(netease, cache, { type, id, title, artist });
  if ('error' in resolved) return resolved.error;
  const { songid, matched } = resolved;

  const cacheKey = pageCacheKey(songid, offset, limit);
  const cached = cache.read<{ expires: number; payload: CommentsPayload }>('netease_comments_v1', cacheKey);
  if (cached?.payload && cached.expires > Date.now() / 1000) {
    return ok({ ...cached.payload, matched: cached.payload.matched || matched });
  }

  const page = await fetchNeteaseCommentPage(songid, offset, limit, cookie);
  if (!page) return fail(502, '评论暂时拉不到，请稍后重试');

  const payload: CommentsPayload = {
    total: Number(page.json.total || 0) || 0,
    more: Boolean(page.json.more),
    offset,
    limit,
    hotComments: offset === 0
      ? uniqueComments(mapList(page.json.topComments).concat(mapList(page.json.hotComments)))
      : [],
    comments: mapList(page.json.comments),
    neteaseId: songid,
    matched,
    via: page.via,
  };
  cache.write('netease_comments_v1', cacheKey, {
    expires: Math.floor(Date.now() / 1000) + 90,
    payload,
  });
  return ok(payload);
}
