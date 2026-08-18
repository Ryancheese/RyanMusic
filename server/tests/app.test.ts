import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.ts';

function testApp() {
  const dir = mkdtempSync(join(tmpdir(), 'ryanmusic-'));
  return createApp({ webRoot: dir, cacheDir: join(dir, 'cache') });
}

test('api.php rejects missing params', async () => {
  const app = testApp();
  const res = await app.request('/api.php');
  assert.equal(res.status, 400);
  assert.match(await res.text(), /缺少请求参数/);
});

test('xhr search without fields returns 403 payload', async () => {
  const app = testApp();
  const res = await app.request('/', {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'foo=1',
  });
  assert.equal(res.status, 200);
  const json = (await res.json()) as { code: number };
  assert.equal(json.code, 403);
});

test('missing frontend build returns a clear error', async () => {
  const app = testApp();
  const res = await app.request('/');
  assert.equal(res.status, 500);
  assert.match(await res.text(), /前端未构建/);
});
