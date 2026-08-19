import assert from 'node:assert/strict';
import test from 'node:test';
import { pickBestCrossPlayTrack } from '../src/crossPlay.ts';
import type { Track } from '../src/config.ts';

function track(title: string, author: string, songid: string): Track {
  return {
    type: 'qq',
    songid,
    title,
    author,
    link: '',
    lrc: '',
    url: '',
    pic: '',
  };
}

test('pickBestCrossPlayTrack strict mode rejects artist mismatch below threshold', () => {
  const result = pickBestCrossPlayTrack(
    { title: '画中游', artist: '清洢' },
    [track('画中游', '王秋实', '001')],
    'strict',
  );
  assert.equal(result, null);
});

test('pickBestCrossPlayTrack titleOnly mode accepts same-title cover', () => {
  const result = pickBestCrossPlayTrack(
    { title: '画中游', artist: '清洢' },
    [track('画中游', '王秋实', '001')],
    'titleOnly',
  );
  assert.equal(result?.songid, '001');
});

test('pickBestCrossPlayTrack titleOnly mode rejects weak title match', () => {
  const result = pickBestCrossPlayTrack(
    { title: '画中游', artist: '清洢' },
    [track('完全不同的歌', '某人', '002')],
    'titleOnly',
  );
  assert.equal(result, null);
});
