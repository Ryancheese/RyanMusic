export function neteaseLyricText(
  payload: Record<string, any> | null | undefined,
  field: 'lrc' | 'yrc' | 'tlyric',
): string {
  if (!payload || typeof payload !== 'object') return '';
  if (field === 'yrc') {
    if (payload.yrc?.lyric) return String(payload.yrc.lyric);
    if (payload.lrc?.yrc?.lyric) return String(payload.lrc.yrc.lyric);
    return '';
  }
  if (field === 'tlyric') {
    if (payload.yrc?.lyric && payload.ytlrc?.lyric) return String(payload.ytlrc.lyric);
    if (payload.lrc?.ytlrc?.lyric) return String(payload.lrc.ytlrc.lyric);
    if (payload.tlyric?.lyric) return String(payload.tlyric.lyric);
    return '';
  }
  return payload.lrc?.lyric ? String(payload.lrc.lyric) : '';
}

export function sliceNameSearchSongids(songids: Array<string | number>, page: number) {
  if (!Array.isArray(songids)) {
    return { songids: [] as Array<string | number>, has_more: false };
  }
  void page;
  const limit = 10;
  const slice = songids.slice(0, limit);
  return {
    songids: slice,
    has_more: songids.length >= limit,
  };
}

export function nameSearchSourcePage(page: number): number {
  const n = Number(page);
  return n < 1 || Number.isNaN(n) ? 1 : n;
}

export function decodeEntities(str: string): string {
  return str
    .replace(/&#13;/g, '')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function jsonpToJson(raw: string): any {
  const text = raw.trim();
  if (!text) return null;
  if (text[0] === '[' || text[0] === '{') {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start + 1, end));
    } catch {
      return null;
    }
  }
  return null;
}

export function isBadMediaUrl(url?: string | null): boolean {
  if (!url) return true;
  if (!/^https?:\/\//i.test(url)) return true;
  if (/\/404/i.test(url) || /music\.163\.com\/404/i.test(url)) return true;
  return false;
}

export function httpsNeteaseUrl(url: string): string {
  if (url.startsWith('http://') && /(126\.net|163\.com)/i.test(url)) {
    return `https://${url.slice(7)}`;
  }
  return url;
}

export function mediaReferer(url: string): string {
  if (/(163\.com|126\.net|netease)/i.test(url)) return 'https://music.163.com/';
  if (/myhkw\.cn/i.test(url)) return 'https://s.myhkw.cn/';
  return 'https://y.qq.com/';
}

export function parseSongUrl(url: string): { site: 'netease' | 'qq'; id: string } | null {
  const netease = url.match(/music\.163\.com\/(#(\/m)?|m)\/song(\?id=|\/)(\d+)/i);
  if (netease?.[4]) return { site: 'netease', id: netease[4] };
  const qq = url.match(
    /(y\.qq\.com\/n\/(ryqq|yqq)\/songDetail\/|y\.qq\.com\/n\/yqq\/song\/|data\.music\.qq\.com\/playsong\.html\?songmid=)([a-zA-Z0-9]+)/i,
  );
  if (qq?.[3]) return { site: 'qq', id: qq[3] };
  return null;
}
