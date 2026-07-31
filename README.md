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
| `macos/` | macOS 原生窗口 App（WKWebView）与一键安装脚本 |
| `windows/` | Windows 原生窗口 App（WebView2）与一键安装脚本 |

## 下载 Windows 绿色免安装包（推荐发给朋友）

从 GitHub Releases 下载最新 **`RyanMusic-win-x64.zip`**：

**https://github.com/Ryancheese/RyanMusic/releases**

解压后双击 `RyanMusic.exe` 即可（已内置便携 PHP，无需安装 .NET / PHP）。  
需要系统已有 **WebView2**（Windows 10/11 通常自带）；若提示缺少，安装：[WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

也可在仓库 **Actions → Windows Release Package** 中下载构建产物 Artifact。

本地在 Windows 上打包：

```powershell
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1 -BundlePhp
# 产物：dist\RyanMusic-win\ 与 dist\RyanMusic-win-x64.zip
```

## macOS 一键安装（推荐）

在终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/macos/install.sh | bash
```

脚本会：检测 PHP / Swift 编译器 → 拉取源码 → 编译带内嵌网页窗口的 `RyanMusic.app` → 安装到 `/Applications`。

安装后双击 **应用程序 / RyanMusic** 即可（独立窗口，关掉窗口即停止服务）。

依赖：本机 PHP（可用 Homebrew）、Xcode Command Line Tools（`xcode-select --install`）。

### 更新

朋友或本机需要更新到最新版时，**再执行一次上面的安装命令**即可（会重新编译并覆盖 `/Applications/RyanMusic.app`）。更新前请先完全退出 RyanMusic。

本地已有仓库时也可：

```bash
./macos/install.sh
# 或只打包不安装：
./macos/build-app.sh && open dist/RyanMusic.app
```

## Windows 一键安装（从源码编译安装）

在 **PowerShell** 执行：

```powershell
irm https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/windows/install.ps1 | iex
```

若提示无法识别 `﻿#`，改用（去掉 BOM）：

```powershell
iex ((irm https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/windows/install.ps1) -replace '^\uFEFF','')
```

脚本会：检测/安装 PHP 与 .NET 8 SDK → 拉取源码 → 编译 WebView2 窗口程序 → 安装到 `%LOCALAPPDATA%\RyanMusic` 并创建桌面快捷方式。

依赖：Windows 10/11、PHP、.NET 8 SDK（脚本可用 winget 自动装）、系统自带的 WebView2（Win11 通常已有）。

本地已有仓库时也可：

```powershell
powershell -ExecutionPolicy Bypass -File windows\install.ps1
# 或只打包（不含便携 PHP）：
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1
# 绿色完整包：
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1 -BundlePhp
```

若 `irm` / GitHub raw 连不上，可改用：

```powershell
git clone --depth 1 https://github.com/Ryancheese/RyanMusic.git
cd RyanMusic
powershell -ExecutionPolicy Bypass -File windows\install.ps1
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
