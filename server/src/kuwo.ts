import { pickBestCrossPlayTrack } from './crossPlay.ts';
import type { Track } from './config.ts';
import { request } from './http.ts';
import { isBadMediaUrl, isKuwoTrialMediaUrl } from './util.ts';

/** bootstrap 不可达时的酷我回退；仅接受全曲，拒绝 ~11s 试听 */

function parseKuwoJsonp(body: string): any {
  const text = body.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
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

function pickFullPlayUrl(payload: any): string | null {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const duration = Number(data?.duration || 0);
  const bitrate = Number(data?.bitrate || 0);
  // 试听常见 duration=11、bitrate=1
  if (duration > 0 && duration <= 60) return null;
  if (bitrate > 0 && bitrate <= 1) return null;
  const url = String(data?.url || payload?.url || '');
  if (!url || isBadMediaUrl(url) || isKuwoTrialMediaUrl(url)) return null;
  return url.replace(/^http:\/\//i, 'https://');
}

export async function kuwoPlayUrl(rid: string): Promise<string | null> {
  const id = kuwoRid(rid);
  if (!id) return null;

  const sources = [
    'kwplayer_ar_5.1.0.0_B_jiakong_vh.apk',
    'kwplayer_ar_1.1.9_oppo_118980_320.apk',
    'jiakong',
  ];
  for (const source of sources) {
    for (const br of ['320kmp3', '128kmp3']) {
      try {
        const res = await request(
          'GET',
          `https://mobi.kuwo.cn/mobi.s?${new URLSearchParams({
            f: 'web',
            source,
            type: 'convert_url_with_sign',
            rid: id,
            br,
          })}`,
          { timeoutMs: 8_000, headers: { 'User-Agent': 'okhttp/3.10.0' } },
        );
        const hit = pickFullPlayUrl(res.json) || pickFullPlayUrl(parseKuwoJsonp(res.body));
        if (hit) return hit;
      } catch {
        // try next
      }
    }
  }

  // antiserver 对 VIP 几乎总是试听，仅在确认非试听路径时采用
  try {
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
    else url = String(parseKuwoJsonp(res.body)?.url || '');
    if (url && !isBadMediaUrl(url) && !isKuwoTrialMediaUrl(url)) {
      return url.replace(/^http:\/\//i, 'https://');
    }
  } catch {
    // ignore
  }
  return null;
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
