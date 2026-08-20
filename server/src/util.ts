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

const PLACEHOLDER_LYRIC_RE = /^(?:暂无歌词|无歌词|纯音乐(?:[，,]?\s*请欣赏)?|此歌曲为没有填词的纯音乐|instrumental|not\s*available|no\s*lyrics?)[\s.…]*$/iu;
const PURE_MUSIC_NOTICE = '纯音乐，请欣赏';

/** Folia：正文含「纯音乐，请欣赏」即视为纯音乐占位 */
export function isPureMusicLyricText(text?: string | null): boolean {
  const raw = String(text || '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\(\d+,\d+(?:,\d+)?\)/g, '')
    .replace(/<\d+,\d+[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return false;
  return raw.includes(PURE_MUSIC_NOTICE) || raw.includes('纯音乐,请欣赏');
}

/** 去掉时间轴后是否仅为「暂无歌词」等占位 */
export function isPlaceholderLyricText(text?: string | null): boolean {
  const raw = String(text || '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\(\d+,\d+(?:,\d+)?\)/g, '')
    .replace(/<\d+,\d+[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return true;
  if (isPureMusicLyricText(text)) return true;
  return PLACEHOLDER_LYRIC_RE.test(raw);
}

export function hasNeteasePureMusicFlag(source?: {
  pureMusic?: boolean;
  lrc?: { pureMusic?: boolean };
  yrc?: { pureMusic?: boolean };
  ytlrc?: { pureMusic?: boolean };
  tlyric?: { pureMusic?: boolean };
} | null): boolean {
  if (!source) return false;
  return Boolean(
    source.pureMusic
    || source.lrc?.pureMusic
    || source.yrc?.pureMusic
    || source.ytlrc?.pureMusic
    || source.tlyric?.pureMusic,
  );
}

export function effectiveTimedLyricScore(text?: string | null): number {
  if (isPlaceholderLyricText(text)) return 0;
  return timedLyricScore(text);
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
  return false;
}

/**
 * 网易云无版权/下架。
 * cloudsearch 常把可播曲误标 st=-100（仍带 maxbr/playMaxbr），不能单凭 st<0 或 -100 判下架。
 * 仅 st=-200（明确无版权），或灰色且完全无可播/可下载码率时标记。
 */
export function isNeteaseDelisted(song: any, privilege?: any): boolean {
  const priv = privilege || song?.privilege || song?.priv;
  if (priv) {
    const st = Number(priv.st);
    if (st === -200) return true;
    const playBr = Math.max(
      Number(priv.playMaxbr || 0),
      Number(priv.maxbr || 0),
      Number(priv.pl || 0),
    );
    const dlBr = Math.max(Number(priv.dl || 0), Number(priv.downloadMaxbr || 0));
    if (st < 0 && playBr <= 0 && dlBr <= 0) return true;
  }
  return Number(song?.st) === -200;
}

/** QQ 官方不可播（仍可走私链） */
export function isQqDelisted(song: any): boolean {
  const action = song?.action;
  if (action && Number(action.play) === 0) return true;
  const pay = song?.pay;
  if (pay && Number(pay.pay_play) === 0 && Number(pay.price_play) > 0) return true;
  return false;
}

/** QQ 朋友圈/私链：带 code 或 myhkw fromtag，不是官方 GetVkey 试听 */
export function isQqPrivatePlayUrl(url: string): boolean {
  return /fromtag=myhkw|fcg_pyq_play|[?&]code=/i.test(url);
}

/** 官方未登录/非会员对 VIP 曲返回的试听文件 */
export function isQqTrialMediaUrl(url: string, filename = ''): boolean {
  if (!url && !filename) return false;
  const hay = `${url} ${filename}`;
  if (isQqPrivatePlayUrl(url)) return false;
  if (/(RS02|TSA|试听)/i.test(hay)) return true;
  return false;
}

/** 网易云官方试听片段：freeTrialInfo / 时长不足 60 秒 */
export function isNeteaseTrialPlayItem(item: any): boolean {
  if (!item) return false;
  if (item.freeTrialInfo) return true;
  const time = Number(item.time || 0);
  if (time > 0 && time <= 60_000) return true;
  const privilege = item.freeTrialPrivilege;
  return Boolean(
    privilege
    && (privilege.resConsumable || privilege.userConsumable)
    && time > 0,
  );
}

/** 网易云试听包装链或路径 */
export function isNeteaseTrialMediaUrl(url: string): boolean {
  if (!url) return false;
  return /\/trial\/|\/preview\/|freeTrial|tryid=|song\/media\/outer\/url/i.test(url);
}

export function httpsNeteaseUrl(url: string): string {
  if (url.startsWith('http://') && /(126\.net|163\.com)/i.test(url)) {
    return `https://${url.slice(7)}`;
  }
  return url;
}

export function mediaReferer(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('126.net') || host.endsWith('163.com') || host.includes('netease')) {
      return 'https://music.163.com/';
    }
    if (host.endsWith('myhkw.cn')) return 'https://s.myhkw.cn/';
  } catch {
    // ignore invalid url
  }
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
