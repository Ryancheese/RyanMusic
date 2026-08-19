import assert from 'node:assert/strict';
import test from 'node:test';
import { isNeteaseTrialMediaUrl, isNeteaseTrialPlayItem } from '../src/util.ts';

test('netease trial API items are rejected', () => {
  assert.equal(isNeteaseTrialPlayItem({ url: 'https://m7.music.126.net/a.mp3', freeTrialInfo: { start: 0, end: 30 } }), true);
  assert.equal(isNeteaseTrialPlayItem({ url: 'https://m7.music.126.net/a.mp3', time: 30_000 }), true);
  assert.equal(isNeteaseTrialPlayItem({
    url: 'https://m7.music.126.net/a.mp3',
    time: 8_000,
    freeTrialPrivilege: { resConsumable: true },
  }), true);
  assert.equal(isNeteaseTrialPlayItem({ url: 'https://m7.music.126.net/a.mp3', time: 240_000 }), false);
});

test('netease trial wrapper urls are rejected', () => {
  assert.equal(isNeteaseTrialMediaUrl('https://music.163.com/song/media/outer/url?id=123.mp3'), true);
  assert.equal(isNeteaseTrialMediaUrl('https://m7.music.126.net/trial/clip.mp3'), true);
  assert.equal(isNeteaseTrialMediaUrl('https://m7.music.126.net/2024/full.mp3'), false);
});
