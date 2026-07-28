# RyanMusic Android

独立 APK：内嵌 PHP（arm64）+ 站点。多数机型安装即可用。

## 安装

1. 打开 [Releases](https://github.com/Ryancheese/RyanMusic/releases) 下载 `RyanMusic-android.apk`
2. 允许「安装未知应用」后安装

## 华为等机型本机 PHP 失败时

部分华为 / HarmonyOS 会拦截应用内启动 PHP，出现「PHP 进程已退出」。请：

1. 电脑打开 RyanMusic（Mac / Windows）
2. 手机与电脑连同一 Wi‑Fi
3. 在手机失败页填写电脑地址，例如 `http://192.168.1.8:18765/`
4. 点「连接」

电脑 IP 可在系统网络设置里查看；端口一般为 `18765`（若被占用会自动顺延）。

## 开发者打包

```bash
bash android/scripts/fetch-php.sh
cd android && gradle assembleRelease
```
