import type { Line, Track } from '../types';
import { detectTimedLyricFormat } from '../utils/lyrics/formatDetection';
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

export function detectLyricParseFormat(content?: string): LyricParseFormat {
  const raw = normalizeLyricText(content);
  if (!raw.trim()) return 'lrc';
  if (looksLikeYrc(raw)) return 'yrc';
  if (looksLikeKrc(raw)) return 'krc';
  if (looksLikeQrc(raw)) return 'qrc';
  return detectTimedLyricFormat(raw);
}

export function trackToVisualizerLines(track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null): Line[] {
  if (!track) return [];
  const translation = normalizeLyricText(track.tlyric);
  const yrc = normalizeLyricText(track.yrc);
  if (yrc.trim()) {
    const wordLines = parseLyricsByFormat(detectLyricParseFormat(yrc), yrc, translation).lines;
    if (wordLines.length) return wordLines;
  }
  const raw = normalizeLyricText(track.lrc);
  if (!raw.trim()) return [];
  return parseLyricsByFormat(detectLyricParseFormat(raw), raw, translation).lines;
}

export function findLatestActiveLineIndex(lines: Line[], time: number): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line || time < line.startTime) continue;
    if (time <= (line.renderHints?.renderEndTime ?? line.endTime)) {
      return index;
    }
  }
  return -1;
}
