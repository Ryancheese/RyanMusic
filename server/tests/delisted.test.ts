import assert from 'node:assert/strict';
import test from 'node:test';
import { isNeteaseDelisted, isQqDelisted } from '../src/util.ts';

test('isNeteaseDelisted detects st=-200 privilege', () => {
  assert.equal(isNeteaseDelisted({}, { st: -200, pl: 0, dl: 0 }), true);
});

test('isNeteaseDelisted ignores playable songs', () => {
  assert.equal(isNeteaseDelisted({}, { st: 0, pl: 320000, dl: 320000 }), false);
});

test('isNeteaseDelisted ignores cloudsearch false gray st=-100 with maxbr', () => {
  assert.equal(
    isNeteaseDelisted({}, {
      st: -100,
      pl: 0,
      dl: 0,
      maxbr: 999000,
      playMaxbr: 999000,
      fee: 0,
    }),
    false,
  );
});

test('isNeteaseDelisted ignores VIP unplayable-for-guest (st=0 pl=0 with maxbr)', () => {
  assert.equal(
    isNeteaseDelisted({}, {
      st: 0,
      pl: 0,
      dl: 0,
      maxbr: 999000,
      playMaxbr: 999000,
      fee: 1,
    }),
    false,
  );
});

test('isNeteaseDelisted detects gray with no bitrate', () => {
  assert.equal(isNeteaseDelisted({}, { st: -100, pl: 0, dl: 0, maxbr: 0, playMaxbr: 0 }), true);
});

test('isNeteaseDelisted ignores cloudsearch stub privilege without bitrate fields', () => {
  assert.equal(isNeteaseDelisted({}, { st: -100, pl: 0, dl: 0, fee: 0 }), false);
});

test('isQqDelisted ignores VIP paywall', () => {
  assert.equal(isQqDelisted({ action: { play: 1 }, pay: { pay_play: 0, price_play: 200 } }), false);
});

test('isQqDelisted detects action.play=0', () => {
  assert.equal(isQqDelisted({ action: { play: 0 } }), true);
});

test('isQqDelisted ignores playable songs', () => {
  assert.equal(isQqDelisted({ action: { play: 1 } }), false);
});
