import { createHash } from 'node:crypto';
import { inflateRawSync, inflateSync, unzipSync } from 'node:zlib';
import { request } from './http.ts';
import { decodeEntities, effectiveTimedLyricScore } from './util.ts';

const KRC_KEY = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]);
const SIGN_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';

export interface KugouSongCandidate {
  id: number;
  name: string;
  artists: string;
  album: string;
  durationMs: number;
  kgHash: string;
  pic?: string;
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function hasKrcHeader(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 107 && bytes[1] === 114 && bytes[2] === 99 && bytes[3] === 49;
}

function looksLikeTimedLyric(text: string): boolean {
  return /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/.test(text)
    || /<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/.test(text)
    || text.trimStart().startsWith('WEBVTT')
    || /\[\d+,\d+\]/.test(text);
}

function krcDecrypt(encrypted: Buffer): string {
  if (encrypted.length <= 4) throw new Error('Invalid KRC data');
  const data = encrypted.subarray(4);
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) {
    decrypted[i] = data[i] ^ KRC_KEY[i % KRC_KEY.length];
  }
  const attempts = [
    () => inflateSync(decrypted),
    () => inflateRawSync(decrypted),
    () => unzipSync(decrypted),
  ];
  for (const attempt of attempts) {
    try {
      return attempt().toString('utf8');
    } catch {
      // try next decompressor
    }
  }
  throw new Error('KRC decompress failed');
}

function decodeDownloadedLyric(bytes: Buffer, contentType: unknown): string {
  const isPlainText = String(contentType) === '2';
  if (isPlainText || !hasKrcHeader(bytes)) {
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    if (looksLikeTimedLyric(text)) return text;
    throw new Error('Unexpected plain lyric payload');
  }
  try {
    return krcDecrypt(bytes);
  } catch (error) {
    const fallback = bytes.toString('utf8');
    if (looksLikeTimedLyric(fallback)) return fallback;
    throw error;
  }
}

function signParams(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort();
  let str = SIGN_SALT;
  for (const key of sortedKeys) {
    str += `${key}=${params[key]}`;
  }
  str += SIGN_SALT;
  return md5(str);
}

export async function requestKugou(
  url: string,
  params: Record<string, string | number>,
  module: string,
  headers: Record<string, string> = {},
): Promise<any> {
  const clientTimeMs = Date.now();
  const clientTimeSec = Math.floor(clientTimeMs / 1000);
  const mid = md5(String(clientTimeMs));
  const finalParams: Record<string, string | number> = { ...params };

  if (module !== 'Lyric') {
    Object.assign(finalParams, {
      userid: finalParams.userid ?? '0',
      appid: '3116',
      token: finalParams.token ?? '',
      clienttime: clientTimeSec,
      iscorrection: '1',
      uuid: '-',
      mid,
      dfid: '-',
      clientver: '11070',
      platform: 'AndroidFilter',
    });
  } else {
    Object.assign(finalParams, {
      appid: '3116',
      clientver: '11070',
    });
  }

  finalParams.signature = signParams(finalParams);
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(finalParams)) {
    urlObj.searchParams.set(key, String(value));
  }

  const res = await request('GET', urlObj.toString(), {
    timeoutMs: 6000,
    headers: {
      'User-Agent': `Android14-1070-11070-201-0-${module}-wifi`,
      Connection: 'Keep-Alive',
      'Accept-Encoding': 'gzip, deflate',
      'KG-Rec': '1',
      'KG-RC': '1',
      'KG-CLIENTTIMEMS': String(clientTimeMs),
      mid,
      ...headers,
    },
  });
  const data = res.json;
  if (!data) throw new Error('Kugou response empty');
  if (data.error_code !== undefined && data.error_code !== 0 && data.error_code !== 200) {
    throw new Error(`Kugou API error ${data.error_code}`);
  }
  return data;
}

function kugouCoverUrl(info: any, hash: string): string {
  const direct = String(info?.Image || info?.album_img || info?.imgUrl || info?.album_img_url || '')
    .trim()
    .replace(/\{size\}/gi, '240');
  if (/^https?:\/\//i.test(direct)) return direct;
  const h = String(hash || info?.FileHash || info?.hash || '').trim();
  if (h.length >= 8) return `https://imgessl.kugou.com/stdmusic/240/${h.slice(0, 8)}/${h}.jpg`;
  return '';
}

function mapSearchResult(info: any): KugouSongCandidate | null {
  const singers = Array.isArray(info?.Singers) ? info.Singers : [];
  const artists = singers.map((s: any) => String(s?.name || '').trim()).filter(Boolean).join(', ')
    || String(info?.singername || '').split('、').map((s: string) => s.trim()).filter(Boolean).join(', ');
  const id = Number(info?.ID || info?.album_audio_id || 0);
  const hash = String(info?.FileHash || info?.hash || '').trim();
  const name = String(info?.SongName || info?.songname || '').replace(/<[^>]+>/g, '').trim();
  if (!hash || !name) return null;
  return {
    id,
    name,
    artists,
    album: String(info?.AlbumName || info?.album_name || '').trim(),
    durationMs: Math.max(0, Number(info?.Duration ?? info?.duration ?? 0)) * 1000,
    kgHash: hash,
    pic: kugouCoverUrl(info, hash),
  };
}

export async function searchKugouSongs(keyword: string, page = 1, pageSize = 20): Promise<KugouSongCandidate[]> {
  const query = keyword.trim();
  if (!query) return [];
  try {
    const data = await requestKugou(
      'http://complexsearch.kugou.com/v2/search/song',
      {
        sorttype: '0',
        keyword: query,
        pagesize: pageSize,
        page,
      },
      'SearchSong',
      { 'x-router': 'complexsearch.kugou.com' },
    );
    return (data?.data?.lists || [])
      .map(mapSearchResult)
      .filter((item: KugouSongCandidate | null): item is KugouSongCandidate => Boolean(item));
  } catch {
    const data = await requestKugou(
      'http://mobiles.kugou.com/api/v3/search/song',
      {
        showtype: '14',
        highlight: '',
        pagesize: String(pageSize),
        tag_aggr: '1',
        plat: '0',
        sver: '5',
        keyword: query,
        correct: '1',
        api_ver: '1',
        version: '9108',
        page: String(page),
      },
      'SearchSong',
    );
    return (data?.data?.info || [])
      .map(mapSearchResult)
      .filter((item: KugouSongCandidate | null): item is KugouSongCandidate => Boolean(item));
  }
}

export async function fetchKugouLyricText(song: KugouSongCandidate): Promise<string> {
  if (!song.kgHash) throw new Error('Missing Kugou hash');
  const searchRes = await requestKugou(
    'https://lyrics.kugou.com/v1/search',
    {
      album_audio_id: song.id,
      duration: song.durationMs,
      hash: song.kgHash,
      keyword: `${song.artists} - ${song.name}`.trim(),
      lrctxt: '1',
      man: 'no',
    },
    'Lyric',
  );
  const candidate = searchRes?.candidates?.[0];
  if (!candidate?.id || !candidate?.accesskey) return '';

  const downloadRes = await requestKugou(
    'http://lyrics.kugou.com/download',
    {
      accesskey: candidate.accesskey,
      charset: 'utf8',
      client: 'mobi',
      fmt: 'krc',
      id: candidate.id,
      ver: '1',
    },
    'Lyric',
  ).catch(async () => requestKugou(
    'http://lyrics.kugou.com/download',
    {
      accesskey: candidate.accesskey,
      charset: 'utf8',
      client: 'mobi',
      fmt: 'lrc',
      id: candidate.id,
      ver: '1',
    },
    'Lyric',
  ));
  const base64 = String(downloadRes?.content || '');
  if (!base64) return '';
  const bytes = Buffer.from(base64, 'base64');
  const lyricText = decodeDownloadedLyric(bytes, downloadRes?.contenttype);
  return decodeEntities(lyricText);
}

export function scoreKugouLyric(text: string): number {
  return effectiveTimedLyricScore(text);
}
