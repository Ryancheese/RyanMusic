# Web Root

后端 `--web-root` 指向的站点根目录，包含静态资源与运行时缓存。

## 目录

| 路径 | 说明 |
|------|------|
| `static/app/` | React 前端构建产物（`web/` 经 Vite 输出） |
| `static/css/`、`static/js/`、`static/img/` | 兼容旧版页面的静态资源 |
| `static/vendor/` | 第三方前端库 |
| `core/cache/` | 运行时缓存（账号凭证等，不纳入版本控制） |
| `favicon.ico` | 站点图标 |

## 开发

```bash
cd web && npm run build
```

构建完成后，`server/` 默认从本目录提供静态文件：

```bash
cd server && npm run dev -- --web-root ../web-root
```
