import { bootstrapBase, UA, type MatchSearchTrack, type Track } from './config.ts';
import { FileCache } from './cache.ts';
import { followLocation, request } from './http.ts';
import { proxyUrl } from './sign.ts';
import { decodeEntities, isBadMediaUrl, isQqDelisted, isQqTrialMediaUrl, jsonpToJson, nameSearchSourcePage, sliceNameSearchSongids } from './util.ts';

export class QqService {
  private readonly playInflight = new Map<string, Promise<string | null>>();

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

  async songNumericId(songmid: string, hint = 0): Promise<number> {
    if (hint > 0) return hint;
    const qs = new URLSearchParams({ songmid, format: 'json' });
    const res = await request('GET', `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`, {
      headers: { Referer: 'http://m.y.qq.com' },
    });
    return Number(res.json?.data?.[0]?.id || 0);
  }

  async playLyricInfo(songmid: string, songId: number, cookie: string): Promise<any> {
    const payload = {
      comm: { ct: 11, cv: '1003006', v: '1003006', tmeAppID: 'qqmusiclight', nettype: 'NETWORK_WIFI', uid: '0', udid: '0' },
      request: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param: {
          albumName: Buffer.from('').toString('base64'),
          crypt: 1,
          ct: 19,
          cv: 2111,
          interval: 0,
          lrc_t: 0,
          qrc: 1,
          qrc_t: 0,
          roma: 1,
          roma_t: 0,
          singerName: Buffer.from('').toString('base64'),
          songID: songId,
          songMid: songmid,
          songName: Buffer.from('').toString('base64'),
          trans: 1,
          trans_t: 0,
          type: 0,
        },
      },
    };
    const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Referer: 'https://y.qq.com/',
        'User-Agent': 'okhttp/3.14.9',
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify(payload),
    });
    return res.json?.request?.data ?? null;
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
    const byId = new Map(list.map((song: any) => [String(song.songmid || song.mid || ''), song]));
    const tracks = sliced.songids
      .map((id) => this.trackFromSong(byId.get(String(id))))
      .filter((item): item is Track => Boolean(item));
    return { tracks, hasMore: sliced.has_more };
  }

  async searchByNameForMatch(query: string, page: number): Promise<MatchSearchTrack[]> {
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
    if (!Array.isArray(list) || !list.length) return [];
    const ids = list.map((s: any) => String(s.songmid || s.mid || '')).filter(Boolean);
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return [];
    const byId = new Map(list.map((song: any) => [String(song.songmid || song.mid || ''), song]));
    return sliced.songids
      .map((id) => {
        const song = byId.get(String(id));
        const track = this.trackFromSong(song);
        if (!track) return null;
        return {
          songid: track.songid,
          title: track.title,
          author: track.author,
          album: track.album || '',
          durationMs: track.durationMs || 0,
          pic: track.pic || '',
        } satisfies MatchSearchTrack;
      })
      .filter((item): item is MatchSearchTrack => Boolean(item));
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
    return data.map((value: any) => {
      const id = String(value.mid || '');
      const authors = Array.isArray(value.singer)
        ? value.singer.map((s: any) => s.title || s.name).filter(Boolean)
        : [];
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
        lrc: '',
        tlyric: '',
        url: '',
        pic,
      });
    });
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

  async resolvePlayUrl(songmid: string, cookie = '', skipCache = false): Promise<string | null> {
    const inflightKey = `${cookie ? 'auth' : 'private'}:${skipCache ? 'fresh' : 'cache'}:${songmid}`;
    const inflight = this.playInflight.get(inflightKey);
    if (inflight) return inflight;
    const pending = this.resolvePlayUrlInner(songmid, cookie, skipCache).finally(() => {
      this.playInflight.delete(inflightKey);
    });
    this.playInflight.set(inflightKey, pending);
    return pending;
  }

  forgetCachedPlay(songmid: string) {
    this.cache.setTtl('qq_play_v7', songmid, '', -1);
    this.cache.setTtl('qq_play_auth_v7', songmid, '', -1);
  }

  private async resolvePlayUrlInner(songmid: string, cookie = '', skipCache = false): Promise<string | null> {
    const cacheKey = cookie ? 'qq_play_auth_v7' : 'qq_play_v7';
    if (!skipCache) {
      const cached = this.cache.getTtl(cacheKey, songmid);
      if (cached && !isQqTrialMediaUrl(cached)) return cached;
    }

    if (cookie) {
      const official = await this.officialPlayUrl(songmid, cookie);
      if (official && !isQqTrialMediaUrl(official)) {
        this.cache.setTtl(cacheKey, songmid, official, 600);
        return official;
      }
    }

    // 非会员一刀切 RyanMusic 私链；试听链不再参与竞速。
    const url = await this.bootstrapPlayUrl(songmid)
      || await this.pyqPlayUrl(songmid);
    if (url && !isBadMediaUrl(url)) {
      this.cache.setTtl('qq_play_v7', songmid, url, 600);
      return url;
    }
    return null;
  }

  private async pyqPlayUrl(songmid: string): Promise<string | null> {
    const code = await this.getPyqCode(songmid);
    if (!code) return null;
    const url = await this.pyqFollow(songmid, code);
    return url && !isBadMediaUrl(url) ? url : null;
  }

  private async officialPlayUrl(songmid: string, cookie: string): Promise<string | null> {
    const map = Object.fromEntries(
      cookie.split(';').map((part) => {
        const index = part.indexOf('=');
        return index > 0
          ? [part.slice(0, index).trim(), part.slice(index + 1).trim()]
          : ['', ''];
      }),
    );
    const rawUin = map.uin || map.wxuin || map.qqmusic_uin || '0';
    const uin = rawUin.replace(/^o/i, '').replace(/^0+/, '') || '0';
    const payload = {
      comm: { uin, format: 'json', ct: 24, cv: 0, platform: 'wk_v17' },
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: '10000',
          songmid: [songmid],
          songtype: [0],
          uin,
          loginflag: cookie ? 1 : 0,
          platform: '20',
        },
      },
    };
    const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Cookie: cookie,
        Referer: 'https://y.qq.com/',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeoutMs: 2_500,
    });
    const data = res.json?.req_0?.data;
    const info = data?.midurlinfo?.[0] || {};
    const purl = String(info.purl || '');
    const filename = String(info.filename || '');
    if (!purl) return null;
    const sip = String(data?.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/');
    const url = `${sip.replace(/\/$/, '')}/${purl.replace(/^\//, '')}`;
    if (isBadMediaUrl(url) || isQqTrialMediaUrl(url, filename)) return null;
    return url;
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
    const loc = await followLocation(play, 'https://y.qq.com/', 4_500);
    if (!loc) return null;
    if (/stream\.qqmusic\.qq\.com|aqqmusic\.tc\.qq\.com/i.test(loc)) return loc;
    return (await followLocation(loc, 'https://y.qq.com/', 4_500)) || loc;
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
    let loc = await followLocation(api, `${base}/`, 4_500);
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
    const album = String(song.albumname || song.album?.title || song.album?.name || '');
    const intervalSec = Number(song.interval || song.duration || 0) || 0;
    return this.wrap({
      type: 'qq',
      songid: String(mid),
      title: String(song.songname || song.title || song.name || '未知曲目'),
      author: artists.join(', ') || '未知艺人',
      link: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
      lrc: '',
      url: '',
      pic,
      album,
      durationMs: intervalSec > 0 ? Math.round(intervalSec * 1000) : 0,
      ...(isQqDelisted(song) ? { delisted: true } : {}),
    });
  }
}

function formatCacheStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
