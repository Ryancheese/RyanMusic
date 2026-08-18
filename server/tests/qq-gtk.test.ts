import assert from 'node:assert/strict';
import test from 'node:test';
import { getGtk, hash33 } from '../src/accounts/session.ts';

test('ptqrtoken hash33 matches QQ ptlogin', () => {
  assert.equal(hash33('abc'), 2147483647 & (() => {
    let e = 0;
    for (const ch of 'abc') e += (e << 5) + ch.charCodeAt(0);
    return e;
  })());
});

test('oauth g_tk starts at 5381 unlike ptqrtoken hash33', () => {
  const skey = 'test_p_skey';
  assert.notEqual(getGtk(skey), hash33(skey));
  let hash = 5381;
  for (const ch of skey) hash += (hash << 5) + ch.charCodeAt(0);
  assert.equal(getGtk(skey), hash & 0x7fffffff);
});
