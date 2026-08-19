import assert from 'node:assert/strict';
import test from 'node:test';
import { playLevelsFromPrivilege } from '../src/netease.ts';

test('playLevelsFromPrivilege uses playMaxBrLevel without probing urls', () => {
  const levels = playLevelsFromPrivilege({ playMaxBrLevel: 'exhigh' });
  assert.deepEqual(levels.map((item) => item.level), ['exhigh', 'higher', 'standard']);
});

test('playLevelsFromPrivilege includes lossless ladder when privilege allows', () => {
  const levels = playLevelsFromPrivilege({ maxBrLevel: 'hires' });
  assert.ok(levels.some((item) => item.level === 'hires'));
  assert.ok(levels.some((item) => item.level === 'lossless'));
  assert.ok(levels.some((item) => item.level === 'exhigh'));
  assert.equal(levels.some((item) => item.level === 'jymaster'), false);
});

test('playLevelsFromPrivilege falls back to bitrate when level name missing', () => {
  const levels = playLevelsFromPrivilege({ pl: 320000 });
  assert.ok(levels.some((item) => item.level === 'exhigh'));
  assert.equal(levels.some((item) => item.level === 'lossless'), false);
});
