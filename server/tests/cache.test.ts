import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FileCache } from '../src/cache.ts';

test('clearSafe removes rebuildable cache but keeps auth sessions', () => {
  const root = mkdtempSync(join(tmpdir(), 'ryanmusic-cache-'));
  const cache = new FileCache(root);
  cache.write('netease_play_v4', '123', { url: 'https://x', expires: 9e9 });
  cache.write('qq_lyric_v2', 'mid', { lyrics: { lrc: 'a' }, expires: 9e9 });
  mkdirSync(join(root, 'netease_auth'), { recursive: true });
  writeFileSync(join(root, 'netease_auth', 'session.json'), '{"ok":1}');
  mkdirSync(join(root, 'qq_auth'), { recursive: true });
  writeFileSync(join(root, 'qq_auth', 'session.json'), '{"ok":1}');

  const result = cache.clearSafe();
  assert.ok(result.removedEntries >= 2);
  assert.ok(result.preserved.includes('netease_auth'));
  assert.ok(result.preserved.includes('qq_auth'));
  assert.equal(existsSync(join(root, 'netease_play_v4')), false);
  assert.equal(existsSync(join(root, 'qq_lyric_v2')), false);
  assert.equal(existsSync(join(root, 'netease_auth', 'session.json')), true);
  assert.equal(existsSync(join(root, 'qq_auth', 'session.json')), true);
});

test('usage reports rebuildable cache separately from auth sessions', () => {
  const root = mkdtempSync(join(tmpdir(), 'ryanmusic-cache-usage-'));
  const cache = new FileCache(root);
  cache.write('netease_play_v4', '123', { url: 'https://x', expires: 9e9 });
  mkdirSync(join(root, 'netease_auth'), { recursive: true });
  writeFileSync(join(root, 'netease_auth', 'session.json'), '{"ok":1}');

  const before = cache.usage();
  assert.ok(before.rebuildableBytes > 0);
  assert.ok(before.preservedBytes > 0);
  assert.equal(before.totalBytes, before.rebuildableBytes + before.preservedBytes);
  assert.ok(before.rebuildableEntries >= 1);

  cache.clearSafe();
  const after = cache.usage();
  assert.equal(after.rebuildableBytes, 0);
  assert.equal(after.rebuildableEntries, 0);
  assert.ok(after.preservedBytes > 0);
});
