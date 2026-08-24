import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { FileCache } from '../cache.ts';
import { request } from '../http.ts';
import { requestKugou } from '../kugouLyrics.ts';
import {
  cookieGet,
  cookieToMap,
  mergeCookies,
  normalizeCookie,
  readJson,
  removeFile,
  writeJson,
} from './session.ts';

interface KugouAuth {
  cookie: string;
  userid: string;
  token: string;
  nickname: string;
  avatar: string;
  vip?: number;
  updatedAt?: number;
}

interface QrSession {
  key: string;
  createdAt: number;
}

/** 酷狗 Web 签名盐（与官网 / musicdl 一致；旧值 XY4yyrin 会触发 20006） */
const WEB_SIGN_KEY = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const QR_APPID = '1014';
const QR_SRCAPPID = '2919';

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function signWeb(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  let raw = WEB_SIGN_KEY;
  for (const key of keys) raw += `${key}=${params[key]}`;
  raw += WEB_SIGN_KEY;
  return md5(raw);
}

/** 官方 mid：MD5(hex) 再转十进制字符串 */
function kugouMid(seed: string): string {
  return BigInt(`0x${md5(seed)}`).toString();
}

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseInnerKuGoo(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    map[part.slice(0, eq)] = decodeComponent(part.slice(eq + 1));
  }
  return map;
}

function extractCredentials(cookie: string): { userid: string; token: string; nickname: string; avatar: string } {
  const map = cookieToMap(cookie);
  const inner = parseInnerKuGoo(map.KuGoo || map.kugoo || map.Kugoo || '');
  const userid = String(
    map.userid || map.KugooID || map.kugouid || inner.KugooID || inner.userid || '',
  ).trim();
  const token = String(map.token || map.t || inner.t || inner.token || '').trim();
  const nickname = String(map.NickName || inner.NickName || inner.nickname || '').trim();
  const avatar = String(map.Pic || inner.Pic || inner.pic || map.photo || '').trim();
  return { userid, token, nickname, avatar };
}

function isVipValue(value: unknown): boolean {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return true;
  const text = String(value || '').toLowerCase();
  return text === '1' || text === 'true' || text === 'vip';
}

export class KugouAccount {
  private readonly authFile: string;
  private readonly qrFile: string;

  constructor(cache: FileCache) {
    this.authFile = join(cache.dir('kugou_auth'), 'session.json');
    this.qrFile = join(cache.dir('kugou_auth'), 'qr_session.json');
  }

  private read(): KugouAuth | null {
    return readJson<KugouAuth>(this.authFile);
  }

  private write(data: KugouAuth) {
    writeJson(this.authFile, { ...data, updatedAt: Math.floor(Date.now() / 1000) });
  }

  status() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    return {
      loggedIn: true,
      uid: Number(auth.userid) || 0,
      nickname: auth.nickname,
      avatar: auth.avatar || '',
      vip: auth.vip ?? 0,
      updatedAt: auth.updatedAt || 0,
    };
  }

  sessionCookie(): string | null {
    return this.read()?.cookie ?? null;
  }

  credentials(): { userid: string; token: string } | null {
    const auth = this.read();
    if (!auth?.userid || !auth.token) return null;
    return { userid: auth.userid, token: auth.token };
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'kugou_status':
        return ok(await this.statusFresh());
      case 'kugou_logout':
        removeFile(this.authFile);
        removeFile(this.qrFile);
        return ok({ ok: true });
      case 'kugou_cookie_save':
        return this.cookieSave(post.cookie || '');
      case 'kugou_qr_key':
        return this.qrKey();
      case 'kugou_qr_check':
        return this.qrCheck(post.key || '');
      default:
        return fail(400, '未知操作');
    }
  }

  private async statusFresh() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    const profile = await this.fetchProfile(auth.userid, auth.token, auth.cookie).catch(() => null);
    if (!profile) return this.status();
    this.write({
      ...auth,
      nickname: profile.nickname || auth.nickname,
      avatar: profile.avatar || auth.avatar,
      vip: profile.vip,
    });
    return this.status();
  }

  private async cookieSave(raw: string) {
    const cookie = normalizeCookie(raw);
    if (!cookie) return fail(400, '请粘贴酷狗 Cookie');
    const creds = extractCredentials(cookie);
    if (!creds.userid || !creds.token) {
      return fail(400, 'Cookie 需包含 userid 与 token（或 KuGoo）');
    }
    const profile = await this.fetchProfile(creds.userid, creds.token, cookie).catch(() => null);
    this.write({
      cookie,
      userid: creds.userid,
      token: creds.token,
      nickname: profile?.nickname || creds.nickname || '酷狗用户',
      avatar: profile?.avatar || creds.avatar || '',
      vip: profile?.vip ?? 0,
    });
    return ok(this.status());
  }

  private async fetchProfile(userid: string, token: string, cookie = '') {
    const tries = [
      () => requestKugou(
        'http://userinfo.user.kugou.com/v2/get_user_info',
        { userid, token },
        'UserInfo',
      ),
      () => requestKugou(
        'https://gatewayretry.kugou.com/v1/get_user_info',
        { userid, token },
        'UserInfo',
        { 'x-router': 'userinfo.kugou.com' },
      ),
    ];
    for (const tryFetch of tries) {
      try {
        const json = await tryFetch();
        const data = json?.data || json?.user || json;
        const nickname = String(
          data?.nickname || data?.nick_name || data?.user_name || data?.username || '',
        ).trim();
        const avatar = String(
          data?.pic || data?.photo || data?.headimg || data?.avatar || data?.userpic || '',
        ).replace(/\{size\}/gi, '150').trim();
        const vip = isVipValue(data?.vip_type)
          || isVipValue(data?.is_vip)
          || isVipValue(data?.m_type)
          || isVipValue(data?.user_type)
          || isVipValue(data?.vip)
          || isVipValue(data?.vip_info?.is_vip)
          || isVipValue(data?.vip_info?.vip_type)
          ? 1
          : 0;
        if (nickname || avatar || json) {
          return {
            nickname: nickname || cookieGet(cookie, 'NickName') || '酷狗用户',
            avatar,
            vip,
          };
        }
      } catch {
        // try next
      }
    }
    if (cookie) {
      const fallback = extractCredentials(cookie);
      if (fallback.nickname || fallback.avatar) {
        return { nickname: fallback.nickname || '酷狗用户', avatar: fallback.avatar, vip: 0 };
      }
    }
    return null;
  }

  private async qrKey() {
    const clienttime = Math.floor(Date.now() / 1000);
    const mid = kugouMid(`ryanmusic-${Date.now()}`);
    const uuid = md5(`${mid}${clienttime}`);
    const params: Record<string, string | number> = {
      appid: QR_APPID,
      clientver: '2000',
      clienttime,
      mid,
      uuid,
      dfid: '-',
      plat: 4,
      type: 1,
      srcappid: QR_SRCAPPID,
      qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${QR_APPID}&`,
    };
    params.signature = signWeb(params);
    const url = new URL('https://login-user.kugou.com/v2/qrcode');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const res = await request('GET', url.toString(), {
      timeoutMs: 8000,
      headers: {
        Referer: 'https://www.kugou.com/',
        Origin: 'https://www.kugou.com',
        mid: String(mid),
        dfid: '-',
        clienttime: String(clienttime),
      },
    });
    const key = String(res.json?.data?.qrcode || res.json?.qrcode || '').trim();
    if (!key) {
      const detail = String(res.json?.data || res.json?.error_msg || res.json?.error_code || '').trim();
      return fail(502, detail ? `无法获取酷狗二维码（${detail}），请改用 Cookie` : '无法获取酷狗二维码，请改用 Cookie');
    }
    writeJson(this.qrFile, { key, createdAt: Date.now() } satisfies QrSession);
    const qrurl = `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${QR_APPID}&qrcode=${encodeURIComponent(key)}`;
    const qrimg = String(res.json?.data?.qrcode_img || res.json?.data?.qrcode_url || '').trim();
    return ok({
      key,
      qrurl,
      qrimg: qrimg || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrurl)}`,
    });
  }

  private async qrCheck(keyHint: string) {
    const session = readJson<QrSession>(this.qrFile);
    const key = (keyHint || session?.key || '').trim();
    if (!key) return fail(400, '缺少二维码 key');
    const clienttime = Math.floor(Date.now() / 1000);
    const mid = kugouMid(`ryanmusic-check-${clienttime}`);
    const uuid = md5(`${mid}${clienttime}`);
    const params: Record<string, string | number> = {
      appid: QR_APPID,
      clientver: '2000',
      clienttime,
      mid,
      uuid,
      dfid: '-',
      plat: 4,
      srcappid: QR_SRCAPPID,
      qrcode: key,
    };
    params.signature = signWeb(params);
    const url = new URL('https://login-user.kugou.com/v2/get_userinfo_qrcode');
    for (const [k, value] of Object.entries(params)) url.searchParams.set(k, String(value));
    const res = await request('GET', url.toString(), {
      timeoutMs: 8000,
      headers: {
        Referer: 'https://www.kugou.com/',
        Origin: 'https://www.kugou.com',
        mid: String(mid),
        dfid: '-',
        clienttime: String(clienttime),
      },
    });
    const data = res.json?.data || {};
    const status = Number(data.status ?? data.qrcode_status ?? res.json?.status ?? 1);
    if (status === 0) return ok({ status: 0, message: '二维码已过期' });
    if (status === 2) return ok({ status: 2, message: '已扫码，请在手机上确认' });
    if (status !== 4) return ok({ status: 1, message: '等待扫码…' });

    const userid = String(data.userid || data.user_id || '').trim();
    const token = String(data.token || '').trim();
    if (!userid || !token) return fail(502, '扫码成功但未拿到登录凭证，请改用 Cookie');
    const cookie = mergeCookies(res.cookies || '', `userid=${userid}; token=${token}`);
    const nickname = String(data.nickname || data.nick_name || '酷狗用户').trim();
    const avatar = String(data.pic || data.photo || data.headimg || '').trim();
    const profile = await this.fetchProfile(userid, token, cookie).catch(() => null);
    this.write({
      cookie,
      userid,
      token,
      nickname: profile?.nickname || nickname,
      avatar: profile?.avatar || avatar,
      vip: profile?.vip ?? 0,
    });
    removeFile(this.qrFile);
    return ok({ status: 4, loggedIn: true, ...this.status() });
  }
}

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}
