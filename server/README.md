# RyanMusic Server

TypeScript + Hono 后端，替代历史 PHP（`maicong-music/*.php`）。HTTP 接口保持兼容：搜索 POST、`api.php` 签名代理、封面/下载、网易云/QQ 账号。

## 运行

```bash
npm install
npm run dev -- --listen 127.0.0.1 --port 8088 --web-root ../maicong-music
```

生产：

```bash
npm run build
node dist/server.mjs --listen 0.0.0.0 --port 18765 --web-root ../maicong-music
```

## 测试

```bash
npm test
```

相对 PHP 的变化：

- 搜索后的歌词请求改为并行
- 流式代理走 Node `fetch`，Vercel 上超时后仍可 302 到源站
- 桌面端优先启动本进程；找不到 Node 时回退 PHP
- 安卓本机仍嵌入 PHP，失败则连线上 Node 站点
