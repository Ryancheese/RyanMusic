import type { Line, LyricData } from '../../types';
import { finalizeParsedLyricLines, isInterludeLine } from './parserCore';

/** 默认示例：过滤带冒号/括号的词曲制作信息行 */
export const LYRIC_FILTER_REGEX_EXAMPLE =
  '^(?=.*[：:（）()])(?=.*(?:词|曲|制作|发行)).*$';

/** RyanMusic 默认开启：制作信息行 + 网易飓风等片头宣传 */
export const DEFAULT_LYRIC_FILTER_PATTERN =
  '^(?=.*[：:（）()])(?=.*(?:词|曲|制作|发行)).*$|本歌曲来自|网易飓风|飓风计划|未经著作权|业务联系|纯音乐.?请欣赏|千亿流量|现金激励|不得翻唱|^OP[:：]|^SP[:：]';

const normalizeFilterPattern = (pattern?: string | null): string => pattern?.trim() || '';

export const getLyricFilterError = (pattern?: string | null): string | null => {
  const normalized = normalizeFilterPattern(pattern);
  if (!normalized) return null;
  try {
    // eslint-disable-next-line no-new
    new RegExp(normalized);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : '无效的正则表达式';
  }
};

export const compileLyricFilterPattern = (pattern?: string | null): RegExp | null => {
  const normalized = normalizeFilterPattern(pattern);
  if (!normalized) return null;
  try {
    return new RegExp(normalized);
  } catch {
    return null;
  }
};

const stripInterludes = (lines: Line[]): Line[] => lines.filter((line) => !isInterludeLine(line));

export function applyLyricLineFilter(lines: Line[], pattern?: string | null): Line[] {
  if (!lines.length) return lines;
  const regex = compileLyricFilterPattern(pattern);
  if (!regex) return lines;
  // Folia：过滤后允许为空。若全被滤掉却回退原文，纯音乐会把「纯音乐，请欣赏」又显示出来。
  const filtered = stripInterludes(lines).filter((line) => !regex.test(String(line.fullText || '')));
  return finalizeParsedLyricLines(filtered, { includeInterludes: true });
}

export function applyLyricDisplayFilter(
  lyrics: LyricData | null | undefined,
  pattern?: string | null,
): LyricData | null {
  if (!lyrics) return null;
  const regex = compileLyricFilterPattern(pattern);
  if (!regex) return lyrics;
  return {
    ...lyrics,
    lines: applyLyricLineFilter(lyrics.lines, pattern),
  };
}
