import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(secret: string, get: string, type: string, id: string, t: string): string {
  const payload = `${get}|${type}|${id}|${t}`;
  const raw = createHmac('sha256', secret).update(payload).digest();
  return raw
    .toString('base64')
    .replace(/\+/g, '.')
    .replace(/\//g, '_')
    .replace(/=/g, '-')
    .slice(0, 13);
}

export function verifySign(
  secret: string,
  get: string,
  type: string,
  id: string,
  t: string,
  given: string,
): boolean {
  if (!given || !t) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 86400) return false;
  const expected = sign(secret, get, type, id, t);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxyUrl(secret: string, get: string, type: string, id: string): string {
  const t = String(Math.floor(Date.now() / 1000));
  const params = new URLSearchParams({
    get,
    type,
    id,
    sign: sign(secret, get, type, id, t),
    t,
  });
  return `api.php?${params.toString()}`;
}
