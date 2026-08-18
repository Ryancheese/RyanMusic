# RyanMusic Web UI

Folia 风格的 React 前端，构建后输出到 `../maicong-music/static/app/`，由 Node 后端（或历史 PHP 模板）加载。

## 开发

先启动后端：

```bash
cd ../server
npm install
npm run dev -- --listen 127.0.0.1 --port 8088 --web-root ../maicong-music
```

再启动前端：

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。Vite 会把搜索 POST 与 `api.php` 代理到 `http://127.0.0.1:8088`。

若后端不在 8088：

```bash
VITE_API_ORIGIN=http://127.0.0.1:18765 npm run dev
```

## 生产构建

```bash
npm run build
```

产物供桌面端与 Docker 直接使用。
