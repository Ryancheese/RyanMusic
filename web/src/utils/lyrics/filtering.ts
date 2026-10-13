import type { Line, LyricData } from '../../types';
import { finalizeParsedLyricLines, isInterludeLine } from './parserCore';

/** 默认示例：过滤带冒号/括号的词曲制作信息行 */
export const LYRIC_FILTER_REGEX_EXAMPLE =
  '^(?=.*[：:（）()])(?=.*(?:词|曲|制作|发行)).*$';

/** RyanMusic 默认开启：制作信息行、平台占位句、片头宣传。 */
export const DEFAULT_LYRIC_FILTER_PATTERN =
  '^(?=.*[：:（）()])(?=.*(?:词|曲|制作|发行|混音|录音|母带|监制|出品|统筹|厂牌|企划|和声)).*$|^(?:作词|作曲|编曲|制作人?|混音|录音|母带|监制|出品|企划|统筹)[:：\\s]|本歌曲来自|网易飓风|飓风计划|未经著作权|未经许可|未经授权|版权所有|侵权必究|业务联系|没有填词|纯音乐[，,\\s]*请您?欣赏|暂无歌词|暂时没有歌词|歌词暂无|千亿流量|现金激励|不得翻唱|禁止翻唱|严禁翻唱|歌词由|歌词来自|仅供试听|QQ音乐|网易云音乐|酷狗音乐|酷我音乐|^OP[:：]|^SP[:：]';

/** 曾经写进本地设置的默认规则。还停在这些句子上时，启动后换成上面的新默认。 */
export const PREVIOUS_DEFAULT_LYRIC_FILTERS = [
  '^(?=.*[：:（）()])(?=.*(?:词|曲|制作|发行)).*$|本歌曲来自|网易飓风|飓风计划|未经著作权|业务联系|纯音乐.?请欣赏|千亿流量|现金激励|不得翻唱|^OP[:：]|^SP[:：]',
];

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
