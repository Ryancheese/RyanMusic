import type { Line, Track } from '../types';
import { detectTimedLyricFormat } from '../utils/lyrics/formatDetection';
import { applyLyricLineFilter } from '../utils/lyrics/filtering';
import { parseLyricsByFormat, type LyricParseFormat } from '../utils/lyrics/parserCore';

const WORD_LINE = /(?:^|\n)\s*\[\d+,\d+\].+/m;
const looksLikeYrc = (content: string) => WORD_LINE.test(content) && /\(\d+,\d+,\d+\)/.test(content);
const looksLikeQrc = (content: string) => (
  WORD_LINE.test(content)
  && /\(\d+,\d+(?:,\d+)?\)/.test(content)
  && !looksLikeYrc(content)
);
const looksLikeKrc = (content: string) => WORD_LINE.test(content) && /<\d+,\d+/.test(content);

export function decodeLyricEntities(text: string): string {
  if (!text || !/&(#|[a-z])/i.test(text)) return text;
  return text
    .replace(/&#13;/g, '')
    .replace(/&#10;/g, '\n')
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function convertNeteaseJsonLyricLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const obj = JSON.parse(trimmed) as { t?: number; c?: Array<{ tx?: string }> };
    if (typeof obj.t !== 'number' || !Array.isArray(obj.c)) return null;
    const text = obj.c.map((part) => part?.tx || '').join('');
    const ms = Math.max(0, obj.t);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = ms % 1000;
    return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(3, '0')}]${text}`;
  } catch {
    return null;
  }
}

export function normalizeLyricText(text?: string | null): string {
  const raw = decodeLyricEntities(text || '');
  if (!raw.trim()) return '';
  if (!raw.includes('{"t":')) return raw;
  return raw
    .split(/\r?\n/)
    .map((line) => convertNeteaseJsonLyricLine(line) ?? line)
    .join('\n');
}

export function timedLyricScore(text?: string | null): number {
  const raw = normalizeLyricText(text);
  if (!raw.trim()) return 0;
  const word = (raw.match(/\[\d+,\d+\]/g) || []).length;
  const lrc = (raw.match(/\[\d{2}:\d{2}/g) || []).length;
  return word * 10 + lrc;
}

const PLACEHOLDER_LYRIC_RE = /^(?:暂无歌词|无歌词|纯音乐|此歌曲为没有填词的纯音乐|instrumental|not\s*available|no\s*lyrics?)[\s.…]*$/iu;

export function isPlaceholderLyricText(text?: string | null): boolean {
  const raw = normalizeLyricText(text)
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\(\d+,\d+(?:,\d+)?\)/g, '')
    .replace(/<\d+,\d+[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return true;
  return PLACEHOLDER_LYRIC_RE.test(raw);
}

export function effectiveTimedLyricScore(text?: string | null): number {
  if (isPlaceholderLyricText(text)) return 0;
  return timedLyricScore(text);
}

export function hasUsableTrackLyrics(
  track?: Pick<Track, 'lrc' | 'yrc'> | null,
): boolean {
  if (!track) return false;
  return effectiveTimedLyricScore(track.yrc) + effectiveTimedLyricScore(track.lrc) > 0;
}

/** 歌词本身的质量（0–100）：逐字加分，覆盖度越高越接近 100 */
export function lyricQualityPercent(
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null,
  filterPattern?: string | null,
): number {
  if (!track || !hasUsableTrackLyrics(track)) return 0;
  const resolved = resolveVisualizerLyrics(track, filterPattern);
  const spoken = resolved.lines.filter((line) => (line.fullText || '').trim()).length;
  const words = resolved.lines.reduce((sum, line) => sum + (line.words?.length || 0), 0);
  const coverage = Math.min(70, spoken * 2.4 + Math.min(words, 80) * 0.25);
  const timed = resolved.isWordByWord ? 30 : Math.min(18, spoken);
  return Math.max(0, Math.min(100, Math.round(coverage + timed)));
}

export function detectLyricParseFormat(content?: string): LyricParseFormat {
  const raw = normalizeLyricText(content);
  if (!raw.trim()) return 'lrc';
  if (looksLikeYrc(raw)) return 'yrc';
  if (looksLikeKrc(raw)) return 'krc';
  if (looksLikeQrc(raw)) return 'qrc';
  return detectTimedLyricFormat(raw);
}

function parseTrackLines(content: string, translation: string): Line[] {
  const raw = normalizeLyricText(content);
  if (!raw.trim()) return [];
  return parseLyricsByFormat(detectLyricParseFormat(raw), raw, translation).lines;
}

function lineCoverageScore(lines: Line[]): number {
  if (!lines.length) return 0;
  const spoken = lines.filter((line) => (line.fullText || '').trim()).length;
  const words = lines.reduce((sum, line) => sum + (line.words?.length || 0), 0);
  return spoken * 10 + words;
}

/** 文本是否看起来是逐字时间轴（YRC / QRC / KRC 等） */
export function isWordByWordLyricText(content?: string | null): boolean {
  const raw = normalizeLyricText(content);
  if (!raw.trim()) return false;
  const format = detectLyricParseFormat(raw);
  return format === 'yrc' || format === 'qrc' || format === 'krc' || format === 'enhanced-lrc';
}

/** 解析后的行是否具备可用的逐字 timing */
export function linesLookWordByWord(lines: Line[]): boolean {
  let multiWord = 0;
  for (const line of lines) {
    const words = line.words || [];
    if (words.length >= 2) multiWord += 1;
    if (multiWord >= 2) return true;
  }
  return multiWord > 0 && lines.length <= 3;
}

export interface ResolvedVisualizerLyrics {
  lines: Line[];
  isWordByWord: boolean;
}

/**
 * 优先逐字歌词；仅当逐字明显缺段（覆盖度远低于逐行）时才回退逐行。
 */
export function resolveVisualizerLyrics(
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null,
  filterPattern?: string | null,
): ResolvedVisualizerLyrics {
  if (!track) return { lines: [], isWordByWord: false };
  const translation = normalizeLyricText(track.tlyric);
  const wordRaw = track.yrc || '';
  const lineRaw = track.lrc || '';
  const wordLines = filterVisualizerLines(parseTrackLines(wordRaw, translation), filterPattern);
  const lineLines = filterVisualizerLines(parseTrackLines(lineRaw, translation), filterPattern);
  const wordScore = lineCoverageScore(wordLines);
  const lineScore = lineCoverageScore(lineLines);
  const wordTimed = linesLookWordByWord(wordLines) || isWordByWordLyricText(wordRaw);

  const wordSpoken = wordLines.filter((line) => (line.fullText || '').trim()).length;
  const lineSpoken = lineLines.filter((line) => (line.fullText || '').trim()).length;
  const yrcCoversLrc = lineSpoken === 0
    || wordSpoken >= Math.ceil(lineSpoken * 0.78);

  // 有可用逐字：优先用；逐字明显缺段则回退更完整的逐行
  if (wordTimed && wordScore > 0 && yrcCoversLrc && wordScore >= lineScore * 0.55) {
    return { lines: wordLines, isWordByWord: true };
  }
  if (lineScore > 0) {
    const lineTimed = linesLookWordByWord(lineLines) || isWordByWordLyricText(lineRaw);
    return { lines: lineLines, isWordByWord: lineTimed };
  }
  if (wordScore > 0) {
    return { lines: wordLines, isWordByWord: wordTimed };
  }
  return { lines: [], isWordByWord: false };
}

/** Folia 风格：按可选正则过滤，不做硬编码大段删减 */
export function filterVisualizerLines(lines: Line[], pattern?: string | null): Line[] {
  return applyLyricLineFilter(lines, pattern || '');
}

/**
 * 优先逐字歌词；若逐字明显比逐行更短（缺段），回退到更完整的逐行。
 */
export function trackToVisualizerLines(
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null,
  filterPattern?: string | null,
): Line[] {
  return resolveVisualizerLyrics(track, filterPattern).lines;
}

export function trackUsesWordByWordLyrics(
  track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null,
  filterPattern?: string | null,
): boolean {
  return resolveVisualizerLyrics(track, filterPattern).isWordByWord;
}

/** Folia：当前行 = 已经开始的最后一行，一直保持到下一行开始，不因行时长结束而跳空。 */
export function findLatestActiveLineIndex(lines: Line[], time: number): number {
  let found = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (line.startTime <= time) found = index;
  }
  return found;
}

export { DEFAULT_LYRIC_FILTER_PATTERN, LYRIC_FILTER_REGEX_EXAMPLE } from '../utils/lyrics/filtering';
