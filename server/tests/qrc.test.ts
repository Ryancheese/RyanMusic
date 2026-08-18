import assert from 'node:assert/strict';
import test from 'node:test';
import { extractQrcLyricContent, looksLikeQrc } from '../src/crypto/qrcDecrypt.ts';

test('QRC XML unwrap extracts LyricContent', () => {
  const xml =
    '<?xml version="1.0"?><Lyric_1 LyricContent="[0,1200]你(0,200)好(200,200)&#10;[1200,800]啊(1200,200)"/>';
  const extracted = extractQrcLyricContent(xml);
  assert.match(extracted, /\[0,1200\]/);
  assert.match(extracted, /\n/);
});

test('QRC with metadata header still looks like QRC', () => {
  const headed = '[ti:晴天]\n[0,800]你(0,200)好(200,200)';
  assert.equal(looksLikeQrc(headed), true);
});
