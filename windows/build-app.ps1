# RyanMusic Windows 打包脚本（Inno Setup 安装向导）
# 用法（在仓库根目录或 windows 目录）：
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1 -BundlePhp
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1 -BundlePhp -SkipInstaller
#   powershell -ExecutionPolicy Bypass -File windows/build-app.ps1 -BundlePhp -AlsoZip

param(
  [switch]$BundlePhp,
  [switch]$BundleNode,
  [switch]$NoBundleNode,
  [switch]$SkipInstaller,
  [switch]$AlsoZip,
  # 兼容旧参数：跳过压缩包（现默认就不打 zip）
  [switch]$SkipZip
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WinDir = Join-Path $Root "windows"
$DistDir = Join-Path $Root "dist\RyanMusic-win"
$SetupPath = Join-Path $Root "dist\RyanMusic-Setup-x64.exe"
$ZipPath = Join-Path $Root "dist\RyanMusic-win-x64.zip"
$IssPath = Join-Path $WinDir "RyanMusic.iss"
$MusicSrc = Join-Path $Root "maicong-music"
$Csproj = Join-Path $WinDir "RyanMusic.csproj"
# CLI / 内置服务器用 NTS；latest 别名跟随官方小版本更新
$PhpZipUrl = "https://windows.php.net/downloads/releases/latest/php-8.3-nts-Win32-vs16-x64-latest.zip"
# 固定版本，避免 download.php 跳转到 HTML 页面
$InnoSetupVersion = "6.7.3"
$NodeBundleVersion = if ($env:NODE_BUNDLE_VERSION) { $env:NODE_BUNDLE_VERSION } else { "22.18.0" }
# 默认内嵌 Node；可用 -NoBundleNode 跳过
$ShouldBundleNode = -not $NoBundleNode.IsPresent
if ($BundleNode.IsPresent) { $ShouldBundleNode = $true }
$InnoSetupUrl = "https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-$InnoSetupVersion.exe"

# 刷新 PATH，避免刚装完 SDK 找不到
$machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$user = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machine;$user;${env:ProgramFiles}\dotnet;${env:ProgramFiles(x86)}\dotnet;$env:Path"

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

function Get-AppVersion {
  $raw = Get-Content -Path $Csproj -Raw -Encoding UTF8
  if ($raw -match '<Version>\s*([^<]+)\s*</Version>') {
    return $Matches[1].Trim()
  }
  return "1.0.0"
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

function Install-BundledNode([string]$TargetNodeDir) {
  Write-Host "==> 准备便携 Node $NodeBundleVersion"
  $name = "node-v$NodeBundleVersion-win-x64"
  $url = "https://nodejs.org/dist/v$NodeBundleVersion/$name.zip"
  $cacheDir = Join-Path $Root "dist\.cache"
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
  $zipFile = Join-Path $cacheDir "$name.zip"
  $fullZip = Join-Path $cacheDir "$name-full.zip"
  $extractDir = Join-Path $cacheDir $name

  try {
    $cachedExe = Join-Path $extractDir "node.exe"
    if (-not (Test-Path $cachedExe)) {
      $sourceZip = $null
      if ((Test-Path $fullZip) -and ((Get-Item $fullZip).Length -gt 20MB)) {
        $sourceZip = $fullZip
        Write-Host "    复用完整缓存：$fullZip"
      } elseif ((Test-Path $zipFile) -and ((Get-Item $zipFile).Length -gt 20MB)) {
        $sourceZip = $zipFile
        Write-Host "    复用缓存：$zipFile"
      } else {
        Write-Host "    $url"
        & curl.exe -fL --retry 3 --retry-all-errors --max-time 600 -o $zipFile $url
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $zipFile) -or ((Get-Item $zipFile).Length -lt 20MB)) {
          throw "便携 Node 下载失败：$url"
        }
        $sourceZip = $zipFile
      }

      if (Test-Path $extractDir) {
        Remove-Item -Recurse -Force $extractDir
      }
      Expand-Archive -Path $sourceZip -DestinationPath $cacheDir -Force
    } else {
      Write-Host "    复用已解压缓存：$cachedExe"
    }

    $nodeExe = Get-ChildItem -Path $extractDir -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if (-not $nodeExe) {
      throw "Node zip 中未找到 node.exe"
    }

    if (Test-Path $TargetNodeDir) {
      Remove-Item -Recurse -Force $TargetNodeDir
    }
    New-Item -ItemType Directory -Path $TargetNodeDir | Out-Null
    Copy-Item -Path $nodeExe.FullName -Destination (Join-Path $TargetNodeDir "node.exe") -Force
    Write-Host "    已安装：$(Join-Path $TargetNodeDir 'node.exe')"
  } catch {
    throw
  }
}

function Install-BundledPhp([string]$TargetPhpDir) {
  Write-Host "==> 下载便携 PHP"
  $tmpRoot = Join-Path $env:TEMP ("ryanmusic-php-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmpRoot | Out-Null
  $zipFile = Join-Path $tmpRoot "php.zip"
  try {
    Write-Host "    $PhpZipUrl"
    & curl.exe -fL --retry 3 --retry-all-errors --max-time 600 -o $zipFile $PhpZipUrl
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $zipFile) -or ((Get-Item $zipFile).Length -lt 1MB)) {
      throw "便携 PHP 下载失败：$PhpZipUrl"
    }
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

function Find-Iscc {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    (Join-Path $env:TEMP "RyanMusic-InnoSetup\ISCC.exe")
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
      return $c
    }
  }
  $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  return $null
}

function Ensure-Iscc {
  $iscc = Find-Iscc
  if ($iscc) {
    return $iscc
  }

  # 优先 winget（稳定，适合本机与 CI）
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host "==> 通过 winget 安装 Inno Setup…"
    try {
      & winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements --disable-interactivity
    } catch {
      Write-Warning "winget 安装 Inno Setup 失败：$($_.Exception.Message)"
    }
    # 刷新 PATH 后再找一次
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
    $iscc = Find-Iscc
    if ($iscc) {
      Write-Host "    ISCC：$iscc"
      return $iscc
    }
  }

  Write-Host "==> 下载 Inno Setup $InnoSetupVersion…"
  $tmpRoot = Join-Path $env:TEMP ("ryanmusic-inno-" + [Guid]::NewGuid().ToString("N"))
  $installer = Join-Path $tmpRoot "innosetup.exe"
  $portableDir = Join-Path $env:TEMP "RyanMusic-InnoSetup"
  New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
  try {
    $downloadUrls = @(
      $InnoSetupUrl,
      "https://ghproxy.net/https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-$InnoSetupVersion.exe"
    )
    $downloaded = $false
    foreach ($url in $downloadUrls) {
      Write-Host "    $url"
      Remove-Item $installer -Force -ErrorAction SilentlyContinue
      & curl.exe -fL --retry 2 --retry-all-errors --max-time 180 -o $installer $url
      if ((Test-Path $installer) -and ((Get-Item $installer).Length -gt 1MB)) {
        $downloaded = $true
        break
      }
    }
    if (-not $downloaded) {
      throw "Inno Setup 下载失败或文件过小：$installer"
    }

    if (Test-Path $portableDir) {
      Remove-Item -Recurse -Force $portableDir
    }
    New-Item -ItemType Directory -Path $portableDir -Force | Out-Null

    $argSets = @(
      @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/PORTABLE=1", "/DIR=$portableDir"),
      @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/DIR=$portableDir")
    )
    $installed = $false
    foreach ($args in $argSets) {
      $p = Start-Process -FilePath $installer -ArgumentList $args -Wait -PassThru
      if ($p.ExitCode -eq 0 -and (Test-Path (Join-Path $portableDir "ISCC.exe"))) {
        $installed = $true
        break
      }
    }
    if (-not $installed) {
      throw "Inno Setup 安装失败"
    }

    $iscc = Find-Iscc
    if (-not $iscc) {
      $fallback = Join-Path $portableDir "ISCC.exe"
      if (Test-Path $fallback) {
        $iscc = $fallback
      }
    }
    if (-not $iscc) {
      throw "Inno Setup 安装后仍未找到 ISCC.exe"
    }
    Write-Host "    ISCC：$iscc"
    return $iscc
  } finally {
    if (Test-Path $tmpRoot) {
      Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
    }
  }
}

function Ensure-ChineseLanguage([string]$IsccPath) {
  $compilerDir = Split-Path $IsccPath -Parent
  $langDir = Join-Path $compilerDir "Languages"
  $langFile = Join-Path $langDir "ChineseSimplified.isl"
  if (Test-Path $langFile) {
    return
  }

  Write-Host "==> 下载简体中文语言包"
  New-Item -ItemType Directory -Path $langDir -Force | Out-Null
  $urls = @(
    "https://raw.githubusercontent.com/jrsoftware/issrc/main/Files/Languages/ChineseSimplified.isl",
    "https://cdn.jsdelivr.net/gh/jrsoftware/issrc@main/Files/Languages/ChineseSimplified.isl",
    "https://raw.githubusercontent.com/kira-96/Inno-Setup-Chinese-Simplified-Translation/main/ChineseSimplified.isl"
  )
  $ok = $false
  foreach ($url in $urls) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $langFile -UseBasicParsing
      if ((Test-Path $langFile) -and ((Get-Item $langFile).Length -gt 200)) {
        $ok = $true
        Write-Host "    已写入：$langFile"
        break
      }
    } catch {
      # try next
    }
  }
  if (-not $ok) {
    Write-Warning "未能下载 ChineseSimplified.isl，安装向导将回退为英文界面"
  }
}

function Build-Installer([string]$Version) {
  if (-not (Test-Path $IssPath)) {
    throw "找不到安装脚本：$IssPath"
  }

  $iscc = Ensure-Iscc
  Ensure-ChineseLanguage $iscc

  if (Test-Path $SetupPath) {
    Remove-Item -Force $SetupPath
  }

  Write-Host "==> 编译安装向导 ($Version)"
  $distForIss = $DistDir
  $outForIss = Split-Path $SetupPath -Parent
  # 部分便携 ISCC 不支持 /D，改为在 windows/ 下生成临时脚本写入 #define
  $tempIss = Join-Path $WinDir ("_build_" + [Guid]::NewGuid().ToString("N") + ".iss")
  $raw = Get-Content -Path $IssPath -Raw -Encoding UTF8
  # 去掉 #ifndef 包装并强制写入版本与路径
  $raw = [regex]::Replace($raw, '(?ms)^#ifndef\s+AppVersion\s*\r?\n\s*#define\s+AppVersion\s+".*?"\s*\r?\n#endif\s*\r?\n?', "")
  $raw = [regex]::Replace($raw, '(?ms)^#ifndef\s+DistDir\s*\r?\n\s*#define\s+DistDir\s+".*?"\s*\r?\n#endif\s*\r?\n?', "")
  $raw = [regex]::Replace($raw, '(?ms)^#ifndef\s+OutputDir\s*\r?\n\s*#define\s+OutputDir\s+".*?"\s*\r?\n#endif\s*\r?\n?', "")
  $header = @"
#define AppVersion "$Version"
#define DistDir "$distForIss"
#define OutputDir "$outForIss"

"@
  Set-Content -Path $tempIss -Value ($header + $raw) -Encoding UTF8
  try {
    Push-Location $WinDir
    & $iscc (Split-Path $tempIss -Leaf)
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) {
      throw "ISCC 编译失败 (exit=$code)"
    }
  } finally {
    Remove-Item -Force $tempIss -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path $SetupPath)) {
    throw "安装包未生成：$SetupPath"
  }
}

$AppVersion = Get-AppVersion

Write-Host "==> 清理旧包"
if (Test-Path $DistDir) {
  Remove-Item -Recurse -Force $DistDir
}
$distParent = Split-Path $DistDir -Parent
if (-not (Test-Path $distParent)) {
  New-Item -ItemType Directory -Path $distParent | Out-Null
}
New-Item -ItemType Directory -Path $DistDir | Out-Null
if ((Test-Path $SetupPath) -and -not $SkipInstaller) {
  Remove-Item -Force $SetupPath
}
if ((Test-Path $ZipPath) -and $AlsoZip) {
  Remove-Item -Force $ZipPath
}

Write-Host "==> 发布自包含可执行文件 (win-x64) v$AppVersion"
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
  /XF .DS_Store Dockerfile docker-compose.yml | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Error "复制站点文件失败 (robocopy=$LASTEXITCODE)"
}
New-Item -ItemType Directory -Force -Path (Join-Path $MusicDst "core\cache") | Out-Null

Write-Host "==> 构建 Node 后端"
$ServerDir = Join-Path $Root "server"
if (-not (Test-Path (Join-Path $ServerDir "package.json"))) {
  Write-Error "找不到 $ServerDir"
}
Push-Location $ServerDir
try {
  if (Test-Path "package-lock.json") { npm ci } else { npm install }
  if ($LASTEXITCODE -ne 0) { throw "npm ci 失败" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "server build 失败" }
} finally {
  Pop-Location
}
$serverJs = Join-Path $ServerDir "dist\server.mjs"
if (-not (Test-Path $serverJs)) {
  Write-Error "未生成 $serverJs"
}
Copy-Item $serverJs (Join-Path $DistDir "server.mjs") -Force

# 复制图标到输出目录（备用）
$icoSrc = Join-Path $WinDir "AppIcon.ico"
if (Test-Path $icoSrc) {
  Copy-Item $icoSrc (Join-Path $DistDir "AppIcon.ico") -Force
}

# 安装包不需要调试符号与 XML 文档
Get-ChildItem -Path $DistDir -Include *.pdb,*.xml -Recurse -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

if ($ShouldBundleNode) {
  Install-BundledNode (Join-Path $DistDir "node")
}

if ($BundlePhp) {
  Install-BundledPhp (Join-Path $DistDir "php")
}

Write-Host "==> 写入使用说明"
$readmeTxt = @"
RyanMusic Windows
=================

安装版：双击 RyanMusic-Setup-x64.exe，按向导完成安装。
本目录为安装包内容（已内嵌 Node 后端；若无 Node 则回退 PHP），也可直接运行 RyanMusic.exe。

系统要求：
- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime（Win10/11 通常自带）
  若启动提示缺少 WebView2：
  https://developer.microsoft.com/microsoft-edge/webview2/

关闭窗口即退出程序并停止本地服务。
"@
Set-Content -Path (Join-Path $DistDir "使用说明.txt") -Value $readmeTxt -Encoding UTF8

if (-not $SkipInstaller) {
  Build-Installer -Version $AppVersion
}

if ($AlsoZip -and -not $SkipZip) {
  Write-Host "==> 额外打包 zip（兼容旧流程）"
  if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
  }
  Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
  Write-Host "已生成：$ZipPath"
}

Write-Host ""
Write-Host "已生成目录：$DistDir"
Write-Host "运行：$DistDir\RyanMusic.exe"
if ((-not $SkipInstaller) -and (Test-Path $SetupPath)) {
  $sizeMb = [math]::Round((Get-Item $SetupPath).Length / 1MB, 1)
  Write-Host "安装包：$SetupPath ($sizeMb MB)"
}
if ($AlsoZip -and (Test-Path $ZipPath)) {
  $sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
  Write-Host "压缩包：$ZipPath ($sizeMb MB)"
}
