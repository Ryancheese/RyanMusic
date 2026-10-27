import { FileCache } from '../cache.ts';
import { SpotifyBridge, SPOTIFY_LIKED_ID } from './spotify/bridge.ts';

function ok(data: unknown) {
  return { code: 200, error: '', data };
}

function fail(code: number, error: string, data: unknown = '') {
  return { code, error, data };
}

function loginMessage(error: { code?: string; message?: string; reason?: string } | undefined) {
  if (!error) return 'Spotify 登录失败';
  if (error.reason === 'cannot-listen') return '无法占用本机登录端口，请关闭占用 5588 的程序后重试';
  if (error.reason === 'access-denied' || error.code === 'auth-required') return '未授权 Spotify，请重试';
  if (error.reason === 'account-not-read') return 'Spotify 已授权，但账号信息读取失败，请重试';
  if (error.code === 'network') return '无法连接 Spotify，请检查网络';
  if (error.code === 'unavailable') return '登录已取消或过期，请重试';
  return error.message || 'Spotify 登录失败';
}

/** Spotify 账号：Folia 同款浏览器 PKCE 登录 + Pathfinder 歌单。 */
export class SpotifyAccount {
  private readonly bridge: SpotifyBridge;

  constructor(cache: FileCache) {
    this.bridge = new SpotifyBridge(cache);
  }

  loggedIn() {
    return this.bridge.loggedIn();
  }

  async handle(action: string, post: Record<string, string>) {
    switch (action) {
      case 'spotify_status':
        return ok(this.status());
      case 'spotify_logout':
        await this.bridge.request('logout');
        return ok({ ok: true });
      case 'spotify_login_start':
        return this.loginStart();
      case 'spotify_login_open':
        return this.loginOpen(post.key || '');
      case 'spotify_login_check':
        return this.loginCheck(post.key || '');
      case 'spotify_login_cancel':
        return this.loginCancel(post.key || '');
      case 'spotify_playlists':
        return this.playlists();
      case 'spotify_playlist_detail':
        return this.playlistDetail(post.id || '', Number(post.offset || 0), Number(post.limit || 80));
      case 'spotify_recommend_feed':
        return this.recommendFeed();
      case 'spotify_recent_songs':
        return fail(400, 'Spotify 暂不提供最近播放列表');
      default:
        return fail(400, '未知操作');
    }
  }

  private status() {
    if (!this.bridge.loggedIn()) return { loggedIn: false };
    const user = this.bridge.user();
    return {
      loggedIn: true,
      nickname: user?.nickname || 'Spotify',
      avatar: user?.avatar || '',
      vip: user?.vip || 0,
    };
  }

  private async loginStart() {
    const result = await this.bridge.request<{ key: string; expiresInMs: number }>('login_start');
    if (!result.ok) return fail(502, loginMessage(result.error));
    const key = String(result.data?.key || '');
    if (!key) return fail(502, '无法开始 Spotify 登录');
    return ok({ key, expiresInMs: Number(result.data?.expiresInMs || 0) });
  }

  private async loginOpen(key: string) {
    const token = String(key || '').trim();
    if (!token) return fail(400, '缺少登录 key');
    const result = await this.bridge.request<boolean>('login_open', { key: token });
    if (!result.ok) return fail(502, loginMessage(result.error));
    return ok({ opened: Boolean(result.data) });
  }

  private async loginCheck(key: string) {
    const token = String(key || '').trim();
    if (!/^[a-f0-9]{32}$/.test(token)) return fail(400, '缺少登录 key');
    const result = await this.bridge.request<{ state?: string; message?: string }>('login_check', { key: token });
    if (!result.ok) return fail(502, loginMessage(result.error));
    const state = String(result.data?.state || '');
    if (state === 'waiting') return ok({ status: 801, message: '请在浏览器完成 Spotify 授权…' });
    if (state === 'expired') return ok({ status: 800, message: '登录已过期，请重试' });
    if (state === 'error') {
      return ok({
        status: 800,
        message: loginMessage({ reason: result.data?.message, message: result.data?.message }),
      });
    }
    if (state === 'confirmed') {
      return ok({ status: 803, message: '登录成功', ...this.status(), loggedIn: true });
    }
    if (state === 'approved') return ok({ status: 801, message: '正在读取账号…' });
    return ok({ status: 801, message: '请在浏览器完成 Spotify 授权…' });
  }

  private async loginCancel(key: string) {
    const token = String(key || '').trim();
    if (token) await this.bridge.request('login_cancel', { key: token });
    return ok({ ok: true });
  }

  private async playlists() {
    if (!this.bridge.loggedIn()) return fail(401, '未登录 Spotify');
    const result = await this.bridge.request<{ items?: any[]; total?: number }>('user_playlists', {
      limit: 80,
      offset: 0,
    });
    if (!result.ok) return fail(502, result.error?.message || '无法读取 Spotify 歌单');
    const playlists = (result.data?.items || []).filter(Boolean);
    const user = this.bridge.user();
    return ok({ playlists, nickname: user?.nickname || 'Spotify' });
  }

  private async playlistDetail(id: string, offset = 0, limit = 80) {
    if (!this.bridge.loggedIn()) return fail(401, '未登录 Spotify');
    const playlistId = String(id || '').trim();
    if (!playlistId) return fail(400, '缺少歌单 id');
    const result = await this.bridge.request<{
      id?: string;
      name?: string;
      cover?: string;
      total?: number;
      tracks?: any[];
      hasMore?: boolean;
      nextOffset?: number;
    }>('playlist_tracks', { id: playlistId, offset, limit });
    if (!result.ok) return fail(502, result.error?.message || '无法读取 Spotify 歌单歌曲');
    return ok({
      id: result.data?.id || playlistId,
      playlistId: result.data?.id || playlistId,
      name: result.data?.name || (playlistId === SPOTIFY_LIKED_ID ? '已点赞的歌曲' : 'Spotify'),
      cover: result.data?.cover || '',
      total: Number(result.data?.total || 0),
      tracks: result.data?.tracks || [],
      hasMore: Boolean(result.data?.hasMore),
      nextOffset: Number(result.data?.nextOffset || offset),
    });
  }

  private async recommendFeed() {
    if (!this.bridge.loggedIn()) return fail(401, '未登录 Spotify');
    const library = await this.playlists().catch(() => ok({ playlists: [] }));
    const playlists = Array.isArray((library as any).data?.playlists) ? (library as any).data.playlists : [];
    const items = playlists.slice(0, 16).map((playlist: any) => ({
      ...playlist,
      recommendKind: 'playlist',
    }));
    return ok({ items });
  }
}
