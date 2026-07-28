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
  if (-not $php) {
    Write-Yellow "未检测到 PHP，尝试通过 winget 安装…"
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Write-Red "未找到 winget。请手动安装 PHP：https://windows.php.net/download/"
      Write-Red "或：winget install --id PHP.PHP.8.3 -e"
      exit 1
    }

    winget install --id PHP.PHP.8.3 -e --accept-package-agreements --accept-source-agreements
    Refresh-Path

    $php = Find-Php
    if (-not $php) {
      Write-Red "PHP 安装后仍不可用，请重新打开终端后再试。"
      exit 1
    }
    Write-Green "PHP 安装完成：$php"
  } else {
    Write-Green "已检测到 PHP：$php"
  }

  Enable-PhpExtensions $php
}

function Enable-PhpExtensions([string]$phpExe) {
  $phpDir = Split-Path $phpExe -Parent
  $extDir = Join-Path $phpDir "ext"
  $iniPath = Join-Path $phpDir "php.ini"

  if (-not (Test-Path $iniPath)) {
    $candidates = @(
      (Join-Path $phpDir "php.ini-development"),
      (Join-Path $phpDir "php.ini-production")
    )
    foreach ($c in $candidates) {
      if (Test-Path $c) {
        Copy-Item $c $iniPath -Force
        Write-Yellow "已生成 php.ini（来自 $(Split-Path $c -Leaf)）"
        break
      }
    }
  }

  if (-not (Test-Path $iniPath)) {
    Write-Yellow "未找到 php.ini，将在启动参数中强制加载扩展。"
  } else {
    $ini = Get-Content $iniPath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $ini) { $ini = "" }
    # 去掉可能存在的 UTF-8 BOM，避免 PHP 解析异常
    if ($ini.Length -gt 0 -and [int][char]$ini[0] -eq 0xFEFF) {
      $ini = $ini.Substring(1)
    }

    # extension_dir
    if ($ini -notmatch '(?m)^\s*extension_dir\s*=') {
      $ini = "extension_dir=`"ext`"`r`n" + $ini
    } else {
      $ini = [regex]::Replace($ini, '(?m)^\s*;?\s*extension_dir\s*=.*$', 'extension_dir="ext"')
    }

    foreach ($ext in @('curl', 'openssl', 'mbstring', 'fileinfo')) {
      # 清掉重复项（含 php_xxx.dll / 注释行），再写唯一启用行
      $ini = [regex]::Replace($ini, "(?m)^\s*;?\s*extension\s*=\s*(php_)?$ext(\.dll)?\s*.*\r?\n?", "")
      $ini = $ini.TrimEnd() + "`r`nextension=$ext`r`n"
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($iniPath, $ini, $utf8NoBom)
  }

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $mods = (& $phpExe -m 2>&1 | ForEach-Object { "$_" }) -join "`n"
  $ErrorActionPreference = $prevEap
  if ($mods -match '(?im)^\s*curl\s*$') {
    Write-Green "PHP curl 扩展已启用"
  } else {
    Write-Yellow "php.ini 已尝试启用 curl，若仍失败请重启终端后再装一次。"
  }
}

function Refresh-Path {
  $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $extra = @(
    "${env:ProgramFiles}\dotnet",
    "${env:ProgramFiles(x86)}\dotnet",
    "$env:USERPROFILE\.dotnet\tools",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links"
  ) | Where-Object { $_ -and (Test-Path $_) }
  $env:Path = (@($machine, $user) + $extra) -join ";"
}

function Test-DotnetSdk {
  Refresh-Path
  $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
  if (-not $dotnet) { return $false }
  try {
    $sdks = & dotnet --list-sdks 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    if (-not $sdks) { return $false }
    # 至少有一个 SDK 行，形如：8.0.423 [C:\Program Files\dotnet\sdk\...]
    return ($sdks | Where-Object { $_ -match '^\d+\.\d+\.\d+' }).Count -gt 0
  } catch {
    return $false
  }
}

function Get-DotnetSdkVersion {
  $sdks = & dotnet --list-sdks 2>$null
  if (-not $sdks) { return $null }
  $first = ($sdks | Where-Object { $_ -match '^\d+\.\d+\.\d+' } | Select-Object -First 1)
  if ($first -match '^(\d+\.\d+\.\d+)') { return $Matches[1] }
  return $null
}

function Ensure-Dotnet {
  Refresh-Path
  if (Test-DotnetSdk) {
    Write-Green "已检测到 .NET SDK：$(Get-DotnetSdkVersion)"
    return
  }

  Write-Yellow "未检测到 .NET SDK（仅有 runtime 不够），尝试通过 winget 安装…"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Red "请安装 .NET 8 SDK：https://dotnet.microsoft.com/download"
    Write-Red "或：winget install --id Microsoft.DotNet.SDK.8 -e"
    exit 1
  }

  winget install --id Microsoft.DotNet.SDK.8 -e --accept-package-agreements --accept-source-agreements
  Refresh-Path

  # winget 装完后有时 PATH 还没刷到，主动探测常见路径
  $dotnetCandidates = @(
    "${env:ProgramFiles}\dotnet\dotnet.exe",
    "${env:ProgramFiles(x86)}\dotnet\dotnet.exe"
  )
  foreach ($c in $dotnetCandidates) {
    if (Test-Path $c) {
      $env:Path = (Split-Path $c -Parent) + ";" + $env:Path
      break
    }
  }

  if (-not (Test-DotnetSdk)) {
    Write-Red ".NET SDK 安装后仍不可用。"
    Write-Yellow "请关闭终端，重新打开 PowerShell 后再执行安装命令。"
    Write-Yellow "也可手动确认：dotnet --list-sdks"
    exit 1
  }
  Write-Green ".NET SDK 安装完成：$(Get-DotnetSdkVersion)"
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

function Download-File([string]$Uri, [string]$OutFile) {
  # 优先 curl.exe（常比 Invoke-WebRequest 稳），失败再回退
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe -L --retry 3 --connect-timeout 20 --max-time 300 -o $OutFile $Uri
    if ($LASTEXITCODE -eq 0 -and (Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 1000)) {
      return $true
    }
  }
  try {
    Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 300
    return ((Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 1000))
  } catch {
    return $false
  }
}

function Expand-RepoZip([string]$ZipPath) {
  Expand-Archive -Path $ZipPath -DestinationPath $WorkDir -Force
  $extracted = Get-ChildItem $WorkDir -Directory | Where-Object { $_.Name -like "RyanMusic*" } | Select-Object -First 1
  if (-not $extracted) {
    throw "解压后未找到 RyanMusic 目录"
  }
  $target = Join-Path $WorkDir "RyanMusic"
  if ($extracted.FullName -ne $target) {
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Rename-Item $extracted.FullName $target
  }
  return $target
}

function Fetch-Repo {
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  $dest = Join-Path $WorkDir "RyanMusic"
  $zip = Join-Path $WorkDir "repo.zip"

  $gitUrls = @(
    $RepoUrl,
    "https://ghproxy.net/https://github.com/Ryancheese/RyanMusic.git",
    "https://mirror.ghproxy.com/https://github.com/Ryancheese/RyanMusic.git"
  )
  $zipUrls = @(
    "https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip",
    "https://ghproxy.net/https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip",
    "https://mirror.ghproxy.com/https://github.com/Ryancheese/RyanMusic/archive/refs/heads/main.zip",
    "https://codeload.github.com/Ryancheese/RyanMusic/zip/refs/heads/main"
  )

  if (Get-Command git -ErrorAction SilentlyContinue) {
    foreach ($url in $gitUrls) {
      Write-Host "==> 尝试克隆：$url"
      if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
      & git clone --depth 1 --branch main $url $dest
      if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $dest "windows\build-app.ps1"))) {
        Write-Green "仓库克隆成功"
        return $dest
      }
      Write-Yellow "克隆失败，尝试下一个源…"
    }
  }

  foreach ($url in $zipUrls) {
    Write-Host "==> 尝试下载 zip：$url"
    if (Test-Path $zip) { Remove-Item -Force $zip }
    if (Download-File $url $zip) {
      try {
        $path = Expand-RepoZip $zip
        if (Test-Path (Join-Path $path "windows\build-app.ps1")) {
          Write-Green "仓库下载成功"
          return $path
        }
      } catch {
        Write-Yellow "解压失败：$($_.Exception.Message)"
      }
    } else {
      Write-Yellow "下载失败，尝试下一个源…"
    }
  }

  Write-Red "无法从 GitHub 获取源码（SSL/网络问题）。"
  Write-Yellow "请换网络/开代理后重试，或手动执行："
  Write-Host "  git clone --depth 1 https://github.com/Ryancheese/RyanMusic.git"
  Write-Host "  cd RyanMusic"
  Write-Host "  powershell -ExecutionPolicy Bypass -File windows\install.ps1"
  exit 1
}

function Stop-RunningApp {
  Write-Host "==> 结束正在运行的 RyanMusic（避免占用安装目录）"
  $names = @("RyanMusic")
  foreach ($n in $names) {
    Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        Write-Yellow "结束进程：$($_.ProcessName) (PID $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction Stop
      } catch {
        Write-Yellow "无法结束 $($_.Id)：$($_.Exception.Message)"
      }
    }
  }

  # 结束占用安装目录的内嵌 PHP（命令行含 InstallDir）
  try {
    $installLower = $InstallDir.ToLowerInvariant()
    Get-CimInstance Win32_Process -Filter "Name='php.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
      $cmd = $_.CommandLine
      if (-not $cmd) { return }
      $cmdLower = $cmd.ToLowerInvariant()
      if ($cmdLower.Contains($installLower) -or $cmdLower.Contains('ryanmusic\maicong-music')) {
        try {
          Write-Yellow "结束 PHP (PID $($_.ProcessId))"
          Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
        } catch { }
      }
    }
  } catch { }

  Start-Sleep -Seconds 1
}

function Clear-InstallDir {
  if (-not (Test-Path $InstallDir)) { return }

  for ($i = 1; $i -le 5; $i++) {
    try {
      Remove-Item -Recurse -Force $InstallDir -ErrorAction Stop
      if (-not (Test-Path $InstallDir)) { return }
    } catch {
      Write-Yellow "清理安装目录失败（第 $i 次）：$($_.Exception.Message)"
      Stop-RunningApp
      Start-Sleep -Seconds 1
    }
  }

  # 删不干净时改为清空内容，尽量继续覆盖安装
  try {
    Get-ChildItem -LiteralPath $InstallDir -Force -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch { }

  if (Test-Path (Join-Path $InstallDir "RyanMusic.exe")) {
    Write-Red "安装目录仍被占用：$InstallDir"
    Write-Red "请先完全退出 RyanMusic（任务栏/托盘也关掉），再重新运行安装命令。"
    Write-Yellow "或任务管理器结束 RyanMusic.exe / php.exe 后重试。"
    exit 1
  }
}

function Build-And-Install([string]$root) {
  $build = Join-Path $root "windows\build-app.ps1"
  if (-not (Test-Path $build)) {
    Write-Red "找不到打包脚本：$build"
    exit 1
  }
  Write-Host "==> 打包 App"
  powershell -ExecutionPolicy Bypass -File $build
  if ($LASTEXITCODE -ne 0) {
    Write-Red "打包脚本执行失败"
    exit 1
  }

  $built = Join-Path $root "dist\RyanMusic-win"
  if (-not (Test-Path (Join-Path $built "RyanMusic.exe"))) {
    Write-Red "打包失败：未找到 RyanMusic.exe"
    exit 1
  }

  Write-Host "==> 安装到 $InstallDir"
  Stop-RunningApp
  Clear-InstallDir
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
