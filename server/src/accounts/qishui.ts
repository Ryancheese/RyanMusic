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
      case 'qishui_personal_fm':
        return this.personalFm(
          post.scene || '',
          post.preference || '',
          Number(post.limit || 20),
          post.first !== '0' && post.first !== 'false',
        );
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
    let playlists = (result.data?.items || [])
      .map((item: any, index: number) => mapQishuiPlaylist(item, index))
      .filter(Boolean) as Array<{ id: string; cover?: string; ownerId?: string; [key: string]: unknown }>;
    const missing = playlists.filter((item) => item?.id && !String(item.cover || '').trim()).slice(0, 24);
    if (missing.length) {
      const covers = await this.playlistFirstTrackCovers(missing);
      playlists = playlists.map((item) => (
        String(item.cover || '').trim()
          ? item
          : { ...item, cover: covers.get(String(item.id)) || '' }
      ));
    }
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
    const cover = mapped?.cover || tracks[0]?.pic || '';
    return ok({
      id: playlistId,
      playlistId,
      name: mapped?.name || String(collection?.base_info?.title || '汽水歌单'),
      cover,
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
    const [recent, library, modes, fmPreview] = await Promise.all([
      this.recentSongs().catch(() => ok({ tracks: [] as any[] })),
      this.playlists().catch(() => ok({ playlists: [] as any[] })),
      this.bridge.request<Array<{ id: string; name: string; group: string; coverUrl?: unknown }>>('feed_modes')
        .catch(() => ({ ok: false as const, error: { code: 'network' as const, message: '' }, data: undefined })),
      this.bridge.request<{ items?: any[] }>('feed', { queue: 'fm', first: true, limit: 1 })
        .catch(() => ({ ok: false as const, error: { code: 'network' as const, message: '' }, data: undefined })),
    ]);
    const items: Array<Record<string, unknown>> = [];
    const recentTracks = Array.isArray((recent as any).data?.tracks) ? (recent as any).data.tracks : [];
    const fmCover = fmPreview.ok
      ? (mapQishuiTrack((fmPreview.data?.items || [])[0])?.pic || '')
      : '';
    items.push({
      id: '__qishui_fm__',
      name: '汽水电台',
      description: '根据口味无限续播',
      cover: fmCover || recentTracks[0]?.pic || '',
      trackCount: 0,
      recommendKind: 'fm',
    });
    if (recentTracks.length) {
      items.push({
        id: '__qishui_recent__',
        name: '最近播放',
        description: '你最近听过的歌',
        cover: recentTracks[0]?.pic || '',
        trackCount: recentTracks.length,
        recommendKind: 'daily',
      });
    }

    const scenes = modes.ok && Array.isArray(modes.data)
      ? modes.data.filter((row) => /^\d+$/.test(String(row?.id || '')) && String(row?.name || '').trim())
      : [];
    // 场景封面留给前端用首曲补；这里不再串行拉 feed，避免推荐接口卡死在加载态。
    for (const scene of scenes.slice(0, 28)) {
      const sceneId = String(scene.id);
      items.push({
        id: `scene-${sceneId}`,
        name: String(scene.name || '').trim() || `场景 ${sceneId}`,
        description: String(scene.group || '场景音乐').trim() || '场景音乐',
        cover: '',
        trackCount: 0,
        recommendKind: 'radio',
        sceneId,
      });
    }

    const playlists = Array.isArray((library as any).data?.playlists) ? (library as any).data.playlists : [];
    for (const playlist of playlists.slice(0, 20)) {
      items.push({
        ...playlist,
        cover: String(playlist.cover || '').trim(),
        recommendKind: 'playlist',
      });
    }
    return ok({ items });
  }

  /** 私人 FM / 场景电台：返回可直接开播的曲目列表。 */
  private async personalFm(scene = '', preference = '', limit = 20, first = true) {
    if (!this.bridge.loggedIn()) return fail(401, '未登录汽水');
    const pageSize = Math.min(40, Math.max(1, limit || 20));
    const sceneId = String(scene || '').trim();
    const pref = String(preference || '').trim();
    const params: Record<string, string | number | boolean> = {
      queue: 'fm',
      first: first !== false,
      limit: pageSize,
    };
    if (sceneId && /^\d+$/.test(sceneId)) params.scene = sceneId;
    else if (pref === 'familiar' || pref === 'fresh') params.preference = pref;
    const result = await this.bridge.request<{ items?: any[]; hasMore?: boolean }>('feed', params);
    if (!result.ok) return fail(502, result.error?.message || '无法拉取汽水电台');
    const tracks = (result.data?.items || []).map((item: any) => mapQishuiTrack(item)).filter(Boolean);
    return ok({
      id: sceneId ? `scene-${sceneId}` : '__qishui_fm__',
      name: sceneId ? '场景电台' : '汽水电台',
      cover: tracks[0]?.pic || '',
      total: tracks.length,
      tracks,
      hasMore: Boolean(result.data?.hasMore),
      sceneId: sceneId || undefined,
    });
  }

  private async sceneFirstTrackCovers(sceneIds: string[]): Promise<Map<string, string>> {
    const covers = new Map<string, string>();
    const queue = [...sceneIds];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const sceneId = queue.shift();
        if (!sceneId) break;
        try {
          const result = await this.bridge.request<{ items?: any[] }>('feed', {
            queue: 'fm',
            scene: sceneId,
            first: true,
            limit: 1,
          });
          if (!result.ok) continue;
          const pic = mapQishuiTrack((result.data?.items || [])[0])?.pic || '';
          if (pic) covers.set(sceneId, pic);
        } catch {
          // skip
        }
      }
    });
    await Promise.all(workers);
    return covers;
  }

  private async playlistFirstTrackCovers(
    playlists: Array<{ id?: string; ownerId?: string }>,
  ): Promise<Map<string, string>> {
    const covers = new Map<string, string>();
    const queue = [...playlists];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        const id = String(item?.id || '').trim();
        if (!id) continue;
        try {
          const result = await this.bridge.request<{ items?: any[] }>('playlist_tracks', {
            id,
            ownerId: String(item?.ownerId || '').trim(),
            limit: 1,
            offset: 0,
          });
          if (!result.ok) continue;
          const pic = mapQishuiTrack((result.data?.items || [])[0])?.pic || '';
          if (pic) covers.set(id, pic);
        } catch {
          // skip
        }
      }
    });
    await Promise.all(workers);
    return covers;
  }
}
