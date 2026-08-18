import assert from 'node:assert/strict';
import test from 'node:test';
import { sign, verifySign } from '../src/sign.ts';

test('proxy signature round-trip', () => {
  const secret = 'test-secret';
  const t = String(Math.floor(Date.now() / 1000));
  const token = sign(secret, 'url', 'netease', '123', t);
  assert.equal(token.length, 13);
  assert.equal(verifySign(secret, 'url', 'netease', '123', t, token), true);
  assert.equal(verifySign(secret, 'url', 'netease', '123', t, 'nope'), false);
  assert.equal(verifySign(secret, 'pic', 'netease', '123', t, token), false);
});
