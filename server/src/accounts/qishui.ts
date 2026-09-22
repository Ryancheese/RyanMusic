import { hostname } from 'node:os';
import { join } from 'node:path';
import { FileCache } from '../cache.ts';
import { request } from '../http.ts';
import { cookieGet, mergeCookies, normalizeCookie, readJson, removeFile, writeJson } from './session.ts';

const PASSPORT_BASE = 'https://api.qishui.com';
const QR_PARAMS = {
  aid: '386088',
  need_logo: 'false',
  need_short_url: 'false',
  passport_jssdk_version: '2.8.8',
  passport_jssdk_type: 'normal',
  is_from_ttaccountsdk: '1',
  language: 'zh',
  account_sdk_source: 'web',
  is_new_login: '1',
  next: PASSPORT_BASE,
};
const QR_HEADERS = {
  Accept: 'application/json, text/javascript',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SodaMusic/3.2.1 Chrome/136.0.7103.59 Electron/36.4.0-rs.22.release.main.1 Safari/537.36',
  Origin: 'https://www.qishui.com',
  Referer: 'https://www.qishui.com/',
};

interface QishuiAuth {
  cookie: string;
  nickname?: string;
  avatar?: string;
  vip?: number;
  updatedAt?: number;
}

interface PendingQr {
  cookies: string;
  msToken: string;
  scanToken: string;
  lastStatus: string;
  createdAt: number;
}

const PENDING_TTL_MS = 15 * 60_000;
const TRUSTED_LOGIN_HOSTS = [
  'qishui.com',
  'zijieapi.com',
  'bytedance.com',
  'snssdk.com',
  'amemv.com',
  'douyin.com',
];

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}

function hasLoginCookie(cookie: string) {
  return /(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|sid_tt)=[^;\s]+/i.test(cookie);
}

function query(extra: Record<string, string> = {}) {
  return new URLSearchParams({ ...QR_PARAMS, ...extra }).toString();
}

function officialScanUrl(indexUrl: string, computerName: string): string {
  const source = new URL(indexUrl);
  const token = source.searchParams.get('token');
  if (!token) throw new Error('qrcode_index_url 缺少 token');
  const target = new URL('https://bff-pc.qishui.com/light/invoke/scan_login');
  target.searchParams.set('token', token);
  target.searchParams.set('os', 'Windows');
  target.searchParams.set('computer_name', computerName || 'Windows-PC');
  return target.toString().replace(/\+/g, '%20');
}

function trustedLoginUrl(raw: string): string {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    if (TRUSTED_LOGIN_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return url.toString();
    }
  } catch {
    // ignore
  }
  return '';
}

function isTransientBusy(description: string, message: string, errorCode: number) {
  const text = `${description} ${message}`;
  if (/系统繁忙|请稍后|稍后重试|too many|busy/i.test(text)) return true;
  return errorCode === 5 || errorCode === 7;
}

function coverUrl(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const raw = value.trim();
    if (/^https?:\/\//i.test(raw) && !/\/img\/?$/i.test(raw)) return raw;
    return '';
  }
  if (typeof value !== 'object') return '';
  const node = value as Record<string, any>;
  const uri = String(node.uri || node.url_key || '').trim();
  const urls = Array.isArray(node.urls) ? node.urls : [];
  const prefix = String(urls[0] || node.url || '').trim();
  if (prefix && uri) {
    const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const joined = prefix.includes(uri) ? prefix : `${base}${uri.replace(/^\//, '')}`;
    return joined.includes('~') ? joined : `${joined}~tplv-b829550vbb-1:1.jpeg`;
  }
  if (/^https?:\/\//i.test(uri)) return uri;
  return '';
}

export class QishuiAccount {
  private readonly authFile: string;
  private readonly pendingFile: string;
  private readonly pending = new Map<string, PendingQr>();
  private authEpoch = 0;

  constructor(private readonly cache: FileCache) {
    this.authFile = join(cache.dir('qishui_auth'), 'session.json');
    this.pendingFile = join(cache.dir('qishui_auth'), 'qr-pending.json');
    this.loadPending();
  }

  sessionCookie(): string | null {
    const auth = this.read();
    return auth?.cookie && hasLoginCookie(auth.cookie) ? auth.cookie : null;
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'qishui_status':
        return ok(this.status());
      case 'qishui_logout':
        this.authEpoch += 1;
        this.pending.clear();
        removeFile(this.authFile);
        removeFile(this.pendingFile);
        return ok({ ok: true });
      case 'qishui_cookie_save':
        return this.cookieSave(post.cookie || '');
      case 'qishui_qr_key':
        return this.qrKey();
      case 'qishui_qr_check':
        return this.qrCheck(post.key || '');
      case 'qishui_playlists':
        return this.playlists();
      case 'qishui_playlist_detail':
        return this.playlistDetail(post.id || '', Number(post.offset || 0), Number(post.limit || 80));
      case 'qishui_recommend_feed':
        return this.recommendFeed();
      case 'qishui_recent_songs':
        return this.recentSongs();
      default:
        return fail(400, '未知操作');
    }
  }

  private read(): QishuiAuth | null {
    return readJson<QishuiAuth>(this.authFile);
  }

  private status() {
    const auth = this.read();
    if (!auth?.cookie || !hasLoginCookie(auth.cookie)) return { loggedIn: false };
    return {
      loggedIn: true,
      nickname: auth.nickname || '汽水音乐',
      avatar: auth.avatar || '',
      vip: auth.vip || 0,
    };
  }

  private async cookieSave(raw: string) {
    const cookie = normalizeCookie(raw);
    if (!hasLoginCookie(cookie)) {
      return fail(400, 'Cookie 里没有汽水登录态，请从汽水电脑版复制完整 Cookie');
    }
    const profile = await this.profile(cookie);
    await this.persist(cookie, profile.nickname, profile.avatar, true);
    return ok(this.status());
  }

  private async persist(cookie: string, nickname = '汽水音乐', avatar = '', force = false) {
    if (!force && !this.read()) return;
    writeJson(this.authFile, {
      cookie,
      nickname,
      avatar,
      vip: 0,
      updatedAt: Date.now(),
    } satisfies QishuiAuth);
  }

  private async profile(cookie: string) {
    let nickname = '汽水音乐';
    let avatar = '';
    try {
      const res = await this.pcGet(cookie, '/luna/pc/me');
      const info = res.json?.my_info || res.json?.data?.my_info || res.json?.data?.user || {};
      nickname = String(info.nickname || info.name || nickname);
      avatar = coverUrl(info.larger_avatar_url || info.medium_avatar_url || info.avatar_url || info.avatar);
    } catch {
      // cookie 本身有效即可登录
    }
    return { nickname, avatar };
  }

  private requireCookie() {
    const cookie = this.sessionCookie();
    if (!cookie) return null;
    return cookie;
  }

  private pcParams(extra: Record<string, string> = {}) {
    const now = String(Date.now());
    return {
      aid: '386088',
      app_name: 'luna_pc',
      region: 'cn',
      device_id: now,
      version_name: '3.3.0',
      version_code: '30030000',
      channel: 'official',
      device_platform: 'windows',
      fp: now,
      ...extra,
    };
  }

  private async pcGet(cookie: string, path: string, extra: Record<string, string> = {}) {
    const query = new URLSearchParams(this.pcParams(extra)).toString();
    return request('GET', `${PASSPORT_BASE}${path}?${query}`, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        Cookie: cookie,
        'User-Agent': 'LunaPC/3.3.0(359450208)',
        Referer: 'https://www.qishui.com/',
        'x-luna-background-type': 'foreground',
        'x-luna-is-background-req': '0',
        'x-luna-is-local-user': '1',
      },
      timeoutMs: 9_000,
    });
  }

  private mapPlaylist(raw: any, index: number) {
    const id = String(raw?.id || raw?.playlist_id || '').trim();
    const name = String(raw?.title || raw?.name || raw?.public_title || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      cover: coverUrl(raw?.url_cover || raw?.cover),
      trackCount: Number(raw?.count_tracks || raw?.track_count || raw?.resource_cnt || 0) || 0,
      order: index,
      createTime: Number(raw?.create_time || 0) || undefined,
    };
  }

  private mapTrack(raw: any) {
    const entity = raw?.entity || {};
    const media = entity.track_wrapper?.track || entity.track || entity.track_info || raw?.track || raw;
    const id = String(media?.id || raw?.id || '').trim();
    const title = String(media?.name || media?.title || '').trim();
    if (!id || !title) return null;
    const artists = Array.isArray(media?.artists) ? media.artists : [];
    const author = artists.map((item: any) => String(item?.name || '').trim()).filter(Boolean).join(' / ')
      || String(media?.artist_name || raw?.artist_name || '汽水音乐');
    return {
      type: 'qishui' as const,
      songid: id,
      title,
      author,
      pic: coverUrl(media?.album?.url_cover || media?.url_cover || raw?.url_cover),
    };
  }

  private async playlists() {
    const cookie = this.requireCookie();
    if (!cookie) return fail(401, '未登录汽水');
    const epoch = this.authEpoch;
    const profile = await this.profile(cookie);
    if (epoch !== this.authEpoch) return fail(401, '未登录汽水');
    await this.persist(cookie, profile.nickname, profile.avatar);
    const res = await this.pcGet(cookie, '/luna/pc/me/playlist', { count: '80', cursor: '' });
    const list = Array.isArray(res.json?.playlists) ? res.json.playlists : [];
    const playlists = list.map((item: any, index: number) => this.mapPlaylist(item, index)).filter(Boolean);
    return ok({ playlists, nickname: profile.nickname });
  }

  private async playlistDetail(id: string, offset = 0, limit = 80) {
    const cookie = this.requireCookie();
    if (!cookie) return fail(401, '未登录汽水');
    const playlistId = String(id || '').trim();
    if (!playlistId) return fail(400, '缺少歌单 id');
    if (playlistId === '__qishui_recent__') return this.recentSongs();
    const pageSize = Math.min(100, Math.max(1, limit || 80));
    const start = Math.max(0, offset || 0);
    const tracks: ReturnType<QishuiAccount['mapTrack']>[] = [];
    let cursor = '';
    let name = '汽水歌单';
    let cover = '';
    let total = 0;
    let hasMore = true;
    while (tracks.length < start + pageSize && hasMore) {
      const res = await this.pcGet(cookie, '/luna/pc/playlist/detail', {
        playlist_id: playlistId,
        cursor,
        count: String(pageSize),
      });
      const meta = res.json?.playlist || {};
      name = String(meta.title || meta.name || name);
      cover = cover || coverUrl(meta.url_cover || meta.cover);
      total = Number(meta.count_tracks || res.json?.total_num || total) || total;
      const page = Array.isArray(res.json?.media_resources) ? res.json.media_resources : [];
      for (const item of page) {
        const track = this.mapTrack(item);
        if (track) tracks.push(track);
      }
      const next = String(res.json?.next_cursor || '');
      hasMore = Boolean(res.json?.has_more) && Boolean(next) && page.length > 0;
      cursor = next;
      if (!page.length) break;
    }
    const sliced = tracks.slice(start, start + pageSize);
    return ok({
      id: playlistId,
      playlistId,
      name,
      cover,
      total: total || tracks.length,
      tracks: sliced,
    });
  }

  private async recentSongs() {
    const cookie = this.requireCookie();
    if (!cookie) return fail(401, '未登录汽水');
    const res = await this.pcGet(cookie, '/luna/pc/me/recently-played-media', { count: '50', cursor: '' });
    const media = Array.isArray(res.json?.media) ? res.json.media : [];
    const tracks = media.map((item: any) => this.mapTrack(item)).filter(Boolean);
    return ok({
      id: '__qishui_recent__',
      playlistId: '__qishui_recent__',
      name: '最近播放',
      cover: tracks[0]?.pic || '',
      total: Number(res.json?.total_num || tracks.length) || tracks.length,
      tracks,
    });
  }

  private async recommendFeed() {
    const cookie = this.requireCookie();
    if (!cookie) return fail(401, '未登录汽水');
    const [recent, library] = await Promise.all([
      this.recentSongs().catch(() => ok({ tracks: [] })),
      this.playlists().catch(() => ok({ playlists: [] })),
    ]);
    const items: Array<Record<string, unknown>> = [];
    const recentTracks = Array.isArray((recent as any).data?.tracks) ? (recent as any).data.tracks : [];
    if (recentTracks.length) {
      items.push({
        id: '__qishui_fm__',
        name: '汽水电台',
        description: '从最近播放继续听',
        cover: recentTracks[0]?.pic || '',
        trackCount: recentTracks.length,
        recommendKind: 'fm',
      });
      items.push({
        id: '__qishui_recent__',
        name: '最近播放',
        description: '你最近听过的歌',
        cover: recentTracks[0]?.pic || '',
        trackCount: recentTracks.length,
        recommendKind: 'daily',
      });
    }
    const playlists = Array.isArray((library as any).data?.playlists) ? (library as any).data.playlists : [];
    for (const playlist of playlists.slice(0, 16)) {
      items.push({
        ...playlist,
        recommendKind: 'playlist',
      });
    }
    return ok({ items });
  }

  private loadPending() {
    const saved = readJson<Record<string, PendingQr>>(this.pendingFile);
    if (!saved) return;
    const now = Date.now();
    for (const [token, item] of Object.entries(saved)) {
      if (!item?.createdAt || now - item.createdAt > PENDING_TTL_MS) continue;
      this.pending.set(token, {
        cookies: item.cookies || '',
        msToken: item.msToken || '',
        scanToken: item.scanToken || '',
        lastStatus: item.lastStatus || '',
        createdAt: item.createdAt,
      });
    }
  }

  private flushPending() {
    const now = Date.now();
    const out: Record<string, PendingQr> = {};
    for (const [token, item] of this.pending) {
      if (now - item.createdAt > PENDING_TTL_MS) {
        this.pending.delete(token);
        continue;
      }
      out[token] = item;
    }
    writeJson(this.pendingFile, out);
  }

  private rememberPending(token: string, patch: Partial<PendingQr> = {}) {
    const prev = this.pending.get(token);
    let cookies = mergeCookies(prev?.cookies || '', patch.cookies || '');
    const msToken = patch.msToken || prev?.msToken || cookieGet(cookies, 'msToken');
    if (msToken && !cookieGet(cookies, 'msToken')) cookies = mergeCookies(cookies, `msToken=${msToken}`);
    this.pending.set(token, {
      cookies,
      msToken,
      scanToken: patch.scanToken || prev?.scanToken || '',
      lastStatus: patch.lastStatus || prev?.lastStatus || '',
      createdAt: prev?.createdAt || Date.now(),
    });
    this.flushPending();
    return this.pending.get(token)!;
  }

  private takeMsToken(headers: Headers, cookies: string) {
    return String(headers.get('x-ms-token') || cookieGet(cookies, 'msToken') || '').trim();
  }

  private passportHeaders(pending?: PendingQr) {
    const csrf = cookieGet(pending?.cookies || '', 'passport_csrf_token');
    return {
      ...QR_HEADERS,
      ...(pending?.cookies ? { Cookie: pending.cookies } : {}),
      ...(csrf ? { 'x-tt-passport-csrf-token': csrf } : {}),
    };
  }

  private async followLoginRedirect(startUrl: string, cookie: string) {
    let current = trustedLoginUrl(startUrl);
    let jar = cookie;
    for (let hop = 0; hop < 5 && current; hop++) {
      const res = await request('GET', current, {
        headers: {
          ...QR_HEADERS,
          ...(jar ? { Cookie: jar } : {}),
        },
        redirect: 'manual',
        timeoutMs: 8_000,
      });
      jar = mergeCookies(jar, res.cookies || '');
      if (hasLoginCookie(jar)) return jar;
      const next = trustedLoginUrl(res.headers.get('location') || '')
        || trustedLoginUrl(String(res.json?.data?.redirect_url || res.json?.redirect_url || ''));
      if (!next || next === current) break;
      current = next;
    }
    return jar;
  }

  private async finishLogin(token: string, cookie: string) {
    const profile = await this.profile(cookie);
    await this.persist(cookie, profile.nickname, profile.avatar);
    this.pending.delete(token);
    this.flushPending();
    return ok({ status: 803, message: '登录成功', loggedIn: true, ...this.status() });
  }

  private async qrKey() {
    const res = await request('GET', `${PASSPORT_BASE}/passport/web/get_qrcode/?${query()}`, {
      headers: QR_HEADERS,
      timeoutMs: 8_000,
    });
    const data = res.json?.data || {};
    const token = String(data.token || '').trim();
    const indexUrl = String(data.qrcode_index_url || '').trim();
    if (res.json?.message !== 'success' || Number(data.error_code) !== 0 || !token || !indexUrl) {
      return fail(502, String(data.description || res.json?.message || '无法获取二维码，请稍后重试或改用 Cookie'));
    }
    let qrurl = '';
    let scanToken = '';
    try {
      const source = new URL(indexUrl);
      scanToken = source.searchParams.get('token') || '';
      qrurl = officialScanUrl(indexUrl, hostname() || 'Windows-PC');
    } catch {
      return fail(502, '二维码地址无效，请稍后重试');
    }
    this.rememberPending(token, {
      cookies: res.cookies || '',
      msToken: this.takeMsToken(res.headers, res.cookies || ''),
      scanToken,
      lastStatus: 'new',
    });
    return ok({
      key: token,
      qrurl,
    });
  }

  private async qrCheck(key: string) {
    const token = String(key || '').trim();
    if (!token) return fail(400, '缺少二维码 key');
    const pending = this.pending.get(token);
    const extra: Record<string, string> = {};
    if (pending?.msToken) extra.msToken = pending.msToken;
    const csrf = cookieGet(pending?.cookies || '', 'passport_csrf_token');
    if (csrf) extra.passport_csrf_token = csrf;
    const body = new URLSearchParams({
      need_logo: 'false',
      need_short_url: 'false',
      is_frontier: 'true',
      token,
      is_new_login: '1',
      next: PASSPORT_BASE,
      ...(csrf ? { passport_csrf_token: csrf } : {}),
    });
    let res = await request('POST', `${PASSPORT_BASE}/passport/web/check_qrconnect/?${query(extra)}`, {
      headers: this.passportHeaders(pending),
      body,
      timeoutMs: 8_000,
    });
    let data = res.json?.data || {};
    let raw = String(data.status || '').toLowerCase();
    let errorCode = Number(data.error_code ?? 0);
    let description = String(data.description || res.json?.message || '');
    let cookie = mergeCookies(pending?.cookies || '', res.cookies || '');
    if (typeof data.session_cookie === 'string') cookie = mergeCookies(cookie, data.session_cookie);
    let redirect = trustedLoginUrl(String(data.redirect_url || data.redirect_url2 || res.headers.get('location') || ''));
    const shouldRetryGet = !hasLoginCookie(cookie) && (
      isTransientBusy(description, String(res.json?.message || ''), errorCode)
      || raw === 'confirmed'
      || raw === '3'
      || Boolean(data.session_cookie)
      || Boolean(redirect)
    );
    if (shouldRetryGet) {
      const getRes = await request('GET', `${PASSPORT_BASE}/passport/web/check_qrconnect/?${query({ ...extra, token })}`, {
        headers: this.passportHeaders({
          cookies: cookie,
          msToken: pending?.msToken || '',
          scanToken: pending?.scanToken || '',
          lastStatus: pending?.lastStatus || '',
          createdAt: pending?.createdAt || Date.now(),
        }),
        timeoutMs: 8_000,
      });
      cookie = mergeCookies(cookie, getRes.cookies || '');
      const getData = getRes.json?.data || {};
      if (typeof getData.session_cookie === 'string') cookie = mergeCookies(cookie, getData.session_cookie);
      const getRedirect = trustedLoginUrl(String(getData.redirect_url || getData.redirect_url2 || getRes.headers.get('location') || ''));
      if (getRedirect) {
        cookie = await this.followLoginRedirect(getRedirect, cookie);
        redirect = getRedirect;
      }
      if (getRes.json?.message === 'success' || getData.status) {
        res = getRes;
        data = getData;
        raw = String(getData.status || raw).toLowerCase();
        errorCode = Number(getData.error_code ?? errorCode);
        description = String(getData.description || getRes.json?.message || description);
      }
    }
    if (redirect) cookie = await this.followLoginRedirect(redirect, cookie);
    const nextPending = this.rememberPending(token, {
      cookies: cookie,
      msToken: this.takeMsToken(res.headers, cookie),
      lastStatus: raw || pending?.lastStatus || '',
    });
    cookie = nextPending.cookies;

    if (hasLoginCookie(cookie) && (raw === 'confirmed' || raw === '3' || data.session_cookie || redirect)) {
      return this.finishLogin(token, cookie);
    }
    if (errorCode === 2046) {
      return fail(502, '这次登录需要二次验证，请改用 Cookie，或在汽水电脑版扫码后再粘贴');
    }
    if (errorCode === 2 || raw === 'expired' || raw === '4') {
      this.pending.delete(token);
      this.flushPending();
      return ok({ status: 800, message: '二维码已过期，请关闭后重开' });
    }
    if (hasLoginCookie(cookie)) {
      return this.finishLogin(token, cookie);
    }
    const scanned = nextPending.lastStatus === 'scanned' || nextPending.lastStatus === '2' || raw === 'scanned' || raw === '2';
    if (errorCode === 2156 || (isTransientBusy(description, String(res.json?.message || ''), errorCode) && scanned)) {
      return ok({
        status: 804,
        message: '手机已确认，但汽水没有下发电脑登录态。请改用 Cookie',
      });
    }
    if (isTransientBusy(description, String(res.json?.message || ''), errorCode)) {
      return ok({
        status: 801,
        message: '等待扫码…',
      });
    }
    if (res.json?.message !== 'success' && errorCode) {
      return ok({
        status: 801,
        message: '等待扫码…',
      });
    }
    const confirmed = raw === 'confirmed' || raw === '3' || Boolean(data.session_cookie);
    if (confirmed) {
      return ok({ status: 802, message: '手机已确认，正在完成登录…' });
    }
    if (raw === 'scanned' || raw === '2') {
      this.rememberPending(token, { lastStatus: 'scanned' });
      return ok({ status: 802, message: '已扫码，请在手机上确认' });
    }
    return ok({ status: 801, message: '等待扫码…' });
  }
}
