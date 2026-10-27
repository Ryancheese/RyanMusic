import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { FileCache } from '../../cache.ts';
import { readJson, removeFile, writeJson } from '../session.ts';
import { describeError, lineReason, spotifyError, statusError, toErrorResult } from './errors.ts';
import { createSpotifySignIn, type SpotifyTokens } from './signIn.ts';

const execFileAsync = promisify(execFile);

const QUERY_URL = 'https://api-partner.spotify.com/pathfinder/v2/query';
const SPCLIENT_URL = 'https://spclient.wg.spotify.com';
const RENEW_AHEAD_MS = 60 * 1000;
const REQUEST_LIMIT_MS = 30 * 1000;
const ACCOUNT_MAX_AGE_MS = 10 * 60 * 1000;
const ACCOUNT_RETRY_MS = 60 * 1000;
const PAGE_LANGUAGES: Record<string, string> = { 'zh-CN': 'zh-CN', en: 'en' };

const QUERIES = Object.freeze({
  profileAttributes: '53bcb064f6cd18c23f752bc324a791194d20df612d8e1239c735144ab0399ced',
  libraryV3: '390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455',
  fetchLibraryTracks: '087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240',
  fetchPlaylist: 'cd2275433b29f7316176e7b5b5e098ae7744724e1a52d63549c76636b3257749',
  searchTracks: 'bc1ca2fcd0ba1013a0fc88e6cc4f190af501851e3dafd3e1ef85840297694428',
  getTrack: '612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294',
});

export const SPOTIFY_LIKED_ID = 'liked';
const TRACK_ID = /^[0-9A-Za-z]{22}$/;
const PLAYLIST_ID = /^[0-9A-Za-z]{22}$/;

interface SpotifyUser {
  id: string;
  nickname: string;
  avatarUrl: string;
  premium: boolean;
}

interface SpotifySession {
  version: 1;
  credentials: SpotifyTokens;
  user: SpotifyUser;
}

function publicAccountId(username: string) {
  return createHash('sha256').update(`ryanmusic-spotify:${username}`).digest('hex').slice(0, 24);
}

function isCredentials(value: any): value is SpotifyTokens {
  return Boolean(
    value
    && typeof value.access_token === 'string'
    && value.access_token
    && typeof value.refresh_token === 'string'
    && value.refresh_token
    && Number.isFinite(value.expires_at),
  );
}

function isUser(value: any): value is SpotifyUser {
  return Boolean(value && typeof value.id === 'string' && value.id && typeof value.nickname === 'string');
}

function pictureOf(sources: Array<{ url?: string; width?: number | null }> | undefined) {
  return (sources ?? []).reduce<{ url?: string; width?: number | null } | null>((best, source) => (
    source?.url && (!best || (source.width ?? 0) > (best.width ?? 0)) ? source : best
  ), null)?.url ?? '';
}

function spotifyId(uri: unknown, kind: 'track' | 'playlist' | 'album' | 'artist') {
  if (typeof uri !== 'string') return '';
  return new RegExp(`^spotify:(?:user:[^:]+:)?${kind}:([0-9A-Za-z]{22})$`).exec(uri)?.[1] ?? '';
}

async function openExternal(url: string) {
  await execFileAsync('open', [url]);
}

/** Folia Spotify 桥：登录 + Pathfinder 读库；暂不接 librespot 播放。 */
export class SpotifyBridge {
  private readonly sessionFile: string;
  private current: SpotifySession | null = null;
  private loaded = false;
  private renewing: { token: string; answer: Promise<string> } | null = null;
  private adopting = false;
  private approved: { key: string; since: number } | null = null;
  private accountReadAt = 0;
  private accountRead: Promise<void> | null = null;
  private planKnown = false;
  private readonly signIn = createSpotifySignIn({
    openExternal,
    language: () => 'zh-CN',
    log: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
  });

  constructor(cache: FileCache) {
    const dir = cache.dir('spotify_auth');
    this.sessionFile = join(dir, 'session.json');
  }

  loggedIn() {
    return Boolean(this.getSession()?.credentials.access_token);
  }

  user() {
    const session = this.getSession();
    if (!session?.user) return null;
    return {
      id: session.user.id,
      nickname: session.user.nickname,
      avatar: session.user.avatarUrl || '',
      vip: session.user.premium ? 1 : 0,
    };
  }

  async request<T = unknown>(operation: string, params: Record<string, any> = {}) {
    try {
      switch (operation) {
        case 'login_start':
          return { ok: true as const, data: await this.signIn.start() as T };
        case 'login_open':
          return { ok: true as const, data: await this.signIn.open(String(params.key || '')) as T };
        case 'login_check':
          return { ok: true as const, data: await this.loginCheck(String(params.key || '')) as T };
        case 'login_cancel':
          if (this.signIn.holds(String(params.key || ''))) this.signIn.cancel();
          return { ok: true as const, data: true as T };
        case 'login_status':
          return { ok: true as const, data: await this.loginStatus() as T };
        case 'logout':
          this.signIn.cancel();
          this.clearSession();
          return { ok: true as const, data: true as T };
        case 'user_playlists':
          return { ok: true as const, data: await this.userPlaylists(Number(params.limit || 50), Number(params.offset || 0)) as T };
        case 'playlist_tracks':
          return { ok: true as const, data: await this.playlistTracks(String(params.id || ''), Number(params.offset || 0), Number(params.limit || 80)) as T };
        case 'liked_tracks':
          return { ok: true as const, data: await this.likedTracks(Number(params.offset || 0), Number(params.limit || 80)) as T };
        case 'search':
          return { ok: true as const, data: await this.searchTracks(String(params.q || ''), Number(params.limit || 30), Number(params.offset || 0)) as T };
        case 'track':
          return { ok: true as const, data: await this.trackDetail(String(params.id || '')) as T };
        default:
          return { ok: false as const, error: { code: 'unsupported', message: 'Unsupported Spotify operation' } };
      }
    } catch (error) {
      console.warn(`[Spotify] ${operation} failed: ${describeError(error)}`);
      return toErrorResult(error);
    }
  }

  private getSession(): SpotifySession | null {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const value = readJson<SpotifySession>(this.sessionFile);
        if (value?.version === 1 && isCredentials(value.credentials) && isUser(value.user)) {
          this.current = value;
        }
      } catch {
        this.current = null;
      }
    }
    return this.current;
  }

  private setSession(session: SpotifySession) {
    this.loaded = true;
    this.current = session;
    writeJson(this.sessionFile, session);
  }

  private updateSession(patch: { credentials?: SpotifyTokens; user?: SpotifyUser }) {
    const current = this.getSession();
    if (!current) return;
    if (patch.credentials && !isCredentials(patch.credentials)) return;
    if (patch.user && !isUser(patch.user)) return;
    this.current = {
      ...current,
      ...(patch.credentials ? { credentials: { ...patch.credentials } } : {}),
      ...(patch.user ? { user: { ...patch.user } } : {}),
    };
    writeJson(this.sessionFile, this.current);
  }

  private clearSession() {
    this.loaded = true;
    this.current = null;
    this.accountReadAt = 0;
    this.planKnown = false;
    removeFile(this.sessionFile);
  }

  private renew(session: SpotifySession) {
    const token = session.credentials.refresh_token;
    if (this.renewing?.token === token) return this.renewing.answer;
    const answer = this.signIn.renew(token).then((credentials) => {
      if (this.getSession()?.credentials.refresh_token === token) {
        this.updateSession({ credentials });
        console.info(`[Spotify] Token renewed, good for ${Math.round((credentials.expires_at - Date.now()) / 1000)} s`);
      }
      return credentials.access_token;
    }, (error) => {
      if (error instanceof Error && (error as any).code === 'auth-required' && this.getSession()?.credentials.refresh_token === token) {
        this.clearSession();
        console.warn('[Spotify] Spotify no longer accepts the stored sign-in; it was removed');
      }
      throw error;
    }).finally(() => {
      if (this.renewing?.answer === answer) this.renewing = null;
    });
    this.renewing = { token, answer };
    return answer;
  }

  private async accessToken(fresh = false) {
    const session = this.getSession();
    if (!session) throw spotifyError('auth-required', 'Spotify sign-in is required');
    if (!fresh && session.credentials.expires_at - Date.now() > RENEW_AHEAD_MS) {
      return session.credentials.access_token;
    }
    return this.renew(session);
  }

  private async call(url: string, init: RequestInit & { token?: string; absent?: unknown } = {}) {
    const { token, absent, ...rest } = init;
    const send = async (bearer: string) => fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
      headers: {
        Accept: 'application/json',
        'Accept-Language': PAGE_LANGUAGES['zh-CN'],
        ...(rest.headers || {}),
        Authorization: `Bearer ${bearer}`,
      },
    });
    let response = await send(token ?? await this.accessToken());
    if (response.status === 401 && !token) response = await send(await this.accessToken(true));
    if (response.status === 404 && absent !== undefined) return absent;
    if (!response.ok) throw statusError(response.status, 'unavailable', 'Spotify refused the request', `HTTP ${response.status}`);
    return response.json();
  }

  private async ask(name: keyof typeof QUERIES, variables: Record<string, unknown>, token?: string) {
    const answer = await this.call(QUERY_URL, {
      token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variables,
        operationName: name,
        extensions: { persistedQuery: { version: 1, sha256Hash: QUERIES[name] } },
      }),
    }) as any;
    const said = Array.isArray(answer?.errors)
      ? answer.errors.map((error: any) => error?.message).filter(Boolean).join(' | ').slice(0, 160)
      : '';
    return { data: answer?.data, said, refused: Array.isArray(answer?.errors) && answer.errors.length > 0 };
  }

  private async query(name: keyof typeof QUERIES, variables: Record<string, unknown>, token?: string) {
    const { data, said } = await this.ask(name, variables, token);
    if (!data) throw spotifyError('invalid-response', 'Spotify did not answer the query', `${name}: ${said || 'no data'}`);
    if (said) console.warn(`[Spotify] ${name} was answered in part: ${said}`);
    return data;
  }

  private async readAccount(token?: string): Promise<SpotifyUser & { premium?: boolean }> {
    const [profile, state] = await Promise.all([
      this.query('profileAttributes', {}, token),
      this.call(`${SPCLIENT_URL}/melody/v1/product_state?market=from_token`, { token }).catch((error) => {
        console.warn(`[Spotify] The account's plan could not be read: ${describeError(error)}`);
        return null;
      }),
    ]);
    const me = (profile as any)?.me?.profile;
    if (typeof me?.username !== 'string' || !me.username) {
      throw spotifyError('invalid-response', 'Spotify did not name the account');
    }
    const pictures = Array.isArray(me.avatar?.sources) ? me.avatar.sources : [];
    const largest = pictures.reduce((best: any, picture: any) => ((picture?.width ?? 0) > (best?.width ?? -1) ? picture : best), null);
    return {
      id: publicAccountId(me.username),
      nickname: String(me.name || 'Spotify'),
      avatarUrl: typeof largest?.url === 'string' ? largest.url : '',
      premium: state ? (state as any).catalogue === 'premium' || (state as any).product === 'premium' : undefined as any,
    };
  }

  private refreshAccount(maxAgeMs = ACCOUNT_MAX_AGE_MS) {
    const session = this.getSession();
    if (!session) return Promise.resolve();
    if (this.accountRead) return this.accountRead;
    if (Date.now() - this.accountReadAt < maxAgeMs) return Promise.resolve();
    this.accountReadAt = Date.now();
    const reading = this.readAccount().then((read) => {
      if (this.getSession()?.credentials.refresh_token !== session.credentials.refresh_token) return;
      this.planKnown = read.premium !== undefined;
      const user = {
        id: read.id,
        nickname: read.nickname,
        avatarUrl: read.avatarUrl,
        premium: read.premium ?? session.user.premium,
      };
      this.updateSession({ user });
    }, (error) => {
      this.planKnown = false;
      console.warn(`[Spotify] The account could not be read again: ${describeError(error)}`);
    }).finally(() => {
      if (this.accountRead === reading) this.accountRead = null;
    });
    this.accountRead = reading;
    return reading;
  }

  private async loginCheck(key: string) {
    const state = this.signIn.check(key);
    if (state.state !== 'approved') return state;
    if (this.adopting) return { state: 'waiting' as const };
    this.adopting = true;
    if (this.approved?.key !== key) this.approved = { key, since: Date.now() };
    try {
      const tokens = state.tokens!;
      const read = await this.readAccount(tokens.access_token);
      if (!this.signIn.holds(key)) return { state: 'expired' as const };
      this.setSession({
        version: 1,
        credentials: tokens,
        user: {
          id: read.id,
          nickname: read.nickname,
          avatarUrl: read.avatarUrl,
          premium: read.premium === true,
        },
      });
      this.accountReadAt = read.premium === undefined ? 0 : Date.now();
      this.planKnown = read.premium !== undefined;
      this.signIn.finish(key);
      console.info(`[Spotify] Signed in (Premium: ${read.premium === undefined ? 'not known yet' : read.premium ? 'yes' : 'no'})`);
      return { state: 'confirmed' as const };
    } catch (error) {
      console.warn(`[Spotify] The account could not be read after Spotify approved the sign-in: ${describeError(error)}`);
      const onTheLine = lineReason(error);
      if (onTheLine && this.signIn.holds(key) && Date.now() - (this.approved?.since || 0) < ACCOUNT_RETRY_MS) {
        return { state: 'waiting' as const };
      }
      this.signIn.finish(key);
      const told = toErrorResult(error).error;
      throw spotifyError(told.code, told.message, (error as any)?.detail ?? (error as any)?.message, onTheLine ?? 'account-not-read');
    } finally {
      this.adopting = false;
    }
  }

  private async loginStatus() {
    const user = this.getSession()?.user;
    if (!user) return null;
    void this.refreshAccount();
    return { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, vipType: user.premium ? 1 : 0 };
  }

  private mapTrack(track: any, besideUri?: string) {
    const id = spotifyId(track?.uri ?? besideUri, 'track');
    if (!track || !id || !track.name || (track.__typename && track.__typename !== 'Track')) return null;
    const artists = Array.isArray(track.artists?.items) ? track.artists.items : [];
    const author = artists.map((item: any) => String(item?.profile?.name || '').trim()).filter(Boolean).join(' / ') || 'Spotify';
    return {
      type: 'spotify' as const,
      songid: id,
      title: String(track.name),
      author,
      pic: pictureOf(track.albumOfTrack?.coverArt?.sources),
      album: String(track.albumOfTrack?.name || ''),
      durationMs: Math.max(0, Number(track.duration?.totalMilliseconds ?? track.trackDuration?.totalMilliseconds) || 0) || undefined,
    };
  }

  private mapPlaylist(playlist: any, index: number) {
    const id = spotifyId(playlist?.uri, 'playlist');
    if (!playlist || !id || (playlist.__typename && playlist.__typename !== 'Playlist')) return null;
    return {
      id,
      name: String(playlist.name || 'Spotify'),
      cover: pictureOf(playlist.images?.items?.[0]?.sources),
      trackCount: Number(playlist.content?.totalCount || 0) || 0,
      order: index,
      description: String(playlist.description || '').replace(/<[^>]+>/g, ''),
    };
  }

  private async likedHead() {
    return this.query('fetchLibraryTracks', { offset: 0, limit: 1 });
  }

  private async userPlaylists(limit = 50, offset = 0) {
    if (!this.getSession()) throw spotifyError('auth-required', 'Spotify sign-in is required');
    const pageSize = Math.min(50, Math.max(1, limit));
    const start = Math.max(0, offset);
    const [page, liked] = await Promise.all([
      this.query('libraryV3', {
        filters: ['Playlists'],
        order: null,
        textFilter: '',
        features: [],
        limit: pageSize,
        offset: start,
        flatten: true,
        expandedFolders: [],
        folderUri: null,
        includeFoldersWhenFlattening: true,
      }),
      start === 0 ? this.likedHead().catch(() => null) : null,
    ]);
    const rows = (page as any)?.me?.libraryV3?.items || [];
    const playlists = rows
      .map((row: any, index: number) => this.mapPlaylist(row?.item?.data, start + index + (liked ? 1 : 0)))
      .filter(Boolean);
    if (liked) {
      const tracks = (liked as any)?.me?.library?.tracks;
      const latest = tracks?.items?.[0]?.track;
      playlists.unshift({
        id: SPOTIFY_LIKED_ID,
        name: '已点赞的歌曲',
        cover: this.mapTrack(latest?.data, latest?._uri)?.pic || '',
        trackCount: Number(tracks?.totalCount || 0) || 0,
        order: 0,
        description: '',
      });
    }
    return {
      items: playlists,
      total: Number((page as any)?.me?.libraryV3?.totalCount || playlists.length) + (liked ? 1 : 0),
    };
  }

  private async likedTracks(offset = 0, limit = 80) {
    if (!this.getSession()) throw spotifyError('auth-required', 'Spotify sign-in is required');
    const pageSize = Math.min(100, Math.max(1, limit));
    const start = Math.max(0, offset);
    const data = await this.query('fetchLibraryTracks', { offset: start, limit: pageSize });
    const tracks = (data as any)?.me?.library?.tracks;
    const items = Array.isArray(tracks?.items) ? tracks.items : [];
    const mapped = items.map((row: any) => this.mapTrack(row?.track?.data, row?.track?._uri)).filter(Boolean);
    const total = Number(tracks?.totalCount || mapped.length) || mapped.length;
    return {
      id: SPOTIFY_LIKED_ID,
      name: '已点赞的歌曲',
      cover: mapped[0]?.pic || '',
      total,
      tracks: mapped,
      hasMore: start + items.length < total,
      nextOffset: start + items.length,
    };
  }

  private async playlistTracks(id: string, offset = 0, limit = 80) {
    if (!this.getSession()) throw spotifyError('auth-required', 'Spotify sign-in is required');
    const playlistId = String(id || '').trim();
    if (playlistId === SPOTIFY_LIKED_ID) return this.likedTracks(offset, limit);
    if (!PLAYLIST_ID.test(playlistId)) throw spotifyError('invalid-response', 'Invalid Spotify playlist');
    const pageSize = Math.min(100, Math.max(1, limit));
    const start = Math.max(0, offset);
    const data = await this.query('fetchPlaylist', {
      uri: `spotify:playlist:${playlistId}`,
      offset: start,
      limit: pageSize,
      enableWatchFeedEntrypoint: false,
    });
    const list = (data as any)?.playlistV2;
    if (!list) throw spotifyError('invalid-response', 'Spotify did not give the playlist');
    const items = Array.isArray(list.content?.items) ? list.content.items : [];
    const tracks = items.map((item: any) => this.mapTrack(item?.itemV2?.data)).filter(Boolean);
    const total = Number(list.content?.totalCount || tracks.length) || tracks.length;
    return {
      id: playlistId,
      name: String(list.name || 'Spotify'),
      cover: pictureOf(list.images?.items?.[0]?.sources),
      total,
      tracks,
      hasMore: start + items.length < total,
      nextOffset: start + items.length,
    };
  }

  private async searchTracks(q: string, limit = 30, offset = 0) {
    if (!this.getSession()) throw spotifyError('auth-required', 'Spotify sign-in is required');
    const text = String(q || '').trim();
    if (!text) return { tracks: [], total: 0 };
    const data = await this.query('searchTracks', {
      searchTerm: text,
      offset: Math.max(0, offset),
      limit: Math.min(50, Math.max(1, limit)),
      includePreReleases: false,
      numberOfTopResults: 20,
      includeAudiobooks: true,
      includeAuthors: false,
    });
    const rows = (data as any)?.searchV2?.tracksV2?.items || [];
    const tracks = rows.map((row: any) => this.mapTrack(row?.item?.data)).filter(Boolean);
    return { tracks, total: tracks.length };
  }

  private async trackDetail(id: string) {
    if (!TRACK_ID.test(id)) throw spotifyError('invalid-response', 'Invalid Spotify track');
    const data = await this.query('getTrack', { uri: `spotify:track:${id}` });
    const track = (data as any)?.trackUnion;
    if (!track) throw spotifyError('invalid-response', 'Spotify track missing');
    const artists = [
      ...((track.firstArtist?.items || []) as any[]),
      ...((track.otherArtists?.items || []) as any[]),
    ];
    return this.mapTrack({ ...track, artists: { items: artists } });
  }
}
