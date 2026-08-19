import assert from 'node:assert/strict';
import test from 'node:test';
import { isQqPrivatePlayUrl, isQqTrialMediaUrl } from '../src/util.ts';

test('QQ private play urls are not treated as trial', () => {
  const url = 'https://dl.stream.qqmusic.qq.com/C400xxx.m4a?fromtag=myhkw.cn&code=abc';
  assert.equal(isQqPrivatePlayUrl(url), true);
  assert.equal(isQqTrialMediaUrl(url), false);
});

test('QQ official preview filenames are trial', () => {
  assert.equal(isQqTrialMediaUrl('https://dl.stream.qqmusic.qq.com/RS02xxx.m4a?vkey=1', 'RS02xxx.m4a'), true);
  assert.equal(isQqTrialMediaUrl('https://dl.stream.qqmusic.qq.com/C400xxx.m4a?vkey=1', 'TSA000xxx.m4a'), true);
});

test('plain official C400 without private markers is not auto-trial by filename', () => {
  const url = 'https://dl.stream.qqmusic.qq.com/C400xxx.m4a?guid=10000&vkey=1';
  assert.equal(isQqPrivatePlayUrl(url), false);
  assert.equal(isQqTrialMediaUrl(url, 'C400xxx.m4a'), false);
});
