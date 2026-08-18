import { FileCache } from './cache.ts';
import { qrcPlainOrDecrypt, looksLikeQrc } from './crypto/qrcDecrypt.ts';
import { eapiRequest } from './crypto/netease.ts';
import { NeteaseService } from './netease.ts';
import { QqService } from './qq.ts';
import { decodeEntities, neteaseLyricText, pickRicherLyric, timedLyricScore } from './util.ts';

export interface LyricBundle {
  lrc: string;
  yrc: string;
  tlyric: string;
}

export class LyricsService {
  constructor(
    private readonly cache: FileCache,
    private readonly netease: NeteaseService,
    private readonly qq: QqService,
    private readonly neteaseCookie: () => string | null,
    private readonly qqCookie: () => string | null,
  ) {}

  async fetch(type: 'netease' | 'qq', id: string): Promise<LyricBundle> {
    if (type === 'qq') return this.fetchQq(id);
    return this.fetchNetease(id);
  }

  private readCache(bucket: string, key: string): LyricBundle | null {
    const data = this.cache.read<{ lyrics?: LyricBundle; expires?: number }>(bucket, key);
    if (!data?.lyrics || !data.expires || data.expires < Date.now() / 1000) return null;
    return data.lyrics;
  }

  private writeCache(bucket: string, key: string, lyrics: LyricBundle, ttlSec: number): void {
    this.cache.write(bucket, key, { lyrics, expires: Math.floor(Date.now() / 1000) + ttlSec });
  }

  private async fetchNetease(songid: string): Promise<LyricBundle> {
    const cookie = this.neteaseCookie() || '';
    const bucket = cookie ? 'netease_lyric_auth_v2' : 'netease_lyric_v2';
    const cached = this.readCache(bucket, songid);
    if (cached && timedLyricScore(cached.lrc) + timedLyricScore(cached.yrc) > 0) return cached;

    let official: any = null;
    if (cookie) {
      const res = await eapiRequest(
        '/api/song/lyric/v1',
        {
          id: Number(songid),
          cp: false,
          tv: 0,
          lv: 0,
          rv: 0,
          kv: 0,
          yv: 0,
          ytv: 0,
          yrv: 0,
        },
        cookie,
      );
      if (res.json && (res.json.lrc || res.json.yrc)) official = res.json;
    }
    const anonymous = await this.netease.fetchLyric(songid, cookie);

    const lyrics: LyricBundle = {
      lrc: pickRicherLyric(neteaseLyricText(official, 'lrc'), neteaseLyricText(anonymous, 'lrc')),
      yrc: pickRicherLyric(neteaseLyricText(official, 'yrc'), neteaseLyricText(anonymous, 'yrc')),
      tlyric: pickRicherLyric(neteaseLyricText(official, 'tlyric'), neteaseLyricText(anonymous, 'tlyric')),
    };
    if (timedLyricScore(lyrics.lrc) + timedLyricScore(lyrics.yrc) > 0) {
      this.writeCache(bucket, songid, lyrics, cookie ? 1800 : 3600);
    }
    return lyrics;
  }

  private async fetchQq(songmid: string): Promise<LyricBundle> {
    const cached = this.readCache('qq_lyric_v2', songmid);
    if (cached && timedLyricScore(cached.lrc) + timedLyricScore(cached.yrc) > 0) return cached;

    const cookie = this.qqCookie() || 'tmeLoginType=-1;';
    const songId = await this.qq.songNumericId(songmid);
    let yrc = '';
    let tlyric = '';
    let lrc = '';

    if (songId > 0) {
      const data = await this.qq.playLyricInfo(songmid, songId, cookie);
      if (data?.lyric) {
        yrc = qrcPlainOrDecrypt(String(data.lyric));
        if (data.trans) tlyric = qrcPlainOrDecrypt(String(data.trans));
      }
    }

    const line = await this.qq.fetchLyric(songmid);
    if (line.lyric) lrc = decodeEntities(String(line.lyric));
    if (!tlyric && line.trans) tlyric = decodeEntities(String(line.trans));

    if (yrc && !looksLikeQrc(yrc)) {
      if (!lrc) lrc = yrc;
      yrc = '';
    }

    const lyrics = { lrc, yrc, tlyric };
    if (timedLyricScore(yrc) + timedLyricScore(lrc) > 0) this.writeCache('qq_lyric_v2', songmid, lyrics, 3600);
    return lyrics;
  }
}
