import { inflateSync, unzipSync } from 'node:zlib';
import { qrcTripleDesDecrypt } from './qrcDes.ts';

function inflateAuto(data: Buffer): Buffer {
  const candidates = [data];
  for (const magic of [Buffer.from([0x78, 0x9c]), Buffer.from([0x78, 0x01]), Buffer.from([0x78, 0xda])]) {
    const pos = data.indexOf(magic);
    if (pos > 0) candidates.push(data.subarray(pos));
  }
  for (const chunk of candidates) {
    try {
      return unzipSync(chunk);
    } catch {
      /* try next */
    }
    try {
      return inflateSync(chunk);
    } catch {
      /* try next */
    }
  }
  throw new Error('QRC inflate failed');
}

export function extractQrcLyricContent(xml: string): string {
  if (!xml) return '';
  const m = xml.match(/LyricContent="([^"]*)"/s) || xml.match(/LyricContent='([^']*)'/s);
  if (!m) return xml;
  const text = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n')
    .replace(/\\n/g, '\n');
  return text.replace(/\r\n/g, '\n');
}

export function looksLikeQrc(content: string): boolean {
  return /\[\d+,\d+\]/.test(content) && content.includes('(');
}

export function qrcPlainOrDecrypt(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (looksLikeQrc(text) || text.startsWith('[')) return text;
  if (!/^[0-9a-fA-F]+$/.test(text.replace(/\s+/g, ''))) return text;
  try {
    const decrypted = qrcTripleDesDecrypt(text);
    const plain = inflateAuto(decrypted).toString('utf8');
    return extractQrcLyricContent(plain) || plain;
  } catch {
    return '';
  }
}

export function decryptQrc(hexCipher: string): string {
  const decrypted = qrcTripleDesDecrypt(hexCipher);
  const plain = inflateAuto(decrypted).toString('utf8');
  return extractQrcLyricContent(plain) || plain;
}
