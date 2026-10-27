import { FileCache } from '../cache.ts';
import { mapQishuiPlaylist, mapQishuiTrack, QishuiBridge } from './qishuiBridge.ts';

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}

function loginMessage(error: { code?: string; message?: string; stage?: string } | undefined) {
  if (!error) return '汽水登录失败';
  if (error.stage === 'access-code') return '抖音已确认，但汽水授权码交换失败，请重试';
  if (error.stage === 'ticket') return '汽水登录票据获取失败，请重试';
  if (error.stage === 'account') return '汽水账号信息读取失败，请重试';
  if (error.code === 'network') return '无法连接汽水登录服务，请检查网络';
  if (error.code === 'unavailable') return '登录已取消或过期，请关闭后重开';
  return error.message || '汽水登录失败';
}

/** 汽水账号：Folia 同款抖音 Open OAuth + 车机 ticket，不再走 Passport Cookie 扫码。 */
export class QishuiAccount {
  private readonly bridge: QishuiBridge;

  constructor(cache: FileCache) {
    this.bridge = new QishuiBridge(cache);
  }

  /** 兼容旧调用点；票证登录没有 Cookie。 */
  sessionCookie(): string | null {
    return null;
  }

  loggedIn(): boolean {
    return this.bridge.loggedIn();
  }

  async resolvePlayUrl(id: string): Promise<string | null> {
    if (!this.bridge.loggedIn()) return null;
    const trackId = String(id || '').trim();
    if (!/^\d{1,30}$/.test(trackId)) return null;
    const result = await this.bridge.request<{ url?: string }>('audio', {
      id: trackId,
      quality: 'standard',
    });
    if (!result.ok) return null;
    const url = String(result.data?.url || '').trim();
    return /^https?:\/\//i.test(url) ? url : null;
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'qishui_status':
        return ok(this.status());
      case 'qishui_logout':
        await this.bridge.request('logout');
        return ok({ ok: true });
      case 'qishui_cookie_save':
        return fail(400, '汽水现已改为抖音扫码登录，请关掉改用 Cookie，直接扫码');
      case 'qishui_qr_key':
        return this.qrKey();
      case 'qishui_qr_check':
        return this.qrCheck(post.key || '');
      case 'qishui_qr_cancel':
        return this.qrCancel(post.key || '');
      case 'qishui_playlists':
        return this.playlists();
      case 'qishui_playlist_detail':
        return this.playlistDetail(post.id || '', Number(post.offset || 0), Number(post.limit || 80), post.ownerId || '');
      case 'qishui_recommend_feed':
        return this.recommendFeed();
      case 'qishui_recent_songs':
        return this.recentSongs();
      default:
        return fail(400, '未知操作');
    }
  }

  private status() {
    if (!this.bridge.loggedIn()) return { loggedIn: false };
    const user = this.bridge.user();
    return {
      loggedIn: true,
      nickname: user?.nickname || '汽水音乐',
      avatar: user?.avatar || '',
      vip: user?.vip || 0,
    };
  }

  private async qrKey() {
    const keyResult = await this.bridge.request<{ key: string }>('login_qr_key');
    if (!keyResult.ok) return fail(502, loginMessage(keyResult.error));
    const key = String(keyResult.data?.key || '');
    if (!key) return fail(502, '无法获取汽水二维码');
    const imageResult = await this.bridge.request<{ imageUrl: string }>('login_qr_create', { key });
    if (!imageResult.ok) return fail(502, loginMessage(imageResult.error));
    const qrimg = String(imageResult.data?.imageUrl || '');
    if (!qrimg.startsWith('data:image/')) return fail(502, '汽水二维码图片无效');
    return ok({ key, qrimg });
  }

  private async qrCheck(key: string) {
    const token = String(key || '').trim();
    if (!/^[a-f0-9]{32}$/.test(token)) return fail(400, '缺少二维码 key');
    const result = await this.bridge.request<{ state?: string; failure?: { case?: string } }>('login_qr_check', { key: token });
    if (!result.ok) {
      if (result.error?.code === 'unavailable') {
        return ok({ status: 800, message: '二维码已过期，请关闭后重开' });
      }
      return fail(502, loginMessage(result.error));
    }
    const state = String(result.data?.state || '');
    if (state === 'waiting' || state === 'new') {
      return ok({ status: 801, message: '等待扫码…' });
    }
    if (state === 'scanned') {
      return ok({ status: 802, message: '已扫码，请在抖音上确认授权' });
    }
    if (state === 'expired') {
      return ok({ status: 800, message: '二维码已过期，请关闭后重开' });
    }
    if (state === 'error' || result.data?.failure?.case === 'refused') {
      return ok({ status: 800, message: '已拒绝授权，请关闭后重开' });
    }
    if (state === 'confirmed') {
      return ok({ status: 803, message: '登录成功', ...this.status(), loggedIn: true });
    }
    return ok({ status: 801, message: '等待扫码…' });
  }

  private async qrCancel(key: string) {
    const token = String(key || '').trim();
    if (/^[a-f0-9]{32}$/.test(token)) {
      await this.bridge.request('login_qr_cancel', { key: token });
    }
    return ok({ ok: true });
  }

  private async playlists() {
    if (!this.bridge.loggedIn()) return fail(401, '未登录汽水');
    const status = await this.bridge.request('login_status');
    if (!status.ok) return fail(401, '未登录汽水');
    const result = await this.bridge.request<{ items?: any[]; total?: number }>('user_playlists', {
      limit: 80,
      offset: 0,
    });
    if (!result.ok) return fail(502, result.error?.message || '无法读取汽水歌单');
    const playlists = (result.data?.items || [])
      .map((item: any, index: number) => mapQishuiPlaylist(item, index))
      .filter(Boolean);
    const user = this.bridge.user();
    return ok({ playlists, nickname: user?.nickname || '汽水音乐' });
  }

  private async playlistDetail(id: string, offset = 0, limit = 80, ownerId = '') {
    if (!this.bridge.loggedIn()) return fail(401, '未登录汽水');
    const playlistId = String(id || '').trim();
    if (!playlistId) return fail(400, '缺少歌单 id');
    if (playlistId === '__qishui_recent__') return this.recentSongs();
    const pageSize = Math.min(100, Math.max(1, limit || 80));
    const start = Math.max(0, offset || 0);
    const result = await this.bridge.request<{
      items?: any[];
      collection?: any;
      hasMore?: boolean;
      nextOffset?: number;
    }>('playlist_tracks', {
      id: playlistId,
      ownerId: String(ownerId || '').trim(),
      limit: pageSize,
      offset: start,
    });
    if (!result.ok) return fail(502, result.error?.message || '无法读取汽水歌单歌曲');
    const collection = result.data?.collection || {};
    const mapped = mapQishuiPlaylist(collection, 0);
    const tracks = (result.data?.items || []).map((item: any) => mapQishuiTrack(item)).filter(Boolean);
    return ok({
      id: playlistId,
      playlistId,
      name: mapped?.name || String(collection?.base_info?.title || '汽水歌单'),
      cover: mapped?.cover || '',
      ownerId: mapped?.ownerId || ownerId,
      total: Number(collection?.resource_cnt?.track_cnt || tracks.length) || tracks.length,
      tracks,
      hasMore: Boolean(result.data?.hasMore),
      nextOffset: Number(result.data?.nextOffset || start + tracks.length),
    });
  }

  private async recentSongs() {
    if (!this.bridge.loggedIn()) return fail(401, '未登录汽水');
    const result = await this.bridge.request<{ items?: any[] }>('recent_played', {
      limit: 50,
      offset: 0,
    });
    if (!result.ok) return fail(502, result.error?.message || '无法读取最近播放');
    const tracks = (result.data?.items || []).map((item: any) => mapQishuiTrack(item)).filter(Boolean);
    return ok({
      id: '__qishui_recent__',
      playlistId: '__qishui_recent__',
      name: '最近播放',
      cover: tracks[0]?.pic || '',
      total: tracks.length,
      tracks,
    });
  }

  private async recommendFeed() {
    if (!this.bridge.loggedIn()) return fail(401, '未登录汽水');
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
}
