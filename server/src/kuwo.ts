import { pickBestCrossPlayTrack } from './crossPlay.ts';
import type { Track } from './config.ts';
import { request } from './http.ts';
import { isBadMediaUrl } from './util.ts';

/** Vercel 等海外节点无法访问 90svip 时，用酷我按歌名匹配取流（与 bootstrap 解锁同源） */

function parseKuwoJsonp(body: string): any {
  const text = body.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      // search.kuwo.cn 返回单引号伪 JSON
      return new Function(`"use strict"; return (${text});`)();
    } catch {
      return null;
    }
  }
}

function kuwoRid(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const digits = value.replace(/^MUSIC_/i, '');
  return /^\d+$/.test(digits) ? digits : null;
}

export async function kuwoSearchTracks(query: string, limit = 8): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await request(
    'GET',
    `https://search.kuwo.cn/r.s?${new URLSearchParams({
      all: q,
      ft: 'music',
      client: 'kt',
      pn: '0',
      rn: String(Math.min(Math.max(limit, 1), 20)),
      rformat: 'json',
      encoding: 'utf8',
      vipver: '1',
    })}`,
    { timeoutMs: 8_000 },
  );
  const json = (res.json && Array.isArray(res.json.abslist))
    ? res.json
    : parseKuwoJsonp(res.body);
  const list = Array.isArray(json?.abslist) ? json.abslist : [];
  const out: Track[] = [];
  for (const item of list) {
    const rid = kuwoRid(item.DC_TARGETID || item.MUSICRID || item.rid);
    if (!rid) continue;
    out.push({
      type: 'netease',
      songid: rid,
      title: String(item.NAME || item.SONGNAME || '').replace(/&nbsp;/g, ' ').trim() || '未知曲目',
      author: String(item.ARTIST || '').replace(/&nbsp;/g, ' ').trim() || '未知艺人',
      link: `https://www.kuwo.cn/play_detail/${rid}`,
      pic: '',
      album: String(item.ALBUM || '').replace(/&nbsp;/g, ' ').trim(),
      durationMs: (Number(item.DURATION || item.duration || 0) || 0) * 1000,
      lrc: '',
      url: '',
    });
  }
  return out;
}

export async function kuwoPlayUrl(rid: string): Promise<string | null> {
  const id = kuwoRid(rid);
  if (!id) return null;
  const res = await request(
    'GET',
    `https://antiserver.kuwo.cn/anti.s?${new URLSearchParams({
      type: 'convert_url3',
      rid: `MUSIC_${id}`,
      format: 'mp3',
      response: 'url',
      httpsStatus: '1',
    })}`,
    { timeoutMs: 8_000 },
  );
  let url = '';
  if (res.json?.url) url = String(res.json.url);
  else if (/^https?:\/\//i.test(res.body.trim())) url = res.body.trim();
  else {
    const parsed = parseKuwoJsonp(res.body);
    url = String(parsed?.url || '');
  }
  if (!url || isBadMediaUrl(url)) return null;
  return url;
}

export async function kuwoMatchPlayUrl(title: string, artist = ''): Promise<string | null> {
  const query = [title, artist].filter(Boolean).join(' ').trim();
  if (!query) return null;
  const tracks = await kuwoSearchTracks(query, 8);
  if (!tracks.length) return null;
  const best =
    pickBestCrossPlayTrack({ title, artist }, tracks, 'strict')
    || (artist.trim() ? pickBestCrossPlayTrack({ title, artist }, tracks, 'titleOnly') : null);
  if (!best?.songid) return null;
  return kuwoPlayUrl(best.songid);
}
