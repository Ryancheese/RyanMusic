import { bootstrapBase, type Track } from './config.ts';
import { FileCache } from './cache.ts';
import { encodeLinuxData, linuxForward, neteaseApi, neteaseHttp, eapiRequest, weapiRequest } from './crypto/netease.ts';
import { followLocation, request } from './http.ts';
import { proxyUrl } from './sign.ts';
import {
  firstTruthy,
  httpsNeteaseUrl,
  isBadMediaUrl,
  nameSearchSourcePage,
  sliceNameSearchSongids,
} from './util.ts';

const QUALITY_LADDER = ['standard', 'higher', 'exhigh', 'lossless', 'hires', 'jyeffect', 'sky', 'jymaster'] as const;

export function playLevelsFromPrivilege(priv: any): Array<{ level: string; label: string; encodeType: string }> {
  const named = String(priv?.playMaxBrLevel || priv?.maxBrLevel || priv?.plLevel || '').toLowerCase();
  let cap = QUALITY_LADDER.indexOf(named as (typeof QUALITY_LADDER)[number]);
  if (cap < 0) {
    const pl = Number(priv?.pl || priv?.maxbr || 0);
    if (pl >= 999000) cap = QUALITY_LADDER.indexOf('lossless');
    else if (pl >= 320000) cap = QUALITY_LADDER.indexOf('exhigh');
    else if (pl >= 192000) cap = QUALITY_LADDER.indexOf('higher');
    else cap = QUALITY_LADDER.indexOf('exhigh');
  }
  return NeteaseService.QUALITY_LEVELS.filter((item) => {
    const index = QUALITY_LADDER.indexOf(item.level as (typeof QUALITY_LADDER)[number]);
    return index >= 0 && index <= cap;
  });
}

export class NeteaseService {
  private readonly playInflight = new Map<string, Promise<string | null>>();

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
    const byId = new Map(songs.map((song: any) => [String(song.id), song]));
    const tracks = sliced.songids
      .map((id) => this.trackFromSong(byId.get(String(id))))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => this.wrap({ ...item, lrc: '', url: '' }));
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

    return songs.map((value: any) => {
      const id = String(value.id);
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
        lrc: '',
        yrc: '',
        tlyric: '',
        url: '',
        pic,
      });
    });
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

  static readonly FAST_PLAY_LEVELS = ['exhigh', 'higher', 'standard'] as const;

  async resolvePlayUrl(songid: string, cookie = '', level = ''): Promise<string | null> {
    const inflightKey = `${cookie ? 'auth' : 'private'}:${level || 'auto'}:${songid}`;
    const inflight = this.playInflight.get(inflightKey);
    if (inflight) return inflight;
    const pending = this.resolvePlayUrlInner(songid, cookie, level).finally(() => {
      this.playInflight.delete(inflightKey);
    });
    this.playInflight.set(inflightKey, pending);
    return pending;
  }

  private async resolvePlayUrlInner(songid: string, cookie = '', level = ''): Promise<string | null> {
    const cacheKey = cookie
      ? `netease_play_auth_v4_${level || 'auto'}`
      : 'netease_play_v4';
    const cached = this.cache.getTtl(cacheKey, songid);
    if (cached) return cached;

    if (cookie) {
      const authUrl = await this.cookiePlayUrl(songid, cookie, level);
      if (authUrl) {
        this.cache.setTtl(cacheKey, songid, authUrl, 600);
        return authUrl;
      }
    }

    const url = await firstTruthy([
      () => this.metingPlayUrl(songid),
      () => this.bootstrapPlayUrl(songid),
    ]);
    if (url && !isBadMediaUrl(url) && !/\/404/.test(url)) {
      const safeUrl = httpsNeteaseUrl(url);
      this.cache.setTtl('netease_play_v4', songid, safeUrl, 600);
      return safeUrl;
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
    const cached = this.cache.read<{ levels?: Array<{ level: string; label: string; encodeType?: string }>; expires?: number }>(
      'netease_quality_v1',
      String(id),
    );
    if (cached?.levels?.length && Number(cached.expires || 0) > Date.now() / 1000) {
      return cached.levels.map((item) => ({
        level: item.level,
        label: item.label,
      }));
    }

    const detail = await eapiRequest('/api/v3/song/detail', {
      c: JSON.stringify([{ id }]),
      ids: JSON.stringify([id]),
    }, cookie);
    let priv = detail.json?.privileges?.[0] || detail.json?.songs?.[0]?.privilege;
    if (!priv) {
      const weapi = await weapiRequest('/weapi/v3/song/detail', {
        ids: JSON.stringify([id]),
        c: JSON.stringify([{ id }]),
      }, cookie);
      priv = weapi.json?.privileges?.[0] || weapi.json?.songs?.[0]?.privilege;
    }

    const levels = playLevelsFromPrivilege(priv).map((item) => ({
      level: item.level,
      label: item.label,
    }));
    const resolved = levels.length
      ? levels
      : NeteaseService.QUALITY_LEVELS
        .filter((item) => NeteaseService.FAST_PLAY_LEVELS.includes(item.level as typeof NeteaseService.FAST_PLAY_LEVELS[number]))
        .map((item) => ({ level: item.level, label: item.label }));
    this.cache.write('netease_quality_v1', String(id), {
      levels: resolved,
      expires: Math.floor(Date.now() / 1000) + 600,
    });
    return resolved;
  }

  async cookiePlayUrl(songid: string, cookie: string, preferredLevel = ''): Promise<string | null> {
    const id = Number(songid);
    if (!id || !cookie) return null;
    const preferred = NeteaseService.QUALITY_LEVELS.find((item) => item.level === preferredLevel)
      || NeteaseService.QUALITY_LEVELS.find((item) => item.level === 'exhigh')
      || NeteaseService.QUALITY_LEVELS[NeteaseService.QUALITY_LEVELS.length - 1];

    const fromWeapi = async () => {
      const weapi = await weapiRequest(
        '/weapi/song/enhance/player/url/v1',
        { ids: `[${id}]`, level: preferred.level, encodeType: preferred.encodeType },
        cookie,
      );
      const item = weapi.json?.data?.[0];
      const url = item?.url as string | undefined;
      if (url && !this.isTrialPlayItem(item) && !isBadMediaUrl(url) && !/\/404/i.test(url)) {
        return httpsNeteaseUrl(url);
      }
      return null;
    };
    const fromEapi = async (item: { level: string; encodeType: string }) => {
      const hit = await this.fetchPlayUrlForLevel(id, cookie, item.level, item.encodeType);
      return hit?.url || null;
    };

    const url = await firstTruthy([
      fromWeapi,
      () => fromEapi(preferred),
    ]);
    if (url) return url;
    if (preferred.level !== 'exhigh') {
      const exhigh = NeteaseService.QUALITY_LEVELS.find((item) => item.level === 'exhigh');
      if (exhigh) {
        const fallback = await fromEapi(exhigh);
        if (fallback) return fallback;
      }
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
    if (this.isTrialPlayItem(item)) return null;
    if (!url || isBadMediaUrl(url) || /\/404/i.test(url)) return null;
    return {
      url: httpsNeteaseUrl(url),
      br: typeof item?.br === 'number' ? item.br : undefined,
      size: typeof item?.size === 'number' ? item.size : undefined,
    };
  }

  private isTrialPlayItem(item: any): boolean {
    if (!item) return false;
    if (item.freeTrialInfo) return true;
    const time = Number(item.time || 0);
    if (time > 0 && time <= 60_000) return true;
    const privilege = item.freeTrialPrivilege;
    return Boolean(
      privilege
      && (privilege.resConsumable || privilege.userConsumable)
      && time > 0,
    );
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
    return firstTruthy(endpoints.map((endpoint) => async () => {
      const loc = await followLocation(endpoint, 'https://api.injahow.cn/');
      if (loc && !isBadMediaUrl(loc) && /(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
      return null;
    }));
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
