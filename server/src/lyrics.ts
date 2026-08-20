import { FileCache } from './cache.ts';
import { qrcPlainOrDecrypt, looksLikeQrc } from './crypto/qrcDecrypt.ts';
import { eapiRequest } from './crypto/netease.ts';
import { NeteaseService } from './netease.ts';
import { QqService } from './qq.ts';
import { fetchKugouLyricText, searchKugouSongs } from './kugouLyrics.ts';
import { request } from './http.ts';
import { decodeEntities, effectiveTimedLyricScore, isPlaceholderLyricText, neteaseLyricText, pickRicherLyric, timedLyricScore } from './util.ts';

const AMLL_DB_BASE = 'https://amll-ttml-db.stevexmh.net';
export type AmllPlatform = 'ncm' | 'qq';

export type LyricProviderSource = 'netease' | 'qq' | 'kugou' | 'amll';

export interface LyricSearchCandidate {
  provider: LyricProviderSource;
  providerSongId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  pic: string;
  matchScore: number;
  titleMatched: boolean;
  artistMatched: boolean;
  kgHash?: string;
  amllPlatform?: AmllPlatform;
}

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
const LYRIC_MODAL_SEARCH_LIMIT = 20;

function stripSearchMarkup(value: string): string {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreBundle(lyrics: LyricBundle): number {
  return effectiveTimedLyricScore(lyrics.yrc) + effectiveTimedLyricScore(lyrics.lrc);
}

function hasUsableLyrics(lyrics: LyricBundle): boolean {
  return scoreBundle(lyrics) > 0;
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

/** 正在播放曲目的原生逐字歌词优先，避免搜索命中另一首同名片段后时间轴错乱 */
function pickAutoMatchedLyrics(
  native: LyricBundle,
  candidate: LyricBundle,
  nativeType?: 'netease' | 'qq',
): LyricBundle {
  if (!hasUsableLyrics(candidate)) return native;
  if (!hasUsableLyrics(native)) return candidate;

  const nativeWord = isWordByWord(native);
  const candidateWord = isWordByWord(candidate);
  const nativeCov = coverageScore(native);
  const candidateCov = coverageScore(candidate);

  if (nativeWord) {
    const samePlatform = nativeType
      && (candidate.source === nativeType || candidate.source === 'native');
    if (samePlatform) {
      return pickBetterLyrics(native, candidate);
    }
    if (!candidateWord || candidateCov < nativeCov * 1.35) {
      return native;
    }
  }

  return pickBetterLyrics(candidate, native);
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
  mode: 'strict' | 'titleOnly' = 'strict',
): { songid: string; title: string; author: string } | null {
  const scored = tracks
    .slice(0, AUTO_MATCH_SEARCH_LIMIT)
    .map((track) => ({ track, details: scoreCandidate(target, track) }))
    .sort((a, b) => b.details.score - a.details.score);

  if (mode === 'titleOnly') {
    const best = scored.find((item) => item.details.titleMatched);
    if (!best) return null;
    if (best.details.score < 65) return null;
    return best.track;
  }

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
    if (cached && hasUsableLyrics(cached)) return cached;

    let official: any = null;
    const officialTask = cookie
      ? eapiRequest(
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
      ).catch(() => null)
      : Promise.resolve(null);
    const [officialRes, anonymous] = await Promise.all([
      officialTask,
      this.netease.fetchLyric(songid, cookie),
    ]);
    if (officialRes?.json && (officialRes.json.lrc || officialRes.json.yrc)) official = officialRes.json;

    const lyrics: LyricBundle = {
      lrc: pickRicherLyric(neteaseLyricText(official, 'lrc'), neteaseLyricText(anonymous, 'lrc')),
      yrc: pickRicherLyric(neteaseLyricText(official, 'yrc'), neteaseLyricText(anonymous, 'yrc')),
      tlyric: pickRicherLyric(neteaseLyricText(official, 'tlyric'), neteaseLyricText(anonymous, 'tlyric')),
    };
    if (isPlaceholderLyricText(lyrics.lrc) && !effectiveTimedLyricScore(lyrics.yrc)) {
      lyrics.lrc = '';
    }
    if (hasUsableLyrics(lyrics)) {
      this.writeCache(bucket, songid, lyrics, cookie ? 1800 : 3600);
    }
    return lyrics;
  }

  private async fetchQq(songmid: string): Promise<LyricBundle> {
    const cached = this.readCache('qq_lyric_v2', songmid);
    if (cached && hasUsableLyrics(cached)) return cached;

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
    if (isPlaceholderLyricText(lrc) && !effectiveTimedLyricScore(yrc)) {
      return { lrc: '', yrc: '', tlyric: isPlaceholderLyricText(tlyric) ? '' : tlyric };
    }
    if (hasUsableLyrics(lyrics)) this.writeCache('qq_lyric_v2', songmid, lyrics, 3600);
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

    const taggedNative = (lyrics: LyricBundle): LyricBundle => (
      withSource(lyrics, options.nativeType || 'native')
    );

    const nativePromise = options.nativeType && options.nativeId
      ? this.fetch(options.nativeType, options.nativeId).catch(() => EMPTY_LYRICS)
      : Promise.resolve(EMPTY_LYRICS);

    if (options.autoUseBest) {
      const [native, best] = await Promise.all([
        nativePromise,
        this.matchBest(options).catch(() => null),
      ]);
      const nativeTagged = taggedNative(native);
      if (best && hasUsableLyrics(best)) {
        const picked = hasUsableLyrics(native)
          ? pickAutoMatchedLyrics(nativeTagged, best, options.nativeType)
          : best;
        if (hasUsableLyrics(picked)) {
          return picked.source ? picked : withSource(picked, options.preferred);
        }
      }
      if (hasUsableLyrics(nativeTagged)) return nativeTagged;

      const relaxed = await this.matchBest({
        ...options,
        artist: '',
      }).catch(() => null);
      if (relaxed && hasUsableLyrics(relaxed)) {
        return relaxed.source ? relaxed : withSource(relaxed, options.preferred);
      }
      return nativeTagged;
    }

    const [native, preferred] = await Promise.all([
      nativePromise,
      this.fetchPreferred(options).catch(() => EMPTY_LYRICS),
    ]);
    const taggedPreferred = withSource(preferred, options.preferred);
    const nativeTagged = taggedNative(native);
    if (!hasUsableLyrics(preferred) && !hasUsableLyrics(native)) {
      return taggedPreferred.source ? taggedPreferred : nativeTagged;
    }
    if (!hasUsableLyrics(preferred)) return nativeTagged;
    if (!hasUsableLyrics(native)) return taggedPreferred;
    return pickBetterLyrics(taggedPreferred, nativeTagged);
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

    const jobs = order.map(async (source) => {
      if (source === 'netease' || source === 'qq') {
        if (options.nativeType === source && options.nativeId) {
          const exact = await this.fetch(source, options.nativeId).catch(() => EMPTY_LYRICS);
          consider(exact, source);
          return;
        }
        const found = source === 'qq'
          ? await this.qq.searchByName(query, 1).catch(() => null)
          : await this.netease.searchByName(query, 1).catch(() => null);
        let hit = pickBestSearchTrack(target, found?.tracks || []);
        if (!hit?.songid && options.artist.trim()) {
          const titleOnlyFound = source === 'qq'
            ? await this.qq.searchByName(options.title, 1).catch(() => null)
            : await this.netease.searchByName(options.title, 1).catch(() => null);
          hit = pickBestSearchTrack(
            { ...target, artist: '' },
            titleOnlyFound?.tracks || [],
            'titleOnly',
          );
        }
        if (hit?.songid) {
          const lyrics = await this.fetch(source, String(hit.songid)).catch(() => EMPTY_LYRICS);
          consider(lyrics, source);
        }
        return;
      }

      if (source === 'amll') {
        const amll = await this.fetchAmll({
          ...options,
          searchQuery: query,
        }).catch(() => EMPTY_LYRICS);
        consider(amll, 'amll');
        return;
      }

      if (source === 'kugou') {
        const kugou = await this.fetchKugou({
          title: options.title,
          artist: options.artist,
          durationMs: options.durationMs,
          searchQuery: query,
        }).catch(() => EMPTY_LYRICS);
        consider(kugou, 'kugou');
      }
    });
    await Promise.all(jobs);

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
        const exact = await this.fetch(options.preferred, options.nativeId);
        if (hasUsableLyrics(exact)) return exact;
      }
      return this.searchAndFetch(options.preferred, query);
    }
    if (options.preferred === 'kugou') {
      return this.fetchKugou({
        title: options.title,
        artist: options.artist,
        searchQuery: query,
      });
    }
    return this.fetchAmll({ ...options, searchQuery: query });
  }

  private async searchAndFetch(type: 'netease' | 'qq', query: string): Promise<LyricBundle> {
    const found = type === 'qq'
      ? await this.qq.searchByName(query, 1)
      : await this.netease.searchByName(query, 1);
    const first = found?.tracks?.[0];
    if (!first?.songid) return EMPTY_LYRICS;
    return this.fetch(type, String(first.songid));
  }

  private amllPlatform(type: 'netease' | 'qq'): AmllPlatform {
    return type === 'netease' ? 'ncm' : 'qq';
  }

  private async fetchAmllFromDb(platform: AmllPlatform, musicId: string): Promise<LyricBundle> {
    const id = String(musicId).trim();
    if (!id) return EMPTY_LYRICS;
    for (const format of ['yrc', 'ttml', 'lrc'] as const) {
      const url = `${AMLL_DB_BASE}/${platform}/${encodeURIComponent(id)}?format=${format}`;
      const res = await request('GET', url, { timeoutMs: 5000 });
      if (!res.ok || !res.body?.trim()) continue;
      if (format === 'yrc' && effectiveTimedLyricScore(res.body) > 0) {
        return { lrc: '', yrc: res.body, tlyric: '' };
      }
      if (format === 'ttml' && /<tt(?:\s|>)/i.test(res.body)) {
        const lrc = ttmlToLrc(res.body);
        if (effectiveTimedLyricScore(lrc) > 0) return { lrc, yrc: '', tlyric: '' };
      }
      if (format === 'lrc' && effectiveTimedLyricScore(res.body) > 0) {
        return { lrc: res.body, yrc: '', tlyric: '' };
      }
    }
    return EMPTY_LYRICS;
  }

  private async fetchAmll(options: {
    title: string;
    artist: string;
    nativeType?: 'netease' | 'qq';
    nativeId?: string;
    searchQuery?: string;
  }): Promise<LyricBundle> {
    const probes: Array<{ platform: AmllPlatform; id: string }> = [];
    if (options.nativeType === 'netease' && options.nativeId) {
      probes.push({ platform: 'ncm', id: options.nativeId });
    }
    if (options.nativeType === 'qq' && options.nativeId) {
      probes.push({ platform: 'qq', id: options.nativeId });
    }

    const target = {
      title: options.title,
      artist: options.artist,
    };
    const query = options.searchQuery || [options.title, options.artist].filter(Boolean).join(' ').trim();
    if (query) {
      for (const source of ['netease', 'qq'] as const) {
        const found = source === 'qq'
          ? await this.qq.searchByName(query, 1).catch(() => null)
          : await this.netease.searchByName(query, 1).catch(() => null);
        let hit = pickBestSearchTrack(target, found?.tracks || []);
        if (!hit?.songid && options.artist.trim()) {
          const titleOnly = source === 'qq'
            ? await this.qq.searchByName(options.title, 1).catch(() => null)
            : await this.netease.searchByName(options.title, 1).catch(() => null);
          hit = pickBestSearchTrack({ ...target, artist: '' }, titleOnly?.tracks || [], 'titleOnly');
        }
        if (hit?.songid) {
          probes.push({ platform: this.amllPlatform(source), id: String(hit.songid) });
        }
      }
    }

    const seen = new Set<string>();
    for (const probe of probes) {
      const key = `${probe.platform}:${probe.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lyrics = await this.fetchAmllFromDb(probe.platform, probe.id);
      if (hasUsableLyrics(lyrics)) return lyrics;
    }
    return EMPTY_LYRICS;
  }

  private async fetchKugou(options: {
    title: string;
    artist: string;
    durationMs?: number;
    searchQuery?: string;
  }): Promise<LyricBundle> {
    const query = options.searchQuery || [options.title, options.artist].filter(Boolean).join(' ').trim();
    if (!query) return EMPTY_LYRICS;
    const target = {
      title: options.title,
      artist: options.artist,
      durationMs: options.durationMs,
    };
    const songs = await searchKugouSongs(query, 1, 8).catch(() => []);
    const ranked = songs
      .map((song) => ({
        song,
        details: scoreCandidate(target, {
          title: song.name,
          author: song.artists,
          durationMs: song.durationMs,
        }),
      }))
      .sort((a, b) => b.details.score - a.details.score);
    const best = ranked.find((item) => item.details.titleMatched && item.details.artistMatched)
      ?? ranked.find((item) => item.details.titleMatched)
      ?? ranked[0];
    const song = best?.song;
    if (!song) return EMPTY_LYRICS;
    const lyricText = await fetchKugouLyricText(song).catch(() => '');
    if (!lyricText || !effectiveTimedLyricScore(lyricText)) return EMPTY_LYRICS;
    if (/\[\d+,\d+\]/.test(lyricText)) {
      return { lrc: '', yrc: lyricText, tlyric: '' };
    }
    return { lrc: lyricText, yrc: '', tlyric: '' };
  }

  async searchCandidates(options: {
    title: string;
    artist: string;
    durationMs?: number;
    source: LyricProviderSource;
    query?: string;
    nativeSongId?: string;
    nativeSource?: 'netease' | 'qq';
  }): Promise<LyricSearchCandidate[]> {
    const target = {
      title: options.title,
      artist: options.artist,
      durationMs: options.durationMs,
    };
    const query = options.query?.trim()
      || [options.title, options.artist].filter(Boolean).join(' ').trim()
      || options.title;
    if (!query.trim()) return [];

    const toCandidate = (
      provider: LyricProviderSource,
      item: {
        providerSongId: string;
        title: string;
        artist: string;
        album?: string;
        durationMs?: number;
        pic?: string;
        kgHash?: string;
        amllPlatform?: AmllPlatform;
      },
    ): LyricSearchCandidate => {
      const title = stripSearchMarkup(item.title);
      const artist = stripSearchMarkup(item.artist);
      const album = stripSearchMarkup(item.album || '');
      const details = scoreCandidate(target, {
        title,
        author: artist,
        durationMs: item.durationMs,
      });
      return {
        provider,
        providerSongId: item.providerSongId,
        title,
        artist,
        album,
        durationMs: item.durationMs || 0,
        pic: item.pic || '',
        matchScore: details.score,
        titleMatched: details.titleMatched,
        artistMatched: details.artistMatched,
        kgHash: item.kgHash,
        amllPlatform: item.amllPlatform,
      };
    };

    if (options.source === 'netease' || options.source === 'qq') {
      const found = options.source === 'qq'
        ? await this.qq.searchByNameForMatch(query, 1).catch(() => [])
        : await this.netease.searchByNameForMatch(query, 1).catch(() => []);
      let results = found
        .slice(0, LYRIC_MODAL_SEARCH_LIMIT)
        .map((track) => toCandidate(options.source, {
          providerSongId: track.songid,
          title: track.title,
          artist: track.author,
          album: track.album,
          durationMs: track.durationMs,
          pic: track.pic,
        }))
        .sort((a, b) => b.matchScore - a.matchScore);
      results = this.pinNativeSearchCandidate(results, options);
      return results;
    }

    if (options.source === 'kugou') {
      const songs = await searchKugouSongs(query, 1, LYRIC_MODAL_SEARCH_LIMIT).catch(() => []);
      return songs
        .map((song) => toCandidate('kugou', {
          providerSongId: String(song.id),
          title: song.name,
          artist: song.artists,
          album: song.album,
          durationMs: song.durationMs,
          kgHash: song.kgHash,
          pic: song.pic,
        }))
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    const [ncmFound, qqFound] = await Promise.all([
      this.netease.searchByNameForMatch(query, 1).catch(() => []),
      this.qq.searchByNameForMatch(query, 1).catch(() => []),
    ]);
    const merged: LyricSearchCandidate[] = [];
    for (const track of ncmFound) {
      merged.push(toCandidate('amll', {
        providerSongId: track.songid,
        title: track.title,
        artist: track.author,
        album: track.album,
        durationMs: track.durationMs,
        pic: track.pic,
        amllPlatform: 'ncm',
      }));
    }
    for (const track of qqFound) {
      merged.push(toCandidate('amll', {
        providerSongId: track.songid,
        title: track.title,
        artist: track.author,
        album: track.album,
        durationMs: track.durationMs,
        pic: track.pic,
        amllPlatform: 'qq',
      }));
    }
    return merged
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, LYRIC_MODAL_SEARCH_LIMIT);
  }

  /** 搜索列表优先置顶正在播放的曲目 ID，避免同名不同版本默认选中另一首 */
  private pinNativeSearchCandidate(
    results: LyricSearchCandidate[],
    options: {
      source: LyricProviderSource;
      nativeSongId?: string;
      nativeSource?: 'netease' | 'qq';
    },
  ): LyricSearchCandidate[] {
    const pinId = String(options.nativeSongId || '').trim();
    if (!pinId || options.source !== options.nativeSource) return results;

    const idx = results.findIndex((item) => String(item.providerSongId) === pinId);
    if (idx < 0) return results;

    const [exact] = results.splice(idx, 1);
    return [{
      ...exact,
      matchScore: Math.max(exact.matchScore, 100),
      titleMatched: true,
      artistMatched: true,
    }, ...results];
  }

  async fetchByCandidate(candidate: {
    provider: LyricProviderSource;
    providerSongId: string;
    kgHash?: string;
    amllPlatform?: AmllPlatform;
    title?: string;
    artist?: string;
    album?: string;
    durationMs?: number;
  }): Promise<LyricBundle> {
    const { provider, providerSongId } = candidate;
    if (provider === 'netease' || provider === 'qq') {
      const lyrics = await this.fetch(provider, providerSongId);
      return withSource(lyrics, provider);
    }
    if (provider === 'amll') {
      const platform = candidate.amllPlatform || 'ncm';
      const lyrics = await this.fetchAmllFromDb(platform, providerSongId);
      return withSource(lyrics, 'amll');
    }
    if (provider === 'kugou') {
      const lyricText = await fetchKugouLyricText({
        id: Number(providerSongId),
        name: candidate.title || '',
        artists: candidate.artist || '',
        album: candidate.album || '',
        durationMs: candidate.durationMs || 0,
        kgHash: candidate.kgHash || '',
      }).catch(() => '');
      if (!lyricText || !effectiveTimedLyricScore(lyricText)) {
        return withSource(EMPTY_LYRICS, 'kugou');
      }
      if (/\[\d+,\d+\]/.test(lyricText)) {
        return withSource({ lrc: '', yrc: lyricText, tlyric: '' }, 'kugou');
      }
      return withSource({ lrc: lyricText, yrc: '', tlyric: '' }, 'kugou');
    }
    return EMPTY_LYRICS;
  }
}
