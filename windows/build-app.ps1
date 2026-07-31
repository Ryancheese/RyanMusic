# RyanMusic Windows 打包脚本（绿色免安装包）
# 用法（在仓库根目录或 windows 目录）：
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1 -BundlePhp
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1 -BundlePhp -SkipZip

param(
  [switch]$BundlePhp,
  [switch]$SkipZip
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WinDir = Join-Path $Root "windows"
$DistDir = Join-Path $Root "dist\RyanMusic-win"
$ZipPath = Join-Path $Root "dist\RyanMusic-win-x64.zip"
$MusicSrc = Join-Path $Root "maicong-music"
$Csproj = Join-Path $WinDir "RyanMusic.csproj"
# CLI / 内置服务器用 NTS；latest 别名跟随官方小版本更新
$PhpZipUrl = "https://windows.php.net/downloads/releases/latest/php-8.3-nts-Win32-vs16-x64-latest.zip"

# 刷新 PATH，避免刚装完 SDK 找不到
$machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$user = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machine;$user;${env:ProgramFiles}\dotnet;${env:ProgramFiles(x86)}\dotnet"

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
  Write-Error "未找到 dotnet。请安装 .NET 8 SDK：https://dotnet.microsoft.com/download"
}

$sdks = & dotnet --list-sdks 2>$null
if (-not $sdks -or -not ($sdks | Where-Object { $_ -match '^\d+\.\d+\.\d+' })) {
  Write-Error "未找到 .NET SDK（仅有 runtime 无法编译）。请执行：winget install --id Microsoft.DotNet.SDK.8 -e"
}

if (-not (Test-Path $Csproj)) {
  Write-Error "找不到 $Csproj"
}

if (-not (Test-Path $MusicSrc)) {
  Write-Error "找不到 $MusicSrc"
}

function Write-PortablePhpIni([string]$PhpDir) {
  $iniPath = Join-Path $PhpDir "php.ini"
  $ini = @"
; RyanMusic portable PHP
extension_dir="ext"
extension=curl
extension=openssl
extension=mbstring
extension=fileinfo
date.timezone=Asia/Shanghai
memory_limit=256M
max_execution_time=60
display_errors=0
"@
  Set-Content -Path $iniPath -Value $ini -Encoding ASCII
}

function Install-BundledPhp([string]$TargetPhpDir) {
  Write-Host "==> 下载便携 PHP"
  $tmpRoot = Join-Path $env:TEMP ("ryanmusic-php-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmpRoot | Out-Null
  $zipFile = Join-Path $tmpRoot "php.zip"
  try {
    Write-Host "    $PhpZipUrl"
    Invoke-WebRequest -Uri $PhpZipUrl -OutFile $zipFile -UseBasicParsing
    $extractDir = Join-Path $tmpRoot "extract"
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

    # zip 解压后可能是扁平目录或带子目录
    $phpExe = Get-ChildItem -Path $extractDir -Filter "php.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if (-not $phpExe) {
      throw "PHP zip 中未找到 php.exe"
    }
    $srcPhpDir = $phpExe.Directory.FullName

    if (Test-Path $TargetPhpDir) {
      Remove-Item -Recurse -Force $TargetPhpDir
    }
    New-Item -ItemType Directory -Path $TargetPhpDir | Out-Null
    Copy-Item -Path (Join-Path $srcPhpDir "*") -Destination $TargetPhpDir -Recurse -Force

    Write-PortablePhpIni $TargetPhpDir

    $bundled = Join-Path $TargetPhpDir "php.exe"
    if (-not (Test-Path $bundled)) {
      throw "便携 PHP 安装失败：$bundled"
    }
    Write-Host "    已安装：$bundled"
  } finally {
    if (Test-Path $tmpRoot) {
      Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "==> 清理旧包"
if (Test-Path $DistDir) {
  Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path $DistDir | Out-Null
$distParent = Split-Path $DistDir -Parent
if (-not (Test-Path $distParent)) {
  New-Item -ItemType Directory -Path $distParent | Out-Null
}
if ((Test-Path $ZipPath) -and -not $SkipZip) {
  Remove-Item -Force $ZipPath
}

Write-Host "==> 发布自包含可执行文件 (win-x64)"
Push-Location $WinDir
try {
  & dotnet publish $Csproj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $DistDir
  if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish 失败 (exit=$LASTEXITCODE)"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $DistDir "RyanMusic.exe"))) {
  Write-Error "发布完成但未找到 RyanMusic.exe"
}

Write-Host "==> 复制站点文件"
$MusicDst = Join-Path $DistDir "maicong-music"
robocopy $MusicSrc $MusicDst /E /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD .git core\cache node_modules `
  /XF .DS_Store | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Error "复制站点文件失败 (robocopy=$LASTEXITCODE)"
}
New-Item -ItemType Directory -Force -Path (Join-Path $MusicDst "core\cache") | Out-Null

# 复制图标到输出目录（备用）
$icoSrc = Join-Path $WinDir "AppIcon.ico"
if (Test-Path $icoSrc) {
  Copy-Item $icoSrc (Join-Path $DistDir "AppIcon.ico") -Force
}

if ($BundlePhp) {
  Install-BundledPhp (Join-Path $DistDir "php")
}

Write-Host "==> 写入使用说明"
$readmeTxt = @"
RyanMusic Windows 绿色免安装包
==============================

1. 解压本压缩包到任意目录（建议路径不含中文亦可）。
2. 双击 RyanMusic.exe 即可使用。
3. 本包已内置 PHP（php 目录），无需单独安装 .NET / PHP。
4. 需要系统已安装 Microsoft Edge WebView2 Runtime（Windows 10/11 通常自带）。
   若启动提示缺少 WebView2，请安装：
   https://developer.microsoft.com/microsoft-edge/webview2/

关闭窗口即退出程序并停止本地服务。
"@
Set-Content -Path (Join-Path $DistDir "使用说明.txt") -Value $readmeTxt -Encoding UTF8

if (-not $SkipZip) {
  Write-Host "==> 打包 zip"
  if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
  }
  Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
  Write-Host "已生成：$ZipPath"
}

Write-Host ""
Write-Host "已生成目录：$DistDir"
Write-Host "运行：$DistDir\RyanMusic.exe"
if ((-not $SkipZip) -and (Test-Path $ZipPath)) {
  $sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
  Write-Host "压缩包：$ZipPath ($sizeMb MB)"
}
