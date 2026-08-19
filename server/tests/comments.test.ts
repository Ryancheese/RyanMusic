import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { mapNeteaseComment, isPlaceholderCommentContent } from '../src/comments.ts';

test('mapNeteaseComment keeps nickname, likes and first reply', () => {
  const mapped = mapNeteaseComment({
    commentId: 5031795,
    content: '有些人死了，他还活着',
    time: 1413809782401,
    timeStr: '2014-10-20',
    likedCount: 221724,
    liked: false,
    user: {
      userId: 9080498,
      nickname: '冰凍七音',
      avatarUrl: 'http://p2.music.126.net/TT0r25kNGR8MUxIjp70Ntw==/7888995929432671.jpg',
    },
    beReplied: [{ user: { nickname: '路人' }, content: '原评' }],
    ipLocation: { location: '北京' },
  });
  assert.ok(mapped);
  assert.equal(mapped.id, '5031795');
  assert.equal(mapped.nickname, '冰凍七音');
  assert.equal(mapped.likedCount, 221724);
  assert.equal(mapped.location, '北京');
  assert.equal(mapped.avatar.startsWith('https://'), true);
  assert.deepEqual(mapped.reply, { nickname: '路人', content: '原评' });
});

test('mapNeteaseComment skips empty content', () => {
  assert.equal(mapNeteaseComment({ commentId: 1, content: '  ' }), null);
  assert.equal(mapNeteaseComment({ content: 'hello' }), null);
});

test('mapNeteaseComment skips mobile-only placeholder comments', () => {
  assert.equal(
    mapNeteaseComment({
      commentId: 2,
      content: '伯虎说\n[发布了语音，请前往最新移动端版本查看]',
    }),
    null,
  );
  assert.equal(
    mapNeteaseComment({
      commentId: 3,
      content: '[发布了语音，请前往最新移动端版本查看]',
    }),
    null,
  );
  assert.equal(
    mapNeteaseComment({
      commentId: 4,
      content: '这首歌真的太好听了，循环一整天',
    })?.content,
    '这首歌真的太好听了，循环一整天',
  );
  assert.equal(isPlaceholderCommentContent('[评论已删除]'), true);
});

function xhr(app: ReturnType<typeof createApp>, body: string) {
  return app.request('/', {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

test('netease_comments rejects missing song info', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ryanmusic-'));
  const app = createApp({ webRoot: dir, cacheDir: join(dir, 'cache') });
  const res = await xhr(app, 'action=netease_comments');
  assert.equal(res.status, 200);
  const json = (await res.json()) as { code: number; error: string };
  assert.equal(json.code, 400);
  assert.match(json.error, /缺少歌曲信息/);
});

test('netease_comments rejects non-numeric netease id', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ryanmusic-'));
  const app = createApp({ webRoot: dir, cacheDir: join(dir, 'cache') });
  const res = await xhr(app, 'action=netease_comments&type=netease&id=abc');
  assert.equal(res.status, 200);
  const json = (await res.json()) as { code: number; error: string };
  assert.equal(json.code, 400);
  assert.match(json.error, /ID 无效/);
});
