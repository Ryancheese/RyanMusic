# RyanMusic Android

独立 APK：内嵌 PHP（arm64）+ Folia 风格前端。多数机型安装即可离线搜索、播放（仍需联网取流）。

## 安装

1. 打开 [Releases](https://github.com/Ryancheese/RyanMusic/releases) 或 [Actions](https://github.com/Ryancheese/RyanMusic/actions) 下载 `RyanMusic-android.apk`
2. 允许「安装未知应用」后安装
3. 仅支持 **64 位 ARM** 手机（近年安卓机基本都是）

首次启动若弹出通知权限，请允许，方便切到后台后继续播放。

## 华为等机型本机 PHP 失败时

部分华为 / HarmonyOS 会拦截应用内启动 PHP，出现「PHP 进程已退出」。请：

1. 电脑打开 RyanMusic（Mac / Windows），或 `php -S 0.0.0.0:8088`
2. 手机与电脑连同一 Wi‑Fi
3. 在手机失败页填写电脑地址，例如 `http://192.168.1.8:8088/`
4. 点「连接」

## 开发者打包

```bash
cd web && npm ci && npm run build
bash android/scripts/fetch-php.sh
cd android && ./gradlew assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```
