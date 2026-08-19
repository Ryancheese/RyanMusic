# RyanMusic Android

独立 APK：WebView 壳 + 在线 Node 服务。安装后即可搜索、播放（仍需联网取流）。

搜索与取流必须经过后端签名代理（网易云 / QQ），所以各端本质是「同一套服务 + WebView」。电脑 / Docker / 线上站点统一使用 **Node（`server/`）**；Android 默认连接线上 Node 站点，也可切到局域网电脑或自建地址。

## 安装

1. 打开 [Releases](https://github.com/Ryancheese/RyanMusic-Releases/releases) 或源码仓 **Actions** 下载 `RyanMusic-android.apk`
2. 允许「安装未知应用」后安装
3. 仅支持 **64 位 ARM** 手机（近年安卓机基本都是）

首次启动若弹出通知权限，请允许，方便切到后台后继续播放。

返回键可切换：**本机服务 / 在线服务 / 自定义服务器**。

## 使用在线服务或局域网服务

默认会连接 [ryanmusic.vercel.app](https://ryanmusic.vercel.app)，一般无需再开电脑。

若线上站点较慢、或想走家里电脑的代理：

1. 电脑打开 RyanMusic（Mac / Windows 已监听局域网）
2. 手机与电脑连同一 Wi‑Fi
3. 电脑托盘 / 菜单选「复制手机访问地址」，粘贴到手机「自定义服务器」
4. 点「连接自定义地址」

也可自建：仓库根目录 `docker compose up`，或 `cd server && npm run dev -- --listen 0.0.0.0 --port 8088`。

## 开发者打包

```bash
cd web && npm ci && npm run build
cd android && ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```
