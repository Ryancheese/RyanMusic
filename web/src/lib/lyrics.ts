import type { Line, LyricLine, Word } from '../types';
import { annotateLyricLines } from '../utils/lyrics/renderHints';

const META_RE = /作\s*词|作\s*曲|编\s*曲|制作人|监制|统筹|出品|发行/i;
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export function parseLrc(raw?: string): LyricLine[] {
  if (!raw) return [];
  const lines: LyricLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]+\]/g, '').trim();
    if (!stamps.length || !text || META_RE.test(text)) continue;
    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(stamp[2]);
      const fraction = stamp[3] ? Number(stamp[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function currentLyricIndex(lines: LyricLine[], time: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function tokenize(text: string): string[] {
  if (CJK_RE.test(text) && !/[a-zA-Z]{3,}/.test(text)) {
    return Array.from(text).filter((char) => char.trim().length > 0);
  }
  return text.split(/(\s+)/).filter((token) => token.trim().length > 0);
}

function buildTimedWords(text: string, startTime: number, endTime: number): Word[] {
  const tokens = tokenize(text);
  if (!tokens.length) {
    return [{ text, startTime, endTime }];
  }
  const duration = Math.max(endTime - startTime, 0.2);
  const weights = tokens.map((token) => Math.max(token.length, 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = startTime;
  return tokens.map((token, index) => {
    const span = (weights[index] / total) * duration;
    const wordStart = cursor;
    const wordEnd = index === tokens.length - 1 ? endTime : cursor + span;
    cursor = wordEnd;
    return { text: token, startTime: wordStart, endTime: wordEnd };
  });
}

export function lrcToVisualizerLines(raw?: string): Line[] {
  const parsed = parseLrc(raw);
  const draft = parsed.map((line, index) => {
    const startTime = line.time;
    const nextStart = parsed[index + 1]?.time;
    const endTime = nextStart && nextStart > startTime ? nextStart : startTime + 4;
    const words = buildTimedWords(line.text, startTime, endTime);
    return {
      words,
      startTime,
      endTime,
      fullText: line.text,
    };
  });
  return annotateLyricLines(draft);
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
