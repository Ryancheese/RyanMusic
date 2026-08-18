# RyanMusic Android

独立 APK：内嵌 PHP（arm64）+ Folia 风格前端。多数机型安装即可搜索、播放（仍需联网取流）。

搜索与取流必须经过 PHP 后端（签名代理网易云 / QQ），所以各端本质是「同一套服务 + WebView」。手机优先用 APK 内嵌的 PHP；部分华为 / HarmonyOS 会拦截应用内启动 PHP，这时会**自动改连线上站点**，不再依赖电脑。

## 安装

1. 打开 [Releases](https://github.com/Ryancheese/RyanMusic/releases) 或 [Actions](https://github.com/Ryancheese/RyanMusic/actions) 下载 `RyanMusic-android.apk`
2. 允许「安装未知应用」后安装
3. 仅支持 **64 位 ARM** 手机（近年安卓机基本都是）

首次启动若弹出通知权限，请允许，方便切到后台后继续播放。

返回键可切换：**本机服务 / 在线服务 / 自定义服务器**。

## 本机 PHP 失败时

部分华为 / HarmonyOS 会拦截应用内启动 PHP。应用会自动连接 [ryanmusic.vercel.app](https://ryanmusic.vercel.app)，一般无需再开电脑。

若线上站点较慢、或想走家里电脑的代理：

1. 电脑打开 RyanMusic（Mac / Windows 已监听局域网）
2. 手机与电脑连同一 Wi‑Fi
3. 电脑托盘 / 菜单选「复制手机访问地址」，粘贴到手机「自定义服务器」
4. 点「连接自定义地址」

也可自建：`php -S 0.0.0.0:8088`（在 `maicong-music/` 目录）。

## 开发者打包

```bash
cd web && npm ci && npm run build
bash android/scripts/fetch-php.sh
cd android && ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```
