import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { FileCache } from '../cache.ts';
import { request } from '../http.ts';
import { QqService } from '../qq.ts';
import {
  cookieGet,
  cookieToMap,
  getGtk,
  hash33,
  mergeCookies,
  normalizeCookie,
  qqGuid,
  readJson,
  removeFile,
  writeJson,
} from './session.ts';

interface QqAuth {
  cookie: string;
  uin: string;
  nickname: string;
  avatar?: string;
  vip?: number;
  updatedAt?: number;
}

interface QrSession {
  qrsig: string;
  ptqrtoken: number;
  createdAt: number;
  finishing?: boolean;
  finishFailed?: boolean;
}

export class QqAccount {
  private readonly authFile: string;
  private readonly qrFile: string;

  constructor(
    cache: FileCache,
    private readonly qq: QqService,
  ) {
    this.authFile = join(cache.dir('qq_auth'), 'session.json');
    this.qrFile = join(cache.dir('qq_auth'), 'qr_session.json');
  }

  private read(): QqAuth | null {
    return readJson<QqAuth>(this.authFile);
  }

  private write(data: QqAuth) {
    writeJson(this.authFile, { ...data, updatedAt: Math.floor(Date.now() / 1000) });
  }

  status() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    return {
      loggedIn: true,
      uin: auth.uin,
      nickname: auth.nickname,
      avatar: auth.avatar || '',
      vip: auth.vip ?? 0,
      updatedAt: auth.updatedAt || 0,
    };
  }

  sessionCookie(): string | null {
    return this.read()?.cookie ?? null;
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'qq_status':
        return ok(await this.statusFresh());
      case 'qq_logout':
        removeFile(this.authFile);
        removeFile(this.qrFile);
        return ok({ ok: true });
      case 'qq_cookie_save':
        return this.cookieSave(post.cookie || '');
      case 'qq_qr_key':
        return this.qrKey();
      case 'qq_qr_check':
        return this.qrCheck();
      case 'qq_playlists':
        return this.playlists();
      case 'qq_recommend_feed':
        return this.recommendFeed(post);
      case 'qq_personal_fm':
        return this.personalFm();
      case 'qq_daily_songs':
        return this.dailySongs();
      case 'qq_radar_songs':
        return this.radarSongs();
      case 'qq_likelist':
        return this.likelist();
      case 'qq_like':
        return this.likeSong(post);
      case 'qq_like_check':
        return this.likeCheck(post);
      case 'qq_playlist_detail':
        return this.playlistDetail(post.id || '');
      case 'qq_playlist_add':
        return this.playlistAdd(post);
      default:
        return fail(400, '未知操作');
    }
  }

  private extractUin(cookie: string): string {
    const map = cookieToMap(cookie);
    const raw = map.uin || map.wxuin || map.qqmusic_uin || '';
    return raw.replace(/^o/, '').replace(/^0+/, '') || raw;
  }

  private hasMusicKey(cookie: string): boolean {
    const map = cookieToMap(cookie);
    return Boolean(map.qm_keyst || map.qqmusic_key);
  }

  /** 统一把头像 URL 收成 https */
  private normalizeAvatarUrl(...candidates: unknown[]): string {
    for (const candidate of candidates) {
      const raw = String(candidate || '').trim();
      if (!raw || raw === 'null' || raw === 'undefined') continue;
      if (raw.startsWith('//')) return `https:${raw}`;
      if (raw.startsWith('http://')) return `https://${raw.slice(7)}`;
      if (raw.startsWith('https://')) return raw;
    }
    return '';
  }

  private avatarFromProfilePayload(data: Record<string, any> | null | undefined): string {
    if (!data || typeof data !== 'object') return '';
    const creator = data.creator || {};
    const userinfo = data.userinfo || data.userInfo || {};
    const info = data.info || data.profile?.info || {};
    const profile = data.profile || {};
    return this.normalizeAvatarUrl(
      creator.headurl,
      creator.headpic,
      creator.avatarUrl,
      creator.logo,
      creator.avatar,
      userinfo.headurl,
      userinfo.headpic,
      userinfo.avatarUrl,
      userinfo.logo,
      info.logo,
      info.headurl,
      info.headpic,
      info.avatarUrl,
      profile.avatarUrl,
      profile.logo,
      data.headurl,
      data.headpic,
      data.logo,
      data.avatarUrl,
    );
  }

  /** Folia 同源：GetLoginUserInfo 的 info.logo 是完整头像 URL */
  private async fetchLoginUserAvatar(uin: string, cookie: string): Promise<{ nickname?: string; avatar?: string }> {
    const attempts = [
      {
        module: 'userInfo.BaseUserInfoServer',
        method: 'GetLoginUserInfo',
        param: {},
      },
      {
        module: 'userInfo.BaseUserInfoServer',
        method: 'get_user_baseinfo_v2',
        param: { vec_uin: [uin] },
      },
    ];
    for (const attempt of attempts) {
      try {
        const payload = {
          comm: { ct: 24, cv: 0, uin, format: 'json' },
          req: attempt,
        };
        const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
          headers: {
            Cookie: cookie,
            Referer: 'https://y.qq.com/',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeoutMs: 6000,
        });
        const root = res.json?.req?.data || res.json?.req_0?.data || res.json?.data || {};
        const map = root.map || root.infos || root;
        const byUin = map?.[uin] || map?.[String(uin)] || {};
        const avatar = this.avatarFromProfilePayload(root)
          || this.avatarFromProfilePayload(byUin)
          || this.normalizeAvatarUrl(byUin.headurl, byUin.logo, byUin.headpic);
        const nickname = String(
          root?.profile?.info?.nick
          || root?.info?.nick
          || byUin.nick
          || byUin.nickname
          || '',
        ).trim();
        if (avatar || nickname) return { ...(nickname ? { nickname } : {}), ...(avatar ? { avatar } : {}) };
      } catch {
        // try next shape
      }
    }
    return {};
  }

  private async profileValidate(cookie: string, allowFallback = false) {
    const uin = this.extractUin(cookie);
    if (!uin || !this.hasMusicKey(cookie)) return null;
    const qs = new URLSearchParams({
      cid: '205360838',
      userid: uin,
      loginUin: uin,
      reqfrom: '1',
      format: 'json',
    });
    const res = await request(
      'GET',
      `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?${qs}`,
      {
        headers: {
          Cookie: cookie,
          Referer: `https://y.qq.com/portal/profile.html?uin=${encodeURIComponent(uin)}`,
        },
      },
    );
    if (!res.json || Number(res.json.code) === 1000) {
      if (!allowFallback) return null;
      const login = await this.fetchLoginUserAvatar(uin, cookie);
      return {
        uin,
        nickname: login.nickname || `QQ ${uin}`,
        avatar: login.avatar || '',
        cookie,
      };
    }
    const data = res.json.data || {};
    let nickname =
      data?.creator?.nick || data?.userinfo?.nick || data?.userInfo?.nick || `QQ ${uin}`;
    let avatar = this.avatarFromProfilePayload(data);
    if (!avatar) {
      const login = await this.fetchLoginUserAvatar(uin, cookie);
      if (login.avatar) avatar = login.avatar;
      if (login.nickname && String(nickname).startsWith('QQ ')) nickname = login.nickname;
    }
    return {
      uin,
      nickname: String(nickname),
      avatar: avatar || '',
      cookie,
    };
  }

  private async fetchVip(uin: string, cookie: string): Promise<number> {
    const payload = {
      comm: { ct: 24, cv: 0, uin, format: 'json' },
      req: {
        module: 'userInfo.VipQueryServer',
        method: 'SRFVipQuery_V2',
        param: { uin_list: [uin] },
      },
    };
    const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Cookie: cookie,
        Referer: 'https://y.qq.com/',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeoutMs: 6000,
    });
    const data = res.json?.req?.data || {};
    const info = data.info_map?.[uin] || data.infoMap?.[uin] || data;
    const current = info.cur || info;
    const value = Number(
      current.vip_flag
      ?? current.iVipFlag
      ?? current.iSuperVip
      ?? current.iYearVip
      ?? info.iVipFlag
      ?? 0,
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private async withVip(account: {
    uin: string;
    nickname: string;
    cookie: string;
    avatar?: string;
  }): Promise<QqAuth> {
    return {
      ...account,
      avatar: account.avatar || '',
      vip: await this.fetchVip(account.uin, account.cookie),
    };
  }

  private async statusFresh() {
    const auth = this.read();
    if (!auth) return { loggedIn: false as const };
    let next = auth;
    let dirty = false;
    if (auth.vip == null) {
      next = { ...next, vip: await this.fetchVip(auth.uin, auth.cookie) };
      dirty = true;
    }
    // 旧会话没存头像：补拉一次（与 Folia 的 info.logo / 主页 headurl 对齐）
    if (!next.avatar) {
      const profile = await this.profileValidate(auth.cookie, true);
      if (profile?.avatar) {
        next = {
          ...next,
          avatar: profile.avatar,
          nickname: profile.nickname || next.nickname,
        };
        dirty = true;
      } else {
        const login = await this.fetchLoginUserAvatar(auth.uin, auth.cookie);
        if (login.avatar) {
          next = {
            ...next,
            avatar: login.avatar,
            nickname: login.nickname || next.nickname,
          };
          dirty = true;
        }
      }
    }
    if (dirty) this.write(next);
    return this.status();
  }

  private async cookieSave(raw: string) {
    let cookie = normalizeCookie(raw);
    if (!cookie) return fail(400, '请粘贴 Cookie');
    const map = cookieToMap(cookie);
    if (Number(map.login_type) === 2 && map.wxuin) {
      cookie = mergeCookies(cookie, `uin=${map.wxuin}`);
    }
    const account = await this.profileValidate(cookie);
    if (!account) return fail(401, 'Cookie 无效：需含 uin 与 qm_keyst/qqmusic_key，请从 y.qq.com 复制');
    this.write(await this.withVip(account));
    return ok(this.status());
  }

  private async qqGet(url: string, cookie = '', extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      Referer: extra.Referer || 'https://y.qq.com/',
      Cookie: cookie,
      ...extra,
    };
    if (!headers.Origin && !/ptlogin2\.qq\.com/i.test(url)) {
      headers.Origin = 'https://y.qq.com';
    }
    return request('GET', url, { headers, redirect: 'manual' });
  }

  private async qqPost(url: string, body: string | Record<string, string>, cookie = '') {
    return request('POST', url, {
      headers: {
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com',
        Cookie: cookie,
      },
      body,
      redirect: 'manual',
    });
  }

  private async qrKey() {
    const t = String(Math.random());
    const url = `https://ssl.ptlogin2.qq.com/ptqrshow?${new URLSearchParams({
      appid: '716027609',
      e: '2',
      l: 'M',
      s: '3',
      d: '72',
      v: '4',
      t,
      daid: '383',
      pt_3rd_aid: '100497308',
      u1: 'https://graph.qq.com/oauth2.0/login_jump',
    })}`;
    const buf = await (await import('../http.ts')).requestBuffer(url, {
      headers: { Referer: 'https://xui.ptlogin2.qq.com/' },
    });
    const qrsig = cookieGet(buf?.cookies || '', 'qrsig');
    if (!buf || buf.status >= 400 || !qrsig) return fail(502, '无法获取 QQ 二维码，请改用 Cookie');
    const img = buf.body.toString('base64');
    const ptqrtoken = hash33(qrsig);
    writeJson(this.qrFile, { qrsig, ptqrtoken, createdAt: Date.now() / 1000 } satisfies QrSession);
    return ok({
      qrimg: `data:image/png;base64,${img}`,
      token: createHash('sha256').update(qrsig).digest('hex').slice(0, 16),
    });
  }

  private parsePtui(body: string) {
    const m = body.match(/ptuiCB\s*\(\s*['"](\d+)['"]/);
    if (!m) return null;
    const code = Number(m[1]);
    let checkUrl = '';
    if (code === 0) {
      const um = body.match(
        /ptuiCB\s*\(\s*['"]0['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/,
      );
      checkUrl = um ? unescapeRedirect(um[1]) : '';
    }
    return { code, checkUrl };
  }

  private headerLocation(headers: Headers): string {
    return headers.get('location') || '';
  }

  private async followCollect(url: string, cookie: string, maxHops = 10, referer = 'https://xui.ptlogin2.qq.com/') {
    let hops = 0;
    let last = null as Awaited<ReturnType<QqAccount['qqGet']>> | null;
    for (let i = 0; i < maxHops; i++) {
      if (!url) break;
      const res = await this.qqGet(url, cookie, { Referer: referer });
      hops++;
      cookie = mergeCookies(cookie, res.cookies);
      last = res;
      let loc = this.headerLocation(res.headers);
      if (!loc && res.body) {
        const href = res.body.match(/(?:location\.href|window\.location)\s*=\s*["']([^"']+)["']/i);
        if (href) loc = href[1];
      }
      if (!loc) break;
      referer = url;
      url = new URL(unescapeRedirect(loc), url).toString();
    }
    return { cookie, last, hops };
  }

  private extractOauthCode(headers: Headers, body: string, loc = '') {
    const hay = `${loc}\n${[...headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')}\n${body}`;
    const m = hay.replace(/\\\//g, '/').match(/[?&#]code=([^&"'<>\s]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  private applyMusicLogin(cookie: string, data: any) {
    if (!data || typeof data !== 'object') return cookie;
    if (data.musicid) {
      const mid = String(data.musicid).replace(/\D/g, '');
      if (mid) cookie = mergeCookies(cookie, `uin=o${mid.padStart(10, '0')}; qqmusic_uin=${mid}`);
    }
    const key = data.musickey || data.key || data.qm_keyst;
    if (key) cookie = mergeCookies(cookie, `qm_keyst=${key}; qqmusic_key=${key}`);
    return cookie;
  }

  private async finishQr(checkSigUrl: string, qrsigCookie: string) {
    let cookie = qrsigCookie;
    let url = checkSigUrl;
    let pSkey = '';
    for (let hop = 0; hop < 8 && url; hop++) {
      const res = await request('GET', url, {
        headers: {
          Cookie: cookie,
          Referer: hop === 0 ? 'https://xui.ptlogin2.qq.com/' : url,
        },
        redirect: 'manual',
      });
      cookie = mergeCookies(cookie, res.cookies);
      pSkey = cookieGet(cookie, 'p_skey') || cookieGet(cookie, 'skey');
      const loc = this.headerLocation(res.headers);
      if (!loc) break;
      url = new URL(unescapeRedirect(loc), url).toString();
      if (pSkey && /y\.qq\.com|graph\.qq\.com/i.test(url)) break;
    }
    if (!pSkey) return null;

    const gtk = getGtk(pSkey);
    const authFields = {
      response_type: 'code',
      client_id: '100497308',
      redirect_uri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
      scope: 'get_user_info,get_app_friends',
      state: 'state',
      switch: '',
      from_ptlogin: '1',
      src: '1',
      update_auth: '1',
      openapi: '1010_1030',
      g_tk: String(gtk),
      auth_time: new Date().toString(),
      ui: qqGuid(),
    };
    const postAuthorize = async (body: string | URLSearchParams, contentType?: string) =>
      request('POST', 'https://graph.qq.com/oauth2.0/authorize', {
        headers: {
          Cookie: cookie,
          Referer: 'https://graph.qq.com/oauth2.0/login_jump',
          Origin: 'https://graph.qq.com',
          ...(contentType ? { 'Content-Type': contentType } : {}),
        },
        body,
        redirect: 'manual',
      });

    let auth = await postAuthorize(new URLSearchParams(authFields));
    cookie = mergeCookies(cookie, auth.cookies);
    let loc = this.headerLocation(auth.headers);
    let code = this.extractOauthCode(auth.headers, auth.body, loc);
    if (!code) {
      auth = await postAuthorize(new URLSearchParams(authFields).toString(), 'application/x-www-form-urlencoded');
      cookie = mergeCookies(cookie, auth.cookies);
      loc = this.headerLocation(auth.headers);
      code = this.extractOauthCode(auth.headers, auth.body, loc);
    }
    if (!code && loc) {
      const jump = await this.followCollect(loc, cookie, 6, 'https://graph.qq.com/');
      cookie = jump.cookie;
      code = this.extractOauthCode(jump.last?.headers || new Headers(), jump.last?.body || '', loc);
    }
    if (!code) {
      if (this.hasMusicKey(cookie) && this.extractUin(cookie)) {
        return this.profileValidate(cookie, true);
      }
      return null;
    }

    const payloads = [
      {
        comm: { g_tk: gtk, platform: 'yqq', ct: 24, cv: 0 },
        req: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } },
      },
      {
        comm: { g_tk: gtk, platform: 'yqq', ct: 24, cv: 0 },
        req_0: { module: 'QQConnectLogin.LoginServer', method: 'QQLogin', param: { code } },
      },
    ];
    for (const payload of payloads) {
      const body = JSON.stringify(payload);
      const attempts = [
        { 'Content-Type': 'application/json' },
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      ];
      for (const headers of attempts) {
        const login = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
          headers: { Referer: 'https://y.qq.com/', Cookie: cookie, ...headers },
          body,
        });
        cookie = mergeCookies(cookie, login.cookies);
        const json = login.json;
        let data: any = null;
        if (json) {
          for (const rk of ['req', 'req_0', 'req1', 'req0']) {
            if (json[rk]?.data) {
              data = json[rk].data;
              break;
            }
          }
        }
        if (data && (data.musickey || data.key || data.qm_keyst)) {
          cookie = this.applyMusicLogin(cookie, data);
          break;
        }
      }
      if (this.hasMusicKey(cookie)) break;
    }
    return this.profileValidate(cookie, true);
  }

  private async qrCheck() {
    const sess = readJson<QrSession>(this.qrFile);
    if (!sess?.qrsig) return fail(400, '二维码已失效，请刷新');
    if (sess.finishFailed) {
      return {
        code: 502,
        error: '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie',
        data: { status: 0, loggedIn: false, message: '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie' },
      };
    }
    if (sess.finishing) return ok({ status: 67, message: '正在完成登录…' });
    const url = `https://ssl.ptlogin2.qq.com/ptqrlogin?${new URLSearchParams({
      u1: 'https://graph.qq.com/oauth2.0/login_jump',
      ptqrtoken: String(sess.ptqrtoken || hash33(sess.qrsig)),
      ptredirect: '0',
      h: '1',
      t: '1',
      g: '1',
      from_ui: '1',
      ptlang: '2052',
      action: `0-0-${Date.now()}`,
      js_ver: '20102616',
      js_type: '1',
      login_sig: '',
      pt_uistyle: '40',
      aid: '716027609',
      daid: '383',
      pt_3rd_aid: '100497308',
      has_onekey: '1',
    })}`;
    const res = await this.qqGet(url, `qrsig=${sess.qrsig}`, { Referer: 'https://xui.ptlogin2.qq.com/' });
    const parsed = this.parsePtui(res.body);
    if (!parsed) return ok({ status: -1, message: '轮询异常' });
    const payload: Record<string, unknown> = { status: parsed.code, message: '' };
    if (parsed.code === 66) payload.message = '等待扫码…';
    else if (parsed.code === 67) payload.message = '已扫码，请在手机上确认';
    else if (parsed.code === 65) payload.message = '二维码已过期，请刷新';
    else if (parsed.code === 0) {
      if (!parsed.checkUrl) {
        return { code: 502, error: '登录成功但缺少跳转地址，请改用 Cookie', data: { ...payload, loggedIn: false } };
      }
      sess.finishing = true;
      writeJson(this.qrFile, sess);
      const account = await this.finishQr(parsed.checkUrl, mergeCookies(`qrsig=${sess.qrsig}`, res.cookies));
      if (!account) {
        sess.finishFailed = true;
        delete sess.finishing;
        writeJson(this.qrFile, sess);
        return {
          code: 502,
          error: '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie',
          data: { ...payload, loggedIn: false, message: '扫码成功但换取音乐凭证失败，请刷新二维码或改用 Cookie' },
        };
      }
      this.write(await this.withVip(account));
      removeFile(this.qrFile);
      payload.loggedIn = true;
      payload.uin = account.uin;
      payload.nickname = account.nickname;
      payload.message = '登录成功';
    }
    return ok(payload);
  }

  private async fetchPlaylists(uin: string, cookie: string) {
    const out: any[] = [];
    const created = await this.qqGet(
      `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?${new URLSearchParams({
        hostUin: '0',
        hostuin: uin,
        sin: '0',
        size: '200',
        g_tk: '5381',
        loginUin: uin,
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: '0',
        platform: 'yqq.json',
        needNewCode: '0',
      })}`,
      cookie,
      { Referer: 'https://y.qq.com/portal/profile.html' },
    );
    for (const pl of created.json?.data?.disslist || []) {
      const tid = String(pl.tid || pl.diss_id || '');
      if (!tid || tid === '0') continue;
      out.push({
        id: tid,
        name: String(pl.diss_name || '未命名歌单'),
        cover: String(pl.diss_cover || ''),
        trackCount: Number(pl.song_cnt || 0),
        dirid: Number(pl.dirid || 0),
        subscribed: false,
        order: out.length,
        createTime: Number(pl.create_time || pl.createTime || 0),
      });
    }
    const fav = await this.qqGet(
      `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?${new URLSearchParams({
        ct: '20',
        cid: '205360956',
        userid: uin,
        reqtype: '3',
        sin: '0',
        ein: '49',
      })}`,
      cookie,
    );
    for (const pl of fav.json?.data?.cdlist || []) {
      const tid = String(pl.disstid || pl.tid || pl.id || '');
      if (!tid || tid === '0') continue;
      out.push({
        id: tid,
        name: String(pl.dissname || pl.title || '收藏歌单'),
        cover: String(pl.logo || pl.pic || ''),
        trackCount: Number(pl.song_cnt || pl.songnum || 0),
        dirid: 0,
        subscribed: true,
        order: out.length,
      });
    }
    const seen = new Set<string>();
    return out.filter((pl) => (seen.has(pl.id) ? false : (seen.add(pl.id), true)));
  }

  private async playlistTracks(id: string, cookie: string) {
    const dissid = id.replace(/\D/g, '');
    if (!dissid) return [];
    const res = await this.qqGet(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${new URLSearchParams({
        type: '1',
        utf8: '1',
        disstid: dissid,
        format: 'json',
      })}`,
      cookie,
    );
    const songs = res.json?.cdlist?.[0]?.songlist || [];
    const out = [];
    for (const song of songs) {
      const t = this.qq.trackFromSong(song);
      if (t) out.push(t);
    }
    return out;
  }

  private async playlists() {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    return ok({ playlists: await this.fetchPlaylists(auth.uin, auth.cookie) });
  }

  private async likeSong(post: Record<string, string>) {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    const songId = Number(String(post.id || '').replace(/\D/g, ''));
    if (!songId) return fail(400, '歌曲 ID 无效');
    const like = post.like !== '0' && post.like !== 'false';
    const map = cookieToMap(auth.cookie);
    const pSkey = map.p_skey || map.pskey || map.skey || '';
    const gtk = getGtk(pSkey || map.qqmusic_key || '');
    const method = like ? 'AddSonglist' : 'DelSonglist';
    const payload = {
      comm: {
        g_tk: gtk,
        uin: Number(auth.uin) || auth.uin,
        format: 'json',
        platform: 'yqq.json',
        ct: 24,
        cv: 0,
      },
      req_1: {
        module: 'music.musicasset.PlaylistDetailWrite',
        method,
        param: {
          dirId: 201,
          v_songInfo: [{ songId, songType: 0 }],
        },
      },
    };
    const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com',
        Cookie: auth.cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = res.json?.req_1;
    const code = Number(data?.code ?? res.json?.code ?? -1);
    if (!res.ok || code !== 0) {
      // 旧接口兜底：加入「我喜欢」dirid=201
      if (like) {
        const form = new URLSearchParams({
          loginUin: auth.uin,
          hostUin: '0',
          format: 'json',
          inCharset: 'utf8',
          outCharset: 'utf-8',
          notice: '0',
          platform: 'yqq.json',
          needNewCode: '0',
          uin: auth.uin,
          dirid: '201',
          idlist: String(songId),
          source: '103',
          g_tk: String(gtk),
        });
        const legacy = await this.qqPost(
          'https://c.y.qq.com/splcloud/fcgi-bin/fcg_music_add2songdir.fcg',
          form.toString(),
          auth.cookie,
        );
        const legacyCode = Number(legacy.json?.code ?? -1);
        if (legacyCode === 0 || legacyCode === 1000) {
          return ok({ liked: true, id: String(songId) });
        }
        return fail(502, String(legacy.json?.msg || data?.msg || '添加到我喜欢失败'));
      }
      return fail(502, String(data?.msg || res.error || '取消喜欢失败'));
    }
    return ok({ liked: like, id: String(songId) });
  }

  private async likeCheck(post: Record<string, string>) {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    const songId = String(post.id || '').replace(/\D/g, '');
    if (!songId) return fail(400, '歌曲 ID 无效');
    const list = await this.fetchPlaylists(auth.uin, auth.cookie);
    const liked = list.find((pl) => Number(pl.dirid) === 201);
    if (!liked) return ok({ liked: false, id: songId });
    const tracks = await this.playlistTracks(liked.id, auth.cookie);
    return ok({ liked: tracks.some((t) => String(t.songid) === songId), id: songId });
  }

  private async likelist() {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    const list = await this.fetchPlaylists(auth.uin, auth.cookie);
    const liked = list.find((pl) => Number(pl.dirid) === 201);
    if (!liked) return ok({ playlistId: '', tracks: [], name: '我喜欢', total: 0 });
    const tracks = await this.playlistTracks(liked.id, auth.cookie);
    return ok({ playlistId: liked.id, name: '我喜欢', tracks, total: tracks.length });
  }

  private async playlistAdd(post: Record<string, string>) {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    const songId = Number(String(post.songid || '').replace(/\D/g, ''));
    if (!songId) return fail(400, '歌曲 ID 无效');
    let dirId = Number(String(post.dirid || '').replace(/\D/g, ''));
    const playlistId = String(post.playlistId || post.id || '').replace(/\D/g, '');
    if (!dirId && playlistId) {
      const playlists = await this.fetchPlaylists(auth.uin, auth.cookie);
      const matched = playlists.find((pl) => String(pl.id) === playlistId);
      dirId = Number(matched?.dirid || 0);
    }
    if (!dirId) dirId = 201;
    const map = cookieToMap(auth.cookie);
    const pSkey = map.p_skey || map.pskey || map.skey || '';
    const gtk = getGtk(pSkey || map.qqmusic_key || '');
    const payload = {
      comm: {
        g_tk: gtk,
        uin: Number(auth.uin) || auth.uin,
        format: 'json',
        platform: 'yqq.json',
        ct: 24,
        cv: 0,
      },
      req_1: {
        module: 'music.musicasset.PlaylistDetailWrite',
        method: 'AddSonglist',
        param: {
          dirId,
          v_songInfo: [{ songId, songType: 0 }],
        },
      },
    };
    const res = await request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com',
        Cookie: auth.cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = res.json?.req_1;
    const code = Number(data?.code ?? res.json?.code ?? -1);
    if (!res.ok || code !== 0) {
      return fail(502, String(data?.data?.Msg || data?.data?.msg || '添加到歌单失败'), {
        playlistId,
        dirId,
        songid: String(songId),
        code,
      });
    }
    return ok({ playlistId, dirId, songid: String(songId), added: true });
  }

  private musiculPayload(auth: { uin: string; cookie: string }, reqs: Record<string, unknown>) {
    const map = cookieToMap(auth.cookie);
    const pSkey = map.p_skey || map.pskey || map.skey || '';
    const gtk = getGtk(pSkey || map.qqmusic_key || '');
    return {
      comm: {
        g_tk: gtk,
        uin: Number(auth.uin) || auth.uin,
        format: 'json',
        platform: 'yqq.json',
        ct: 24,
        cv: 0,
      },
      ...reqs,
    };
  }

  private async musiculPost(auth: { uin: string; cookie: string }, reqs: Record<string, unknown>) {
    const payload = this.musiculPayload(auth, reqs);
    return request('POST', 'https://u.y.qq.com/cgi-bin/musicu.fcg', {
      headers: {
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com',
        Cookie: auth.cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  private radarTracksFromResponse(data: any): any[] {
    const vecSongs: any[] = data?.VecSongs || [];
    if (vecSongs.length) {
      return vecSongs
        .map((item) => item?.Track || item)
        .filter(Boolean);
    }
    return data?.TrackInfoList || [];
  }

  private radarTrackKey(track: any): string {
    return String(
      track?.mid
      || track?.songmid
      || track?.id
      || track?.songid
      || track?.SongID
      || '',
    ).trim();
  }

  private async fetchRadarRawList(
    auth: { uin: string; cookie: string },
    maxTracks = 30,
  ): Promise<any[]> {
    const seen = new Set<string>();
    const out: any[] = [];
    for (let page = 1; page <= 4 && out.length < maxTracks; page++) {
      const radarRes = await this.musiculPost(auth, {
        req_0: {
          module: 'music.recommend.TrackRelationServer',
          method: 'GetRadarSong',
          param: { Page: page },
        },
      });
      const data = radarRes.json?.req_0?.data;
      const rawList = this.radarTracksFromResponse(data);
      if (!rawList.length) break;
      for (const item of rawList) {
        const key = this.radarTrackKey(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= maxTracks) break;
      }
      if (!data?.HasMore) break;
    }
    return out;
  }

  private dailyMixTitleHints(): string[] {
    return ['每日30', '每日 30', '今日私享', 'daily mix', 'daily30'];
  }

  private isDailyMixText(...parts: unknown[]): boolean {
    const text = parts.map((part) => String(part || '')).join(' ').toLowerCase();
    return this.dailyMixTitleHints().some((hint) => text.includes(hint.toLowerCase()));
  }

  private playlistIdFromValue(value: unknown): string {
    if (value == null) return '';
    const raw = String(value).trim();
    if (/^\d{6,}$/.test(raw)) return raw;
    const fromUrl = raw.match(/(?:disstid|dissid|playlist\/)(\d{6,})/i);
    return fromUrl?.[1] || '';
  }

  private playlistIdFromObject(obj: any): string {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
      obj.disstid,
      obj.dissid,
      obj.tid,
      obj.id,
      obj.diss_id,
      obj.playlist_id,
      obj?.basic?.tid,
      obj?.basic?.disstid,
      obj?.Playlist?.basic?.tid,
      obj?.miscellany?.disstid,
      obj?.miscellany?.tid,
      obj.jump_url,
      obj.url,
      obj.scheme,
      obj.link,
    ];
    for (const candidate of candidates) {
      const id = this.playlistIdFromValue(candidate);
      if (id) return id;
    }
    return '';
  }

  private coverFromPlaylistObject(obj: any): string {
    if (!obj || typeof obj !== 'object') return '';
    const cover = obj?.cover || obj?.pic || obj?.picUrl || obj?.imgurl || {};
    if (typeof cover === 'string') return cover.startsWith('//') ? `https:${cover}` : cover;
    return String(
      cover?.medium_url
      || cover?.default_url
      || cover?.big_url
      || cover?.url
      || '',
    );
  }

  private deepFindDailyMix(
    node: any,
    depth = 0,
    titleContext: string[] = [],
  ): { id: string; name: string; cover: string; trackCount: number } | null {
    if (!node || depth > 12) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.deepFindDailyMix(item, depth + 1, titleContext);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;

    const texts = [...titleContext];
    for (const key of ['title', 'subtitle', 'main_title', 'sub_title', 'title_content', 'title_template', 'name', 'desc']) {
      if (node[key]) texts.push(String(node[key]));
    }
    const id = this.playlistIdFromObject(node);
    if (id && this.isDailyMixText(...texts)) {
      return {
        id,
        name: String(node?.title || node?.main_title || node?.title_content || '每日30首'),
        cover: this.coverFromPlaylistObject(node),
        trackCount: Number(node?.song_cnt || node?.songnum || node?.track_count || 30) || 30,
      };
    }
    for (const value of Object.values(node)) {
      const found = this.deepFindDailyMix(value, depth + 1, texts.slice(-6));
      if (found) return found;
    }
    return null;
  }

  private parseDailyMixFromFeed(data: any): { id: string; name: string; cover: string; trackCount: number } | null {
    const shelves: any[] = data?.v_shelf || data?.shelves || [];
    for (const shelf of shelves) {
      const niches: any[] = shelf?.v_niche || shelf?.niches || [];
      for (const niche of niches) {
        const cards: any[] = niche?.v_card || niche?.cards || [];
        for (const card of cards) {
          const titleParts = [
            card?.title,
            card?.subtitle,
            card?.main_title,
            card?.sub_title,
            card?.title_content,
            card?.title_template,
            card?.name,
            niche?.title_content,
            niche?.title_template,
            shelf?.title_content,
          ];
          if (!this.isDailyMixText(...titleParts)) continue;
          const id = this.playlistIdFromObject(card);
          if (!id) continue;
          return {
            id,
            name: String(card?.title || card?.main_title || card?.title_content || '每日30首'),
            cover: this.coverFromPlaylistObject(card),
            trackCount: Number(card?.song_cnt || card?.songnum || card?.track_count || 30) || 30,
          };
        }
      }
    }
    return this.deepFindDailyMix(data);
  }

  private async fetchDailyMixFromHomepage(cookie: string): Promise<{ id: string; name: string; cover: string; trackCount: number } | null> {
    const res = await this.qqGet('https://c.y.qq.com/node/musicmac/v6/index.html', cookie);
    const html = res.body || '';
    const patterns = [
      /playlist__name[^>]*>\s*今日私享[\s\S]{0,800}?data-rid=["'](\d+)["']/i,
      /data-rid=["'](\d+)["'][\s\S]{0,800}?playlist__name[^>]*>\s*今日私享/i,
      /每日\s*30[\s\S]{0,800}?data-rid=["'](\d+)["']/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return { id: match[1], name: '每日30首', cover: '', trackCount: 30 };
      }
    }
    return null;
  }

  private async resolveDailyMix(auth: { uin: string; cookie: string }) {
    try {
      const feedRes = await this.musiculPost(auth, {
        req_0: {
          module: 'music.recommend.RecommendFeed',
          method: 'get_recommend_feed',
          param: { direction: 0, page: 1, s_num: 0, v_cache: [] },
        },
      });
      const fromFeed = this.parseDailyMixFromFeed(feedRes.json?.req_0?.data);
      if (fromFeed?.id) return fromFeed;
    } catch {
      // ignore and fall back
    }
    return this.fetchDailyMixFromHomepage(auth.cookie);
  }

  private async fetchRadioRawList(
    auth: { uin: string; cookie: string },
    maxTracks = 20,
  ): Promise<any[]> {
    const seen = new Set<string>();
    const out: any[] = [];
    for (let i = 0; i < 4 && out.length < maxTracks; i++) {
      const radioRes = await this.musiculPost(auth, {
        req_0: {
          module: 'music.radioProxy.MbTrackRadioSvr',
          method: 'get_radio_track',
          param: { IsGetTrackInfo: 1, IsSetTrack: 0 },
        },
      });
      const rawList = this.radioTracksFromResponse(radioRes.json?.req_0?.data);
      if (!rawList.length) break;
      for (const item of rawList) {
        const key = this.radarTrackKey(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= maxTracks) break;
      }
    }
    return out;
  }

  private radioTracksFromResponse(data: any): any[] {
    return data?.tracks || data?.TrackList || [];
  }

  private albumCoverFromTrack(track: any): string {
    const albummid = track?.album?.mid || track?.AlbumMID || track?.albumMid || '';
    return albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`
      : '';
  }

  private recommendPlaylistsFromFeed(data: any, limit: number): any[] {
    const list: any[] = data?.List || data?.list || [];
    const playlists: Array<Record<string, unknown>> = [];
    for (const entry of list) {
      const basic = entry?.Playlist?.basic || entry?.basic || entry;
      const id = String(basic?.tid || basic?.disstid || basic?.id || '');
      if (!id) continue;
      playlists.push({
        id,
        name: String(basic?.title || basic?.dissname || '推荐歌单'),
        cover: String(
          basic?.cover?.medium_url
          || basic?.cover?.default_url
          || basic?.cover?.big_url
          || basic?.picUrl
          || basic?.imgurl
          || '',
        ),
        trackCount: Number(basic?.song_cnt || basic?.songNum || 0),
        recommendKind: 'playlist',
        description: String(
          basic?.desc
          || basic?.description
          || basic?.creator?.nick
          || '个性推荐',
        ),
      });
      if (playlists.length >= limit) break;
    }
    return playlists;
  }

  private async recommendFeed(post: Record<string, string>) {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    let limit = Number(post.limit || 24);
    if (limit <= 0) limit = 24;
    if (limit > 35) limit = 35;

    const [dailyMix, radarPreview, radioRes, feedRes] = await Promise.all([
      this.resolveDailyMix(auth),
      this.fetchRadarRawList(auth, 1),
      this.musiculPost(auth, {
        req_0: {
          module: 'music.radioProxy.MbTrackRadioSvr',
          method: 'get_radio_track',
          param: { IsGetTrackInfo: 1, IsSetTrack: 0 },
        },
      }),
      this.musiculPost(auth, {
        req_0: {
          module: 'music.playlist.PlaylistSquare',
          method: 'GetRecommendFeed',
          param: { From: 0, Size: limit },
        },
      }),
    ]);

    const radioSongs = this.radioTracksFromResponse(radioRes.json?.req_0?.data);
    const playlists = this.recommendPlaylistsFromFeed(feedRes.json?.req_0?.data, limit);

    const items: Array<Record<string, unknown>> = [];
    items.push({
      id: dailyMix?.id || '__qq_daily__',
      name: dailyMix?.name || '每日30首',
      cover: dailyMix?.cover || '',
      trackCount: dailyMix?.trackCount || 30,
      recommendKind: 'daily',
      description: '根据你的口味生成，每天更新',
    });
    items.push({
      id: '__qq_radar__',
      name: '私人雷达',
      cover: this.albumCoverFromTrack(radarPreview[0]),
      trackCount: 30,
      recommendKind: 'radar',
      description: '根据你的喜好智能推荐，持续发现新歌',
    });
    items.push({
      id: '__qq_fm__',
      name: '猜你喜欢',
      cover: this.albumCoverFromTrack(radioSongs[0]),
      trackCount: radioSongs.length || 6,
      recommendKind: 'fm',
      description: '无限随机电台',
    });
    items.push(...playlists);

    if (!dailyMix?.id && !radarPreview.length && !radioSongs.length && !playlists.length) {
      return fail(502, '拉取 QQ 音乐推荐失败');
    }

    return ok({ items });
  }

  private async dailySongs() {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');

    const mix = await this.resolveDailyMix(auth);
    if (!mix?.id) return fail(502, '拉取每日30首失败');

    const tracks = await this.playlistTracks(mix.id, auth.cookie);
    const meta = await this.qqGet(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${new URLSearchParams({
        type: '1',
        utf8: '1',
        disstid: mix.id,
        format: 'json',
      })}`,
      auth.cookie,
    );
    const cover = mix.cover?.trim()
      || this.albumCoverFromTrack(meta.json?.cdlist?.[0]?.songlist?.[0])
      || '';

    return ok({
      id: '__qq_daily__',
      name: String(meta.json?.cdlist?.[0]?.dissname || mix.name || '每日30首'),
      cover,
      total: tracks.length,
      tracks,
    });
  }

  private async radarSongs() {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');

    const rawList = await this.fetchRadarRawList(auth, 30);
    if (!rawList.length) return fail(502, '拉取私人雷达失败');

    const tracks = rawList
      .map((item: any) => this.qq.trackFromSong(item))
      .filter(Boolean);

    return ok({
      id: '__qq_radar__',
      name: '私人雷达',
      cover: this.albumCoverFromTrack(rawList[0]),
      total: tracks.length,
      tracks,
    });
  }

  private async personalFm() {
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');

    const rawList = await this.fetchRadioRawList(auth, 20);
    if (!rawList.length) return fail(502, '拉取猜你喜欢失败');

    const tracks = rawList
      .map((item: any) => this.qq.trackFromSong(item))
      .filter(Boolean);

    return ok({ tracks });
  }

  private async playlistDetail(id: string) {
    const trimmed = id.trim();
    if (trimmed === '__qq_radar__') return this.radarSongs();
    if (trimmed === '__qq_daily__') return this.dailySongs();
    const auth = this.read();
    if (!auth) return fail(401, '请先登录 QQ 音乐');
    if (!/^\d+$/.test(trimmed)) return fail(400, '歌单 ID 无效');
    const tracks = await this.playlistTracks(id.trim(), auth.cookie);
    const meta = await this.qqGet(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${new URLSearchParams({
        type: '1',
        utf8: '1',
        disstid: id.trim(),
        format: 'json',
      })}`,
      auth.cookie,
    );
    return ok({
      id: id.trim(),
      name: String(meta.json?.cdlist?.[0]?.dissname || ''),
      tracks,
      total: tracks.length,
    });
  }
}

function unescapeRedirect(url: string): string {
  return url.replace(/\\\//g, '/').replace(/&amp;/g, '&');
}

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}
