import { createHash } from 'node:crypto';
import { FileCache } from './cache.ts';
import type { Track } from './config.ts';
import { pickBestCrossPlayTrack } from './crossPlay.ts';
import { linuxForward, neteaseApi, weapiRequest } from './crypto/netease.ts';
import { request } from './http.ts';
import { searchKugouSongs } from './kugouLyrics.ts';
import type { NeteaseService } from './netease.ts';
import type { QqService } from './qq.ts';
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

export type CommentSource = 'netease' | 'qq' | 'kugou';

export interface CommentsPayload {
  total: number;
  more: boolean;
  offset: number;
  limit: number;
  hotComments: SongComment[];
  comments: SongComment[];
  source: CommentSource;
  sourceId: string;
  neteaseId: string;
  matched: { type: CommentSource; songid: string; title: string; author: string } | null;
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

const COMMENT_SOURCE_FALLBACK: CommentSource[] = ['netease', 'qq', 'kugou'];

export function isCommentSource(value: unknown): value is CommentSource {
  return value === 'netease' || value === 'qq' || value === 'kugou';
}

export function commentSourceOrder(preferred: CommentSource): CommentSource[] {
  return [preferred, ...COMMENT_SOURCE_FALLBACK.filter((item) => item !== preferred)];
}

function hasUsableComments(payload: CommentsPayload): boolean {
  return payload.hotComments.length > 0 || payload.comments.length > 0 || payload.total > 0;
}

function toMatchTracks(items: Array<{ songid: string; title: string; author: string }>): Track[] {
  return items.map((item) => ({
    type: 'qq',
    songid: item.songid,
    title: item.title,
    author: item.author,
    lrc: '',
    url: '',
    pic: '',
  }));
}

function normalizeUnixMs(value: unknown): number {
  if (typeof value === 'string' && /[-/]/.test(value) && Number.isNaN(Number(value))) {
    const parsed = Date.parse(value.includes('T') ? value : value.replace(/-/g, '/'));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const n = Number(value) || 0;
  if (!n) return 0;
  return n < 1e12 ? n * 1000 : n;
}

export function mapQqComment(raw: any): SongComment | null {
  const id = String(raw?.commentid || raw?.id || '').trim();
  const content = String(raw?.rootcommentcontent || raw?.middlecommentcontent || raw?.content || '').trim();
  if (!id || !content || isPlaceholderCommentContent(content)) return null;
  const replyRaw = Array.isArray(raw?.middlecommentcontent) ? raw.middlecommentcontent[0] : null;
  const replyContent = String(replyRaw?.replycontent || replyRaw?.subcommentcontent || replyRaw?.content || '').trim();
  const time = normalizeUnixMs(raw?.time || raw?.timestamp);
  return {
    id,
    userId: String(raw?.uin || raw?.encrypt_uin || raw?.userid || ''),
    nickname: String(raw?.nick || raw?.nickname || 'QQ 音乐用户'),
    avatar: String(raw?.avatarurl || raw?.avatar || raw?.headurl || '').replace(/^http:\/\//, 'https://'),
    content,
    time,
    timeStr: String(raw?.timestr || raw?.timeStr || ''),
    likedCount: Number(raw?.praisenum || raw?.praise_num || raw?.likedCount || 0) || 0,
    liked: Boolean(raw?.ispraise || raw?.liked),
    location: String(raw?.location || raw?.ip_location || '').trim(),
    reply: replyContent && !isPlaceholderCommentContent(replyContent)
      ? {
          nickname: String(replyRaw?.nick || replyRaw?.nickname || replyRaw?.replyname || 'QQ 音乐用户'),
          content: replyContent,
        }
      : null,
  };
}

export function mapKugouComment(raw: any): SongComment | null {
  const user = raw?.user_info || raw?.user || {};
  const id = String(raw?.id || raw?.commentid || raw?.special_child_id || '').trim();
  const content = String(raw?.content || raw?.content_text || '').trim();
  if (!id || !content || isPlaceholderCommentContent(content)) return null;
  const replyContent = String(raw?.pcontent || raw?.reply_content || raw?.be_reply?.content || '').trim();
  const avatar = String(
    user.user_pic || user.pic || raw?.user_pic || raw?.userpic || '',
  ).replace(/\{size\}/gi, '100').replace(/^http:\/\//, 'https://');
  const time = normalizeUnixMs(raw?.addtime || raw?.add_time || raw?.update_time || raw?.time);
  return {
    id,
    userId: String(user.user_id || user.userid || raw?.user_id || ''),
    nickname: String(user.user_name || user.nickname || raw?.user_name || '酷狗用户'),
    avatar,
    content,
    time,
    timeStr: String(raw?.add_time_str || raw?.timeStr || ''),
    likedCount: Number(raw?.like || raw?.like_num || raw?.likes || raw?.support || 0) || 0,
    liked: Boolean(raw?.is_like || raw?.liked),
    location: String(raw?.location || raw?.city || '').trim(),
    reply: replyContent && !isPlaceholderCommentContent(replyContent)
      ? {
          nickname: String(raw?.puser || raw?.reply_user_name || raw?.be_reply?.user_name || '酷狗用户'),
          content: replyContent,
        }
      : null,
  };
}

function mapQqList(raw: unknown): SongComment[] {
  if (!Array.isArray(raw)) return [];
  return uniqueComments(raw.map(mapQqComment).filter((item): item is SongComment => Boolean(item)));
}

function mapKugouList(raw: unknown): SongComment[] {
  if (!Array.isArray(raw)) return [];
  return uniqueComments(raw.map(mapKugouComment).filter((item): item is SongComment => Boolean(item)));
}

async function resolveQqSong(
  qq: QqService,
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
): Promise<{ songmid: string; songid: string; matched: CommentsPayload['matched'] } | { error: ActionResult }> {
  const type = (post.type || '').trim();
  const id = String(post.id || '').trim();
  let songmid = type === 'qq' ? id : '';
  let matched: CommentsPayload['matched'] = null;

  if (!songmid) {
    const title = String(post.title || '').trim();
    const artist = String(post.artist || '').trim();
    if (!title) return { error: fail(400, '缺少歌名，无法匹配 QQ 音乐评论') };
    const matchKey = hashKey(`qq:${title}|${artist}`);
    const cachedMatch = cache.read<{ expires: number; songmid: string; title: string; author: string }>(
      'qq_comment_match_v1',
      matchKey,
    );
    if (cachedMatch && cachedMatch.expires > Date.now() / 1000 && cachedMatch.songmid) {
      songmid = cachedMatch.songmid;
      matched = { type: 'qq', songid: songmid, title: cachedMatch.title, author: cachedMatch.author };
    } else {
      const query = [title, artist].filter(Boolean).join(' ');
      const found = await qq.searchByName(query, 1).catch(() => null);
      const best = pickBestCrossPlayTrack({ title, artist }, found?.tracks || []);
      if (!best?.songid) return { error: fail(404, '未找到对应的 QQ 音乐评论') };
      songmid = String(best.songid);
      matched = { type: 'qq', songid: songmid, title: best.title, author: best.author };
      cache.write('qq_comment_match_v1', matchKey, {
        expires: Math.floor(Date.now() / 1000) + 6 * 3600,
        songmid,
        title: best.title,
        author: best.author,
      });
    }
  }

  const numeric = await qq.songNumericId(songmid).catch(() => 0);
  if (!numeric) return { error: fail(404, '未找到对应的 QQ 音乐评论') };
  return { songmid, songid: String(numeric), matched };
}

async function fetchQqCommentPage(
  songid: string,
  offset: number,
  limit: number,
): Promise<{ json: any; via: string } | null> {
  const pagenum = Math.floor(offset / limit);
  const qs = new URLSearchParams({
    biztype: '1',
    topid: songid,
    cmd: '8',
    pagenum: String(pagenum),
    pagesize: String(limit),
    lasthotcommentid: '',
    cid: '205360772',
    reqtype: '2',
    format: 'json',
  });
  const res = await request('GET', `https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?${qs}`, {
    timeoutMs: 8000,
    headers: { Referer: 'https://y.qq.com/' },
  });
  const json = res.json;
  if (!json) return null;
  const comments = json.comment?.commentlist || json.comment?.commentList;
  const hot = json.hot_comment?.commentlist || json.hot_comment?.commentList;
  if (!Array.isArray(comments) && !Array.isArray(hot)) return null;
  return { json, via: 'h5' };
}

async function resolveKugouSong(
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
): Promise<{ hash: string; mixsongid: string; matched: CommentsPayload['matched'] } | { error: ActionResult }> {
  const title = String(post.title || '').trim();
  const artist = String(post.artist || '').trim();
  if (!title) return { error: fail(400, '缺少歌名，无法匹配酷狗评论') };
  const matchKey = hashKey(`kugou:${title}|${artist}`);
  const cachedMatch = cache.read<{ expires: number; hash: string; mixsongid: string; title: string; author: string }>(
    'kugou_comment_match_v1',
    matchKey,
  );
  if (cachedMatch && cachedMatch.expires > Date.now() / 1000 && cachedMatch.hash) {
    return {
      hash: cachedMatch.hash,
      mixsongid: cachedMatch.mixsongid,
      matched: { type: 'kugou', songid: cachedMatch.hash, title: cachedMatch.title, author: cachedMatch.author },
    };
  }
  const query = [title, artist].filter(Boolean).join(' ');
  const found = await searchKugouSongs(query, 1, 8).catch(() => []);
  const best = pickBestCrossPlayTrack(
    { title, artist },
    toMatchTracks(found.map((item) => ({ songid: item.kgHash, title: item.name, author: item.artists }))),
  );
  const hit = found.find((item) => item.kgHash === best?.songid) || found[0];
  if (!hit?.kgHash || !best) return { error: fail(404, '未找到对应的酷狗评论') };
  cache.write('kugou_comment_match_v1', matchKey, {
    expires: Math.floor(Date.now() / 1000) + 6 * 3600,
    hash: hit.kgHash,
    mixsongid: String(hit.id || ''),
    title: hit.name,
    author: hit.artists,
  });
  return {
    hash: hit.kgHash,
    mixsongid: String(hit.id || ''),
    matched: { type: 'kugou', songid: hit.kgHash, title: hit.name, author: hit.artists },
  };
}

async function fetchKugouCommentPage(
  hash: string,
  mixsongid: string,
  offset: number,
  limit: number,
): Promise<{ json: any; via: string } | null> {
  const page = Math.floor(offset / limit) + 1;
  const tries = [
    `https://mcomment.kugou.com/index.php?r=commentsv2/getCommentWithLike&code=fc4be23b4e972707f36b8a828a93ba8a&hash=${encodeURIComponent(hash)}&p=${page}&pagesize=${limit}`,
    mixsongid
      ? `https://mcomment.kugou.com/index.php?r=commentsv2/getCommentWithLike&code=fc4be23b4e972707f36b8a828a93ba8a&mixsongid=${encodeURIComponent(mixsongid)}&childrenid=${encodeURIComponent(mixsongid)}&p=${page}&pagesize=${limit}`
      : '',
  ].filter(Boolean);
  for (const url of tries) {
    const res = await request('GET', url, {
      timeoutMs: 8000,
      headers: { Referer: 'https://www.kugou.com/' },
    });
    const json = res.json;
    const list = json?.list || json?.data?.list || json?.comments || json?.data?.comments;
    const hot = json?.weightList || json?.data?.weightList || json?.hotList;
    if (Array.isArray(list) || Array.isArray(hot)) return { json, via: 'mcomment' };
  }
  return null;
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

async function loadNeteaseComments(
  netease: NeteaseService,
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
  offset: number,
  limit: number,
  cookie: string,
): Promise<ActionResult> {
  const resolved = await resolveNeteaseSong(netease, cache, post);
  if ('error' in resolved) return resolved.error;
  const { songid, matched } = resolved;
  const cacheKey = pageCacheKey(`netease:${songid}`, offset, limit);
  const cached = cache.read<{ expires: number; payload: CommentsPayload }>('song_comments_v1', cacheKey);
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
    source: 'netease',
    sourceId: songid,
    neteaseId: songid,
    matched,
    via: page.via,
  };
  cache.write('song_comments_v1', cacheKey, {
    expires: Math.floor(Date.now() / 1000) + 90,
    payload,
  });
  return ok(payload);
}

async function loadQqComments(
  qq: QqService,
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
  offset: number,
  limit: number,
): Promise<ActionResult> {
  const resolved = await resolveQqSong(qq, cache, post);
  if ('error' in resolved) return resolved.error;
  const cacheKey = pageCacheKey(`qq:${resolved.songid}`, offset, limit);
  const cached = cache.read<{ expires: number; payload: CommentsPayload }>('song_comments_v1', cacheKey);
  if (cached?.payload && cached.expires > Date.now() / 1000) {
    return ok({ ...cached.payload, matched: cached.payload.matched || resolved.matched });
  }
  const page = await fetchQqCommentPage(resolved.songid, offset, limit);
  if (!page) return fail(502, 'QQ 音乐评论暂时拉不到，请稍后重试');
  const comments = mapQqList(page.json.comment?.commentlist || page.json.comment?.commentList);
  const hotComments = offset === 0
    ? mapQqList(page.json.hot_comment?.commentlist || page.json.hot_comment?.commentList)
    : [];
  const total = Number(page.json.comment?.commenttotal || page.json.comment?.commentTotal || comments.length) || 0;
  const payload: CommentsPayload = {
    total,
    more: offset + comments.length < total,
    offset,
    limit,
    hotComments,
    comments,
    source: 'qq',
    sourceId: resolved.songid,
    neteaseId: resolved.songid,
    matched: resolved.matched,
    via: page.via,
  };
  cache.write('song_comments_v1', cacheKey, {
    expires: Math.floor(Date.now() / 1000) + 90,
    payload,
  });
  return ok(payload);
}

async function loadKugouComments(
  cache: FileCache,
  post: { type?: string; id: string; title?: string; artist?: string },
  offset: number,
  limit: number,
): Promise<ActionResult> {
  const resolved = await resolveKugouSong(cache, post);
  if ('error' in resolved) return resolved.error;
  const cacheKey = pageCacheKey(`kugou:${resolved.hash}`, offset, limit);
  const cached = cache.read<{ expires: number; payload: CommentsPayload }>('song_comments_v1', cacheKey);
  if (cached?.payload && cached.expires > Date.now() / 1000) {
    return ok({ ...cached.payload, matched: cached.payload.matched || resolved.matched });
  }
  const page = await fetchKugouCommentPage(resolved.hash, resolved.mixsongid, offset, limit);
  if (!page) return fail(502, '酷狗评论暂时拉不到，请稍后重试');
  const json = page.json;
  const comments = mapKugouList(json.list || json.data?.list || json.comments || json.data?.comments);
  const hotComments = offset === 0
    ? mapKugouList(json.weightList || json.data?.weightList || json.hotList || json.data?.hotList)
    : [];
  const total = Number(json.count || json.data?.count || json.total || comments.length) || 0;
  const payload: CommentsPayload = {
    total,
    more: offset + comments.length < total,
    offset,
    limit,
    hotComments,
    comments,
    source: 'kugou',
    sourceId: resolved.hash,
    neteaseId: resolved.hash,
    matched: resolved.matched,
    via: page.via,
  };
  cache.write('song_comments_v1', cacheKey, {
    expires: Math.floor(Date.now() / 1000) + 90,
    payload,
  });
  return ok(payload);
}

export async function loadSongComments(
  netease: NeteaseService,
  qq: QqService,
  cache: FileCache,
  post: Record<string, string>,
  cookies: { netease?: string } = {},
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

  const locked = isCommentSource(post.source) ? post.source : null;
  const wantBest = post.mode === 'best' || post.preferred === 'auto';
  const preferred = isCommentSource(post.preferred) ? post.preferred : 'netease';
  const ctx = { type, id, title, artist };

  const loadOne = (source: CommentSource) => (
    source === 'qq'
      ? loadQqComments(qq, cache, ctx, offset, limit)
      : source === 'kugou'
        ? loadKugouComments(cache, ctx, offset, limit)
        : loadNeteaseComments(netease, cache, ctx, offset, limit, cookies.netease || '')
  );

  // 翻页或手动锁定：只走单一平台
  if (locked || offset > 0) {
    const source = locked || preferred;
    return loadOne(source);
  }

  // 自动：并行探测三家，取评论数最多且可用的
  if (wantBest) {
    const results = await Promise.all(
      COMMENT_SOURCE_FALLBACK.map(async (source) => ({ source, result: await loadOne(source) })),
    );
    let best: ActionResult | null = null;
    let bestTotal = -1;
    let lastError: ActionResult | null = null;
    for (const { result } of results) {
      if (result.code === 200 && result.data && hasUsableComments(result.data)) {
        const total = Number(result.data.total) || 0;
        if (total > bestTotal) {
          bestTotal = total;
          best = result;
        }
      } else if (result.code !== 200) {
        lastError = result;
      } else {
        lastError = fail(404, '暂无评论');
      }
    }
    return best || lastError || fail(404, '暂无评论');
  }

  const order = commentSourceOrder(preferred);
  let lastError: ActionResult | null = null;
  for (const source of order) {
    const result = await loadOne(source);
    if (result.code === 400 && source === order[0] && !title) return result;
    if (result.code === 200 && result.data && hasUsableComments(result.data)) return result;
    lastError = result.code === 200 ? fail(404, '暂无评论') : result;
  }
  return lastError || fail(404, '暂无评论');
}
