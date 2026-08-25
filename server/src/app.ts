import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { KugouAccount } from './accounts/kugou.ts';
import { NeteaseAccount } from './accounts/netease.ts';
import { QqAccount } from './accounts/qq.ts';
import { FileCache } from './cache.ts';
import { NETEASE_UA, UA, VERSION, apiSecret, bootstrapBase, isServerlessEnv, randomCnIp, type MusicSource, type SearchCategory } from './config.ts';
import { LyricsService } from './lyrics.ts';
import { NeteaseService } from './netease.ts';
import { spaHtml } from './pages.ts';
import { QqService } from './qq.ts';
import { verifySign } from './sign.ts';
import { httpsNeteaseUrl, mediaReferer, parseSongUrl } from './util.ts';
import { pickBestCrossPlayTrack } from './crossPlay.ts';
import { fetchOpen, request } from './http.ts';

export interface AppOptions {
  webRoot: string;
  cacheDir: string;
  coreMarker?: string;
}

function jsonResponse(data: unknown, code: number, error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ data, code, error, ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function isAllowedCoverUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('126.net')
      || host.endsWith('163.com')
      || host.endsWith('gtimg.cn')
      || host.endsWith('qlogo.cn')
      || host.endsWith('qq.com')
      || host.endsWith('myqcloud.com')
      || host.endsWith('music.126.net')
      || host.endsWith('kugou.com')
      || host.endsWith('kgimg.com')
    );
  } catch {
    return false;
  }
}

async function proxyMedia(
  url: string,
  req: Request,
  opts: { download?: boolean; filename?: string; contentType?: string; cookie?: string },
) {
  const neteaseCdn = /(163\.com|126\.net|netease)/i.test(url);
  const cnIp = neteaseCdn ? randomCnIp() : '';
  const headers: Record<string, string> = {
    'User-Agent': neteaseCdn ? NETEASE_UA : UA,
    Referer: mediaReferer(url),
    Accept: '*/*',
  };
  if (cnIp) {
    headers['X-Real-IP'] = cnIp;
    headers['X-Forwarded-For'] = cnIp;
  }
  if (opts.cookie) headers.Cookie = opts.cookie;
  const range = req.headers.get('range');
  if (range) headers.Range = range;
  try {
    const res = await fetchOpen(url, { headers, redirect: 'follow', connectTimeoutMs: 8_000 });
    if (res.status >= 400) {
      return new Response(opts.download ? '无法获取播放地址' : '上游资源不可用', { status: res.status });
    }
    const out = new Headers();
    out.set('Content-Type', res.headers.get('content-type') || opts.contentType || 'audio/mpeg');
    out.set('Cache-Control', opts.contentType?.startsWith('image/') ? 'public, max-age=86400' : 'no-store');
    out.set('Accept-Ranges', 'bytes');
    const len = res.headers.get('content-length');
    if (len) out.set('Content-Length', len);
    const cr = res.headers.get('content-range');
    if (cr) out.set('Content-Range', cr);
    if (opts.download && opts.filename) {
      out.set(
        'Content-Disposition',
        `attachment; filename="${opts.filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`,
      );
    }
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return new Response(opts.download || !opts.contentType?.startsWith('image/') ? '无法获取播放地址' : '封面不可用', {
      status: 502,
    });
  }
}

export function createApp(options: AppOptions) {
  try {
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  } catch {
    // Vercel / 部分 serverless 会锁住该环境变量
  }
  const secret = apiSecret(options.coreMarker || join(options.webRoot, 'core'));
  const cache = new FileCache(options.cacheDir);
  const netease = new NeteaseService(cache, secret);
  const qq = new QqService(cache, secret);
  const neteaseAccount = new NeteaseAccount(cache, netease);
  const qqAccount = new QqAccount(cache, qq);
  const kugouAccount = new KugouAccount(cache);
  const lyrics = new LyricsService(
    cache,
    netease,
    qq,
    () => neteaseAccount.sessionCookie(),
    () => qqAccount.sessionCookie(),
  );
  const privateBase = bootstrapBase();
  if (privateBase && !isServerlessEnv()) {
    void request('GET', `${privateBase}/`, { timeoutMs: 2_000 });
  }
  const app = new Hono();

  const mime: Record<string, string> = {
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
    '.webp': 'image/webp',
  };

  const sendFile = (rel: string) => {
    const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(options.webRoot, safe);
    if (!file.startsWith(options.webRoot) || !existsSync(file) || !statSync(file).isFile()) {
      return new Response('Not found', { status: 404 });
    }
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      headers: { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream' },
    });
  };

  app.get('/static/*', (c) => sendFile(c.req.path.slice(1)));
  app.get('/favicon.ico', () => sendFile('favicon.ico'));

  app.get('/help.php', (c) => c.redirect('/?doc=help', 302));
  app.get('/help', (c) => c.redirect('/?doc=help', 302));
  app.get('/disclaimer.php', (c) => c.redirect('/?doc=disclaimer', 302));
  app.get('/disclaimer', (c) => c.redirect('/?doc=disclaimer', 302));
  app.get('/privacy.php', (c) => c.redirect('/?doc=privacy', 302));
  app.get('/privacy', (c) => c.redirect('/?doc=privacy', 302));

  app.all('/api.php', async (c) => {
    const get = (c.req.query('get') || '').trim();
    const typeRaw = (c.req.query('type') || '').trim();
    const id = (c.req.query('id') || '').trim();
    const given = (c.req.query('sign') || '').trim();
    const t = (c.req.query('t') || '').trim();
    if (!get || !typeRaw || !id || !given || !t) return c.text('缺少请求参数', 400);
    if (!verifySign(secret, get, typeRaw, id, t, given)) return c.text('非法请求', 403);
    let type = typeRaw === 'wy' ? 'netease' : typeRaw;
    if (type !== 'qq' && type !== 'netease') return c.text('暂不支持该音源', 400);
    if (type === 'qq' && !/^[a-zA-Z0-9]+$/.test(id)) return c.text('Invalid id', 400);
    if (type === 'netease' && !/^\d+$/.test(id)) return c.text('Invalid id', 400);

    if (get === 'url') {
      const useAuth = Boolean(c.req.query('auth'));
      const skipCache = Boolean(c.req.query('fresh'));
      const level = String(c.req.query('level') || '').trim();
      const neteaseCookie = useAuth ? neteaseAccount.sessionCookie() || '' : '';
      const qqCookie = useAuth ? qqAccount.sessionCookie() || '' : '';
      const wantCross = c.req.query('cross') === '1';
      const isDelisted = c.req.query('delisted') === '1';
      const resolveCurrent = (auth: boolean, fresh = skipCache) => (
        type === 'qq'
          ? qq.resolvePlayUrl(id, auth ? qqCookie : '', fresh)
          : netease.resolvePlayUrl(id, auth ? neteaseCookie : '', level, fresh)
      );
      const resolveCross = async () => {
        const title = String(c.req.query('title') || '').trim();
        const artist = String(c.req.query('artist') || '').trim();
        if (!title) return null;
        const altType: MusicSource = type === 'qq' ? 'netease' : 'qq';
        const searchAlt = async (query: string) => (
          altType === 'qq'
            ? qq.searchByName(query, 1).catch(() => null)
            : netease.searchByName(query, 1).catch(() => null)
        );
        const pickCross = async (query: string, mode: 'strict' | 'titleOnly') => {
          const found = await searchAlt(query);
          return pickBestCrossPlayTrack({ title, artist }, found?.tracks || [], mode);
        };
        let best = await pickCross([title, artist].filter(Boolean).join(' '), 'strict');
        if (!best?.songid && artist.trim()) {
          best = await pickCross(title, 'titleOnly');
        }
        if (!best?.songid) return null;
        return altType === 'qq'
          ? qq.resolvePlayUrl(String(best.songid), '', true)
          : netease.resolvePlayUrl(String(best.songid), '', '', true);
      };
      let play: string | null = null;
      if (isDelisted) {
        play = await resolveCross();
      }
      if (!play) play = await resolveCurrent(useAuth);
      if (!play && useAuth) play = await resolveCurrent(false, skipCache);
      if (!play && wantCross && !isDelisted) play = await resolveCross();
      if (!play) return c.text('无法获取播放地址', 502);
      if (c.req.query('probe')) return new Response(null, { status: 204 });
      let name = c.req.query('name') || 'RyanMusic';
      name = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_');
      if (!/\.mp3$/i.test(name)) name += '.mp3';

      // 注意：不要 302 到跨域 CDN。前端 createMediaElementSource 需要同源音频，
      // 否则无 CORS 时浏览器会静音。
      const wantDownload = Boolean(c.req.query('dl'));
      const proxyOpts = {
        download: wantDownload,
        filename: name,
        contentType: 'audio/mpeg',
        cookie: type === 'netease' ? neteaseCookie : type === 'qq' ? qqCookie : undefined,
      };
      let streamed = await proxyMedia(play, c.req.raw, proxyOpts);
      if (streamed.status >= 400) {
        if (type === 'qq') qq.forgetCachedPlay(id);
        else netease.forgetCachedPlay(id);
        let retry = await resolveCurrent(false, true);
        if ((!retry || retry === play) && (wantCross || isDelisted)) {
          retry = await resolveCross();
        }
        if (retry && retry !== play) {
          streamed = await proxyMedia(retry, c.req.raw, { ...proxyOpts, cookie: undefined });
        }
      }
      return streamed;
    }
    if (get === 'pic') {
      const pic = type === 'qq' ? await qq.resolvePicUrl(id) : await netease.resolvePicUrl(id);
      if (!pic) return c.text('封面不存在', 404);
      const streamed = await proxyMedia(pic, c.req.raw, { contentType: 'image/jpeg' });
      return streamed.status >= 400 ? c.text('封面不存在', 404) : streamed;
    }
    if (get === 'lrc') {
      if (type !== 'qq') return c.text('该音源歌词无需代理', 400);
      return c.text(await qq.resolveLrcText(id));
    }
    return c.text('未知资源类型', 400);
  });

  const handleIndex = async (c: any) => {
    if (c.req.query('cover') && c.req.query('type') && c.req.query('id')) {
      let type = c.req.query('type') === 'wy' ? 'netease' : c.req.query('type');
      const id = c.req.query('id') || '';
      if ((type !== 'netease' && type !== 'qq') || !id) return c.text('Invalid cover', 400);
      const { proxyUrl } = await import('./sign.ts');
      c.header('Cache-Control', 'public, max-age=3600');
      return c.redirect(proxyUrl(secret, 'pic', type, id), 302);
    }
    if (c.req.query('img') && c.req.query('url')) {
      const raw = String(c.req.query('url') || '');
      const url = httpsNeteaseUrl(raw);
      if (!isAllowedCoverUrl(url)) return c.text('Invalid cover url', 400);
      c.header('Cache-Control', 'public, max-age=86400');
      return proxyMedia(url, c.req.raw, { contentType: 'image/jpeg' });
    }
    if (c.req.query('download') && c.req.query('url')) {
      const url = c.req.query('url') || '';
      if (!/^https?:\/\//i.test(url)) return c.text('Invalid url', 400);
      let name = c.req.query('name') || 'RyanMusic';
      name = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_');
      if (!/\.mp3$/i.test(name)) name += '.mp3';
      return proxyMedia(url, c.req.raw, { download: true, filename: name });
    }

    const xhr = (c.req.header('x-requested-with') || '') === 'XMLHttpRequest';
    if (c.req.method === 'POST' && xhr) {
      const body = await c.req.parseBody();
      const post: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string') post[k] = v;
      }
      const action = (post.action || '').trim();
      if (action === 'sign_media') {
        const type = post.type === 'qq' ? 'qq' : 'netease';
        const id = String(post.id || post.songid || '').trim();
        if (!id) return jsonResponse(null, 400, '缺少歌曲');
        let delisted = post.delisted === '1';
        if (!delisted) {
          try {
            if (type === 'netease') {
              const [track] = await netease.songsByIds([id]);
              delisted = Boolean(track?.delisted);
            } else {
              const [track] = await qq.songsByIds([id]);
              delisted = Boolean(track?.delisted);
            }
          } catch {
            // ignore probe errors
          }
        }
        const stub = {
          type,
          songid: id,
          title: String(post.title || ''),
          author: String(post.artist || post.author || ''),
          lrc: '',
          url: '',
          pic: '',
          ...(delisted ? { delisted: true } : {}),
        };
        const wrapped = type === 'qq' ? qq.wrap(stub) : netease.wrap(stub);
        return jsonResponse({ url: wrapped.url, pic: wrapped.pic, delisted }, 200, '');
      }
      if (action.startsWith('netease_')) {
        if (action === 'netease_qualities') {
          const songid = String(post.id || post.songid || '').trim();
          const cookie = neteaseAccount.sessionCookie() || '';
          if (!songid || !cookie) {
            return jsonResponse({ qualities: [] }, 200);
          }
          const qualities = await netease.probePlayQualities(songid, cookie);
          return jsonResponse({ qualities }, 200);
        }
        if (action === 'netease_comments') {
          const { loadSongComments } = await import('./comments.ts');
          const result = await loadSongComments(
            netease,
            qq,
            cache,
            post,
            { netease: neteaseAccount.sessionCookie() || '' },
          );
          return jsonResponse(result.data, result.code, result.error);
        }
        const result = await neteaseAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action.startsWith('qq_')) {
        const result = await qqAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action.startsWith('kugou_')) {
        const result = await kugouAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action === 'lyrics_search') {
        const title = (post.title || '').trim();
        const artist = (post.artist || '').trim();
        const durationMs = Number(post.durationMs || 0) || 0;
        const query = (post.query || '').trim();
        const source = (post.source || '').trim();
        const nativeSongId = (post.nativeSongId || '').trim();
        const nativeSourceRaw = (post.nativeSource || '').trim();
        const nativeSource = nativeSourceRaw === 'qq' ? 'qq' : nativeSourceRaw === 'netease' ? 'netease' : undefined;
        const sourceOk = source === 'netease' || source === 'qq' || source === 'kugou' || source === 'amll';
        if (!sourceOk) {
          return jsonResponse('', 403, '歌词源无效');
        }
        try {
          const candidates = await lyrics.searchCandidates({
            title,
            artist,
            durationMs,
            source: source as 'netease' | 'qq' | 'kugou' | 'amll',
            query,
            nativeSongId: nativeSongId || undefined,
            nativeSource,
          });
          return jsonResponse(candidates, 200, '');
        } catch (err) {
          return jsonResponse('', 502, `(°ー°〃) ${err instanceof Error ? err.message : '歌词搜索失败'}`);
        }
      }
      if (action === 'lyrics') {
        const lyricType = (post.type || '').trim();
        const lyricId = (post.id || '').trim();
        const preferred = (post.preferred || '').trim();
        const title = (post.title || '').trim();
        const artist = (post.artist || '').trim();
        const album = (post.album || '').trim();
        const durationMs = Number(post.durationMs || 0) || 0;
        const autoUseBest = post.autoUseBest === '1' || post.autoUseBest === 'true' || post.autoUseBest === true;
        const forceSource = post.forceSource === '1' || post.forceSource === 'true' || post.forceSource === true;
        const providerSongId = (post.providerSongId || '').trim();
        const kgHash = (post.kgHash || '').trim();
        const amllPlatformRaw = (post.amllPlatform || '').trim();
        const amllPlatform = amllPlatformRaw === 'qq' ? 'qq' : amllPlatformRaw === 'ncm' ? 'ncm' : undefined;
        const nativeOk = lyricType === 'netease' || lyricType === 'qq';
        const preferredOk = preferred === 'netease' || preferred === 'qq' || preferred === 'kugou' || preferred === 'amll';
        if (!nativeOk && !preferredOk) {
          return jsonResponse('', 403, '歌词类型无效');
        }
        try {
          if (providerSongId && preferredOk) {
            const data = await lyrics.fetchByCandidate({
              provider: preferred as 'netease' | 'qq' | 'kugou' | 'amll',
              providerSongId,
              kgHash: kgHash || undefined,
              amllPlatform,
              title,
              artist,
              album,
              durationMs,
            });
            return jsonResponse(data, 200, '');
          }
          const data = preferredOk
            ? await lyrics.match({
                preferred: preferred as 'netease' | 'qq' | 'kugou' | 'amll',
                title,
                artist,
                durationMs,
                autoUseBest,
                forceSource,
                nativeType: nativeOk ? lyricType : undefined,
                nativeId: lyricId || undefined,
              })
            : {
                ...(await lyrics.fetch(lyricType as 'netease' | 'qq', lyricId)),
                source: lyricType as 'netease' | 'qq',
              };
          return jsonResponse(data, 200, '');
        } catch (err) {
          return jsonResponse('', 502, `(°ー°〃) ${err instanceof Error ? err.message : '歌词获取失败'}`);
        }
      }
      if (action === 'cache_usage' || action === 'clear_cache') {
        try {
          const bytesToMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;
          const withMb = (usage: ReturnType<typeof cache.usage>) => ({
            ...usage,
            totalMB: bytesToMB(usage.totalBytes),
            rebuildableMB: bytesToMB(usage.rebuildableBytes),
            preservedMB: bytesToMB(usage.preservedBytes),
            categories: usage.categories.map((item) => ({
              ...item,
              mb: bytesToMB(item.bytes),
            })),
          });
          if (action === 'cache_usage') {
            return jsonResponse(withMb(cache.usage()), 200, '');
          }
          const rawCategory = String(post.category || 'all').trim();
          const category = (
            rawCategory === 'lyrics'
            || rawCategory === 'play'
            || rawCategory === 'comments'
            || rawCategory === 'other'
            || rawCategory === 'all'
          ) ? rawCategory : 'all';
          const result = cache.clearSafe(category);
          const usage = cache.usage();
          return jsonResponse({
            ...result,
            removedMB: bytesToMB(result.removedBytes),
            usage: withMb(usage),
          }, 200, '');
        } catch (err) {
          return jsonResponse('', 500, err instanceof Error ? err.message : '清理失败');
        }
      }

      const input = (post.input || '').trim();
      const filter = post.filter;
      const type = post.type as MusicSource | undefined;
      const page = Number(post.page || 1) || 1;
      const rawCategory = String(post.category || 'all').trim() as SearchCategory;
      const category: SearchCategory = (
        rawCategory === 'all'
        || rawCategory === 'song'
        || rawCategory === 'playlist'
        || rawCategory === 'album'
        || rawCategory === 'artist'
      ) ? rawCategory : 'all';
      if (!input || !filter || !type) {
        return jsonResponse('', 403, '(°ー°〃) 传入的数据不对啊');
      }
      if (filter !== 'url' && type !== 'netease' && type !== 'qq') {
        return jsonResponse('', 403, '(°ー°〃) 目前还不支持这个网站');
      }
      const patterns: Record<string, RegExp> = {
        name: /^.+$/i,
        id: /^[\w/|]+$/i,
        url: /^https?:\/\/\S+$/i,
      };
      if (!patterns[filter]?.test(input)) {
        return jsonResponse('', 403, '(・-・*) 请检查您的输入是否正确');
      }

      try {
        if (filter === 'name') {
          const activeCategory = category === 'all' ? 'all' : category;
          const result = type === 'qq'
            ? await qq.searchByCategory(input, page, activeCategory)
            : await netease.searchByCategory(input, page, activeCategory);
          if (!result) {
            return jsonResponse('', 404, 'ㄟ( ▔, ▔ )ㄏ 没有找到相关信息');
          }
          return jsonResponse(result.data, 200, '', {
            has_more: Boolean(result.hasMore),
            category: result.category,
          });
        }

        let result: { tracks: import('./config.ts').Track[]; hasMore?: boolean } | null = null;
        if (filter === 'id') {
          const tracks = type === 'qq' ? await qq.songsByIds([input]) : await netease.songsByIds([input]);
          result = { tracks, hasMore: false };
        } else {
          const parsed = parseSongUrl(input);
          if (!parsed) return jsonResponse('', 404, 'ㄟ( ▔, ▔ )ㄏ 没有找到相关信息');
          const tracks =
            parsed.site === 'qq'
              ? await qq.songsByIds([parsed.id])
              : await netease.songsByIds([parsed.id]);
          result = { tracks, hasMore: false };
        }
        if (!result || !result.tracks.length) {
          return jsonResponse('', 404, 'ㄟ( ▔, ▔ )ㄏ 没有找到相关信息');
        }
        return jsonResponse(result.tracks, 200, '', { has_more: Boolean(result.hasMore), category: 'song' });
      } catch (err) {
        return jsonResponse('', 502, `(°ー°〃) ${err instanceof Error ? err.message : '搜索失败'}`);
      }
    }

    const html = spaHtml(options.webRoot);
    if (!html) {
      return c.text(
        `RyanMusic ${VERSION}: 前端未构建。请先运行 web 目录 npm run build。`,
        500,
      );
    }
    return c.html(html);
  };

  app.get('/', handleIndex);
  app.post('/', handleIndex);
  app.get('/index.php', handleIndex);
  app.post('/index.php', handleIndex);

  return app;
}

export default createApp;
