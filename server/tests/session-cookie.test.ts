import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactNeteaseCookie,
  cookieHeaderValue,
  packValue,
  persistCookies,
  readPackedCookie,
  serializeBrowserCookie,
  unpackValue,
} from '../src/accounts/browserSession.ts';

test('browser session packs and restores netease cookie', () => {
  const raw = 'MUSIC_U=abc123; __csrf=token';
  const packed = packValue(raw);
  assert.equal(unpackValue(packed), raw);
  const header = `rm_ne=${packed}; other=1`;
  assert.equal(readPackedCookie(header, 'rm_ne'), raw);
  assert.equal(cookieHeaderValue(header, 'other'), '1');
});

test('compact netease cookie keeps MUSIC_U', () => {
  const compact = compactNeteaseCookie('foo=bar; MUSIC_U=xyz; __csrf=c; extra=1');
  assert.equal(compact, 'MUSIC_U=xyz; __csrf=c');
});

test('serialize browser cookie is httpOnly and can be cleared', () => {
  const line = serializeBrowserCookie({ name: 'rm_ne', value: 'abc', maxAge: 60 }, true);
  assert.match(line, /HttpOnly/);
  assert.match(line, /Secure/);
  assert.match(line, /Max-Age=60/);
  const cookies = persistCookies('MUSIC_U=x', 'rm_ne_meta', 'rm_ne', { vip: 11 });
  assert.equal(cookies.length, 2);
  assert.equal(unpackValue(cookies[0].value), 'MUSIC_U=x');
});
