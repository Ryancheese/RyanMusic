# RyanMusic Android

独立 APK：内嵌 PHP（arm64）+ 站点，安装即可用，无需电脑开服务。

## 给用户：安装 APK

1. 打开 GitHub [Releases](https://github.com/Ryancheese/RyanMusic/releases) 或 Actions 产物，下载 `app-release.apk`
2. 手机允许「安装未知应用」
3. 安装并打开 **RyanMusic**

要求：arm64 手机（2017 年后主流机型）。首次启动会解压站点并拉起本地 PHP，稍等几秒。

## 开发者：本地打包

依赖：JDK 17、Android SDK（`ANDROID_HOME`）。

```bash
# 1) 拉取内嵌 PHP
bash android/scripts/fetch-php.sh

# 2) 打包
cd android
chmod +x gradlew
./gradlew assembleRelease
```

APK 路径：

`android/app/build/outputs/apk/release/app-release.apk`

也可用 Android Studio 打开 `android/` 目录后 Build → Build APK(s)。

## 说明

- PHP 来自 [pmmp/PHP-Binaries](https://github.com/pmmp/PHP-Binaries)（静态 arm64），构建时下载，不进 Git
- 站点在构建时从仓库根目录 `maicong-music/` 同步到 assets
- 下载歌曲/歌词成功后会 Toast「下载成功」
