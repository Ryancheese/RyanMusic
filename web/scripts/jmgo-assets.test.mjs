import test from 'node:test';
import assert from 'node:assert/strict';
import { readAsset } from '../public/jmgo/assets.js';

test('cold-scene loads keep at most three requests active through body decoding', async () => {
  const originalFetch = globalThis.fetch;
  let active = 0, peak = 0;
  globalThis.fetch = async url => {
    active++; peak = Math.max(peak, active);
    return { ok:true, text:async () => {
      await new Promise(resolve => setTimeout(resolve, 5)); active--; return String(url);
    } };
  };
  try {
    const urls = Array.from({length:12}, (_, i) => `fixture-${i}`);
    assert.deepEqual(await Promise.all(urls.map(url => readAsset(url))), urls);
    assert.equal(peak, 3); assert.equal(active, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('transient connection loss retries once; HTTP missing assets fail directly', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) throw new TypeError('Failed to fetch');
    return {ok:true,json:async()=>({recovered:true})};
  };
  try {
    assert.deepEqual(await readAsset('fixture-scene.json','json'), {recovered:true});
    assert.equal(attempts, 2);
    attempts = 0;
    globalThis.fetch = async () => { attempts++; return {ok:false,status:404}; };
    await assert.rejects(readAsset('missing.glsl'), /404.*missing\.glsl/);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = originalFetch; }
});
