# RyanMusic

基于 [maicong/music](https://github.com/maicong/music) 二次开发的音乐搜索与播放站点（网易云、QQ）。界面采用 Folia 风格的沉浸式歌词播放器。搜索、歌词与取流由 **TypeScript / Hono** 后端完成（`server/`）；安卓本机仍可回退内嵌 PHP。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `web/` | Folia 风格 React 前端（Vite） |
| `server/` | TypeScript + Hono 后端（搜索、签名代理、账号） |
| `maicong-music/` | 前端静态资源、历史 PHP 实现（安卓本机仍用） |
| `macos/` | macOS 原生窗口 App（WKWebView）与一键安装脚本 |
| `windows/` | Windows 原生窗口 App（WebView2）与一键安装脚本 |
| `android/` | Android 独立 APK（内嵌 PHP + WebView；失败时自动连线上站点） |
| `shared/cloud-origin.txt` | 各端共用的在线服务地址 |

## 下载安装包（推荐发给朋友）

从 GitHub Releases 下载：

**https://github.com/Ryancheese/RyanMusic/releases**

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `RyanMusic-Setup-x64.exe` | 双击按安装向导完成（Node 后端；需 WebView2） |
| macOS Apple Silicon | `RyanMusic-mac-arm64.dmg` | 拖到「应用程序」；首次请右键 → 打开 |
| Android | `RyanMusic-android.apk` | 允许「安装未知应用」后安装（arm64） |

> Intel Mac 暂请使用下方「一键安装」脚本编译安装。

搜索、歌词、取流走同一套后端：电脑 / Docker / Vercel 默认是 `server/`（Node）。手机优先用 APK 内嵌 PHP；被系统拦截时自动连线上站点 [ryanmusic.vercel.app](https://ryanmusic.vercel.app)。若希望手机走家里电脑的代理，电脑版已监听局域网：托盘 / 菜单里「复制手机访问地址」。

也可在 **Actions** 里下载对应 Artifact。

本地打包：

```powershell
# Windows（生成安装向导 exe；需 Node 22+ 构建后端，可选 -BundlePhp 作为回退）
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1
# 产物：dist/RyanMusic-Setup-x64.exe
```

```bash
# macOS（需 Node 22+；可选 --bundle-php 作为回退）
./macos/build-app.sh --dmg
# 产物：dist/RyanMusic-mac-arm64.dmg 或 dist/RyanMusic-mac-x64.dmg
```

```bash
# Android（需 Android SDK / JDK 17）
cd web && npm ci && npm run build
bash android/scripts/fetch-php.sh
cd android && ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

## macOS 一键安装（从源码编译）

在终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/macos/install.sh | bash
```

脚本会：检测 Node.js / Swift 编译器 → 拉取源码 → 编译带内嵌网页窗口的 `RyanMusic.app` → 安装到 `/Applications`。

安装后双击 **应用程序 / RyanMusic** 即可（独立窗口，关掉窗口即停止服务）。

依赖：本机 Node 22+（可用 Homebrew）、Xcode Command Line Tools（`xcode-select --install`）。PHP 仅作找不到 Node 时的回退。

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

脚本会：检测/安装 Node.js 与 .NET 8 SDK → 拉取源码 → 编译 WebView2 窗口程序 → 安装到 `%LOCALAPPDATA%\RyanMusic` 并创建桌面快捷方式。

依赖：Windows 10/11、Node 22+、.NET 8 SDK（脚本可用 winget 自动装）、系统自带的 WebView2（Win11 通常已有）。PHP 仅作找不到 Node 时的回退。

本地已有仓库时也可：

```powershell
powershell -ExecutionPolicy Bypass -File windows\install.ps1
# 或只打包目录（不含安装向导）：
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1 -SkipInstaller
# 完整安装包（内嵌 Node 后端 + 可选 PHP 回退 + Setup.exe）：
powershell -ExecutionPolicy Bypass -File windows\build-app.ps1 -BundlePhp
```

若 `irm` / GitHub raw 连不上，可改用：

```powershell
git clone --depth 1 https://github.com/Ryancheese/RyanMusic.git
cd RyanMusic
powershell -ExecutionPolicy Bypass -File windows\install.ps1
```

## 本地运行（Node / Docker）

```bash
cd web && npm ci && npm run build
cd ../server && npm ci && npm run dev -- --listen 127.0.0.1 --port 8088
```

或 Docker：

```bash
docker compose up -d
```

浏览器访问：**http://localhost:8088**

前端为 Folia 风格的全屏歌词播放器：首页 3D 封面轨、搜索覆层、底部玻璃浮控。播放走同源签名代理流（网易云 / QQ）。

修改 `web/` 后需重新构建：

```bash
cd web && npm install && npm run build
```

## 推送到 GitHub

本地已初始化 Git 仓库，远程为 `git@github.com:Ryancheese/RyanMusic.git`。

若远程仓库尚未创建，在终端执行：

```bash
cd /Volumes/hardDisk_01/project/my/RyanMusic
gh auth login
gh repo create RyanMusic --public --source=. --remote=origin --push \
  --description "RyanMusic - 网易云/QQ 音乐搜索与播放"
```

或先在 GitHub 网页创建空仓库 `RyanMusic`，再执行：

```bash
git push -u origin main
```
