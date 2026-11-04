import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLyricBlockLayout, findActiveLyricIndex, lyricScrollOffset } from '../public/jmgo/vinyl-lyrics.js';

function separated(layout, offset, minimumGap) {
  for (let i = 0; i + 1 < layout.starts.length; i++) {
    const previousBottom = layout.starts[i] - offset + layout.heights[i];
    const nextTop = layout.starts[i + 1] - offset;
    assert.ok(nextTop - previousBottom >= minimumGap - 1e-8);
  }
}

test('wrapped CJK, newline and Latin measured blocks reserve the full active height', () => {
  // Heights represent DOM measurements for short, CJK-wrapped, explicit-newline,
  // and unbroken-Latin wrapped blocks at both inactive and selected active size.
  const profiles = [{ inactive: 30, active: 36 }, { inactive: 60, active: 108 }, { inactive: 90, active: 144 }, { inactive: 120, active: 180 }];
  for (let activeIndex = 0; activeIndex < profiles.length; activeIndex++) {
    const layout = buildLyricBlockLayout(profiles, activeIndex, 16);
    assert.equal(layout.heights[activeIndex], profiles[activeIndex].active);
    for (const progress of [0, 0.1, 0.5, 1, 100]) {
      const offset = lyricScrollOffset(layout, { activeIndex, time: 10 + progress, lineStart: 10, anchor: 180 });
      separated(layout, offset, 16);
    }
  }
});

test('pause and forward/backward seek produce deterministic bounded offsets', () => {
  const profiles = [{ inactive: 30, active: 40 }, { inactive: 100, active: 140 }, { inactive: 30, active: 40 }];
  const layout = buildLyricBlockLayout(profiles, 1, 20);
  const params = { activeIndex: 1, lineStart: 5, lineEnd: 5.3, duration: 0.6667, anchor: 100 };
  const paused = lyricScrollOffset(layout, { ...params, time: 5.15 });
  assert.equal(paused, lyricScrollOffset(layout, { ...params, time: 5.15 }));
  assert.equal(lyricScrollOffset(layout, { ...params, time: 100 }), layout.centers[1] - 100);
  assert.equal(lyricScrollOffset(layout, { ...params, time: -100 }), layout.centers[0] - 100);
  assert.equal(lyricScrollOffset(layout, { ...params, time: 5.15 }), paused);
  separated(layout, paused, 20);
});

test('line lookup handles repeated timestamps and pre-roll without duplicating active indices', () => {
  const lines = [{ startTime: 2 }, { startTime: 5 }, { startTime: 5 }, { startTime: 10 }];
  assert.equal(findActiveLyricIndex(lines, 0), -1);
  assert.equal(findActiveLyricIndex(lines, 5), 2);
  assert.equal(findActiveLyricIndex(lines, 100), 3);
  assert.equal(findActiveLyricIndex([], 1), -1);
  assert.deepEqual(buildLyricBlockLayout([], -1), { starts: [], heights: [], centers: [], totalHeight: 0 });
  assert.equal(lyricScrollOffset(buildLyricBlockLayout([], -1), { activeIndex: -1, time: 0 }), 0);
});
