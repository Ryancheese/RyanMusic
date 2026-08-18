import { bootstrapBase, UA, type Track } from './config.ts';
import { FileCache } from './cache.ts';
import { followLocation, request } from './http.ts';
import { proxyUrl } from './sign.ts';
import { decodeEntities, isBadMediaUrl, jsonpToJson, nameSearchSourcePage, sliceNameSearchSongids } from './util.ts';

export class QqService {
  constructor(
    private readonly cache: FileCache,
    private readonly secret: string,
  ) {}

  wrap(track: Track): Track {
    return {
      ...track,
      url: proxyUrl(this.secret, 'url', 'qq', track.songid),
      pic: proxyUrl(this.secret, 'pic', 'qq', track.songid),
    };
  }

  async searchByName(query: string, page: number): Promise<{ tracks: Track[]; hasMore: boolean } | null> {
    const sourcePage = nameSearchSourcePage(page);
    const qs = new URLSearchParams({ w: query, p: String(sourcePage), n: '10', format: 'json' });
    const res = await request('GET', `http://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp?${qs}`, {
      headers: {
        Referer: 'http://m.y.qq.com',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
      },
    });
    const list = res.json?.data?.song?.list;
    if (!Array.isArray(list) || !list.length) return null;
    const ids = list.map((s: any) => String(s.songmid || s.mid || '')).filter(Boolean);
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return null;
    const tracks = await this.songsByIds(sliced.songids.map(String));
    return { tracks, hasMore: sliced.has_more };
  }

  async songsByIds(ids: string[]): Promise<Track[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return [];
    const qs = new URLSearchParams({ songmid: unique.join(','), format: 'json' });
    const res = await request('GET', `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`, {
      headers: { Referer: 'http://m.y.qq.com' },
    });
    const data = res.json?.data;
    if (!Array.isArray(data)) return [];
    return Promise.all(
      data.map(async (value: any) => {
        const id = String(value.mid || '');
        const authors = Array.isArray(value.singer)
          ? value.singer.map((s: any) => s.title || s.name).filter(Boolean)
          : [];
        const lrc = await this.fetchLyric(id);
        const albumMid = value.album?.mid || '';
        const pic = albumMid
          ? `http://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
          : '';
        return this.wrap({
          type: 'qq',
          songid: id,
          title: String(value.title || '未知曲目'),
          author: authors.join(',') || '未知艺人',
          link: `https://y.qq.com/n/ryqq/songDetail/${id}`,
          lrc: decodeEntities(String(lrc.lyric || '')),
          tlyric: decodeEntities(String(lrc.trans || '')),
          url: '',
          pic,
        });
      }),
    );
  }

  async fetchLyric(songmid: string): Promise<{ lyric?: string; trans?: string }> {
    const qs = new URLSearchParams({
      songmid,
      format: 'json',
      nobase64: '1',
      songtype: '0',
      callback: 'c',
    });
    const res = await request(
      'GET',
      `http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg?${qs}`,
      { headers: { Referer: 'http://m.y.qq.com' } },
    );
    if (res.json && (res.json.lyric || res.json.trans)) return res.json;
    return jsonpToJson(res.body) || {};
  }

  async resolvePlayUrl(songmid: string): Promise<string | null> {
    const cached = this.cache.getTtl('qq_play', songmid);
    if (cached) return cached;
    const code = await this.getPyqCode(songmid);
    if (code) {
      const url = await this.pyqFollow(songmid, code);
      if (url && !isBadMediaUrl(url)) {
        this.cache.setTtl('qq_play', songmid, url, 1800);
        return url;
      }
    }
    const fallback = await this.bootstrapPlayUrl(songmid);
    if (fallback && !isBadMediaUrl(fallback)) {
      this.cache.setTtl('qq_play', songmid, fallback, 1800);
      return fallback;
    }
    return null;
  }

  private async getPyqCode(songmid: string): Promise<string | null> {
    const cached = this.cache.getTtl('qq_pyq', songmid, 'code');
    if (cached) return cached;
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request('POST', `${base}/`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: `${base}/` },
      body: { input: songmid, filter: 'id', type: 'qq', page: 1 },
    });
    const apiPath = res.json?.data?.[0]?.url as string | undefined;
    if (!apiPath) return null;
    const api = `${base}/${String(apiPath).replace(/^\//, '')}`;
    const loc = await followLocation(api, `${base}/`);
    const hay = loc || '';
    const m = hay.match(/[?&]code=([^&\s'"]+)/);
    if (!m) {
      const raw = await request('GET', api, { headers: { Referer: `${base}/`, 'User-Agent': UA } });
      const fromBody = raw.body.match(/[?&]code=([^&\s'"]+)/);
      if (fromBody) {
        this.cache.setTtl('qq_pyq', songmid, fromBody[1], 86400 * 7, 'code');
        return fromBody[1];
      }
      return null;
    }
    this.cache.setTtl('qq_pyq', songmid, m[1], 86400 * 7, 'code');
    return m[1];
  }

  private async pyqFollow(songmid: string, code: string): Promise<string | null> {
    const play = `https://c6.y.qq.com/rsc/fcgi-bin/fcg_pyq_play.fcg?${new URLSearchParams({
      songid: '',
      songmid,
      songtype: '1',
      fromtag: 'myhkw.cn',
      uin: '10001',
      code,
      cache: formatCacheStamp(),
    })}`;
    const loc = await followLocation(play, 'https://y.qq.com/');
    if (!loc) return null;
    if (/stream\.qqmusic\.qq\.com|aqqmusic\.tc\.qq\.com/i.test(loc)) return loc;
    return (await followLocation(loc, 'https://y.qq.com/')) || loc;
  }

  private async bootstrapPlayUrl(songmid: string): Promise<string | null> {
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request('POST', `${base}/`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: `${base}/` },
      body: { input: songmid, filter: 'id', type: 'qq', page: 1 },
    });
    const apiPath = res.json?.data?.[0]?.url as string | undefined;
    if (!apiPath) return null;
    const api = `${base}/${String(apiPath).replace(/^\//, '')}`;
    let loc = await followLocation(api, `${base}/`);
    if (!loc) return null;
    if (/stream\.qqmusic\.qq\.com|aqqmusic\.tc\.qq\.com/i.test(loc)) return loc;
    return (await followLocation(loc, `${base}/`)) || loc;
  }

  async resolvePicUrl(songmid: string): Promise<string | null> {
    const qs = new URLSearchParams({ songmid, format: 'json' });
    const res = await request(
      'GET',
      `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`,
      { headers: { Referer: 'https://y.qq.com/' } },
    );
    const albumMid = res.json?.data?.[0]?.album?.mid;
    if (!albumMid) return null;
    return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
  }

  async resolveLrcText(songmid: string): Promise<string> {
    const qs = new URLSearchParams({ songmid, format: 'json', nobase64: '1' });
    const res = await request(
      'GET',
      `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${qs}`,
      { headers: { Referer: 'https://y.qq.com/' } },
    );
    if (!res.json?.lyric) return '[00:00.00] 暂无歌词\n';
    return decodeEntities(String(res.json.lyric));
  }

  trackFromSong(song: any): Track | null {
    const mid = song.songmid || song.mid || '';
    if (!mid) return null;
    const artists: string[] = [];
    if (Array.isArray(song.singer)) {
      for (const s of song.singer) if (s?.name) artists.push(s.name);
    }
    const albummid = song.albummid || song.album?.mid || '';
    const pic = albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`
      : '';
    return this.wrap({
      type: 'qq',
      songid: String(mid),
      title: String(song.songname || song.title || song.name || '未知曲目'),
      author: artists.join(', ') || '未知艺人',
      link: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
      lrc: '',
      url: '',
      pic,
    });
  }
}

function formatCacheStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
