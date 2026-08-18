export function decodeEntities(str: string): string {
  return str
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

export function timedLyricScore(text?: string | null): number {
  const raw = text || '';
  if (!raw.trim()) return 0;
  const word = (raw.match(/\[\d+,\d+\]/g) || []).length;
  const lrc = (raw.match(/\[\d{2}:\d{2}/g) || []).length;
  return word * 10 + lrc;
}

export function pickRicherLyric(primary: string, fallback: string): string {
  return timedLyricScore(primary) >= timedLyricScore(fallback) ? primary || fallback : fallback;
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

export function normalizeNeteaseLyric(text: string): string {
  if (!text) return '';
  return text
    .split(/\r?\n/)
    .map((line) => convertNeteaseJsonLyricLine(line) ?? line)
    .join('\n');
}

export function neteaseLyricText(
  payload: Record<string, any> | null | undefined,
  field: 'lrc' | 'yrc' | 'tlyric',
): string {
  if (!payload || typeof payload !== 'object') return '';
  let raw = '';
  if (field === 'yrc') {
    raw = payload.yrc?.lyric ? String(payload.yrc.lyric) : payload.lrc?.yrc?.lyric ? String(payload.lrc.yrc.lyric) : '';
  } else if (field === 'tlyric') {
    if (payload.yrc?.lyric && payload.ytlrc?.lyric) raw = String(payload.ytlrc.lyric);
    else if (payload.lrc?.ytlrc?.lyric) raw = String(payload.lrc.ytlrc.lyric);
    else if (payload.tlyric?.lyric) raw = String(payload.tlyric.lyric);
  } else {
    raw = payload.lrc?.lyric ? String(payload.lrc.lyric) : '';
  }
  return normalizeNeteaseLyric(raw);
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

export function firstTruthy<T>(tasks: Array<() => Promise<T | null | undefined>>): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = tasks.length;
    let settled = false;
    if (!pending) {
      resolve(null);
      return;
    }
    for (const task of tasks) {
      void task().then((value) => {
        if (!settled && value) {
          settled = true;
          resolve(value);
          return;
        }
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      }).catch(() => {
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      });
    }
  });
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
  return isTrialMediaUrl(url);
}

export function isTrialMediaUrl(url?: string | null): boolean {
  if (!url) return true;
  return /trial|preview|freeTrial|limit=1/i.test(url);
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
