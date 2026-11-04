import test from 'node:test';
import assert from 'node:assert/strict';
import { createRhythmTracker } from '../public/jmgo/rhythm.js';
import { elantraRhythmBands } from '../public/jmgo/elantra-renderer.js';

const snapshot = (time, low = 0, mid = 0, bands = Array(8).fill(0)) => ({ time, low, mid, bands });

test('silence and invalid analyser values do not produce rhythm or bursts', () => {
  const tracker = createRhythmTracker();
  for (let i = 0; i < 240; i++) {
    const result = tracker.update({ time: i / 60, low: NaN, mid: -1, bands: [NaN, Infinity, -1] });
    assert.equal(result.low, 0); assert.equal(result.mid, 0);
    assert.deepEqual(result.bands, Array(8).fill(0));
    assert.equal(result.energy, 0); assert.equal(result.beat, 0); assert.equal(result.onset, false);
  }
});

test('separate tone bands stay separate after adaptive normalization', () => {
  const tracker = createRhythmTracker();
  tracker.update(snapshot(0));
  let result;
  for (let i = 1; i <= 20; i++) result = tracker.update(snapshot(i / 60, 0, 0.6, [0, 0, 0, 0, 0.6, 0, 0, 0]));
  assert.equal(result.bands[1], 0); assert.ok(result.bands[4] > 0.8);
  assert.equal(result.low, 0); assert.ok(result.mid > 0.8);
});

test('pause freezes envelopes and seek resets the beat without a false onset', () => {
  const tracker = createRhythmTracker();
  tracker.update(snapshot(0));
  for (let i = 1; i < 30; i++) tracker.update(snapshot(i / 60));
  const active = tracker.update(snapshot(0.5, 0.8, 0.4));
  assert.equal(active.onset, true); assert.ok(active.beat > 0.5);
  const paused = tracker.update({ ...snapshot(0.5), paused: true });
  assert.deepEqual(paused, { ...active, onset: false });
  assert.deepEqual(tracker.update({ ...snapshot(0.5, 1, 1), paused: true }), paused);
  const seeked = tracker.update({ ...snapshot(8), paused: true });
  assert.equal(seeked.beat, 0); assert.equal(seeked.onset, false); assert.equal(seeked.energy, 0);
  const backward = tracker.update(snapshot(1, 0.8, 0.5));
  assert.equal(backward.beat, 0); assert.equal(backward.onset, false);
});

function runPulseTrain(fps) {
  const tracker = createRhythmTracker(), onsets = [], checkpoints = [];
  for (let frame = 0; frame <= fps * 5; frame++) {
    const time = frame / fps;
    const phase = time % 0.5;
    const pulse = time >= 0.5 && phase < 0.1 ? 0.85 : 0.025;
    const result = tracker.update(snapshot(time, pulse, pulse * 0.35));
    if (result.onset) onsets.push(time);
    if (frame % (fps / 2) === Math.round(fps * 0.3)) checkpoints.push(result.low);
  }
  return { onsets, checkpoints };
}

test('pulse detection and release timing agree at 30, 60 and 120 FPS', () => {
  const results = [30, 60, 120].map(runPulseTrain);
  for (const result of results) assert.ok(result.onsets.length >= 8 && result.onsets.length <= 10);
  assert.ok(Math.max(...results.map(r => r.onsets.length)) - Math.min(...results.map(r => r.onsets.length)) <= 1);
  for (let i = 0; i < 8; i++) assert.ok(Math.abs(results[0].onsets[i] - results[2].onsets[i]) < 0.05);
  for (let i = 0; i < results[0].checkpoints.length; i++) assert.ok(Math.abs(results[0].checkpoints[i] - results[2].checkpoints[i]) < 0.12);
});

test('sustained input produces an initial attack rather than repeated fake beats', () => {
  const tracker = createRhythmTracker(); tracker.update(snapshot(0));
  let onsets = 0;
  for (let i = 1; i < 240; i++) {
    const value = i >= 30 ? 0.6 : 0;
    onsets += Number(tracker.update(snapshot(i / 60, value, value * 0.4)).onset);
  }
  assert.equal(onsets, 1);
});

test('Elantra strengthens measured bands while raw mode preserves the previous input', () => {
  const bands = [0, 0, 0, 0, 0.7, 0, 0, 0];
  assert.deepEqual(elantraRhythmBands({ bands, rhythmEnabled: false }), bands);
  const enhanced = elantraRhythmBands({ bands });
  assert.ok(enhanced[4] > bands[4]);
  assert.equal(enhanced[0], 0); assert.equal(enhanced[7], 0);
  const kick = elantraRhythmBands({ bands: Array(8).fill(0), beat: 1 });
  assert.ok(kick[0] > kick[2]); assert.equal(kick[7], 0);
  assert.deepEqual(elantraRhythmBands({ bands: Array(8).fill(0), beat: 0 }), Array(8).fill(0));
});
