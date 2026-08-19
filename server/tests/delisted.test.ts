import assert from 'node:assert/strict';
import test from 'node:test';
import { isNeteaseDelisted, isQqDelisted } from '../src/util.ts';

test('isNeteaseDelisted detects st=-200 privilege', () => {
  assert.equal(isNeteaseDelisted({}, { st: -200, pl: 0, dl: 0 }), true);
});

test('isNeteaseDelisted ignores playable songs', () => {
  assert.equal(isNeteaseDelisted({}, { st: 0, pl: 320000, dl: 320000 }), false);
});

test('isQqDelisted detects action.play=0', () => {
  assert.equal(isQqDelisted({ action: { play: 0 } }), true);
});

test('isQqDelisted ignores playable songs', () => {
  assert.equal(isQqDelisted({ action: { play: 1 } }), false);
});
