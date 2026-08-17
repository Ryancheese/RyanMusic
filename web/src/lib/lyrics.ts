import type { Line, Track } from '../types';
import { detectTimedLyricFormat } from '../utils/lyrics/formatDetection';
import { parseLyricsByFormat, type LyricParseFormat } from '../utils/lyrics/parserCore';

const looksLikeYrc = (content: string) => /^\s*\[\d+,\d+\]/.test(content) && /\(\d+,\d+,\d+\)/.test(content);
const looksLikeQrc = (content: string) => (
  /^\s*\[\d+,\d+\]/.test(content)
  && /\(\d+,\d+(?:,\d+)?\)/.test(content)
  && !looksLikeYrc(content)
);
const looksLikeKrc = (content: string) => /^\s*\[\d+,\d+\]/.test(content) && /<\d+,\d+/.test(content);

export function detectLyricParseFormat(content?: string): LyricParseFormat {
  const raw = content?.replace(/^\uFEFF/, '') || '';
  if (!raw.trim()) return 'lrc';
  if (looksLikeYrc(raw)) return 'yrc';
  if (looksLikeKrc(raw)) return 'krc';
  if (looksLikeQrc(raw)) return 'qrc';
  return detectTimedLyricFormat(raw);
}

export function trackToVisualizerLines(track?: Pick<Track, 'lrc' | 'yrc' | 'tlyric'> | null): Line[] {
  if (!track) return [];
  const translation = track.tlyric || '';
  if (track.yrc?.trim()) {
    return parseLyricsByFormat('yrc', track.yrc, translation).lines;
  }
  const raw = track.lrc || '';
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
