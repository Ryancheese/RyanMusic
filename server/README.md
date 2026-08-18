# RyanMusic Server

TypeScript + Hono 统一后端，替代历史 PHP。HTTP 接口保持兼容：搜索 POST、`api.php` 签名代理、封面/下载、逐字歌词、网易云/QQ 账号。

## 多端部署

| 平台 | 后端来源 |
|------|----------|
| macOS / Windows | 内嵌 `server/dist/server.mjs` + 系统/内置 Node 22+ |
| Android | 默认连接 `shared/cloud-origin.txt` 线上 Node 服务；可改局域网/自定义地址 |
| Web / iOS (PWA) | Vercel `api/index.ts` 或任意部署的 Node 服务 |
| Docker / 自托管 | `docker compose up` |

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

## 能力

- 网易/QQ 搜索、播放链代理（匿名链 + 登录态高品质）
- `action=lyrics` 逐字歌词（网易 YRC、QQ QRC 解密）
- 账号扫码/Cookie 登录、云端歌单
- 并行歌词拉取、Node 流式代理

## 免费听歌

未登录时使用 RyanMusic 匿名代理链；登录后优先官方 CDN（会员可用高品质），失败自动回退匿名链。
