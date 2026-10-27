import { join } from 'node:path';
import {
  createQishuiApi,
  createQishuiDeviceId,
  isQishuiDeviceId,
  isAccountId,
  type QishuiApi,
  type QishuiOperation,
  type QishuiParams,
  type QishuiSession,
} from 'qishui-music-api';
import { FileCache } from '../cache.ts';
import { readJson, removeFile, writeJson } from './session.ts';

interface DeviceFile {
  deviceId: string;
}

/** Folia 同款车机协议：抖音扫码拿 ticket，不用 Passport Cookie。 */
export class QishuiBridge {
  private readonly deviceFile: string;
  private readonly sessionFile: string;
  private readonly deviceId: string;
  private current: QishuiSession | null = null;
  private loaded = false;
  private revision = 0;
  private readonly api: QishuiApi;

  constructor(cache: FileCache) {
    const dir = cache.dir('qishui_auth');
    this.deviceFile = join(dir, 'device.json');
    this.sessionFile = join(dir, 'ticket-session.json');
    this.deviceId = this.loadDeviceId();
    const bridge = this;
    this.api = createQishuiApi({
      deviceId: this.deviceId,
      sessions: {
        deviceId: this.deviceId,
        get revision() {
          return bridge.revision;
        },
        get: () => bridge.getSession(),
        set: (value: QishuiSession) => bridge.setSession(value),
        clear: () => bridge.clearSession(),
      },
      log: (message: string) => console.info(message),
      warn: (message: string) => console.warn(message),
    });
  }

  loggedIn(): boolean {
    return Boolean(this.getSession()?.ticket);
  }

  user() {
    const session = this.getSession();
    if (!session?.user) return null;
    return {
      id: String(session.user.id || ''),
      nickname: String(session.user.nickname || '汽水音乐'),
      avatar: qishuiImage(session.user.avatar),
      vip: session.user.isVip ? 1 : 0,
    };
  }

  async request<T = unknown>(operation: QishuiOperation, params: QishuiParams = {}) {
    return this.api.request<T>(operation, params);
  }

  private loadDeviceId(): string {
    const saved = readJson<DeviceFile>(this.deviceFile);
    if (isQishuiDeviceId(saved?.deviceId)) return saved.deviceId;
    const deviceId = createQishuiDeviceId();
    writeJson(this.deviceFile, { deviceId });
    return deviceId;
  }

  private getSession(): QishuiSession | null {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const value = readJson<QishuiSession>(this.sessionFile);
        if (
          value
          && value.version === 1
          && isAccountId(value.userId)
          && value.ticket
          && value.guardKey
          && value.guardCert
          && value.guardTsSign
          && value.accessCode
          && Number.isFinite(value.expiresAt)
        ) {
          this.current = value;
        }
      } catch {
        this.current = null;
      }
    }
    return this.current;
  }

  private setSession(value: QishuiSession) {
    this.loaded = true;
    this.current = { ...value, version: 1 };
    this.revision += 1;
    writeJson(this.sessionFile, this.current);
  }

  private clearSession() {
    this.loaded = true;
    this.current = null;
    this.revision += 1;
    removeFile(this.sessionFile);
  }
}

export function qishuiImage(raw: unknown): string {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return /^https?:\/\//i.test(text) ? text : '';
  }
  if (!raw || typeof raw !== 'object') return '';
  const value = raw as Record<string, any>;
  const urls = Array.isArray(value.urls) ? value.urls : [];
  const url = urls.find((item: unknown) => typeof item === 'string' && /^https?:\/\//i.test(item));
  if (typeof url !== 'string' || !url) return '';
  if (value.uri && url.endsWith('/')) {
    const joined = `${url}${String(value.uri).replace(/^\//, '')}`;
    return value.template_prefix
      ? `${joined}~${value.template_prefix}-image.image`
      : joined.includes('~')
        ? joined
        : `${joined}~tplv-b829550vbb-1:1.jpeg`;
  }
  return url;
}

export function mapQishuiTrack(raw: any) {
  const track = raw?.track_entity || raw?.entity?.media?.track_entity || raw?.entity?.track || raw?.track || raw;
  const base = track?.base_info || {};
  const id = String(base.id || track?.id || '').trim();
  const title = String(base.name || track?.name || '').trim();
  if (!id || !title) return null;
  const related = track?.related_info || {};
  const artists = Array.isArray(related.artist_links) ? related.artist_links : [];
  const author = artists.map((item: any) => String(item?.name || '').trim()).filter(Boolean).join(' / ')
    || String(base.artist_name || '汽水音乐');
  return {
    type: 'qishui' as const,
    songid: id,
    title,
    author,
    pic: qishuiImage(track?.display_info?.cover_url || related.album_link?.url_cover),
    album: String(related.album_link?.name || ''),
    durationMs: Math.max(0, Number(base.duration_ms) || 0) || undefined,
  };
}

export function mapQishuiPlaylist(raw: any, index: number) {
  const base = raw?.base_info || {};
  const id = String(base.id || '').trim();
  const name = String(base.title || base.name || '').trim();
  if (!id || !name) return null;
  const owner = raw?.relation_info?.owner || {};
  return {
    id,
    name,
    cover: qishuiImage(raw?.display_info?.url_cover || base.url_cover),
    trackCount: Number(raw?.resource_cnt?.track_cnt || base.count_tracks || 0) || 0,
    order: index,
    ownerId: String(base.owner_id || owner.id || ''),
    createTime: Number(base.create_time || 0) || undefined,
  };
}
