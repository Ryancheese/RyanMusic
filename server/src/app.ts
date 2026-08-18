import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { NeteaseAccount } from './accounts/netease.ts';
import { QqAccount } from './accounts/qq.ts';
import { FileCache } from './cache.ts';
import { NETEASE_UA, UA, VERSION, apiSecret, randomCnIp, type MusicSource } from './config.ts';
import { LyricsService } from './lyrics.ts';
import { NeteaseService } from './netease.ts';
import { spaHtml } from './pages.ts';
import { QqService } from './qq.ts';
import { verifySign } from './sign.ts';
import { mediaReferer, parseSongUrl } from './util.ts';

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
    const res = await fetch(url, { headers, redirect: 'follow' });
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
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
  const secret = apiSecret(options.coreMarker || join(options.webRoot, 'core'));
  const cache = new FileCache(options.cacheDir);
  const netease = new NeteaseService(cache, secret);
  const qq = new QqService(cache, secret);
  const neteaseAccount = new NeteaseAccount(cache, netease);
  const qqAccount = new QqAccount(cache, qq);
  const lyrics = new LyricsService(
    cache,
    netease,
    qq,
    () => neteaseAccount.sessionCookie(),
    () => qqAccount.sessionCookie(),
  );
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
      const neteaseCookie = useAuth ? neteaseAccount.sessionCookie() || '' : '';
      let play =
        type === 'qq'
          ? await qq.resolvePlayUrl(id)
          : await netease.resolvePlayUrl(id, neteaseCookie);
      if (!play && useAuth && type === 'netease') {
        play = await netease.resolvePlayUrl(id, '');
      }
      if (!play) return c.text('无法获取播放地址', 502);
      let name = c.req.query('name') || 'RyanMusic';
      name = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_');
      if (!/\.mp3$/i.test(name)) name += '.mp3';
      const proxyOpts = {
        download: Boolean(c.req.query('dl')),
        filename: name,
        contentType: 'audio/mpeg',
        cookie: type === 'netease' ? neteaseCookie : undefined,
      };
      let streamed = await proxyMedia(play, c.req.raw, proxyOpts);
      if (streamed.status >= 400 && type === 'netease') {
        const fallback = await netease.resolvePlayUrl(id, '');
        if (fallback && fallback !== play) {
          streamed = await proxyMedia(fallback, c.req.raw, { ...proxyOpts, cookie: undefined });
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
      if (action.startsWith('netease_')) {
        const result = await neteaseAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action.startsWith('qq_')) {
        const result = await qqAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action === 'lyrics') {
        const lyricType = (post.type || '').trim();
        const lyricId = (post.id || '').trim();
        if (lyricType !== 'netease' && lyricType !== 'qq') {
          return jsonResponse('', 403, '歌词类型无效');
        }
        if (!lyricId) return jsonResponse('', 403, '缺少歌曲 ID');
        try {
          const data = await lyrics.fetch(lyricType, lyricId);
          return jsonResponse(data, 200, '');
        } catch (err) {
          return jsonResponse('', 502, `(°ー°〃) ${err instanceof Error ? err.message : '歌词获取失败'}`);
        }
      }

      const input = (post.input || '').trim();
      const filter = post.filter;
      const type = post.type as MusicSource | undefined;
      const page = Number(post.page || 1) || 1;
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
        let result: { tracks: import('./config.ts').Track[]; hasMore?: boolean } | null = null;
        if (filter === 'name') {
          result =
            type === 'qq'
              ? await qq.searchByName(input, page)
              : await netease.searchByName(input, page);
        } else if (filter === 'id') {
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
        return jsonResponse(result.tracks, 200, '', { has_more: Boolean(result.hasMore) });
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
