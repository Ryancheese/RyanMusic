import { FileCache } from './cache.ts';
import { qrcPlainOrDecrypt, looksLikeQrc } from './crypto/qrcDecrypt.ts';
import { eapiRequest } from './crypto/netease.ts';
import { NeteaseService } from './netease.ts';
import { QqService } from './qq.ts';
import { request } from './http.ts';
import { decodeEntities, neteaseLyricText, pickRicherLyric, timedLyricScore } from './util.ts';

export type LyricProviderSource = 'netease' | 'qq' | 'kugou' | 'amll';

export interface LyricBundle {
  lrc: string;
  yrc: string;
  tlyric: string;
  source?: LyricProviderSource | 'native';
}

const EMPTY_LYRICS: LyricBundle = { lrc: '', yrc: '', tlyric: '' };
const BASE_LYRIC_SOURCE_ORDER: readonly LyricProviderSource[] = ['netease', 'amll', 'qq', 'kugou'];
const AUTO_MATCH_MIN_SCORE = 75;
const AUTO_MATCH_SEARCH_LIMIT = 8;

function scoreBundle(lyrics: LyricBundle): number {
  return timedLyricScore(lyrics.yrc) + timedLyricScore(lyrics.lrc);
}

/** 行覆盖度：避免「逐字很少但分数虚高」压过更完整的逐行 */
function coverageScore(lyrics: LyricBundle): number {
  const yrcLines = (lyrics.yrc.match(/\[\d+,\d+\]/g) || []).length;
  const lrcLines = (lyrics.lrc.match(/\[\d{2}:\d{2}/g) || []).length;
  return yrcLines * 8 + lrcLines * 10 + scoreBundle(lyrics) * 0.15;
}

function withSource(lyrics: LyricBundle, source: LyricProviderSource | 'native'): LyricBundle {
  return { ...lyrics, source };
}

function isWordByWord(lyrics: LyricBundle): boolean {
  return timedLyricScore(lyrics.yrc) > 0;
}

function pickBetterLyrics(a: LyricBundle, b: LyricBundle): LyricBundle {
  const aWord = isWordByWord(a);
  const bWord = isWordByWord(b);
  const aCov = coverageScore(a);
  const bCov = coverageScore(b);
  // 逐字优先：另一份只有更完整很多时才压过逐字
  if (aWord && !bWord) {
    return bCov > aCov * 1.45 ? b : a;
  }
  if (bWord && !aWord) {
    return aCov > bCov * 1.45 ? a : b;
  }
  return aCov >= bCov ? a : b;
}

function buildLyricSourceOrder(preferred: LyricProviderSource): LyricProviderSource[] {
  return [preferred, ...BASE_LYRIC_SOURCE_ORDER.filter((source) => source !== preferred)];
}

function normalizeMatchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\(\[（【].*?[\)\]）】]/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  const n1 = normalizeMatchText(a);
  const n2 = normalizeMatchText(b);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) {
    return Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
  }
  const set1 = new Set(n1);
  const set2 = new Set(n2);
  let intersection = 0;
  for (const ch of set1) if (set2.has(ch)) intersection += 1;
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0;
}

function artistSimilarity(target: string, search: string): number {
  const split = (value: string) => value
    .split(/[,&、/]|feat\.?|ft\.?|featuring|与/i)
    .map((part) => normalizeMatchText(part))
    .filter(Boolean);
  const left = split(target);
  const right = split(search);
  if (!left.length || !right.length) return stringSimilarity(target, search);
  let hits = 0;
  for (const a of left) {
    if (right.some((b) => a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b)))) {
      hits += 1;
    }
  }
  return Math.max(hits / Math.max(left.length, right.length), stringSimilarity(target, search));
}

function scoreCandidate(
  target: { title: string; artist: string; durationMs?: number },
  candidate: { title: string; author: string; durationMs?: number },
): { score: number; titleMatched: boolean; artistMatched: boolean } {
  const titleSim = stringSimilarity(target.title, candidate.title);
  const artistSim = target.artist.trim()
    ? artistSimilarity(target.artist, candidate.author)
    : 1;
  let identity = titleSim * 45 + artistSim * 25 + 30;
  const titleMatched = titleSim >= 0.65;
  const artistMatched = !target.artist.trim() || artistSim >= 0.5;
  if (!titleMatched || !artistMatched) identity = Math.min(identity, 74);

  let durationMul = 0.9;
  if (target.durationMs && target.durationMs > 0 && candidate.durationMs && candidate.durationMs > 0) {
    const diff = Math.abs(target.durationMs - candidate.durationMs);
    if (diff <= 1000) durationMul = 1;
    else if (diff <= 3000) durationMul = 0.95;
    else if (diff <= 5000) durationMul = 0.75;
    else if (diff <= 10000) durationMul = 0.35;
    else durationMul = 0.1;
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(identity * durationMul))),
    titleMatched,
    artistMatched,
  };
}

function pickBestSearchTrack(
  target: { title: string; artist: string; durationMs?: number },
  tracks: Array<{ songid: string; title: string; author: string }>,
): { songid: string; title: string; author: string } | null {
  const scored = tracks
    .slice(0, AUTO_MATCH_SEARCH_LIMIT)
    .map((track) => ({ track, details: scoreCandidate(target, track) }))
    .sort((a, b) => b.details.score - a.details.score);
  const best = scored.find((item) => item.details.titleMatched && item.details.artistMatched)
    ?? scored[0];
  if (!best) return null;
  if (!best.details.titleMatched || !best.details.artistMatched) return null;
  if (best.details.score < AUTO_MATCH_MIN_SCORE) return null;
  return best.track;
}

function ttmlToLrc(ttml: string): string {
  const lines: string[] = [];
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(ttml))) {
    const attrs = match[1] || '';
    const begin = attrs.match(/\bbegin="([^"]+)"/i)?.[1] || '';
    const text = match[2]
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    const ms = parseTtmlTime(begin);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = ms % 1000;
    lines.push(`[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(3, '0')}]${text}`);
  }
  return lines.join('\n');
}

function parseTtmlTime(value: string): number {
  const clock = value.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/);
  if (clock) {
    const hasHours = clock[3] != null;
    const hours = hasHours ? Number(clock[1]) : 0;
    const minutes = hasHours ? Number(clock[2]) : Number(clock[1]);
    const seconds = hasHours ? Number(clock[3]) : Number(clock[2]);
    const frac = clock[4] ? Number(`0.${clock[4]}`) : 0;
    return ((hours * 60 + minutes) * 60 + seconds + frac) * 1000;
  }
  const seconds = Number(value.replace(/s$/i, ''));
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
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

  async match(options: {
    preferred: LyricProviderSource;
    title: string;
    artist: string;
    durationMs?: number;
    autoUseBest?: boolean;
    forceSource?: boolean;
    nativeType?: 'netease' | 'qq';
    nativeId?: string;
  }): Promise<LyricBundle> {
    if (options.forceSource) {
      const forced = await this.fetchPreferred(options).catch(() => EMPTY_LYRICS);
      return withSource(forced, options.preferred);
    }

    if (options.autoUseBest) {
      const best = await this.matchBest(options).catch(() => null);
      if (best && scoreBundle(best) > 0) {
        const native = options.nativeType && options.nativeId
          ? await this.fetch(options.nativeType, options.nativeId).catch(() => EMPTY_LYRICS)
          : EMPTY_LYRICS;
        const chosen = pickBetterLyrics(best, withSource(native, options.nativeType || 'native'));
        return chosen.source ? chosen : withSource(chosen, options.preferred);
      }
    }

    const native = options.nativeType && options.nativeId
      ? await this.fetch(options.nativeType, options.nativeId).catch(() => EMPTY_LYRICS)
      : EMPTY_LYRICS;
    const preferred = await this.fetchPreferred(options).catch(() => EMPTY_LYRICS);
    const taggedNative = withSource(native, options.nativeType || 'native');
    const taggedPreferred = withSource(preferred, options.preferred);
    if (scoreBundle(preferred) <= 0 && scoreBundle(native) <= 0) {
      return taggedNative;
    }
    if (scoreBundle(preferred) <= 0) return taggedNative;
    if (scoreBundle(native) <= 0) return taggedPreferred;
    return pickBetterLyrics(taggedPreferred, taggedNative);
  }

  /**
   * 按优先级扫各源，最终取「覆盖度更高」的一份（更完整优先于短逐字）。
   */
  private async matchBest(options: {
    preferred: LyricProviderSource;
    title: string;
    artist: string;
    durationMs?: number;
    nativeType?: 'netease' | 'qq';
    nativeId?: string;
  }): Promise<LyricBundle | null> {
    const target = {
      title: options.title,
      artist: options.artist,
      durationMs: options.durationMs,
    };
    const query = [options.title, options.artist].filter(Boolean).join(' ').trim() || options.title;
    const order = buildLyricSourceOrder(options.preferred);

    let best: LyricBundle | null = null;
    let bestScore = 0;
    const consider = (lyrics: LyricBundle, source: LyricProviderSource | 'native') => {
      if (scoreBundle(lyrics) <= 0) return;
      const tagged = withSource(lyrics, source);
      // 覆盖度为主；明显偏好逐字
      const score = coverageScore(tagged) + (isWordByWord(tagged) ? 80 : 0);
      if (score > bestScore) {
        best = tagged;
        bestScore = score;
      }
    };

    for (const source of order) {
      if (source === 'netease' || source === 'qq') {
        if (options.nativeType === source && options.nativeId) {
          const exact = await this.fetch(source, options.nativeId).catch(() => EMPTY_LYRICS);
          consider(exact, source);
        }
        const found = source === 'qq'
          ? await this.qq.searchByName(query, 1).catch(() => null)
          : await this.netease.searchByName(query, 1).catch(() => null);
        const hit = pickBestSearchTrack(target, found?.tracks || []);
        if (hit?.songid) {
          const lyrics = await this.fetch(source, String(hit.songid)).catch(() => EMPTY_LYRICS);
          consider(lyrics, source);
        }
        continue;
      }

      if (source === 'amll') {
        const amll = await this.fetchAmll(options).catch(() => EMPTY_LYRICS);
        consider(amll, 'amll');
        continue;
      }

      if (source === 'kugou') {
        const kugou = await this.fetchKugou(query).catch(() => EMPTY_LYRICS);
        consider(kugou, 'kugou');
      }
    }

    return best;
  }

  private async fetchPreferred(options: {
    preferred: LyricProviderSource;
    title: string;
    artist: string;
    nativeType?: 'netease' | 'qq';
    nativeId?: string;
  }): Promise<LyricBundle> {
    const query = [options.title, options.artist].filter(Boolean).join(' ').trim() || options.title;
    if (options.preferred === 'netease' || options.preferred === 'qq') {
      if (options.nativeType === options.preferred && options.nativeId) {
        return this.fetch(options.preferred, options.nativeId);
      }
      return this.searchAndFetch(options.preferred, query);
    }
    if (options.preferred === 'kugou') return this.fetchKugou(query);
    return this.fetchAmll(options);
  }

  private async searchAndFetch(type: 'netease' | 'qq', query: string): Promise<LyricBundle> {
    const found = type === 'qq'
      ? await this.qq.searchByName(query, 1)
      : await this.netease.searchByName(query, 1);
    const first = found?.tracks?.[0];
    if (!first?.songid) return EMPTY_LYRICS;
    return this.fetch(type, String(first.songid));
  }

  private async fetchKugou(query: string): Promise<LyricBundle> {
    const searchQs = new URLSearchParams({
      ver: '1',
      man: 'yes',
      client: 'pc',
      keyword: query,
      duration: '0',
      hash: '',
    });
    const search = await request('GET', `http://lyrics.kugou.com/search?${searchQs}`, {
      headers: { Referer: 'https://www.kugou.com/' },
      timeoutMs: 8000,
    });
    const candidate = search.json?.candidates?.[0];
    const id = candidate?.id;
    const accesskey = candidate?.accesskey;
    if (!id || !accesskey) return EMPTY_LYRICS;
    const downQs = new URLSearchParams({
      ver: '1',
      client: 'pc',
      id: String(id),
      accesskey: String(accesskey),
      fmt: 'lrc',
      charset: 'utf8',
    });
    const down = await request('GET', `http://lyrics.kugou.com/download?${downQs}`, {
      headers: { Referer: 'https://www.kugou.com/' },
      timeoutMs: 8000,
    });
    const encoded = String(down.json?.content || '');
    if (!encoded) return EMPTY_LYRICS;
    const lrc = decodeEntities(Buffer.from(encoded, 'base64').toString('utf8'));
    return { lrc, yrc: '', tlyric: '' };
  }

  private async fetchAmll(options: {
    title: string;
    artist: string;
    nativeType?: 'netease' | 'qq';
    nativeId?: string;
  }): Promise<LyricBundle> {
    const urls: string[] = [];
    if (options.nativeType === 'netease' && options.nativeId) {
      urls.push(`https://cdn.jsdelivr.net/gh/Steve-xmh/amll-ttml-db@main/ncm-lyrics/${options.nativeId}.ttml`);
    }
    if (options.nativeType === 'qq' && options.nativeId) {
      urls.push(`https://cdn.jsdelivr.net/gh/Steve-xmh/amll-ttml-db@main/qq-lyrics/${options.nativeId}.ttml`);
    }
    for (const url of urls) {
      const res = await request('GET', url, { timeoutMs: 8000 });
      if (!res.ok || !res.body.includes('<p')) continue;
      const lrc = ttmlToLrc(res.body);
      if (timedLyricScore(lrc) > 0) return { lrc, yrc: '', tlyric: '' };
    }
    return EMPTY_LYRICS;
  }
}
