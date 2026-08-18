import { join } from 'node:path';
import { FileCache } from '../cache.ts';
import { cookieCsrf, eapiRequest, mergeCookies, neteaseApi, weapiRequest } from '../crypto/netease.ts';
import { NeteaseService } from '../netease.ts';
import { normalizeCookie, readJson, removeFile, writeJson } from './session.ts';

interface NeteaseAuth {
  cookie: string;
  csrf?: string;
  uid: number;
  nickname: string;
  avatar: string;
  updatedAt?: number;
}

export class NeteaseAccount {
  private readonly file: string;

  constructor(
    cache: FileCache,
    private readonly netease: NeteaseService,
  ) {
    this.file = join(cache.dir('netease_auth'), 'session.json');
  }

  private read(): NeteaseAuth | null {
    return readJson<NeteaseAuth>(this.file);
  }

  private write(data: NeteaseAuth): void {
    writeJson(this.file, { ...data, updatedAt: Math.floor(Date.now() / 1000) });
  }

  status() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    return {
      loggedIn: true,
      uid: auth.uid,
      nickname: auth.nickname,
      avatar: auth.avatar,
      updatedAt: auth.updatedAt || 0,
    };
  }

  logout() {
    removeFile(this.file);
    return { ok: true };
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'netease_status':
        return ok(this.status());
      case 'netease_logout':
        return ok(this.logout());
      case 'netease_cookie_save':
        return this.cookieSave(post.cookie || '');
      case 'netease_qr_key':
        return this.qrKey();
      case 'netease_qr_check':
        return this.qrCheck(post.key || '');
      case 'netease_playlists':
        return this.playlists();
      case 'netease_likelist':
        return this.likelist(post);
      case 'netease_playlist_detail':
        return this.playlistDetail(post);
      case 'netease_songs_by_ids':
        return this.songsByIds(post.ids || '');
      default:
        return fail(400, '未知操作');
    }
  }

  private async accountGet(cookie: string) {
    let res = await neteaseApi('/api/nuser/account/get', {}, cookie, 'POST');
    if (!res.json) res = await neteaseApi('/api/w/nuser/account/get', {}, cookie, 'POST');
    if (!res.json) return null;
    const profile = res.json.profile;
    const account = res.json.account;
    const uid = Number(profile?.userId || account?.id || 0);
    if (uid <= 0) return null;
    return {
      uid,
      nickname: String(profile?.nickname || ''),
      avatar: String(profile?.avatarUrl || ''),
    };
  }

  private async cookieSave(raw: string) {
    const cookie = normalizeCookie(raw);
    if (!cookie || !/MUSIC_U=/.test(cookie)) return fail(400, '请粘贴包含 MUSIC_U 的 Cookie');
    const account = await this.accountGet(cookie);
    if (!account) return fail(401, 'Cookie 无效或已过期，请重新从浏览器复制');
    this.write({ cookie, csrf: cookieCsrf(cookie), ...account });
    return ok(this.status());
  }

  private async qrKey() {
    let unikey = '';
    let via = '';
    let res = await eapiRequest('/api/login/qrcode/unikey', { type: 3 }, '');
    unikey = String(res.json?.unikey || '');
    if (unikey) via = 'eapi';
    if (!unikey) {
      res = await weapiRequest('/weapi/login/qrcode/unikey', { type: 3 }, '');
      unikey = String(res.json?.unikey || '');
      if (unikey) via = 'weapi-t3';
    }
    if (!unikey) {
      res = await neteaseApi('/api/login/qrcode/unikey', { type: 3 }, '', 'POST');
      unikey = String(res.json?.unikey || '');
      if (unikey) via = 'api-t3';
    }
    if (!unikey) return fail(502, '无法获取二维码，请稍后重试或改用 Cookie');
    return ok({
      key: unikey,
      qrurl: `https://music.163.com/login?codekey=${encodeURIComponent(unikey)}`,
      via,
    });
  }

  private extractLoginCookie(res: { cookies: string; json: any; body: string }): string {
    let cookie = res.cookies || '';
    const bodyCookie = res.json?.cookie;
    if (typeof bodyCookie === 'string') cookie = mergeCookies(cookie, bodyCookie);
    if (Array.isArray(bodyCookie)) cookie = mergeCookies(cookie, bodyCookie.join('; '));
    return cookie;
  }

  private async qrCheck(key: string) {
    if (!key) return fail(400, '缺少二维码 key');
    const params = { type: 3, key };
    let res = await eapiRequest('/api/login/qrcode/client/login', params, '');
    let via = 'eapi';
    let code = Number(res.json?.code || 0);
    if (!res.json || code === 0) {
      res = await weapiRequest('/weapi/login/qrcode/client/login', params, '');
      via = 'weapi-t3';
      code = Number(res.json?.code || 0);
    }
    const payload: Record<string, unknown> = {
      status: code,
      message: String(res.json?.message || ''),
      via,
    };
    if (code !== 803) return ok(payload);
    let cookie = this.extractLoginCookie(res);
    if (!/MUSIC_U=/.test(cookie)) {
      const retry = await eapiRequest('/api/login/qrcode/client/login', params, '');
      cookie = mergeCookies(cookie, this.extractLoginCookie(retry));
    }
    if (!/MUSIC_U=/.test(cookie)) {
      return { code: 502, error: '扫码成功但未拿到 Cookie，请改用 Cookie 登录', data: { ...payload, loggedIn: false } };
    }
    const account = await this.accountGet(cookie);
    if (!account) {
      return { code: 502, error: '登录态校验失败，请改用 Cookie', data: { ...payload, loggedIn: false } };
    }
    this.write({ cookie, csrf: cookieCsrf(cookie), ...account });
    return ok({ ...payload, loggedIn: true, ...account });
  }

  private requireAuth() {
    const auth = this.read();
    if (!auth) return null;
    return auth;
  }

  private async playlists() {
    const auth = this.requireAuth();
    if (!auth) return fail(401, '请先登录网易云');
    const res = await neteaseApi(
      '/api/user/playlist',
      { uid: auth.uid, limit: 1000, offset: 0 },
      auth.cookie,
      'POST',
    );
    const list = res.json?.playlist;
    if (!Array.isArray(list)) return fail(502, '拉取歌单失败');
    return ok({
      playlists: list.map((pl: any) => ({
        id: String(pl.id || ''),
        name: String(pl.name || '未命名歌单'),
        cover: String(pl.coverImgUrl || ''),
        trackCount: Number(pl.trackCount || 0),
        specialType: Number(pl.specialType || 0),
        subscribed: Boolean(pl.subscribed),
      })),
    });
  }

  private pageParams(post: Record<string, string>): [number, number] {
    const offset = Math.max(0, Number(post.offset || 0));
    let limit = Number(post.limit || 10);
    if (limit <= 0) limit = 10;
    if (limit > 50) limit = 50;
    return [offset, limit];
  }

  private async playlistPage(playlistId: number, cookie: string, offset: number, limit: number) {
    const res = await neteaseApi(
      '/api/v6/playlist/detail',
      { id: playlistId, n: 0, s: 0 },
      cookie,
      'POST',
    );
    const playlist = res.json?.playlist || {};
    const ids = Array.isArray(playlist.trackIds)
      ? playlist.trackIds.map((t: any) => Number(t.id)).filter(Boolean)
      : [];
    const pageIds = ids.slice(offset, offset + limit);
    const tracks = await this.netease.songsByIdsV3(pageIds, cookie);
    return {
      id: String(playlistId),
      name: String(playlist.name || ''),
      total: ids.length || Number(playlist.trackCount || 0),
      trackIds: ids.map(String),
      tracks,
    };
  }

  private async likelist(post: Record<string, string>) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, '请先登录网易云');
    const [offset, limit] = this.pageParams(post);
    const res = await neteaseApi('/api/song/like/get', { uid: auth.uid }, auth.cookie, 'POST');
    const ids = Array.isArray(res.json?.ids) ? res.json.ids.map(Number) : [];
    if (!ids.length) {
      const plRes = await neteaseApi(
        '/api/user/playlist',
        { uid: auth.uid, limit: 50, offset: 0 },
        auth.cookie,
        'POST',
      );
      let likedId = 0;
      for (const pl of plRes.json?.playlist || []) {
        if (Number(pl.specialType || 0) === 5) {
          likedId = Number(pl.id || 0);
          break;
        }
      }
      if (likedId > 0) {
        const page = await this.playlistPage(likedId, auth.cookie, offset, limit);
        return ok({
          playlistId: String(likedId),
          name: page.name || '我喜欢',
          total: page.total,
          trackIds: page.trackIds,
          tracks: page.tracks,
        });
      }
      return ok({ playlistId: '', name: '我喜欢', total: 0, trackIds: [], tracks: [] });
    }
    const pageIds = ids.slice(offset, offset + limit);
    return ok({
      playlistId: 'likelist',
      name: '我喜欢',
      total: ids.length,
      trackIds: ids.map(String),
      tracks: await this.netease.songsByIdsV3(pageIds, auth.cookie),
    });
  }

  private async playlistDetail(post: Record<string, string>) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, '请先登录网易云');
    const id = (post.id || '').trim();
    if (!/^\d+$/.test(id)) return fail(400, '歌单 ID 无效');
    const [offset, limit] = this.pageParams(post);
    const page = await this.playlistPage(Number(id), auth.cookie, offset, limit);
    return ok(page);
  }

  private async songsByIds(raw: string) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, '请先登录网易云');
    if (!raw.trim()) return ok({ tracks: [] });
    let ids = raw.split(',').map((n) => Number(n)).filter((n) => n > 0);
    if (ids.length > 10) ids = ids.slice(0, 10);
    return ok({ tracks: await this.netease.songsByIdsV3(ids, auth.cookie) });
  }
}

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}
