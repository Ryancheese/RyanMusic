# RyanMusic

基于 [maicong/music](https://github.com/maicong/music) 二次开发的音乐搜索与播放站点（网易云、QQ）。

## 目录

- `maicong-music/` — PHP 站点（当前主版本）

## 本地运行（Docker）

```bash
cd maicong-music
docker compose up -d
```

浏览器访问：**http://localhost:8080**

## 同步代码到容器

修改 `maicong-music` 内文件后，可拷贝进运行中的容器，例如：

```bash
docker cp maicong-music/static/js/music.js ryan-maicong-music:/var/www/html/static/js/music.js
```

## 说明

本项目仅保留 PHP 版。原 Node/Next（`localhost:3000`）方案已移除。
