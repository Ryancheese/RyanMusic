import {
  bootstrapBase,
  isServerlessEnv,
  type MatchSearchTrack,
  type SearchAlbumHit,
  type SearchArtistHit,
  type SearchBundle,
  type SearchCategory,
  type SearchPlaylistHit,
  type SearchResultData,
  type Track,
} from './config.ts';
import { FileCache } from './cache.ts';
import { encodeLinuxData, eapiRequest, linuxForward, neteaseApi, neteaseHttp, weapiEncode, weapiRequest } from './crypto/netease.ts';
import { followLocation, request } from './http.ts';
import { proxyUrl } from './sign.ts';
import {
  firstTruthy,
  httpsNeteaseUrl,
  isBadMediaUrl,
  isNeteaseDelisted,
  isNeteaseTrialMediaUrl,
  isNeteaseTrialPlayItem,
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
    const privileges = res.json?.result?.privileges;
    const privById = new Map<string, any>(
      Array.isArray(privileges)
        ? privileges.map((item: any) => [String(item.id), item])
        : [],
    );
    const ids = songs.map((s: any) => String(s.id));
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return null;
    const byId = new Map(songs.map((song: any) => [String(song.id), song]));
    const tracks = sliced.songids
      .map((id) => this.trackFromSong(byId.get(String(id)), privById.get(String(id))))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => this.wrap({ ...item, lrc: '', url: '' }));
    return { tracks, hasMore: sliced.has_more };
  }

  private async cloudSearchRaw(query: string, type: number, page: number, limit = 20) {
    const offset = Math.max(0, (page - 1) * limit);
    const encoded = encodeLinuxData({
      method: 'POST',
      url: 'http://music.163.com/api/cloudsearch/pc',
      params: { s: query, type, offset, limit },
    });
    const res = await neteaseHttp('POST', 'http://music.163.com/api/linux/forward', encoded, '', {
      Referer: 'http://music.163.com/',
    });
    return res.json?.result;
  }

  private mapPlaylists(list: unknown): SearchPlaylistHit[] {
    if (!Array.isArray(list)) return [];
    return list
      .map((item: any) => {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        if (!id || !name) return null;
        const coverRaw = String(item?.coverImgUrl || item?.picUrl || '').trim();
        const cover = coverRaw
          ? httpsNeteaseUrl(coverRaw.includes('?') ? coverRaw : `${coverRaw}?param=300x300`)
          : undefined;
        const trackCount = Number(item?.trackCount || 0) || undefined;
        const creator = String(item?.creator?.nickname || item?.user?.nickname || '').trim() || undefined;
        return { id, name, cover, trackCount, creator, type: 'netease' as const };
      })
      .filter((item): item is SearchPlaylistHit => Boolean(item));
  }

  private mapAlbums(list: unknown): SearchAlbumHit[] {
    if (!Array.isArray(list)) return [];
    return list
      .map((item: any) => {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        if (!id || !name) return null;
        const coverRaw = String(item?.picUrl || item?.blurPicUrl || '').trim();
        const cover = coverRaw
          ? httpsNeteaseUrl(coverRaw.includes('?') ? coverRaw : `${coverRaw}?param=300x300`)
          : undefined;
        const artists: string[] = [];
        if (Array.isArray(item?.artists)) {
          for (const artist of item.artists) {
            if (artist?.name) artists.push(String(artist.name));
          }
        } else if (item?.artist?.name) {
          artists.push(String(item.artist.name));
        }
        const artist = artists.join(', ') || undefined;
        return { id, name, cover, artist, type: 'netease' as const };
      })
      .filter((item): item is SearchAlbumHit => Boolean(item));
  }

  private mapArtists(list: unknown): SearchArtistHit[] {
    if (!Array.isArray(list)) return [];
    return list
      .map((item: any) => {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        if (!id || !name) return null;
        const coverRaw = String(item?.img1v1Url || item?.picUrl || '').trim();
        const cover = coverRaw
          ? httpsNeteaseUrl(coverRaw.includes('?') ? coverRaw : `${coverRaw}?param=300x300`)
          : undefined;
        return { id, name, cover, type: 'netease' as const };
      })
      .filter((item): item is SearchArtistHit => Boolean(item));
  }

  async searchByCategory(
    query: string,
    page: number,
    category: SearchCategory,
  ): Promise<{ data: SearchResultData; hasMore: boolean; category: SearchCategory } | null> {
    if (category === 'song') {
      const result = await this.searchByName(query, page);
      if (!result?.tracks.length) return null;
      return { data: result.tracks, hasMore: result.hasMore, category: 'song' };
    }

    if (category === 'all') {
      const previewLimit = 5;
      const [songResult, playlistRaw, albumRaw, artistRaw] = await Promise.all([
        this.searchByName(query, page),
        this.cloudSearchRaw(query, 1000, 1, previewLimit),
        this.cloudSearchRaw(query, 10, 1, previewLimit),
        this.cloudSearchRaw(query, 100, 1, previewLimit),
      ]);
      const bundle: SearchBundle = {
        songs: songResult?.tracks || [],
        playlists: this.mapPlaylists(playlistRaw?.playlists),
        albums: this.mapAlbums(albumRaw?.albums),
        artists: this.mapArtists(artistRaw?.artists),
      };
      if (!bundle.songs.length && !bundle.playlists.length && !bundle.albums.length && !bundle.artists.length) {
        return null;
      }
      return {
        data: bundle,
        hasMore: Boolean(songResult?.hasMore),
        category: 'all',
      };
    }

    const typeMap: Record<'playlist' | 'album' | 'artist', number> = {
      playlist: 1000,
      album: 10,
      artist: 100,
    };
    const limit = 20;
    const raw = await this.cloudSearchRaw(query, typeMap[category], page, limit);
    if (category === 'playlist') {
      const playlists = this.mapPlaylists(raw?.playlists);
      if (!playlists.length) return null;
      return { data: playlists, hasMore: playlists.length >= limit, category };
    }
    if (category === 'album') {
      const albums = this.mapAlbums(raw?.albums);
      if (!albums.length) return null;
      return { data: albums, hasMore: albums.length >= limit, category };
    }
    const artists = this.mapArtists(raw?.artists);
    if (!artists.length) return null;
    return { data: artists, hasMore: artists.length >= limit, category };
  }

  async searchByNameForMatch(query: string, page: number): Promise<MatchSearchTrack[]> {
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
    if (!Array.isArray(songs) || !songs.length) return [];
    const privileges = res.json?.result?.privileges;
    const privById = new Map<string, any>(
      Array.isArray(privileges)
        ? privileges.map((item: any) => [String(item.id), item])
        : [],
    );
    const ids = songs.map((s: any) => String(s.id));
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return [];
    const byId = new Map(songs.map((song: any) => [String(song.id), song]));
    return sliced.songids
      .map((id) => {
        const song = byId.get(String(id));
        const track = this.trackFromSong(song, privById.get(String(id)));
        if (!track) return null;
        const picRaw = song?.al?.picUrl || song?.album?.picUrl || track.pic || '';
        const pic = picRaw
          ? httpsNeteaseUrl(picRaw.includes('?') ? picRaw : `${picRaw}?param=300x300`)
          : '';
        return {
          songid: track.songid,
          title: track.title,
          author: track.author,
          album: track.album || '',
          durationMs: track.durationMs || 0,
          pic,
        } satisfies MatchSearchTrack;
      })
      .filter((item): item is MatchSearchTrack => Boolean(item));
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
    const privileges = res.json?.privileges;
    const privById = new Map<string, any>(
      Array.isArray(privileges)
        ? privileges.map((item: any) => [String(item.id), item])
        : [],
    );

    return songs.map((value: any) => {
      const id = String(value.id);
      const authors = Array.isArray(value.artists)
        ? value.artists.map((a: any) => a.name).filter(Boolean)
        : [];
      const pic = value.album?.picUrl ? `${value.album.picUrl}?param=300x300` : '';
      const delisted = isNeteaseDelisted(value, privById.get(id));
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
        ...(delisted ? { delisted: true } : {}),
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

  async resolvePlayUrl(songid: string, cookie = '', level = '', skipCache = false): Promise<string | null> {
    const inflightKey = `${cookie ? 'auth' : 'private'}:${level || 'auto'}:${skipCache ? 'fresh' : 'cache'}:${songid}`;
    const inflight = this.playInflight.get(inflightKey);
    if (inflight) return inflight;
    const pending = this.resolvePlayUrlInner(songid, cookie, level, skipCache).finally(() => {
      this.playInflight.delete(inflightKey);
    });
    this.playInflight.set(inflightKey, pending);
    return pending;
  }

  forgetCachedPlay(songid: string) {
    this.cache.setTtl('netease_play_v6', songid, '', -1);
  }

  private async resolvePlayUrlInner(songid: string, cookie = '', level = '', skipCache = false): Promise<string | null> {
    const cacheKey = cookie
      ? `netease_play_auth_v6_${level || 'auto'}`
      : 'netease_play_v6';
    if (!skipCache) {
      const cached = this.cache.getTtl(cacheKey, songid);
      if (cached && !isNeteaseTrialMediaUrl(cached)) return cached;
    }

    if (cookie) {
      const authUrl = await this.cookiePlayUrl(songid, cookie, level);
      if (authUrl && !isNeteaseTrialMediaUrl(authUrl)) {
        this.cache.setTtl(cacheKey, songid, authUrl, 600);
        return authUrl;
      }
    }

    // 非会员一刀切：只走 RyanMusic 私链，官方/Meting 会给 30 秒试听。
    if (isServerlessEnv()) {
      const direct = await this.anonymousPlayUrl(songid);
      if (direct) {
        this.cache.setTtl('netease_play_v6', songid, direct, 600);
        return direct;
      }
    }

    const url = await this.bootstrapPlayUrl(songid);
    if (url && !isBadMediaUrl(url) && !isNeteaseTrialMediaUrl(url) && !/\/404/i.test(url)) {
      const safeUrl = httpsNeteaseUrl(url);
      this.cache.setTtl('netease_play_v6', songid, safeUrl, 1800);
      return safeUrl;
    }

    if (!isServerlessEnv()) {
      const direct = await this.anonymousPlayUrl(songid);
      if (direct) {
        this.cache.setTtl('netease_play_v6', songid, direct, 600);
        return direct;
      }
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
      if (url && !isNeteaseTrialPlayItem(item) && !isBadMediaUrl(url) && !/\/404/i.test(url)) {
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
    if (isNeteaseTrialPlayItem(item)) return null;
    if (!url || isBadMediaUrl(url) || /\/404/i.test(url)) return null;
    return {
      url: httpsNeteaseUrl(url),
      br: typeof item?.br === 'number' ? item.br : undefined,
      size: typeof item?.size === 'number' ? item.size : undefined,
    };
  }

  private async bootstrapPlayUrl(songid: string): Promise<string | null> {
    const base = bootstrapBase();
    if (!base) return null;
    const timeoutMs = isServerlessEnv() ? 10_000 : 2_500;
    const res = await request('POST', `${base}/`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/`,
      },
      body: { input: songid, filter: 'id', type: 'netease', page: 1 },
      timeoutMs,
    });
    const apiPath = res.json?.data?.[0]?.url as string | undefined;
    if (!apiPath) return null;
    const api = `${base}/${apiPath.replace(/^\//, '')}`;
    const loc = await followLocation(api, `${base}/`, timeoutMs);
    if (!loc || isBadMediaUrl(loc) || isNeteaseTrialMediaUrl(loc)) return null;
    if (/(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
    const hop = await followLocation(loc, `${base}/`, Math.min(timeoutMs, 4_000));
    return hop && !isNeteaseTrialMediaUrl(hop) ? hop : loc;
  }

  /** Vercel 等 serverless 环境 bootstrap 不稳定时的直连回退 */
  private playApiTimeout(): number {
    return isServerlessEnv() ? 12_000 : 4_000;
  }

  private pickAnonymousPlayItem(item: any): string | null {
    const url = item?.url as string | undefined;
    if (!url || isNeteaseTrialPlayItem(item) || isBadMediaUrl(url) || isNeteaseTrialMediaUrl(url) || /\/404/i.test(url)) {
      return null;
    }
    return httpsNeteaseUrl(url);
  }

  private async anonymousPlayUrl(songid: string): Promise<string | null> {
    const id = Number(songid);
    if (!id) return null;
    const timeoutMs = this.playApiTimeout();
    const levels = ['exhigh', 'higher', 'standard'] as const;
    const paramsFor = (level: string) => ({
      ids: `[${id}]`,
      level,
      encodeType: 'aac',
      csrf_token: '',
    });

    for (const level of levels) {
      try {
        const res = await linuxForward('/api/song/enhance/player/url/v1', paramsFor(level), '', 'POST');
        const hit = this.pickAnonymousPlayItem(res.json?.data?.[0]);
        if (hit) return hit;
      } catch {
        // try next level
      }
    }

    for (const level of levels) {
      try {
        const encoded = weapiEncode(paramsFor(level));
        const res = await neteaseHttp(
          'POST',
          'https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token=',
          encoded,
          '',
          {},
          timeoutMs,
        );
        const hit = this.pickAnonymousPlayItem(res.json?.data?.[0]);
        if (hit) return hit;
      } catch {
        // try next level
      }
    }

    for (const level of levels) {
      try {
        const res = await eapiRequest('/api/song/enhance/player/url/v1', {
          ids: [id],
          level,
          encodeType: 'aac',
        }, '');
        const hit = this.pickAnonymousPlayItem(res.json?.data?.[0]);
        if (hit) return hit;
      } catch {
        // try next level
      }
    }

    for (const level of levels) {
      try {
        const res = await neteaseApi('/api/song/enhance/player/url/v1', paramsFor(level), '', 'POST');
        const hit = this.pickAnonymousPlayItem(res.json?.data?.[0]);
        if (hit) return hit;
      } catch {
        // try next level
      }
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

  trackFromSong(song: any, privilege?: any): Omit<Track, 'lrc' | 'url'> | null {
    const id = song?.id;
    if (!id) return null;
    const artists: string[] = [];
    if (Array.isArray(song.ar)) {
      for (const a of song.ar) if (a?.name) artists.push(a.name);
    } else if (Array.isArray(song.artists)) {
      for (const a of song.artists) if (a?.name) artists.push(a.name);
    }
    const pic = song.al?.picUrl || song.album?.picUrl || '';
    const delisted = isNeteaseDelisted(song, privilege);
    const album = String(song.al?.name || song.album?.name || '');
    const durationMs = Number(song.dt || song.duration || 0) || 0;
    return {
      type: 'netease',
      songid: String(id),
      title: String(song.name || '未知曲目'),
      author: artists.join(', ') || '未知艺人',
      link: `https://music.163.com/#/song?id=${id}`,
      pic,
      album,
      durationMs,
      ...(delisted ? { delisted: true } : {}),
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
        const t = this.trackFromSong(song, res.json?.privileges?.find((p: any) => String(p.id) === String(song.id)));
        if (t) out.push(this.wrap({ ...t, lrc: '', url: '' }));
      }
    }
    return out;
  }
}
