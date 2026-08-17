# RyanMusic Web UI

Folia 风格的 React 前端，构建后输出到 `../maicong-music/static/app/`，由 PHP 模板加载。

## 开发

先在本机启动 PHP（Docker 或内置服务器）：

```bash
cd ../maicong-music
php -S 127.0.0.1:8088
```

再启动前端：

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。Vite 会把搜索 POST 与 `api.php` 代理到 `http://127.0.0.1:8088`。

若 PHP 不在 8088：

```bash
VITE_PHP_ORIGIN=http://127.0.0.1:18765 npm run dev
```

## 生产构建

```bash
npm run build
```

产物供桌面端与 Docker 直接使用，无需 Node。
