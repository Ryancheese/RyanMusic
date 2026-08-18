import { bootstrapBase, type Track } from './config.ts';
import { FileCache } from './cache.ts';
import { encodeLinuxData, linuxForward, neteaseApi, neteaseHttp, eapiRequest, weapiRequest } from './crypto/netease.ts';
import { followLocation, request } from './http.ts';
import { proxyUrl } from './sign.ts';
import {
  httpsNeteaseUrl,
  isBadMediaUrl,
  nameSearchSourcePage,
  neteaseLyricText,
  sliceNameSearchSongids,
} from './util.ts';

export class NeteaseService {
  constructor(
    private readonly cache: FileCache,
    private readonly secret: string,
  ) {}

  wrap(track: Track): Track {
    return {
      ...track,
      url: proxyUrl(this.secret, 'url', 'netease', track.songid),
      pic: proxyUrl(this.secret, 'pic', 'netease', track.songid),
    };
  }

  async searchByName(query: string, page: number): Promise<{ tracks: Track[]; hasMore: boolean } | null> {
    const sourcePage = nameSearchSourcePage(page);
    const encoded = encodeLinuxData({
      method: 'POST',
      url: 'http://music.163.com/api/cloudsearch/pc',
      params: { s: query, type: 1, offset: sourcePage * 10 - 10, limit: 10 },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, '', {
      Referer: 'http://music.163.com/',
    });
    const songs = res.json?.result?.songs;
    if (!Array.isArray(songs) || !songs.length) return null;
    const ids = songs.map((s: any) => String(s.id));
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return null;
    const tracks = await this.songsByIds(sliced.songids.map(String));
    return { tracks, hasMore: sliced.has_more };
  }

  async songsByIds(ids: string[], cookie = ''): Promise<Track[]> {
    const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
    if (!unique.length) return [];
    const encoded = encodeLinuxData({
      method: 'GET',
      url: 'http://music.163.com/api/song/detail',
      params: { id: unique.join(','), ids: `[${unique.join(',')}]` },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, cookie, {
      Referer: 'http://music.163.com/',
    });
    const songs = res.json?.songs;
    if (!Array.isArray(songs)) return [];

    const details = await Promise.all(
      songs.map(async (value: any) => {
        const id = String(value.id);
        const lrc = await this.fetchLyric(id, cookie);
        const authors = Array.isArray(value.artists)
          ? value.artists.map((a: any) => a.name).filter(Boolean)
          : [];
        const pic = value.album?.picUrl ? `${value.album.picUrl}?param=300x300` : '';
        return this.wrap({
          type: 'netease',
          songid: id,
          title: String(value.name || '未知曲目'),
          author: authors.join(',') || '未知艺人',
          link: `http://music.163.com/#/song?id=${id}`,
          lrc: neteaseLyricText(lrc, 'lrc'),
          yrc: neteaseLyricText(lrc, 'yrc'),
          tlyric: neteaseLyricText(lrc, 'tlyric'),
          url: '',
          pic,
        });
      }),
    );
    return details;
  }

  async fetchLyric(id: string, cookie = ''): Promise<any> {
    const encoded = encodeLinuxData({
      method: 'GET',
      url: 'http://music.163.com/api/song/lyric',
      params: { id, lv: -1, tv: -1, rv: -1, kv: -1, yv: -1 },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, cookie, {
      Referer: 'http://music.163.com/',
    });
    return res.json;
  }

  static readonly QUALITY_LEVELS: Array<{ level: string; label: string; encodeType: string }> = [
    { level: 'jymaster', label: '超清母带', encodeType: 'flac' },
    { level: 'sky', label: '沉浸环绕', encodeType: 'flac' },
    { level: 'jyeffect', label: '高清环绕声', encodeType: 'flac' },
    { level: 'hires', label: 'Hi-Res', encodeType: 'flac' },
    { level: 'lossless', label: '无损', encodeType: 'flac' },
    { level: 'exhigh', label: '极高', encodeType: 'mp3' },
    { level: 'higher', label: '较高', encodeType: 'mp3' },
    { level: 'standard', label: '标准', encodeType: 'mp3' },
  ];

  async resolvePlayUrl(songid: string, cookie = '', level = ''): Promise<string | null> {
    const cacheKey = cookie
      ? `netease_play_auth_${level || 'auto'}`
      : 'netease_play';
    const cached = this.cache.getTtl(cacheKey, songid);
    if (cached) return cached;

    if (cookie) {
      const authUrl = await this.cookiePlayUrl(songid, cookie, level);
      if (authUrl) {
        this.cache.setTtl(cacheKey, songid, authUrl, 600);
        return authUrl;
      }
    }

    let url = await this.officialPlayUrl(songid);
    if (!url) url = await this.bootstrapPlayUrl(songid);
    if (!url) url = await this.metingPlayUrl(songid);
    if (url && !isBadMediaUrl(url) && !/\/404/.test(url)) {
      url = httpsNeteaseUrl(url);
      this.cache.setTtl('netease_play', songid, url, 600);
      return url;
    }
    return null;
  }

  async probePlayQualities(songid: string, cookie: string): Promise<Array<{
    level: string;
    label: string;
    br?: number;
    size?: number;
  }>> {
    const id = Number(songid);
    if (!id || !cookie) return [];
    const hits = await Promise.all(
      NeteaseService.QUALITY_LEVELS.map(async (item) => {
        const hit = await this.fetchPlayUrlForLevel(id, cookie, item.level, item.encodeType);
        if (!hit) return null;
        return {
          level: item.level,
          label: item.label,
          br: hit.br,
          size: hit.size,
        };
      }),
    );
    return hits.filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  async cookiePlayUrl(songid: string, cookie: string, preferredLevel = ''): Promise<string | null> {
    const id = Number(songid);
    if (!id || !cookie) return null;
    const preferred = NeteaseService.QUALITY_LEVELS.find((item) => item.level === preferredLevel);
    // 未指定档位时只试 320k 附近，避免登录态串行探测母带拖慢首包
    const ordered = preferred
      ? [preferred]
      : NeteaseService.QUALITY_LEVELS.filter((item) =>
        ['exhigh', 'higher', 'standard'].includes(item.level)
      );

    for (const item of ordered) {
      const hit = await this.fetchPlayUrlForLevel(id, cookie, item.level, item.encodeType);
      if (hit?.url) return hit.url;
    }
    if (preferred) {
      for (const item of NeteaseService.QUALITY_LEVELS.filter((item) => item.level !== preferred.level)) {
        const hit = await this.fetchPlayUrlForLevel(id, cookie, item.level, item.encodeType);
        if (hit?.url) return hit.url;
      }
    }
    const weapi = await weapiRequest(
      '/weapi/song/enhance/player/url/v1',
      { ids: `[${id}]`, level: preferredLevel || 'exhigh', encodeType: preferredLevel ? 'flac' : 'mp3' },
      cookie,
    );
    const item = weapi.json?.data?.[0];
    const url = item?.url as string | undefined;
    if (url && !item?.freeTrialInfo && !isBadMediaUrl(url) && !/\/404/i.test(url)) {
      return httpsNeteaseUrl(url);
    }
    return null;
  }

  private async fetchPlayUrlForLevel(
    id: number,
    cookie: string,
    level: string,
    encodeType: string,
  ): Promise<{ url: string; br?: number; size?: number } | null> {
    const res = await eapiRequest(
      '/api/song/enhance/player/url/v1',
      { ids: `[${id}]`, level, encodeType },
      cookie,
    );
    const item = res.json?.data?.[0];
    const url = item?.url as string | undefined;
    if (item?.freeTrialInfo) return null;
    if (!url || isBadMediaUrl(url) || /\/404/i.test(url)) return null;
    return {
      url: httpsNeteaseUrl(url),
      br: typeof item?.br === 'number' ? item.br : undefined,
      size: typeof item?.size === 'number' ? item.size : undefined,
    };
  }

  private async officialPlayUrl(songid: string): Promise<string | null> {
    const encoded = encodeLinuxData({
      method: 'POST',
      url: 'http://music.163.com/api/song/enhance/player/url',
      params: { ids: [Number(songid)], br: 320000 },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, '', {
      Referer: 'http://music.163.com/',
    });
    const url = res.json?.data?.[0]?.url as string | undefined;
    return url && !isBadMediaUrl(url) ? url : null;
  }

  private async bootstrapPlayUrl(songid: string): Promise<string | null> {
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request('POST', `${base}/`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/`,
      },
      body: { input: songid, filter: 'id', type: 'netease', page: 1 },
    });
    const apiPath = res.json?.data?.[0]?.url as string | undefined;
    if (!apiPath) return null;
    const api = `${base}/${apiPath.replace(/^\//, '')}`;
    let loc = await followLocation(api, `${base}/`);
    if (!loc) return null;
    if (/(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
    return (await followLocation(loc, `${base}/`)) || loc;
  }

  private async metingPlayUrl(songid: string): Promise<string | null> {
    const endpoints = [
      `https://api.injahow.cn/meting/?server=netease&type=url&id=${encodeURIComponent(songid)}`,
      `https://api.injahow.cn/meting/?type=url&id=${encodeURIComponent(songid)}`,
    ];
    for (const endpoint of endpoints) {
      const loc = await followLocation(endpoint, 'https://api.injahow.cn/');
      if (loc && !isBadMediaUrl(loc) && /(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
    }
    return null;
  }

  async resolvePicUrl(songid: string): Promise<string | null> {
    const encoded = encodeLinuxData({
      method: 'GET',
      url: 'http://music.163.com/api/song/detail',
      params: { id: songid, ids: `[${songid}]` },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, '', {
      Referer: 'http://music.163.com/',
    });
    const pic = res.json?.songs?.[0]?.album?.picUrl as string | undefined;
    if (!pic) return null;
    const withSize = pic.includes('?') ? pic : `${pic}?param=300x300`;
    return httpsNeteaseUrl(withSize);
  }

  trackFromSong(song: any): Omit<Track, 'lrc' | 'url'> | null {
    const id = song?.id;
    if (!id) return null;
    const artists: string[] = [];
    if (Array.isArray(song.ar)) {
      for (const a of song.ar) if (a?.name) artists.push(a.name);
    } else if (Array.isArray(song.artists)) {
      for (const a of song.artists) if (a?.name) artists.push(a.name);
    }
    const pic = song.al?.picUrl || song.album?.picUrl || '';
    return {
      type: 'netease',
      songid: String(id),
      title: String(song.name || '未知曲目'),
      author: artists.join(', ') || '未知艺人',
      link: `https://music.163.com/#/song?id=${id}`,
      pic,
    };
  }

  async songsByIdsV3(ids: number[], cookie: string): Promise<Track[]> {
    const unique = [...new Set(ids.filter((n) => n > 0))];
    const out: Track[] = [];
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200);
      const res = await neteaseApi(
        '/api/v3/song/detail',
        {
          c: JSON.stringify(chunk.map((id) => ({ id }))),
          ids: chunk.join(','),
        },
        cookie,
        'POST',
      );
      const songs = res.json?.songs;
      if (!Array.isArray(songs)) continue;
      for (const song of songs) {
        const t = this.trackFromSong(song);
        if (t) out.push(this.wrap({ ...t, lrc: '', url: '' }));
      }
    }
    return out;
  }
}
