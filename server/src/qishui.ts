import {
  type SearchAlbumHit,
  type SearchArtistHit,
  type SearchCategory,
  type SearchPlaylistHit,
  type SearchResultData,
  type Track,
} from './config.ts';
import { FileCache } from './cache.ts';
import { request } from './http.ts';
import { proxyUrl } from './sign.ts';

const PUBLIC_SEARCH_URL = 'https://api-vehicle.volcengine.com/v2/search/type';
const PUBLIC_CONTENTS_URL = 'https://api-vehicle.volcengine.com/v2/custom/contents';
const PC_TRACK_URL = 'https://api.qishui.com/luna/pc/track_v2';
const PUBLIC_HEADERS = {
  Accept: 'application/json,text/plain,*/*',
  'User-Agent': 'RyanMusic/2.0.9 (Qishui catalog)',
};
const PC_UA = 'LunaPC/3.3.0(359450208)';

interface TrackMeta {
  title: string;
  author: string;
  pic: string;
  album?: string;
  durationMs?: number;
  playUrl?: string;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function firstUrl(...values: unknown[]): string {
  for (const value of values) {
    const raw = text(value);
    if (/^https?:\/\//i.test(raw)) return raw;
  }
  return '';
}

function pickObject(...values: unknown[]): Record<string, any> {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  }
  return {};
}

function pickArray(...values: unknown[]): any[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function comparable(value: string): string {
  return text(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function scoreTrack(track: Track, keywords: string): number {
  const query = comparable(keywords);
  if (!query) return 0;
  const name = comparable(track.title);
  const artist = comparable(track.author);
  const album = comparable(track.album || '');
  let score = 0;
  if (name === query) score += 180;
  else if (name.includes(query)) score += 120;
  else if (name && query.includes(name) && name.length >= 2) score += 70;
  if (artist === query) score += 150;
  else if (artist.includes(query)) score += 105;
  if (album === query) score += 80;
  else if (album.includes(query)) score += 45;
  for (const token of text(keywords).split(/\s+/).map(comparable).filter((item) => item.length >= 2)) {
    if (name.includes(token)) score += 28;
    if (artist.includes(token)) score += 22;
    if (album.includes(token)) score += 10;
  }
  return score;
}

export class QishuiService {
  private readonly metas = new Map<string, TrackMeta>();

  constructor(
    private readonly cache: FileCache,
    private readonly secret: string,
  ) {}

  remember(id: string, meta: TrackMeta) {
    if (!id) return;
    this.metas.set(id, meta);
  }

  meta(id: string): TrackMeta | undefined {
    return this.metas.get(id);
  }

  wrap(track: Track, playUrl = ''): Track {
    this.remember(track.songid, {
      title: track.title,
      author: track.author,
      pic: track.pic,
      album: track.album,
      durationMs: track.durationMs,
      playUrl: playUrl || undefined,
    });
    return {
      ...track,
      type: 'qishui',
      url: proxyUrl(this.secret, 'url', 'qishui', track.songid),
      pic: track.pic || proxyUrl(this.secret, 'pic', 'qishui', track.songid),
    };
  }

  async searchByName(query: string, page: number): Promise<{ tracks: Track[]; hasMore: boolean } | null> {
    const limit = 12;
    const offset = Math.max(0, (Math.max(1, page) - 1) * limit);
    const requestLimit = Math.min(80, offset + limit * 3);
    const url = new URL(PUBLIC_SEARCH_URL);
    url.searchParams.set('keyword', query);
    url.searchParams.set('search_type', 'music');
    url.searchParams.set('limit', String(requestLimit));
    url.searchParams.set('real_offset', '0');
    url.searchParams.set('search_source', 'qishui');
    const res = await request('GET', url.toString(), { headers: PUBLIC_HEADERS, timeoutMs: 8_000 });
    const list = pickArray(res.json?.data?.list);
    const tracks = this.rankTracks(
      list
        .map((item, index) => this.trackFromPublic(item, index, query))
        .filter((item): item is Track => Boolean(item)),
      query,
    );
    const sliced = tracks.slice(offset, offset + limit);
    if (!sliced.length) return null;
    return { tracks: sliced, hasMore: offset + sliced.length < tracks.length };
  }

  async searchByCategory(
    query: string,
    page: number,
    category: SearchCategory,
    cookie = '',
  ): Promise<{ data: SearchResultData; hasMore: boolean; category: SearchCategory } | null> {
    const songs = cookie
      ? (await this.searchPc(query, page, cookie).catch(() => null)) || await this.searchByName(query, category === 'all' ? 1 : page)
      : await this.searchByName(query, category === 'all' ? 1 : page);
    if (!songs?.tracks.length) return null;
    if (category === 'song' || category === 'all') {
      const playlists: SearchPlaylistHit[] = [];
      const albums: SearchAlbumHit[] = [];
      const artists: SearchArtistHit[] = [];
      if (category === 'all') {
        return {
          data: { songs: songs.tracks.slice(0, 8), playlists, albums, artists },
          hasMore: songs.hasMore,
          category: 'all',
        };
      }
      return { data: songs.tracks, hasMore: songs.hasMore, category: 'song' };
    }
    return { data: [], hasMore: false, category };
  }

  async songsByIds(ids: string[]): Promise<Track[]> {
    const tracks: Track[] = [];
    for (const id of ids) {
      const cached = this.meta(id);
      if (cached) {
        tracks.push(this.wrap({
          type: 'qishui',
          songid: id,
          title: cached.title,
          author: cached.author,
          pic: cached.pic,
          album: cached.album,
          durationMs: cached.durationMs,
          lrc: '',
          url: '',
        }, cached.playUrl || ''));
        continue;
      }
      const detail = await this.publicDetail(id).catch(() => null);
      if (detail) tracks.push(detail);
    }
    return tracks;
  }

  async resolvePlayUrl(id: string, cookie = ''): Promise<string | null> {
    const cached = this.meta(id)?.playUrl;
    if (cached) return cached;
    if (!cookie || !/(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|sid_tt)=/i.test(cookie)) return null;
    const now = Date.now();
    const qs = new URLSearchParams({
      aid: '386088',
      app_name: 'luna_pc',
      region: 'cn',
      device_id: String(now),
      version_name: '3.3.0',
      version_code: '30030000',
      channel: 'official',
      device_platform: 'windows',
      fp: String(now),
    });
    const body = JSON.stringify({
      track_id: id,
      media_type: 'track',
      queue_type: 'favorite_track_playlist',
      scene_name: 'library',
    });
    const res = await request('POST', `${PC_TRACK_URL}?${qs}`, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': PC_UA,
        Cookie: cookie,
        Referer: 'https://www.qishui.com/',
      },
      body,
      timeoutMs: 6_000,
    });
    const code = Number(res.json?.status_code ?? res.json?.error_code ?? 0);
    if (code) return null;
    return this.firstStreamUrl(res.json);
  }

  async publicCover(id: string): Promise<string> {
    return this.meta(id)?.pic || (await this.publicDetail(id))?.pic || '';
  }

  private async searchPc(query: string, page: number, cookie: string): Promise<{ tracks: Track[]; hasMore: boolean } | null> {
    const limit = 12;
    const offset = Math.max(0, (Math.max(1, page) - 1) * limit);
    const now = Date.now();
    const qs = new URLSearchParams({
      aid: '386088',
      app_name: 'luna_pc',
      region: 'cn',
      device_id: String(now),
      version_name: '3.3.0',
      version_code: '30030000',
      channel: 'official',
      device_platform: 'windows',
      fp: String(now),
      q: query,
      cursor: String(offset),
      count: String(limit),
      search_method: 'input',
    });
    const res = await request('GET', `https://api.qishui.com/luna/pc/search/track?${qs}`, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': PC_UA,
        Cookie: cookie,
        Referer: 'https://www.qishui.com/',
      },
      timeoutMs: 8_500,
    });
    const code = Number(res.json?.status_code ?? res.json?.error_code ?? 0);
    if (code) return null;
    const tracks = this.rankTracks(
      this.extractMediaList(res.json)
        .map((item, index) => this.trackFromPublic(item, index, query))
        .filter((item): item is Track => Boolean(item)),
      query,
    );
    if (!tracks.length) return null;
    const data = pickObject(res.json?.data, res.json);
    const result = pickObject(data.search_result, data.searchResult, data);
    const hasMore = result.has_more === true || result.has_more === 'true' || tracks.length >= limit;
    return { tracks, hasMore };
  }

  private async publicDetail(id: string): Promise<Track | null> {
    const url = new URL(PUBLIC_CONTENTS_URL);
    url.searchParams.set('sources', 'qishui');
    url.searchParams.set('need_author', 'true');
    url.searchParams.set('need_album', 'true');
    url.searchParams.set('item_ids', id);
    const res = await request('GET', url.toString(), { headers: PUBLIC_HEADERS, timeoutMs: 8_000 });
    const item = pickArray(res.json?.data?.list)[0];
    return this.trackFromPublic(item, 0, '');
  }

  private extractMediaList(payload: any): any[] {
    const data = pickObject(payload?.data, payload);
    const groups = pickArray(
      data.result_groups,
      data.resultGroups,
      data.search_result?.result_groups,
      payload?.result_groups,
    );
    const items: any[] = [];
    for (const group of groups) {
      items.push(...pickArray(group?.data, group?.items, group?.list, group?.result));
    }
    if (items.length) return items;
    return pickArray(data.list, data.items, data.tracks, data.song_list);
  }

  private rankTracks(tracks: Track[], keywords: string): Track[] {
    const query = comparable(keywords);
    if (!query || tracks.length < 2) return tracks;
    const scored = tracks.map((track, index) => ({ track, index, score: scoreTrack(track, keywords) }));
    const matched = scored.filter((item) => item.score > 0);
    const source = matched.length ? matched : scored;
    return source
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.track);
  }

  private trackFromPublic(raw: any, index: number, query: string): Track | null {
    const media = pickObject(raw?.track, raw?.track_info, raw?.trackInfo, raw);
    const author = pickObject(media.author_info, media.author, media.artist, raw?.author_info, raw?.author);
    const album = pickObject(media.album_info, media.album, raw?.album_info, raw?.album);
    const id = text(
      media.item_id || media.id || media.song_id || media.music_id || media.track_id
      || raw?.item_id || raw?.id || raw?.song_id || raw?.music_id || raw?.track_id,
    );
    const title = text(media.title || media.name || media.song_name || media.track_name || raw?.title || raw?.name);
    if (!id || !title) return null;
    const artistName = text(
      author.name || media.author_name || media.artist_name || media.singer
      || raw?.author_name || raw?.artist_name || raw?.singer,
    );
    const pic = firstUrl(media.cover_url, media.cover, media.artwork, raw?.cover_url, raw?.cover, album.cover_url);
    const durationRaw = Number(media.duration || media.duration_ms || raw?.duration || raw?.duration_ms || 0);
    const durationMs = durationRaw > 10_000 ? durationRaw : durationRaw * 1000;
    const playUrl = firstUrl(media.play_url, raw?.play_url);
    return this.wrap({
      type: 'qishui',
      songid: id,
      title,
      author: artistName,
      album: text(album.name || media.album_name || raw?.album_name),
      pic,
      durationMs: durationMs || undefined,
      lrc: '',
      url: '',
      link: query ? `qishui://search/${encodeURIComponent(query)}/${index}` : `qishui://${id}`,
    }, playUrl);
  }

  private firstStreamUrl(payload: any): string | null {
    const data = payload?.data || payload || {};
    const track = pickObject(data.track, data.track_info, data.trackInfo);
    const audio = pickObject(track.audio_info, track.audioInfo, data.audio_info);
    const list = pickArray(audio.play_info_list, audio.PlayInfoList, audio.playInfoList);
    for (const item of list) {
      const url = firstUrl(item?.url, item?.main_url, item?.play_url, item?.PlayUrl);
      const auth = text(item?.auth || item?.url_player_info);
      if (url) return auth && !url.includes('#auth=') ? `${url}#auth=${encodeURIComponent(auth)}` : url;
    }
    return firstUrl(track.url, data.url) || null;
  }
}
