# RyanMusic Windows 一键安装脚本
# 用法：
#   irm https://raw.githubusercontent.com/Ryancheese/RyanMusic/main/windows/install.ps1 | iex
# 或在仓库内：
#   powershell -ExecutionPolicy Bypass -File windows/install.ps1

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/Ryancheese/RyanMusic.git"
$AppName = "RyanMusic"
$InstallDir = Join-Path $env:LOCALAPPDATA $AppName
$Desktop = [Environment]::GetFolderPath("Desktop")
$WorkDir = Join-Path $env:TEMP ("ryanmusic-install-" + [Guid]::NewGuid().ToString("N"))

function Write-Green($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Yellow($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Red($msg) { Write-Host $msg -ForegroundColor Red }

function Assert-Windows {
  if ($env:OS -ne "Windows_NT") {
    Write-Red "本安装脚本仅支持 Windows。"
    exit 1
  }
}

function Find-Php {
  $cmd = Get-Command php -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "C:\php\php.exe",
    "C:\Program Files\PHP\php.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\PHP\php.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  return $null
}

function Ensure-Php {
  $php = Find-Php
  if ($php) {
    Write-Green "已检测到 PHP：$php"
    return
  }

  Write-Yellow "未检测到 PHP，尝试通过 winget 安装…"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Red "未找到 winget。请手动安装 PHP：https://windows.php.net/download/"
    Write-Red "或：winget install --id PHP.PHP.8.3 -e"
    exit 1
  }

  winget install --id PHP.PHP.8.3 -e --accept-package-agreements --accept-source-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")

  $php = Find-Php
  if (-not $php) {
    Write-Red "PHP 安装后仍不可用，请重新打开终端后再试。"
    exit 1
  }
  Write-Green "PHP 安装完成：$php"
}

function Ensure-Dotnet {
  if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    Write-Green "已检测到 .NET SDK：$((dotnet --version))"
    return
  }
  Write-Yellow "未检测到 .NET SDK，尝试通过 winget 安装…"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Red "请安装 .NET 8 SDK：https://dotnet.microsoft.com/download"
    exit 1
  }
  winget install --id Microsoft.DotNet.SDK.8 -e --accept-package-agreements --accept-source-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Red ".NET SDK 安装后仍不可用，请重新打开终端后再试。"
    exit 1
  }
  Write-Green ".NET SDK 安装完成：$((dotnet --version))"
}

function Resolve-RepoRoot {
  $here = $PSScriptRoot
  if ($here) {
    $candidate = Resolve-Path (Join-Path $here "..") -ErrorAction SilentlyContinue
    if ($candidate -and (Test-Path (Join-Path $candidate "maicong-music\index.php")) -and (Test-Path (Join-Path $candidate "windows\build-app.ps1"))) {
      return $candidate.Path
    }
  }
  return $null
}

function Fetch-Repo {
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "==> 克隆仓库"
    git clone --depth 1 --branch main $RepoUrl (Join-Path $WorkDir "RyanMusic")
  } else {
    Write-Host "==> 下载仓库 zip"
    $zip = Join-Path $WorkDir "repo.zip"
    Invoke-WebRequest -Uri "https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $WorkDir -Force
    Rename-Item (Join-Path $WorkDir "RyanMusic-main") (Join-Path $WorkDir "RyanMusic")
  }
  return (Join-Path $WorkDir "RyanMusic")
}

function Build-And-Install([string]$root) {
  $build = Join-Path $root "windows\build-app.ps1"
  Write-Host "==> 打包 App"
  powershell -ExecutionPolicy Bypass -File $build

  $built = Join-Path $root "dist\RyanMusic-win"
  if (-not (Test-Path (Join-Path $built "RyanMusic.exe"))) {
    Write-Red "打包失败：未找到 RyanMusic.exe"
    exit 1
  }

  Write-Host "==> 安装到 $InstallDir"
  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  robocopy $built $InstallDir /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) {
    Write-Red "安装复制失败"
    exit 1
  }

  $exe = Join-Path $InstallDir "RyanMusic.exe"
  $shortcutPath = Join-Path $Desktop "$AppName.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($shortcutPath)
  $sc.TargetPath = $exe
  $sc.WorkingDirectory = $InstallDir
  $sc.Description = "RyanMusic"
  $sc.Save()

  Write-Green "安装完成：$exe"
  Write-Green "桌面快捷方式：$shortcutPath"
}

try {
  Assert-Windows
  Ensure-Php
  Ensure-Dotnet

  $root = Resolve-RepoRoot
  if ($root) {
    Write-Yellow "使用本地仓库：$root"
  } else {
    $root = Fetch-Repo
  }

  Build-And-Install $root

  Write-Host ""
  Write-Yellow "若被 SmartScreen 拦截：更多信息 → 仍要运行。"
  Write-Host ""

  $exe = Join-Path $InstallDir "RyanMusic.exe"
  Start-Process $exe
}
finally {
  if (Test-Path $WorkDir) {
    Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
  }
}
