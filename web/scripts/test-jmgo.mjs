import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const built = await build({ entryPoints: [resolve(web, 'src/visualizer-types.ts')], bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const { normalizeLyricWallTuning: normalize, DEFAULT_LYRIC_WALL_TUNING: defaults } = api;

test('removed and corrupt stored scene IDs migrate, while all six JMGO IDs survive', () => {
  for (const mode of ['floating', 'stardust', 'kinetic', 'aurora', 'unknown', null, 4]) {
    assert.deepEqual(normalize({ mode }), defaults);
  }
  for (const mode of ['flowing', 'mobius', 'shapes', 'elantra', 'matrix', 'vinyl']) {
    assert.equal(normalize({ mode }).mode, mode);
  }
  assert.equal(api.LYRIC_WALL_MODES.length, 6);
});
test('older mode-only settings gain defaults and invalid persisted controls stay bounded', () => {
  assert.deepEqual(normalize({ mode: 'mobius' }), { ...defaults, mode: 'mobius' });
  assert.deepEqual(normalize({ mode: 'vinyl', lyricEffect: 'neon', lyricFont: 'serif', fontScale: 4,
    rhythmEnabled: false, rhythmStrength: -10, inputGain: NaN, shapeVariant: 20 }), {
    ...defaults, mode: 'vinyl', lyricEffect: 'neon', lyricFont: 'serif', fontScale: 1.35, rhythmEnabled: false, rhythmStrength: .4,
  });
  assert.deepEqual(normalize({ lyricEffect: {}, lyricFont: [], fontScale: Infinity, rhythmEnabled: 'false', shapeVariant: null }), defaults);
});
test('settings and shipped runtime agree on all effects, fonts, shapes and scenes', async () => {
  const runtime = await import('../public/jmgo/lyric-effects.js');
  const { scenes } = await import('../public/jmgo/scenes.js');
  assert.deepEqual(api.LYRIC_WALL_EFFECTS.map(x => x.id), runtime.LYRIC_EFFECTS.map(x => x.id));
  assert.deepEqual(api.LYRIC_WALL_FONTS.map(x => x.id), runtime.LYRIC_FONTS.map(x => x.id));
  assert.deepEqual(api.LYRIC_WALL_MODES.map(x => x.id), Object.keys(scenes));
  const shapes = JSON.parse(await readFile(resolve(web, 'public/jmgo/shapes/scene.json')));
  assert.deepEqual(api.LYRIC_WALL_SHAPES, shapes.variants.map(({ id, label }) => ({ id, label })));
  // Catch missing relative runtime imports before shipping a build (especially dynamically loaded renderers).
  for (const name of ['renderer', 'mobius-renderer', 'shapes-renderer', 'elantra-renderer', 'matrix-renderer', 'vinyl-renderer']) {
    const code = await readFile(resolve(web, `public/jmgo/${name}.js`), 'utf8');
    for (const [, path] of code.matchAll(/from\s+['"](.+?)['"]/g)) await access(resolve(web, 'public/jmgo', path));
  }
});
