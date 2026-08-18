import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeEntities, firstTruthy, isBadMediaUrl, isTrialMediaUrl, neteaseLyricText, nameSearchSourcePage, sliceNameSearchSongids, timedLyricScore } from '../src/util.ts';

test('netease lyric payload prefers yrc and word-level translation', () => {
  const payload = {
    lrc: { lyric: '[00:01.00]hello' },
    yrc: { lyric: '[1000,2000](1000,200,0)hello' },
    ytlrc: { lyric: '[00:01.00]逐字翻译' },
    tlyric: { lyric: '[00:01.00]line translation' },
  };
  assert.equal(neteaseLyricText(payload, 'lrc'), '[00:01.00]hello');
  assert.equal(neteaseLyricText(payload, 'yrc'), '[1000,2000](1000,200,0)hello');
  assert.equal(neteaseLyricText(payload, 'tlyric'), '[00:01.00]逐字翻译');
  assert.equal(neteaseLyricText(null, 'yrc'), '');
});

test('decode numeric html entities used by QQ private-chain lyrics', () => {
  const encoded = '[ti&#58;遗憾]\n[00&#58;27&#46;510]别再说是谁的错';
  assert.equal(decodeEntities(encoded), '[ti:遗憾]\n[00:27.510]别再说是谁的错');
  assert.ok(timedLyricScore(decodeEntities(encoded)) > 0);
});

test('netease v1 json lyric lines convert to timed lrc', () => {
  const payload = {
    lrc: {
      lyric: '{"t":27510,"c":[{"tx":"别再说是谁的错"}]}\n[00:37.290]除非放下心中的负累',
    },
    yrc: { lyric: '{"t":0,"c":[{"tx":"作词: "}]}\n[27620,7010](27620,310,0)别' },
  };
  const lrc = neteaseLyricText(payload, 'lrc');
  const yrc = neteaseLyricText(payload, 'yrc');
  assert.match(lrc, /^\[00:27\.510\]别再说是谁的错/m);
  assert.match(lrc, /\[00:37\.290\]除非放下心中的负累/);
  assert.match(yrc, /\[27620,7010\]/);
  assert.ok(timedLyricScore(yrc) >= 10);
});

test('name search paging uses source page and first 10 ids', () => {
  assert.equal(nameSearchSourcePage(1), 1);
  assert.equal(nameSearchSourcePage(3), 3);
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepEqual(sliceNameSearchSongids(ten, 1), { songids: ten, has_more: true });
  assert.deepEqual(sliceNameSearchSongids([1, 2], 1), { songids: [1, 2], has_more: false });
});

test('play URL race returns first usable result', async () => {
  const late = () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 20));
  assert.equal(await firstTruthy([() => Promise.resolve(null), () => Promise.resolve('fast'), late]), 'fast');
  assert.equal(await firstTruthy([() => Promise.resolve(null), () => Promise.reject(new Error('no'))]), null);
});

test('trial media urls are rejected', () => {
  assert.equal(isTrialMediaUrl('https://m801.music.126.net/trial/foo.mp3'), true);
  assert.equal(isBadMediaUrl('https://m801.music.126.net/freeTrial/foo.mp3'), true);
  assert.equal(isBadMediaUrl('https://music.163.com/404'), true);
  assert.equal(isBadMediaUrl('https://m801.music.126.net/full.mp3'), false);
});
