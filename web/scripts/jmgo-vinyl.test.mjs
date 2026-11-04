import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleVinylCurve, createVinylMotion, vinylSpriteGeometry } from '../public/jmgo/vinyl-animation.js';
const scene = JSON.parse(readFileSync(new URL('../public/jmgo/vinyl/scene.json',import.meta.url),'utf8'));

test('source arm clips reproduce their original endpoints and halfway pose', () => {
  for (const [time,angle] of [[0,0],[0.5,-15],[1,-30]]) {
    assert.ok(Math.abs(sampleVinylCurve(scene.animations.TurntableStart,2,time)-angle)<1e-4);
  }
  for (const [time,angle] of [[0,-30],[0.5,-15],[1,0]]) {
    assert.ok(Math.abs(sampleVinylCurve(scene.animations.TurntableStop,2,time)-angle)<1e-4);
  }
});

test('pause can lift the arm while disc position stays frozen and seeking is reproducible', () => {
  const motion = createVinylMotion(scene.animations,6);
  motion({time:0,paused:false},0);
  assert.equal(motion({time:1,paused:false},1).armDegrees,-30);
  assert.equal(motion({time:1,paused:true},1).recordDegrees,-6);
  const lifted = motion({time:1,paused:true},2);
  assert.equal(lifted.armDegrees,0); assert.equal(lifted.recordDegrees,-6);
  assert.equal(motion({time:20,paused:true},3).recordDegrees,-120);
});

test('all original simple and sliced Sprite draw references produce valid geometry', () => {
  for (const draw of scene.draws.filter(draw=>draw.kind==='sprite')) {
    const source = scene.sprites[draw.sprite];
    const geometry = vinylSpriteGeometry(source,draw);
    assert.equal(geometry.uv.length,geometry.positions.length);
    assert.ok(geometry.indices.length>0);
    assert.ok(geometry.indices.every(index=>Number.isInteger(index)&&index>=0&&index<geometry.positions.length));
    if (draw.drawMode===0) assert.equal(geometry.positions,source.positions);
  }
});
