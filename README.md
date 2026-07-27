# RyanMusic

基于 [maicong/music](https://github.com/maicong/music) 二次开发的音乐搜索与播放站点（网易云、QQ）。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `maicong-music/index.php` | 后端入口（搜索 API、下载代理） |
| `maicong-music/core/music.php` | 平台聚合与 curl 逻辑 |
| `maicong-music/template/` | 前端页面模板 |
| `maicong-music/static/` | 前端 CSS / JS / 图片 |
| `maicong-music/docker-compose.yml` | Docker 部署 |
| `macos/` | macOS 轻量启动器与一键安装脚本 |

## macOS 一键安装（推荐）

在终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/macos/install.sh | bash
```

脚本会：检测/安装 PHP → 拉取源码 → 打包 `RyanMusic.app` → 安装到 `/Applications`。

安装后双击 **应用程序 / RyanMusic** 即可，无需再手动开服务。

本地已有仓库时也可：

```bash
./macos/install.sh
# 或只打包不安装：
./macos/build-app.sh && open dist/RyanMusic.app
```

## 本地运行（Docker）

```bash
cd maicong-music
docker compose up -d
```

浏览器访问：**http://localhost:8088**

## 同步代码到容器

修改 `maicong-music` 内文件后，可拷贝进运行中的容器，例如：

```bash
docker cp maicong-music/static/js/music.js ryan-maicong-music:/var/www/html/static/js/music.js
```

## 推送到 GitHub

本地已初始化 Git 仓库，远程为 `git@github.com:Ryancheese/RyanMusic.git`。

若远程仓库尚未创建，在终端执行：

```bash
cd /Volumes/hardDisk_01/project/my/RyanMusic
gh auth login
gh repo create RyanMusic --public --source=. --remote=origin --push \
  --description "RyanMusic - 网易云/QQ 音乐搜索与播放（PHP）"
```

或先在 GitHub 网页创建空仓库 `RyanMusic`，再执行：

```bash
git push -u origin main
```
