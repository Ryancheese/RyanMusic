import assert from 'node:assert/strict';
import test from 'node:test';
import { isFakeIp, isLiteralHost, PROXY_ENV_KEYS, stripProxyEnv } from '../src/http.ts';

test('clash fake-ip range is detected', () => {
  assert.equal(isFakeIp('198.18.0.1'), true);
  assert.equal(isFakeIp('198.18.1.24'), true);
  assert.equal(isFakeIp('198.19.255.255'), true);
  assert.equal(isFakeIp('223.5.5.5'), false);
  assert.equal(isFakeIp('1.1.1.1'), false);
  assert.equal(isFakeIp('music.163.com'), false);
});

test('literal hosts skip public dns bypass', () => {
  assert.equal(isLiteralHost('127.0.0.1'), true);
  assert.equal(isLiteralHost('localhost'), true);
  assert.equal(isLiteralHost('::1'), true);
  assert.equal(isLiteralHost('music.163.com'), false);
});

test('stripProxyEnv clears common vpn keys', () => {
  const env: NodeJS.ProcessEnv = {
    http_proxy: 'http://127.0.0.1:7890',
    HTTPS_PROXY: 'http://127.0.0.1:7890',
    all_proxy: 'socks5://127.0.0.1:7890',
    PATH: '/usr/bin',
  };
  stripProxyEnv(env);
  for (const key of PROXY_ENV_KEYS) {
    assert.equal(env[key], undefined);
  }
  assert.equal(env.NO_PROXY, '*');
  assert.equal(env.PATH, '/usr/bin');
});
