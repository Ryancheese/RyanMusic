import assert from 'node:assert/strict';
import test from 'node:test';
import { neteaseLyricText, nameSearchSourcePage, sliceNameSearchSongids } from '../src/util.ts';

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

test('name search paging uses source page and first 10 ids', () => {
  assert.equal(nameSearchSourcePage(1), 1);
  assert.equal(nameSearchSourcePage(3), 3);
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepEqual(sliceNameSearchSongids(ten, 1), { songids: ten, has_more: true });
  assert.deepEqual(sliceNameSearchSongids([1, 2], 1), { songids: [1, 2], has_more: false });
});
